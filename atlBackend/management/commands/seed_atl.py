from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from atlBackend.models import (
    AcademicPeriod,
    ATLSubskill,
    ContextATLMapping,
    ContextRubricItem,
    LearningContext,
    SchoolClass,
    Student,
    Subject,
    Topic,
    UserProfile,
)
from atlBackend.seed_data import EXTRA_TOPICS, TOPIC_RUBRICS, USER_SEEDS
from atlBackend.services.catalog import STUDENTS, SUBJECTS
from atlBackend.services.contextual_atl import (
    ensure_contextual_seed,
    normalize_rubric_subskills,
    reset_pairwise_scale_options,
    sync_rubric_item_subskills,
)


def split_name(full_name):
    parts = full_name.split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


class Command(BaseCommand):
    help = "Seed the ATL SQLite database with classes, students, users, topics, ATL hierarchy, and rubric data."

    @transaction.atomic
    def handle(self, *args, **options):
        period, _ = AcademicPeriod.objects.update_or_create(
            name="Semester 2 (2024/2025)",
            defaults={"academic_year": "2024/2025", "semester": "Semester 2", "is_active": True},
        )
        AcademicPeriod.objects.exclude(id=period.id).update(is_active=False)

        classes = self.seed_classes_and_students()
        subjects = self.seed_subjects_and_topics()
        ensure_contextual_seed()
        self.seed_extra_contexts(subjects)
        self.seed_users(classes, subjects)
        self.seed_rubrics()
        self.reset_pairwise_scales()

        self.stdout.write(self.style.SUCCESS("ATL seed complete."))

    def seed_classes_and_students(self):
        classes = {}
        for class_display, students in STUDENTS.items():
            code = class_display.split(" - ")[0].strip()
            school_class, _ = SchoolClass.objects.update_or_create(
                code=code,
                defaults={
                    "display_name": class_display,
                    "level": class_display.split(" - ")[1].strip() if " - " in class_display else "",
                    "is_active": True,
                },
            )
            classes[code] = school_class
            classes[class_display] = school_class

            for student_data in students:
                Student.objects.update_or_create(
                    nis=student_data["nis"],
                    defaults={
                        "full_name": student_data["name"].strip(),
                        "school_class": school_class,
                        "avatar_tone": student_data.get("avatarTone", ""),
                        "baseline_overall": student_data.get("overall", ""),
                        "baseline_strength": student_data.get("strength", ""),
                        "baseline_strength_value": student_data.get("strengthValue", ""),
                        "baseline_focus": student_data.get("focus", ""),
                        "baseline_trend_value": student_data.get("trendValue", ""),
                        "is_active": True,
                    },
                )
        return classes

    def seed_subjects_and_topics(self):
        subjects = {}
        for subject_index, subject_data in enumerate(SUBJECTS):
            subject, _ = Subject.objects.update_or_create(
                code=subject_data["id"],
                defaults={"label": subject_data["label"]},
            )
            subjects[subject.code] = subject
            topic_rows = list(subject_data["topics"]) + EXTRA_TOPICS.get(subject.code, [])
            for topic_index, topic_data in enumerate(topic_rows):
                Topic.objects.update_or_create(
                    code=topic_data["id"],
                    defaults={
                        "subject": subject,
                        "label": topic_data["label"],
                        "description": topic_data.get("description", ""),
                        "order": subject_index * 100 + topic_index,
                    },
                )
        return subjects

    def seed_extra_contexts(self, subjects):
        for subject_code, topics in EXTRA_TOPICS.items():
            subject = subjects.get(subject_code)
            if not subject:
                continue
            for topic_data in topics:
                LearningContext.objects.update_or_create(
                    legacy_topic_code=topic_data["id"],
                    defaults={
                        "grade": "Grade 3",
                        "subject_name": subject.label,
                        "unit_name": topic_data["label"],
                        "description": topic_data.get("description", ""),
                    },
                )

    def seed_users(self, classes, subjects):
        for user_data in USER_SEEDS:
            first_name, last_name = split_name(user_data["name"])
            user, created = User.objects.update_or_create(
                username=user_data["username"],
                defaults={
                    "email": user_data.get("email", ""),
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_staff": user_data.get("isStaff", False),
                    "is_superuser": user_data.get("isSuperuser", False),
                    "is_active": user_data.get("status", "Aktif") == "Aktif",
                },
            )
            if user_data.get("password"):
                user.set_password(user_data["password"])
                user.save(update_fields=["password"])

            profile, _ = UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "nip": user_data.get("nip", ""),
                    "role_label": user_data["roleLabel"],
                    "role_group": user_data["roleGroup"],
                    "status": user_data.get("status", "Aktif"),
                    "last_login_label": user_data.get("lastLogin", "-"),
                },
            )
            profile.class_access.set(
                [classes[item] for item in user_data.get("classAccess", []) if item in classes]
            )
            profile.subject_access.set(
                [subjects[item] for item in user_data.get("subjectAccess", []) if item in subjects]
            )

    def seed_rubrics(self):
        subskills = {
            subskill.name: subskill
            for subskill in ATLSubskill.objects.select_related("category").all()
        }
        for topic_code, rubric_rows in TOPIC_RUBRICS.items():
            try:
                topic = Topic.objects.select_related("subject").get(code=topic_code)
            except Topic.DoesNotExist:
                continue
            context, _ = LearningContext.objects.update_or_create(
                legacy_topic_code=topic.code,
                defaults={
                    "grade": "Grade 3",
                    "subject_name": topic.subject.label,
                    "unit_name": "Christmas Carol Choir" if topic.code == "singing_christmas_carol" else topic.label,
                    "description": topic.description,
                },
            )
            for order, rubric in enumerate(rubric_rows):
                selected = [subskills[name] for name in rubric["subskills"] if name in subskills]
                if not selected:
                    selected = [
                        item for item in subskills.values()
                        if item.category.name in rubric.get("categories", [])
                    ][:1]
                selected = normalize_rubric_subskills(selected)
                if not selected:
                    continue

                for subskill_order, subskill in enumerate(selected):
                    ContextATLMapping.objects.update_or_create(
                        context=context,
                        subskill=subskill,
                        defaults={"order": order * 20 + subskill_order, "is_active": True},
                    )

                item, _ = ContextRubricItem.objects.update_or_create(
                    context=context,
                    title=rubric["title"],
                    defaults={
                        "subskill": selected[0],
                        "criteria_topic": rubric.get("topic", ""),
                        "level_descriptors": rubric.get("levels", {}),
                        "order": order,
                    },
                )
                sync_rubric_item_subskills(item, selected)

    def reset_pairwise_scales(self):
        for context in LearningContext.objects.all():
            reset_pairwise_scale_options(context)
