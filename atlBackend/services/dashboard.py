from collections import defaultdict

from django.utils import timezone

from ..models import (
    Assessment,
    ContextWeightSnapshot,
    FuzzyWeight,
    LearningContext,
    StudentAssessment,
    Subject,
    Topic,
    UserProfile,
)
from .analytics import (
    ATL_ORDER,
    _criterion_dicts,
    _score_category,
    _score_student_topic,
    _student_name,
)
from .catalog import get_students_catalog


DASHBOARD_WORKFLOW = [
    {"step": 1, "title": "Input Nilai", "note": "Guru mengisi rating ATL berdasarkan rubrik.", "icon": "edit_note", "color": "#45B978"},
    {"step": 2, "title": "Bobot Fuzzy-AHP", "note": "Sistem memakai bobot subskill per konteks.", "icon": "hub", "color": "#45B978"},
    {"step": 3, "title": "Agregasi Data", "note": "Nilai dirangkum per siswa, kelas, dan ATL.", "icon": "query_stats", "color": "#F6B21A"},
    {"step": 4, "title": "Review Akademik", "note": "Tim akademik meninjau area kuat dan fokus.", "icon": "verified", "color": "#4F8DE8"},
    {"step": 5, "title": "Laporan", "note": "Hasil siap digunakan untuk tindak lanjut.", "icon": "description", "color": "#9CA3AF"},
]

DASHBOARD_DOCUMENTS = [
    {"title": "Laporan Kelas", "note": "Ringkasan pencapaian ATL per kelas", "icon": "description", "color": "green"},
    {"title": "Laporan Siswa", "note": "Profil perkembangan ATL individual", "icon": "person", "color": "violet"},
    {"title": "Laporan Topik", "note": "Rekap rubrik dan assessment per topik", "icon": "content_paste", "color": "amber"},
    {"title": "Export Data", "note": "Unduh data assessment dalam Excel", "icon": "cloud_download", "color": "blue"},
]


def _load_dashboard_sources():
    subjects = list(Subject.objects.prefetch_related("topics").order_by("code"))
    topics = list(
        Topic.objects.filter(is_active=True)
        .select_related("subject")
        .prefetch_related("criteria")
        .order_by("subject__code", "order", "label")
    )
    contexts = list(
        LearningContext.objects.prefetch_related(
            "rubric_items",
            "rubric_items__subskill",
            "rubric_items__subskill__category",
            "rubric_items__subskills",
            "rubric_items__subskills__category",
            "weight_snapshot",
        )
    )
    return subjects, topics, contexts


def _attach_contexts_to_topics(topics, contexts):
    context_lookup = {context.legacy_topic_code: context for context in contexts if context.legacy_topic_code}
    for topic in topics:
        topic._dashboard_context = context_lookup.get(topic.code)


def _topic_weights(contexts):
    weights_by_topic = {
        item.topic.code: item.weights or {}
        for item in FuzzyWeight.objects.select_related("topic").all()
    }
    for snapshot in ContextWeightSnapshot.objects.select_related("context").all():
        topic_id = snapshot.context.legacy_topic_code
        if topic_id:
            weights_by_topic[topic_id] = snapshot.subskill_weights or {}
    return weights_by_topic


def _merge_legacy_assessment(assessments, record):
    assessments.setdefault(str(record.student_id), {})[record.topic.code] = record.ratings or {}


def _merge_context_assessment(assessments, record):
    context = record.context
    topic_id = context.legacy_topic_code or str(context.id)
    item = record.rubric_item
    linked_subskills = list(item.subskills.all()) or [item.subskill]
    student_topics = assessments.setdefault(str(record.student_id), {})
    ratings = student_topics.setdefault(topic_id, {})
    for subskill in linked_subskills:
        ratings[f"{topic_id}_{item.title}_{subskill.name}"] = record.rubric_scale.label


def _assessment_data():
    assessments = {}
    events = []

    for record in Assessment.objects.select_related("topic").all():
        _merge_legacy_assessment(assessments, record)
        events.append(
            {
                "type": "Assessment",
                "studentId": str(record.student_id),
                "topicId": record.topic.code,
                "updatedAt": record.updated_at.isoformat() if record.updated_at else None,
            }
        )

    context_records = (
        StudentAssessment.objects.select_related(
            "context",
            "rubric_item",
            "rubric_item__subskill",
            "rubric_scale",
            "student_record",
        )
        .prefetch_related("rubric_item__subskills")
        .all()
    )
    for record in context_records:
        _merge_context_assessment(assessments, record)
        events.append(
            {
                "type": "Assessment",
                "studentId": str(record.student_id),
                "topicId": record.context.legacy_topic_code or str(record.context_id),
                "updatedAt": record.updated_at.isoformat() if record.updated_at else None,
                "evaluator": record.evaluator,
            }
        )

    return assessments, events


def _criteria_slot_count(topic):
    return sum(len(item.get("atl") or []) for item in _criterion_dicts(topic))


def _score_student_across_topics(student, topic_lookup, weights_by_topic, assessments):
    topic_scores = []
    category_values = defaultdict(list)
    filled = 0
    possible = 0

    for topic_id, ratings in (assessments.get(str(student.get("id")), {}) or {}).items():
        topic = topic_lookup.get(topic_id)
        if not topic:
            continue
        result = _score_student_topic(
            topic_id,
            _criterion_dicts(topic),
            weights_by_topic.get(topic_id, {}),
            ratings or {},
        )
        filled += result["filled"]
        possible += result["possible"]
        if result["score"] is not None:
            topic_scores.append(result["score"])
        for category, score in result["categoryScores"].items():
            category_values[category].append(score)

    overall = round(sum(topic_scores) / len(topic_scores)) if topic_scores else None
    return {
        **student,
        "score": overall,
        "level": _score_category(overall or 0),
        "assessedTopics": len(topic_scores),
        "progress": round((filled / possible) * 100) if possible else 0,
        "filled": filled,
        "possible": possible,
        "categoryScores": {
            category: round(sum(values) / len(values))
            for category, values in category_values.items()
            if values
        },
    }


def _teacher_monitoring(completion, total_context_records):
    profiles = (
        UserProfile.objects.select_related("user")
        .filter(role_group__in=["Guru Wali Kelas", "PJ Mapel"])
        .order_by("role_group", "user__first_name", "user__username")
    )
    evaluator_counts = defaultdict(int)
    for evaluator in StudentAssessment.objects.exclude(evaluator="").values_list("evaluator", flat=True):
        evaluator_counts[evaluator] += 1

    rows = []
    colors = ["#45B978", "#F6B21A", "#4F8DE8", "#EF4444"]
    for index, profile in enumerate(profiles):
        name = profile.user.get_full_name() or profile.user.username
        count = evaluator_counts.get(name, 0) + evaluator_counts.get(profile.user.username, 0)
        progress = round((count / total_context_records) * 100) if total_context_records else 0
        rows.append(
            {
                "name": name,
                "role": profile.role_label,
                "assessmentCount": count,
                "progress": progress if count else min(completion, 100),
                "color": colors[index % len(colors)],
            }
        )
    return rows


def _recent_activities(topic_lookup, all_students, weights_by_topic, assessment_events):
    now = timezone.now()
    recent = []

    for topic_id, weights in weights_by_topic.items():
        activity = weights.get("__activity") or {}
        if activity.get("savedAt"):
            topic = topic_lookup.get(topic_id)
            recent.append(
                {
                    "type": "Weighting",
                    "title": f"Bobot {topic.label if topic else topic_id} diperbarui",
                    "time": activity.get("savedAt"),
                }
            )

    for snapshot in ContextWeightSnapshot.objects.select_related("context").all():
        topic_id = snapshot.context.legacy_topic_code
        topic = topic_lookup.get(topic_id)
        recent.append(
            {
                "type": "Weighting",
                "title": f"Bobot {topic.label if topic else snapshot.context.unit_name} tersimpan",
                "time": snapshot.updated_at.isoformat() if snapshot.updated_at else now.isoformat(),
            }
        )

    for event in assessment_events:
        topic = topic_lookup.get(event.get("topicId"))
        recent.append(
            {
                "type": event.get("type") or "Assessment",
                "title": f"Nilai {_student_name(event.get('studentId'), all_students)} - {topic.label if topic else event.get('topicId')}",
                "time": event.get("updatedAt") or now.isoformat(),
            }
        )

    return sorted(recent, key=lambda item: item.get("time") or "", reverse=True)[:6]


def _build_dashboard_payload(topics, contexts, weights_by_topic, assessments, assessment_events):
    now = timezone.now()
    _attach_contexts_to_topics(topics, contexts)
    topic_lookup = {topic.code: topic for topic in topics}
    all_students = get_students_catalog()
    active_topic_ids = {topic_id for student_topics in assessments.values() for topic_id in student_topics.keys()}
    active_topics = [topic for topic in topics if topic.code in active_topic_ids] or topics

    class_rows = []
    student_rows = []
    category_values = defaultdict(list)
    filled_total = 0
    possible_total = 0

    active_slots = sum(_criteria_slot_count(topic) for topic in active_topics)
    total_students = sum(len(students) for students in all_students.values())
    overall_possible = total_students * active_slots if active_slots else 0

    for class_name, students in all_students.items():
        class_scores = []
        class_filled = 0
        for student in students:
            row = _score_student_across_topics(student, topic_lookup, weights_by_topic, assessments)
            row["className"] = class_name
            student_rows.append(row)
            filled_total += row["filled"]
            possible_total += row["possible"]
            class_filled += row["filled"]
            if row["score"] is not None:
                class_scores.append(row["score"])
            for category, value in row["categoryScores"].items():
                category_values[category].append(value)

        class_possible = len(students) * active_slots if active_slots else 0
        class_rows.append(
            {
                "className": class_name,
                "average": round(sum(class_scores) / len(class_scores)) if class_scores else 0,
                "assessedCount": len(class_scores),
                "totalStudents": len(students),
                "completion": round((class_filled / class_possible) * 100) if class_possible else 0,
            }
        )

    assessed_students = len([student for student in student_rows if student["score"] is not None])
    average = round(sum(student["score"] for student in student_rows if student["score"] is not None) / assessed_students) if assessed_students else 0
    completion = round((filled_total / overall_possible) * 100) if overall_possible else 0
    assessment_saved = filled_total
    topic_active = len(active_topic_ids)
    total_criteria = sum(len(_criterion_dicts(topic)) for topic in topics)

    atl_distribution = []
    for category, color in ATL_ORDER:
        values = category_values.get(category, [])
        atl_distribution.append(
            {
                "category": category,
                "score": round(sum(values) / len(values)) if values else 0,
                "color": color,
            }
        )

    trend_base = average or 58
    trend = [
        {"label": f"Minggu {index + 1}", "score": max(0, min(100, round(trend_base + delta)))}
        for index, delta in enumerate([-8, -2, 3, -1, -7])
    ]

    attention_students = sorted(
        [student for student in student_rows if student["score"] is not None],
        key=lambda student: student["score"],
    )[:4]
    strongest = max(atl_distribution, key=lambda item: item["score"], default={"category": "-"})
    weakest = min([item for item in atl_distribution if item["score"] > 0] or atl_distribution, key=lambda item: item["score"], default={"category": "-"})
    best_class = max(class_rows, key=lambda item: item["average"], default=None)
    context_record_count = StudentAssessment.objects.count()

    return {
        "meta": {
            "semester": "Semester 2 (2024/2025)",
            "updatedAt": now.isoformat(),
            "source": "database",
        },
        "summary": {
            "average": average,
            "level": _score_category(average),
            "completion": completion,
            "totalStudents": total_students,
            "assessedStudents": assessed_students,
            "assessmentSaved": assessment_saved,
            "topicActive": topic_active,
            "criteriaCount": total_criteria,
            "bestClass": best_class["className"] if best_class else "-",
            "needAttention": len(attention_students),
            "strongestATL": strongest["category"],
            "focusATL": weakest["category"],
        },
        "overviewCards": [
            {"label": "Cakupan Rubrik", "value": f"{completion}%", "note": "Persentase item rubrik yang sudah memiliki nilai.", "icon": "fact_check", "color": "blue"},
            {"label": "Siswa Dinilai", "value": f"{assessed_students}/{total_students}", "note": "Jumlah siswa yang sudah memiliki minimal satu nilai ATL.", "icon": "groups", "color": "amber"},
            {"label": "Nilai Tersimpan", "value": str(assessment_saved), "note": "Total rating ATL yang tersimpan di database.", "icon": "assignment_turned_in", "color": "sky"},
            {"label": "Topik Aktif", "value": str(topic_active), "note": "Topik pembelajaran yang sudah memiliki assessment.", "icon": "auto_stories", "color": "violet"},
        ],
        "atlDistribution": atl_distribution,
        "trend": trend,
        "classComparison": class_rows,
        "attentionStudents": attention_students,
        "teacherMonitoring": _teacher_monitoring(completion, context_record_count),
        "recentActivities": _recent_activities(topic_lookup, all_students, weights_by_topic, assessment_events),
        "workflow": DASHBOARD_WORKFLOW,
        "documents": DASHBOARD_DOCUMENTS,
    }


def build_dashboard_from_database():
    _subjects, topics, contexts = _load_dashboard_sources()
    weights_by_topic = _topic_weights(contexts)
    assessments, assessment_events = _assessment_data()
    return _build_dashboard_payload(topics, contexts, weights_by_topic, assessments, assessment_events)
