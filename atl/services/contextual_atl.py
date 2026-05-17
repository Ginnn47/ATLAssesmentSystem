from itertools import combinations

from django.core.exceptions import ObjectDoesNotExist
from django.db import OperationalError

from ..models import (
    ATLCategory,
    ATLSubskill,
    Assessment,
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    LearningContext,
    PairwiseComparison,
    RubricScale,
    StudentAssessment,
)
from .catalog import STUDENTS, SUBJECTS
from .fuzzy_ahp import calculate_fuzzy_ahp


ATL_HIERARCHY = [
    {
        "name": "Thinking Skills",
        "subskills": [
            "Critical Thingking",
            "Creative Thingking",
            "InformationTransfer",
            "Reflection / Metacognitive",
        ],
    },
    {
        "name": "Research Skills",
        "subskills": [
            "Textual Literacy",
            "Media Literacy",
            "Ethical use of information",
        ],
    },
    {
        "name": "Communication Skills",
        "subskills": [
            "Exchanging-information",
            "Literacy skills",
            "ICT skills",
        ],
    },
    {
        "name": "Social Skills",
        "subskills": [
            "Interpersonal relationships",
            "Social-emotional intelligence",
        ],
    },
    {
        "name": "Self-Management Skills",
        "subskills": [
            "Organization skills",
            "State of Mind",
        ],
    },
]

RUBRIC_SCALES = [
    ("EE", "Exceeding Expectation", 0.8, 0.9, 1.0),
    ("ME", "Meeting Expectation", 0.6, 0.7, 0.8),
    ("DE", "Developing Expectation", 0.4, 0.5, 0.6),
    ("PTE", "Progressing Toward Expectation", 0.2, 0.3, 0.4),
    ("NFI", "Need Further Improvement", 0.0, 0.1, 0.2),
]

DEFAULT_LEVELS = {
    "NFI": "Belum menunjukkan perilaku atau keterampilan yang dinilai.",
    "PTE": "Mulai mencoba, tetapi masih membutuhkan arahan intensif.",
    "DE": "Menunjukkan perkembangan dengan beberapa dukungan guru.",
    "ME": "Memenuhi ekspektasi secara konsisten dalam konteks pembelajaran.",
    "EE": "Melampaui ekspektasi dan memberi dampak positif pada proses belajar.",
}

CHOIR_RUBRIC_ITEMS = [
    {
        "topic": "Creating",
        "title": "Role Play & Musical Contribution",
        "categories": ["Thinking Skills", "Communication Skills"],
        "subskills": [
            "Interpersonal relationships",
            "Exchanging-information",
            "Organization skills",
            "Reflection / Metacognitive",
        ],
        "levels": {
            "NFI": "Fails to participate in the assigned part.",
            "PTE": "Significantly struggles with assigned role; negatively impacts the group.",
            "DE": "Tries to fulfill role; struggles with technical requirements.",
            "ME": "Executes assigned role effectively; contributes reliably to the music.",
            "EE": "Skillfully executes role; demonstrates high technical command.",
        },
    },
    {
        "topic": "Creating",
        "title": "Rhythm & Tempo Accuracy",
        "categories": ["Thinking Skills", "Self-Management Skills"],
        "subskills": [
            "State of Mind",
            "InformationTransfer",
            "Reflection / Metacognitive",
            "Critical Thingking",
        ],
        "levels": {
            "NFI": "Cannot follow the rhythm or tempo.",
            "PTE": "Difficulty maintaining tempo.",
            "DE": "Often out of sync with the music's tempo.",
            "ME": "Performs with mostly accurate rhythm.",
            "EE": "Performs with highly accurate rhythm.",
        },
    },
    {
        "topic": "Creating",
        "title": "Ensemble Balance & Dynamics",
        "categories": ["Social Skills", "Communication Skills"],
        "subskills": [
            "Interpersonal relationships",
            "Social-emotional intelligence",
            "Exchanging-information",
        ],
        "levels": {
            "NFI": "No awareness of group sound or control.",
            "PTE": "Difficulty controlling volume.",
            "DE": "Volume is sometimes unbalanced.",
            "ME": "Good ensemble balance.",
            "EE": "Excellent ensemble balance.",
        },
    },
    {
        "topic": "Responding",
        "title": "Focus & Attention",
        "categories": ["Self-Management Skills", "Thinking Skills"],
        "subskills": [
            "State of Mind",
            "Reflection / Metacognitive",
            "Organization skills",
        ],
        "levels": {
            "NFI": "Does not show attention to the lesson at all.",
            "PTE": "Is often unfocused and distracts others.",
            "DE": "Is sometimes attentive, but is often distracted by others.",
            "ME": "Pays attention to teacher and peer instructions well.",
            "EE": "Always pays attention to teacher and peer instructions.",
        },
    },
    {
        "topic": "Responding",
        "title": "Participation & Effort",
        "categories": ["Social Skills", "Self-Management Skills"],
        "subskills": [
            "State of Mind",
            "Interpersonal relationships",
            "Reflection / Metacognitive",
        ],
        "levels": {
            "NFI": "Is completely unwilling to participate in music activities in class.",
            "PTE": "Often refuses to participate in singing or practice activities.",
            "DE": "Participates when asked or encouraged by the teacher.",
            "ME": "Actively participates in most activities.",
            "EE": "Very enthusiastic and always actively participates in all music activities.",
        },
    },
    {
        "topic": "Responding",
        "title": "Responsibility & Respect",
        "categories": ["Social Skills", "Self-Management Skills"],
        "subskills": [
            "Social-emotional intelligence",
            "Interpersonal relationships",
            "Organization skills",
        ],
        "levels": {
            "NFI": "Shows a lack of concern for classroom rules, peers, and the teacher.",
            "PTE": "Needs repeated reminders to be respectful.",
            "DE": "Sometimes forgets classroom rules.",
            "ME": "Shows respect for the teacher and peers.",
            "EE": "Listens respectfully when others are performing or the teacher is speaking.",
        },
    },
]

CHOIR_PAIRWISE = [
    ("Interpersonal relationships", "Exchanging-information", "Lebih penting"),
    ("Interpersonal relationships", "Organization skills", "Sangat lebih penting"),
    ("Exchanging-information", "Organization skills", "Sedikit lebih penting"),
]

STALE_CHOIR_RUBRIC_TITLES = [
    "Ensemble Balance",
    "Team Coordination / Ensemble Work",
    "Creativity / Interpretation",
]

LEGACY_ATL_SUBSKILL_MAP = {
    "Thinking": "Critical Thingking",
    "Thinking Skills": "Critical Thingking",
    "Communication": "Exchanging-information",
    "Communication Skills": "Exchanging-information",
    "Social": "Interpersonal relationships",
    "Social Skills": "Interpersonal relationships",
    "Self-Management": "Organization skills",
    "Self Management": "Organization skills",
    "Research": "Textual Literacy",
    "Research Skills": "Textual Literacy",
}

RATING_LABEL_TO_CODE = {
    "Exceeding Expectation": "EE",
    "Meeting Expectation": "ME",
    "Developing Expectation": "DE",
    "Progressing Toward Expectation": "PTE",
    "Need Further Improvement": "NFI",
    "Need Improvement": "NFI",
    "EE": "EE",
    "ME": "ME",
    "DE": "DE",
    "PTE": "PTE",
    "NFI": "NFI",
}


def canonical_subskill_names():
    return {
        name
        for category in ATL_HIERARCHY
        for name in category["subskills"]
    }


def subskills_for_categories(category_names):
    names = set(category_names or [])
    return list(
        ATLSubskill.objects.select_related("category")
        .filter(category__name__in=names, name__in=canonical_subskill_names())
        .order_by("category__order", "order", "name")
    )


def subskills_for_names(subskill_names):
    names = list(subskill_names or [])
    if not names:
        return []
    subskills = {
        item.name: item
        for item in ATLSubskill.objects.select_related("category").filter(name__in=names)
    }
    return [subskills[name] for name in names if name in subskills]


def ensure_contextual_seed():
    try:
        subskills = {}
        for category_order, category_data in enumerate(ATL_HIERARCHY):
            category, _ = ATLCategory.objects.get_or_create(
                name=category_data["name"],
                defaults={"order": category_order},
            )
            updates = []
            if category.order != category_order:
                category.order = category_order
                updates.append("order")
            if updates:
                category.save(update_fields=updates)

            for subskill_order, subskill_name in enumerate(category_data["subskills"]):
                subskill, _ = ATLSubskill.objects.get_or_create(
                    category=category,
                    name=subskill_name,
                    defaults={"order": subskill_order},
                )
                if subskill.order != subskill_order:
                    subskill.order = subskill_order
                    subskill.save(update_fields=["order"])
                subskills[subskill_name] = subskill

        for order, (code, label, lower, middle, upper) in enumerate(RUBRIC_SCALES):
            scale, _ = RubricScale.objects.get_or_create(
                code=code,
                defaults={
                    "label": label,
                    "fuzzy_lower": lower,
                    "fuzzy_middle": middle,
                    "fuzzy_upper": upper,
                    "order": order,
                },
            )
            changed = []
            for field, value in {
                "label": label,
                "fuzzy_lower": lower,
                "fuzzy_middle": middle,
                "fuzzy_upper": upper,
                "order": order,
            }.items():
                if getattr(scale, field) != value:
                    setattr(scale, field, value)
                    changed.append(field)
            if changed:
                scale.save(update_fields=changed)

        for subject_data in SUBJECTS:
            for topic_data in subject_data["topics"]:
                unit_name = topic_data["label"]
                if topic_data["id"] == "singing_christmas_carol":
                    unit_name = "Christmas Carol Choir"
                context, _ = LearningContext.objects.get_or_create(
                    legacy_topic_code=topic_data["id"],
                    defaults={
                        "grade": "Grade 3",
                        "subject_name": subject_data["label"],
                        "unit_name": unit_name,
                        "description": topic_data.get("description", ""),
                    },
                )
                updates = []
                desired = {
                    "grade": "Grade 3",
                    "subject_name": subject_data["label"],
                    "unit_name": unit_name,
                    "description": topic_data.get("description", ""),
                }
                for field, value in desired.items():
                    if getattr(context, field) != value:
                        setattr(context, field, value)
                        updates.append(field)
                if updates:
                    context.save(update_fields=updates)

        seed_choir_context(subskills)
        convert_legacy_assessments_to_contexts()
    except OperationalError:
        return


def seed_choir_context(subskills):
    context = LearningContext.objects.filter(legacy_topic_code="singing_christmas_carol").first()
    if not context:
        return

    context.rubric_items.filter(title__in=STALE_CHOIR_RUBRIC_TITLES).delete()

    for order, rubric in enumerate(CHOIR_RUBRIC_ITEMS):
        title = rubric["title"]
        category_names = rubric["categories"]
        selected = subskills_for_names(rubric.get("subskills")) or subskills_for_categories(category_names)
        primary_subskill = selected[0] if selected else None
        if not primary_subskill:
            continue
        for subskill_order, subskill in enumerate(selected):
            ContextATLMapping.objects.update_or_create(
                context=context,
                subskill=subskill,
                defaults={"order": order * 20 + subskill_order, "is_active": True},
            )
        rubric_item, _ = ContextRubricItem.objects.update_or_create(
            context=context,
            title=title,
            defaults={
                "subskill": primary_subskill,
                "criteria_topic": rubric["topic"],
                "level_descriptors": rubric["levels"],
                "order": order,
            },
        )
        rubric_item.subskills.set(selected)

    for left_name, right_name, scale in CHOIR_PAIRWISE:
        left = subskills.get(left_name)
        right = subskills.get(right_name)
        if not left or not right:
            continue
        PairwiseComparison.objects.update_or_create(
            context=context,
            left_subskill=left,
            right_subskill=right,
            defaults={"linguistic_scale": scale, "expert_user": "Seed"},
        )


def context_to_dict(context):
    return {
        "id": context.id,
        "grade": context.grade,
        "subjectName": context.subject_name,
        "unitName": context.unit_name,
        "description": context.description,
        "legacyTopicCode": context.legacy_topic_code,
        "label": f"{context.grade} - {context.unit_name}" if context.grade else context.unit_name,
    }


def subskill_to_dict(subskill):
    return {
        "id": subskill.id,
        "name": subskill.name,
        "description": subskill.description,
        "category": {
            "id": subskill.category_id,
            "name": subskill.category.name,
        },
    }


def rubric_item_to_dict(item):
    linked_subskills = list(item.subskills.select_related("category").all())
    if not linked_subskills:
        linked_subskills = [item.subskill]
    categories = []
    for subskill in linked_subskills:
        category = {"id": subskill.category_id, "name": subskill.category.name}
        if category not in categories:
            categories.append(category)
    return {
        "id": item.id,
        "criteriaTopic": item.criteria_topic,
        "title": item.title,
        "levelDescriptors": item.level_descriptors or {},
        "order": item.order,
        "subskill": subskill_to_dict(item.subskill),
        "subskills": [subskill_to_dict(subskill) for subskill in linked_subskills],
        "categories": categories,
    }


def pairwise_to_dict(item):
    return {
        "id": item.id,
        "left": item.left_subskill.name,
        "right": item.right_subskill.name,
        "leftSubskillId": item.left_subskill_id,
        "rightSubskillId": item.right_subskill_id,
        "scale": item.linguistic_scale,
        "expertUser": item.expert_user,
    }


def rubric_scale_to_dict(scale):
    return {
        "id": scale.id,
        "code": scale.code,
        "label": scale.label,
        "tfn": [scale.fuzzy_lower, scale.fuzzy_middle, scale.fuzzy_upper],
        "score": rubric_scale_to_score(scale),
    }


def get_context(identifier):
    ensure_contextual_seed()
    queryset = LearningContext.objects.all()
    if str(identifier).isdigit():
        return queryset.get(id=int(identifier))
    return queryset.get(legacy_topic_code=identifier)


def get_context_for_topic(topic_id):
    return get_context(topic_id)


def selected_subskills(context):
    return list(
        ATLSubskill.objects.select_related("category")
        .filter(context_mappings__context=context, context_mappings__is_active=True, name__in=canonical_subskill_names())
        .order_by("context_mappings__order", "name")
        .distinct()
    )


def generated_pairs(context):
    return [
        {"left": left.name, "right": right.name, "leftSubskillId": left.id, "rightSubskillId": right.id}
        for left, right in combinations(selected_subskills(context), 2)
    ]


def equal_weights(context):
    subskills = selected_subskills(context)
    if not subskills:
        return {}
    value = 1 / len(subskills)
    return {subskill.name: f"{value:.6f}" for subskill in subskills}


def get_saved_or_equal_weights(context):
    try:
        snapshot = context.weight_snapshot
    except ObjectDoesNotExist:
        snapshot = None
    if snapshot and snapshot.subskill_weights:
        return snapshot.subskill_weights
    return equal_weights(context)


def get_pairwise_payload(context):
    return [
        {
            "left": item.left_subskill.name,
            "right": item.right_subskill.name,
            "scale": item.linguistic_scale,
        }
        for item in context.pairwise_comparisons.select_related("left_subskill", "right_subskill").all()
    ]


def resolve_subskill(context, value):
    if value is None:
        return None
    subskills = selected_subskills(context)
    for subskill in subskills:
        if str(subskill.id) == str(value) or subskill.name == value:
            return subskill
    return None


def save_context_pairwise(context, pairwise_payload, expert_user=""):
    saved = []
    for item in list(pairwise_payload.values()) if isinstance(pairwise_payload, dict) else list(pairwise_payload or []):
        left = resolve_subskill(context, item.get("leftSubskillId") or item.get("left"))
        right = resolve_subskill(context, item.get("rightSubskillId") or item.get("right"))
        scale = item.get("scale") or item.get("linguistic_scale") or "Sama penting"
        if not left or not right or left.id == right.id:
            continue
        record, _ = PairwiseComparison.objects.update_or_create(
            context=context,
            left_subskill=left,
            right_subskill=right,
            defaults={"linguistic_scale": scale, "expert_user": expert_user},
        )
        saved.append(record)
    return saved


def calculate_context_weights(context, pairwise_payload=None, expert_user="", persist=True):
    if isinstance(pairwise_payload, dict) and pairwise_payload.get("__criterionPackages"):
        package_weights = pairwise_payload.get("packages") or {}
        flat_weights = pairwise_payload.get("weights") or {}
        if not flat_weights:
            for package_name, package in package_weights.items():
                for subskill_name, weight in (package.get("weights") or {}).items():
                    flat_weights[f"{package_name} ({subskill_name})"] = weight
        consistency_values = [
            float(package.get("consistency") or 0)
            for package in package_weights.values()
            if package.get("consistency") is not None
        ]
        result = {
            "weights": flat_weights,
            "packages": package_weights,
            "sumD": "0.00",
            "consistency": max(consistency_values) if consistency_values else 0,
            "debug": {"packages": package_weights},
        }
        if persist:
            ContextWeightSnapshot.objects.update_or_create(
                context=context,
                defaults={
                    "subskill_weights": flat_weights,
                    "consistency_ratio": result["consistency"],
                    "debug": result["debug"],
                },
            )
        return result

    if pairwise_payload is not None:
        save_context_pairwise(context, pairwise_payload, expert_user=expert_user)

    criteria = [subskill.name for subskill in selected_subskills(context)]
    if not criteria:
        result = {"weights": {}, "sumD": "0.00", "consistency": 0.0, "debug": {}}
    else:
        result = calculate_fuzzy_ahp(criteria, get_pairwise_payload(context))

    if persist:
        ContextWeightSnapshot.objects.update_or_create(
            context=context,
            defaults={
                "subskill_weights": result.get("weights") or {},
                "consistency_ratio": result.get("consistency") or 0,
                "debug": result.get("debug") or {},
            },
        )
    return result


def context_flow_to_dict(context):
    weights = get_saved_or_equal_weights(context)
    try:
        snapshot = context.weight_snapshot
    except ObjectDoesNotExist:
        snapshot = None
    return {
        "context": context_to_dict(context),
        "subskills": [subskill_to_dict(item) for item in selected_subskills(context)],
        "rubricItems": [
            rubric_item_to_dict(item)
            for item in context.rubric_items.select_related("subskill", "subskill__category").all()
        ],
        "pairs": generated_pairs(context),
        "pairwise": [pairwise_to_dict(item) for item in context.pairwise_comparisons.all()],
        "weights": weights,
        "debug": snapshot.debug if snapshot else {},
        "consistency": snapshot.consistency_ratio if snapshot else None,
        "rubricScales": [rubric_scale_to_dict(item) for item in RubricScale.objects.all()],
    }


def hierarchy_to_dict():
    ensure_contextual_seed()
    canonical = canonical_subskill_names()
    return {
        "categories": [
            {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "subskills": [
                    subskill_to_dict(subskill)
                    for subskill in category.subskills.all()
                    if subskill.name in canonical
                ],
            }
            for category in ATLCategory.objects.prefetch_related("subskills").all()
        ]
    }


def contexts_to_dict():
    ensure_contextual_seed()
    return {"contexts": [context_to_dict(item) for item in LearningContext.objects.all()]}


def rubric_scale_to_score(scale):
    return (scale.fuzzy_lower + scale.fuzzy_middle + scale.fuzzy_upper) / 3


def find_rubric_scale(value):
    code = RATING_LABEL_TO_CODE.get(value, value)
    if not code:
        return None
    return RubricScale.objects.filter(code=code).first()


def parse_legacy_rating_key(context, key):
    legacy = context.legacy_topic_code
    text = str(key)
    if legacy and text.startswith(f"{legacy}_"):
        text = text[len(legacy) + 1 :]
    if "_" in text:
        title, _subskill = text.rsplit("_", 1)
        return title
    return text


def find_rubric_item(context, key):
    if str(key).isdigit():
        item = ContextRubricItem.objects.filter(context=context, id=int(key)).first()
        if item:
            return item
    title = parse_legacy_rating_key(context, key)
    return ContextRubricItem.objects.filter(context=context, title=title).first()


def upsert_student_assessments_from_ratings(student_id, context, ratings, evaluator=""):
    saved = []
    for key, value in (ratings or {}).items():
        rubric_scale = find_rubric_scale(value)
        rubric_item = find_rubric_item(context, key)
        if not rubric_scale or not rubric_item:
            continue
        record, _ = StudentAssessment.objects.update_or_create(
            student_id=str(student_id),
            context=context,
            rubric_item=rubric_item,
            defaults={"rubric_scale": rubric_scale, "evaluator": evaluator},
        )
        saved.append(record)
    return saved


def convert_legacy_assessments_to_contexts():
    for legacy in Assessment.objects.select_related("topic").all():
        context = LearningContext.objects.filter(legacy_topic_code=legacy.topic.code).first()
        if context:
            upsert_student_assessments_from_ratings(legacy.student_id, context, legacy.ratings or {})


def student_assessments_to_legacy(context, student_id=None):
    queryset = (
        StudentAssessment.objects.select_related("rubric_item", "rubric_item__subskill", "rubric_scale")
        .prefetch_related("rubric_item__subskills")
        .filter(context=context)
    )
    if student_id:
        queryset = queryset.filter(student_id=str(student_id))

    assessments = {}
    topic_id = context.legacy_topic_code or str(context.id)
    for item in queryset:
        linked_subskills = list(item.rubric_item.subskills.all()) or [item.rubric_item.subskill]
        for subskill in linked_subskills:
            key = f"{topic_id}_{item.rubric_item.title}_{subskill.name}"
            assessments.setdefault(str(item.student_id), {}).setdefault(topic_id, {})[key] = item.rubric_scale.label
    return assessments


def calculate_student_context_score(student_id, context):
    weights = get_saved_or_equal_weights(context)
    rows = (
        StudentAssessment.objects.select_related(
            "rubric_item",
            "rubric_item__subskill",
            "rubric_item__subskill__category",
            "rubric_scale",
        )
        .prefetch_related("rubric_item__subskills", "rubric_item__subskills__category")
        .filter(context=context, student_id=str(student_id))
    )
    subskill_scores = {}
    detail_items = []
    weighted_total = 0
    total_weight = 0
    for row in rows:
        score = rubric_scale_to_score(row.rubric_scale)
        linked_subskills = list(row.rubric_item.subskills.all()) or [row.rubric_item.subskill]
        for subskill in linked_subskills:
            subskill_scores.setdefault(subskill.name, []).append(score)
            criterion_weight_key = f"{row.rubric_item.title} ({subskill.name})"
            weight = float(weights.get(criterion_weight_key, weights.get(subskill.name, 0)) or 0)
            if weight > 0:
                weighted_total += score * weight
                total_weight += weight
        detail_items.append(
            {
                "kriteria": row.rubric_item.title,
                "criteriaTopic": row.rubric_item.criteria_topic,
                "atlName": ", ".join(subskill.name for subskill in linked_subskills),
                "categoryName": ", ".join(sorted({subskill.category.name for subskill in linked_subskills})),
                "subskills": [subskill_to_dict(subskill) for subskill in linked_subskills],
                "ratingCode": row.rubric_scale.code,
                "ratingLabel": row.rubric_scale.label,
                "rubricScore": f"{score:.2f}",
                "levelDescription": (row.rubric_item.level_descriptors or {}).get(row.rubric_scale.code, ""),
            }
        )

    subskill_averages = {
        name: sum(scores) / len(scores)
        for name, scores in subskill_scores.items()
        if scores
    }
    final_score = (weighted_total / total_weight * 100) if total_weight > 0 else 0
    if final_score == 0:
        predikat = "-"
    elif final_score >= 85:
        predikat = "Sangat Baik"
    elif final_score >= 70:
        predikat = "Baik"
    elif final_score >= 50:
        predikat = "Cukup"
    else:
        predikat = "Kurang"

    return {
        "score": f"{final_score:.2f}",
        "rawScore": final_score,
        "predikat": predikat,
        "progress": "+2.5" if final_score > 75 else "-1.2",
        "subskillAverages": {name: f"{score * 100:.1f}" for name, score in subskill_averages.items()},
        "detailItems": detail_items,
    }


def build_context_report(class_name, context):
    convert_legacy_assessments_to_contexts()
    students = STUDENTS.get(class_name, [])
    rows = []
    for student in students:
        score_data = calculate_student_context_score(student.get("id"), context)
        detail_count = len(score_data.get("detailItems", []))
        total_items = context.rubric_items.count()
        summary = (
            f"{student.get('name')} in {context.subject_name}, {context.unit_name}, "
            f"achieved ATL score {score_data['score']} based on {detail_count}/{total_items} rubric items."
        )
        rows.append({**student, **score_data, "summaryParagraph": summary, "assessedCount": detail_count, "totalIndicators": total_items})

    assessed = len([row for row in rows if row.get("rawScore", 0) > 0])
    dist = {"Sangat Baik": 0, "Baik": 0, "Cukup": 0, "Kurang": 0, "Belum Dinilai": 0}
    for row in rows:
        if row["predikat"] == "-":
            dist["Belum Dinilai"] += 1
        elif row["predikat"] in dist:
            dist[row["predikat"]] += 1

    subskill_names = [item.name for item in selected_subskills(context)]
    cats = []
    for subskill_name in subskill_names:
        values = [
            float(row.get("subskillAverages", {}).get(subskill_name) or 0)
            for row in rows
        ]
        cats.append({"name": subskill_name, "val": f"{sum(values) / len(values):.1f}" if values else 0})
    strongest = sorted(cats, key=lambda item: float(item.get("val") or 0), reverse=True)[0] if cats else None

    return {
        "students": rows,
        "stats": {"assessed": assessed, "dist": dist, "cats": cats, "strongest": strongest},
        "meta": {
            "className": class_name,
            "contextId": context.id,
            "topicId": context.legacy_topic_code,
            "subjectLabel": context.subject_name,
            "topicLabel": context.unit_name,
        },
    }
