from itertools import combinations

from django.core.exceptions import ObjectDoesNotExist
from django.db import OperationalError, transaction
from django.utils import timezone

from ..models import (
    ATLCategory,
    ATLSubskill,
    Assessment,
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    Criterion,
    LearningContext,
    PairwiseComparison,
    PairwiseScaleOption,
    RubricScale,
    AcademicPeriod,
    Student,
    StudentAssessment,
    Topic,
)
from ..seed_data import TOPIC_RUBRICS
from .catalog import SUBJECTS, get_students_for_class
from .FuzzyATLEquation import (
    DEFAULT_PAIRWISE_SCALE_OPTIONS,
    RATING_CODE_MAP,
    RUBRIC_SCALE_DEFINITIONS,
    calculate_fuzzy_ahp,
    calculate_weighted_entries,
    calculate_weighting_packages,
    expected_pairs,
    pairwise_trace,
    rubric_scale_fraction,
    score_topic_assessment,
)
from .labels import ATL_CANONICAL_HIERARCHY, ATL_CATEGORY_LABELS, ATL_SUBSKILL_ALIASES, SCORE_LEVEL_ORDER, get_score_level
from .reports import enrich_student_report


ATL_HIERARCHY = ATL_CANONICAL_HIERARCHY

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
        "categories": ["Social Skills"],
        "subskills": [
            "Interpersonal relationships",
            "Social-emotional intelligence",
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
        "categories": ["Thinking Skills"],
        "subskills": [
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
        "categories": ["Social Skills"],
        "subskills": [
            "Interpersonal relationships",
            "Social-emotional intelligence",
        ],
        "levels": {
            "NFI": "No awareness of group sound or control.",
            "PTE": "Difficulty controlling volume.",
            "DE": "Volume is sometimes unbalanced.",
            "ME": "Maintains balanced ensemble contribution.",
            "EE": "Shows highly polished ensemble balance.",
        },
    },
    {
        "topic": "Responding",
        "title": "Focus & Attention",
        "categories": ["Self-Management Skills"],
        "subskills": [
            "State of Mind",
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
        "categories": ["Self-Management Skills"],
        "subskills": [
            "State of Mind",
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
        "categories": ["Social Skills"],
        "subskills": [
            "Social-emotional intelligence",
            "Interpersonal relationships",
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
    ("Interpersonal relationships", "Exchanging Information", "Lebih penting"),
    ("Interpersonal relationships", "Organization skills", "Sangat lebih penting"),
    ("Exchanging Information", "Organization skills", "Sedikit lebih penting"),
]

STALE_CHOIR_RUBRIC_TITLES = [
    "Ensemble Balance",
    "Team Coordination / Ensemble Work",
    "Creativity / Interpretation",
]

LEGACY_ATL_SUBSKILL_MAP = {
    "Thinking": "Critical Thingking",
    "Thinking Skills": "Critical Thingking",
    "Communication": "Exchanging Information",
    "Communication Skills": "Exchanging Information",
    "Social": "Interpersonal relationships",
    "Social Skills": "Interpersonal relationships",
    "Self-Management": "Organization skills",
    "Self Management": "Organization skills",
    "Research": "Textual Literacy",
    "Research Skills": "Textual Literacy",
    **ATL_SUBSKILL_ALIASES,
}

def canonical_subskill_names():
    return {
        name
        for category in ATL_HIERARCHY
        for name in category["subskills"]
    }


def normalize_subskill_name(name):
    return LEGACY_ATL_SUBSKILL_MAP.get(name, name)


def subskills_for_categories(category_names):
    names = set(category_names or [])
    return list(
        ATLSubskill.objects.select_related("category")
        .filter(category__name__in=names, name__in=canonical_subskill_names())
        .order_by("category__order", "order", "name")
    )


def subskills_for_names(subskill_names):
    names = [normalize_subskill_name(name) for name in list(subskill_names or [])]
    if not names:
        return []
    subskills = {
        item.name: item
        for item in ATLSubskill.objects.select_related("category").filter(name__in=names)
    }
    return [subskills[name] for name in names if name in subskills]


def normalize_rubric_subskills(subskills):
    """Keep only the majority ATL category for one rubric criterion."""
    ordered = []
    seen = set()
    for subskill in subskills or []:
        if not subskill or subskill.id in seen:
            continue
        ordered.append(subskill)
        seen.add(subskill.id)
    if len(ordered) <= 1:
        return ordered

    counts = {}
    first_seen = {}
    for index, subskill in enumerate(ordered):
        category_id = subskill.category_id
        counts[category_id] = counts.get(category_id, 0) + 1
        first_seen.setdefault(category_id, index)

    selected_category_id = min(
        counts,
        key=lambda category_id: (-counts[category_id], first_seen[category_id]),
    )
    return [subskill for subskill in ordered if subskill.category_id == selected_category_id]


def sync_rubric_item_subskills(item, subskills):
    selected = normalize_rubric_subskills(subskills)
    if not selected:
        return []
    item.subskill = selected[0]
    item.save(update_fields=["subskill"])
    item.subskills.set(selected)
    return selected


def ensure_topic_context(topic):
    context, _ = LearningContext.objects.update_or_create(
        legacy_topic_code=topic.code,
        defaults={
            "grade": "Grade 3",
            "subject_name": topic.subject.label,
            "unit_name": topic.label,
            "description": topic.description,
        },
    )
    return context


def legacy_criterion_subskills(criterion):
    selected = subskills_for_names(criterion.atl or [])
    if not selected:
        selected = list(
            ATLSubskill.objects.select_related("category").order_by("category__order", "order", "name")[:1]
        )
    return normalize_rubric_subskills(selected)


def sync_criterion_to_context_rubric(criterion, context=None):
    context = context or ensure_topic_context(criterion.topic)
    selected = legacy_criterion_subskills(criterion)
    if not selected:
        return None
    rubric_item, _ = ContextRubricItem.objects.update_or_create(
        context=context,
        title=criterion.name,
        defaults={
            "subskill": selected[0],
            "criteria_topic": "",
            "level_descriptors": criterion.levels or DEFAULT_LEVELS,
            "order": criterion.order,
        },
    )
    selected_item_subskills = sync_rubric_item_subskills(rubric_item, selected)
    for index, subskill in enumerate(selected_item_subskills):
        ContextATLMapping.objects.update_or_create(
            context=context,
            subskill=subskill,
            defaults={"order": criterion.order * 20 + index, "is_active": True},
        )
    return rubric_item


def ensure_assessable_topic(topic_code):
    topic = Topic.objects.select_related("subject").filter(code=topic_code).first()
    if not topic:
        return {
            "topic": None,
            "context": None,
            "rubricCount": 0,
            "contextAvailable": False,
            "isAssessable": False,
        }
    context = ensure_topic_context(topic)
    legacy_criteria = list(Criterion.objects.filter(topic=topic).order_by("order", "id"))
    if legacy_criteria:
        existing_titles = set(context.rubric_items.values_list("title", flat=True))
        for criterion in legacy_criteria:
            if criterion.name not in existing_titles:
                sync_criterion_to_context_rubric(criterion, context=context)
                existing_titles.add(criterion.name)
    rubric_count = context.rubric_items.count()
    return {
        "topic": topic,
        "context": context,
        "rubricCount": rubric_count,
        "contextAvailable": True,
        "isAssessable": topic.is_active and rubric_count > 0,
    }


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

        for order, (code, label, lower, middle, upper) in enumerate(RUBRIC_SCALE_DEFINITIONS):
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
                topic = Topic.objects.filter(code=topic_data["id"]).first()
                if topic is not None and not topic.is_active:
                    continue
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
        seed_topic_rubrics_from_catalog()
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
        selected = normalize_rubric_subskills(
            subskills_for_names(rubric.get("subskills")) or subskills_for_categories(category_names)
        )
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
        sync_rubric_item_subskills(rubric_item, selected)

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


def seed_topic_rubrics_from_catalog():
    subskills = {
        subskill.name: subskill
        for subskill in ATLSubskill.objects.select_related("category").all()
    }
    for topic_code, rubric_rows in TOPIC_RUBRICS.items():
        topic = Topic.objects.filter(code=topic_code, is_active=True).select_related("subject").first()
        if not topic:
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
            selected = [subskills[name] for name in rubric.get("subskills", []) if name in subskills]
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
            rubric_item, _ = ContextRubricItem.objects.update_or_create(
                context=context,
                title=rubric["title"],
                defaults={
                    "subskill": selected[0],
                    "criteria_topic": rubric.get("topic", ""),
                    "level_descriptors": rubric.get("levels", DEFAULT_LEVELS),
                    "order": order,
                },
            )
            sync_rubric_item_subskills(rubric_item, selected)


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


def validate_pairwise_tfn(values):
    try:
        lower, middle, upper = [float(value) for value in values]
    except (TypeError, ValueError):
        raise ValueError("Scale TFN harus berisi angka valid.")
    if lower <= 0 or middle <= 0 or upper <= 0:
        raise ValueError("Scale TFN harus lebih besar dari 0.")
    if lower > middle or middle > upper:
        raise ValueError("Scale TFN harus berurutan: lower <= middle <= upper.")
    return lower, middle, upper


def pairwise_scale_option_to_dict(option):
    tfn = [option.fuzzy_lower, option.fuzzy_middle, option.fuzzy_upper]
    reciprocal = [1 / option.fuzzy_upper, 1 / option.fuzzy_middle, 1 / option.fuzzy_lower]
    return {
        "id": option.id,
        "code": option.code,
        "label": option.label,
        "ahpValue": option.ahp_value,
        "tfn": tfn,
        "fuzzyLower": option.fuzzy_lower,
        "fuzzyMiddle": option.fuzzy_middle,
        "fuzzyUpper": option.fuzzy_upper,
        "reciprocal": reciprocal,
        "order": option.order,
        "updatedAt": option.updated_at.isoformat() if option.updated_at else None,
    }


def ensure_pairwise_scale_options(context):
    existing = {item.code: item for item in context.pairwise_scale_options.all()}
    for order, item in enumerate(DEFAULT_PAIRWISE_SCALE_OPTIONS):
        lower, middle, upper = item["tfn"]
        if item["code"] in existing:
            continue
        PairwiseScaleOption.objects.create(
            context=context,
            code=item["code"],
            label=item["label"],
            ahp_value=item["ahpValue"],
            fuzzy_lower=lower,
            fuzzy_middle=middle,
            fuzzy_upper=upper,
            order=order,
        )
    return list(context.pairwise_scale_options.all())


def get_pairwise_scale_options(context):
    return [pairwise_scale_option_to_dict(item) for item in ensure_pairwise_scale_options(context)]


def get_pairwise_scale_lookup(context):
    return {
        item["label"]: item["tfn"]
        for item in get_pairwise_scale_options(context)
    }


def update_pairwise_scale_options(context, options):
    if not isinstance(options, list):
        raise ValueError("Pairwise scale options harus berupa array.")
    existing = {item.code: item for item in ensure_pairwise_scale_options(context)}
    with transaction.atomic():
        for payload in options:
            if not isinstance(payload, dict):
                raise ValueError("Setiap scale option harus berupa object.")
            code = payload.get("code")
            if code not in existing:
                raise ValueError(f"Scale option tidak dikenal: {code}")
            option = existing[code]
            values = payload.get("tfn") or [
                payload.get("fuzzyLower"),
                payload.get("fuzzyMiddle"),
                payload.get("fuzzyUpper"),
            ]
            lower, middle, upper = validate_pairwise_tfn(values)
            option.fuzzy_lower = lower
            option.fuzzy_middle = middle
            option.fuzzy_upper = upper
            option.save(update_fields=["fuzzy_lower", "fuzzy_middle", "fuzzy_upper", "updated_at"])
    return get_pairwise_scale_options(context)


def reset_pairwise_scale_options(context):
    existing = {item.code: item for item in ensure_pairwise_scale_options(context)}
    with transaction.atomic():
        for order, item in enumerate(DEFAULT_PAIRWISE_SCALE_OPTIONS):
            lower, middle, upper = item["tfn"]
            option = existing[item["code"]]
            option.label = item["label"]
            option.ahp_value = item["ahpValue"]
            option.fuzzy_lower = lower
            option.fuzzy_middle = middle
            option.fuzzy_upper = upper
            option.order = order
            option.save(update_fields=["label", "ahp_value", "fuzzy_lower", "fuzzy_middle", "fuzzy_upper", "order", "updated_at"])
    return get_pairwise_scale_options(context)


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
    weights = {}
    rubric_items = (
        context.rubric_items.select_related("subskill")
        .prefetch_related("subskills")
        .all()
    )
    for item in rubric_items:
        subskills = list(item.subskills.all()) or [item.subskill]
        if not subskills:
            continue
        value = 1 / len(subskills)
        for subskill in subskills:
            weights[f"{item.title} ({subskill.name})"] = f"{value:.6f}"
    if weights:
        return weights

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


def weighting_packages_for_context(context):
    try:
        snapshot = context.weight_snapshot
    except ObjectDoesNotExist:
        snapshot = None
    saved_packages = ((snapshot.debug or {}).get("packages") or {}) if snapshot else {}
    context_pairwise = get_pairwise_payload(context)
    scale_options = get_pairwise_scale_lookup(context)
    packages = {}
    rubric_items = (
        context.rubric_items.select_related("subskill", "subskill__category")
        .prefetch_related("subskills", "subskills__category")
        .all()
    )
    for item in rubric_items:
        key = f"rubric-{item.id}"
        linked_subskills = list(item.subskills.all()) or [item.subskill]
        subskill_names = list(dict.fromkeys(subskill.name for subskill in linked_subskills))
        saved = saved_packages.get(key) or next(
            (
                package
                for package in saved_packages.values()
                if package.get("title") == item.title
            ),
            {},
        )
        package_pairwise = saved.get("pairwiseTrace") or [
            pair
            for pair in context_pairwise
            if pair.get("left") in subskill_names and pair.get("right") in subskill_names
        ]
        packages[key] = {
            "key": key,
            "rubricItemId": item.id,
            "title": item.title,
            "criteriaTopic": item.criteria_topic or "Rubric Evidence",
            "categories": list(dict.fromkeys(subskill.category.name for subskill in linked_subskills)),
            "subskills": subskill_names,
            "pairs": expected_pairs(subskill_names),
            "pairwise": pairwise_trace(subskill_names, package_pairwise, scale_options=scale_options),
            "weights": saved.get("weights") or {},
            "sumD": saved.get("sumD") or "0.00",
            "consistency": saved.get("consistency"),
            "debug": saved.get("debug") or {},
        }
    return packages


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
    valid_scales = set(get_pairwise_scale_lookup(context))
    for item in list(pairwise_payload.values()) if isinstance(pairwise_payload, dict) else list(pairwise_payload or []):
        left = resolve_subskill(context, item.get("leftSubskillId") or item.get("left"))
        right = resolve_subskill(context, item.get("rightSubskillId") or item.get("right"))
        scale = item.get("scale") or item.get("linguistic_scale") or "Sama penting"
        if scale not in valid_scales:
            scale = "Sama penting"
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
    scale_options = get_pairwise_scale_lookup(context)
    scale_options_payload = get_pairwise_scale_options(context)
    if isinstance(pairwise_payload, dict) and pairwise_payload.get("__criterionPackages"):
        result = calculate_weighting_packages(
            pairwise_payload.get("packages") or {},
            require_complete=persist,
            scale_options=scale_options,
        )
        saved_at = pairwise_payload.get("savedAt") or timezone.now().isoformat()
        activity = pairwise_payload.get("activity") or {}
        persisted_weights = {
            **(result.get("weights") or {}),
            "__mode": "criterion-packages",
            "__savedAt": saved_at,
        }
        if activity:
            persisted_weights["__activity"] = activity
        result["savedAt"] = saved_at
        result["activity"] = activity
        result["scaleOptions"] = scale_options_payload
        result["debug"] = {**(result.get("debug") or {}), "scaleOptions": scale_options_payload}
        if persist:
            result["weights"] = persisted_weights
            ContextWeightSnapshot.objects.update_or_create(
                context=context,
                defaults={
                    "subskill_weights": persisted_weights,
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
        result = calculate_fuzzy_ahp(criteria, get_pairwise_payload(context), scale_options=scale_options)
    result["scaleOptions"] = scale_options_payload
    result["debug"] = {**(result.get("debug") or {}), "scaleOptions": scale_options_payload}

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
    scale_options = get_pairwise_scale_options(context)
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
        "weightingPackages": weighting_packages_for_context(context),
        "scaleOptions": scale_options,
        "weights": weights,
        "hasSavedWeight": bool(snapshot and snapshot.subskill_weights),
        "weightSource": "saved" if snapshot and snapshot.subskill_weights else "equal-fallback",
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
    return rubric_scale_fraction(scale)


def find_rubric_scale(value):
    code = RATING_CODE_MAP.get(value, value)
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


def upsert_student_assessments_from_ratings(student_id, context, ratings, evaluator=None, teacher_note=None, replace=True):
    saved = []
    matched_item_ids = set()
    student = Student.objects.filter(id=str(student_id)).first() if str(student_id).isdigit() else None
    if student is None:
        student = Student.objects.filter(nis=str(student_id)).first()
    period = AcademicPeriod.objects.filter(is_active=True).first()
    for key, value in (ratings or {}).items():
        rubric_scale = find_rubric_scale(value)
        rubric_item = find_rubric_item(context, key)
        if not rubric_scale or not rubric_item:
            continue
        matched_item_ids.add(rubric_item.id)
        defaults = {
            "rubric_scale": rubric_scale,
            "student_record": student,
            "academic_period": period,
        }
        if evaluator is not None:
            defaults["evaluator"] = evaluator
        if teacher_note is not None:
            defaults["teacher_note"] = teacher_note
        record, _ = StudentAssessment.objects.update_or_create(
            student_id=str(student_id),
            context=context,
            rubric_item=rubric_item,
            defaults=defaults,
        )
        saved.append(record)
    if replace:
        stale = StudentAssessment.objects.filter(student_id=str(student_id), context=context)
        if matched_item_ids:
            stale = stale.exclude(rubric_item_id__in=matched_item_ids)
        stale.delete()
    return saved


def merged_assessments_for_context(context=None, topic=None, student_id=None):
    assessments = {}
    if topic is not None:
        queryset = Assessment.objects.filter(topic=topic)
        if student_id:
            queryset = queryset.filter(student_id=str(student_id))
        for item in queryset:
            assessments.setdefault(str(item.student_id), {})[topic.code] = item.ratings or {}

    if context is not None:
        contextual = student_assessments_to_legacy(context, student_id=student_id)
        for row_student_id, topic_map in contextual.items():
            assessments.setdefault(str(row_student_id), {}).update(topic_map or {})
    return assessments


def sync_assessment_payload(student_id, topic_identifier, context_identifier, ratings, evaluator="", teacher_note=""):
    with transaction.atomic():
        topic = Topic.objects.get(code=topic_identifier, is_active=True)
        context = None
        try:
            context = get_context(context_identifier or topic_identifier)
        except (LearningContext.DoesNotExist, OperationalError):
            context = None

        record, _ = Assessment.objects.update_or_create(
            student_id=str(student_id),
            topic=topic,
            defaults={"ratings": ratings or {}},
        )
        if context is not None:
            upsert_student_assessments_from_ratings(
                student_id,
                context,
                ratings or {},
                evaluator=evaluator,
                teacher_note=teacher_note,
                replace=True,
            )
        assessments = merged_assessments_for_context(context=context, topic=topic, student_id=student_id)
        return record, assessments


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
    detail_items = []
    equation_entries = []
    for row in rows:
        score = rubric_scale_to_score(row.rubric_scale)
        linked_subskills = list(row.rubric_item.subskills.all()) or [row.rubric_item.subskill]
        for subskill in linked_subskills:
            equation_entries.append(
                {
                    "criterion": row.rubric_item.title,
                    "subskill": subskill.name,
                    "category": subskill.category.name,
                    "rating": row.rubric_scale.code,
                }
            )
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

    equation = calculate_weighted_entries(equation_entries, weights)
    final_score = equation.get("score") or 0
    predikat = "No Data" if final_score == 0 else get_score_level(final_score)["label"]

    return {
        "score": f"{final_score:.2f}",
        "rawScore": final_score,
        "predikat": predikat,
        "progress": "+2.5" if final_score > 75 else "-1.2",
        "subskillAverages": {
            name: f"{score:.1f}"
            for name, score in equation.get("subskillScores", {}).items()
        },
        "categoryScores": {
            name: score
            for name, score in equation.get("categoryScores", {}).items()
        },
        "detailItems": detail_items,
    }


def build_context_scoring_config(context):
    rubric_items = (
        context.rubric_items.select_related("subskill", "subskill__category")
        .prefetch_related("subskills", "subskills__category")
        .all()
    )
    return {
        "topicId": context.legacy_topic_code or str(context.id),
        "criteria": [rubric_item_to_dict(item) for item in rubric_items],
        "weights": get_saved_or_equal_weights(context),
    }


def calculate_context_ratings_preview(context, ratings, scoring_config=None):
    config = scoring_config or build_context_scoring_config(context)
    result = score_topic_assessment(
        config["topicId"],
        config["criteria"],
        config["weights"],
        ratings or {},
    )
    final_score = result.get("score") or 0
    return {
        "score": f"{final_score:.2f}",
        "rawScore": final_score,
        "predikat": "No Data" if final_score == 0 else get_score_level(final_score)["label"],
        "filled": result.get("filled") or 0,
        "possible": result.get("possible") or 0,
        "categoryScores": result.get("categoryScores") or {},
        "subskillScores": result.get("subskillScores") or {},
    }


def build_context_report(class_name, context):
    convert_legacy_assessments_to_contexts()
    students = get_students_for_class(class_name)
    rows = []
    for student in students:
        score_data = calculate_student_context_score(student.get("id"), context)
        detail_count = len(score_data.get("detailItems", []))
        total_items = context.rubric_items.count()
        summary = (
            f"{student.get('name')} in {context.subject_name}, {context.unit_name}, "
            f"achieved ATL score {score_data['score']} based on {detail_count}/{total_items} rubric items."
        )
        visual = enrich_student_report(
            {**student, **score_data},
            score_data.get("detailItems", []),
            context.subject_name,
            context.unit_name,
            total_items,
            detail_count,
        )
        rows.append({**student, **score_data, "summaryParagraph": summary, "assessedCount": detail_count, "totalIndicators": total_items, **visual})

    assessed = len([row for row in rows if row.get("rawScore", 0) > 0])
    dist = {label: 0 for label in [*SCORE_LEVEL_ORDER, "No Data"]}
    for row in rows:
        if row["predikat"] in dist:
            dist[row["predikat"]] += 1

    category_names = list(ATL_CATEGORY_LABELS.keys())
    cats = []
    for category_name in category_names:
        values = [
            float(row.get("categoryScores", {}).get(category_name) or 0)
            for row in rows
            if float(row.get("categoryScores", {}).get(category_name) or 0) > 0
        ]
        cats.append({"name": category_name, "val": f"{sum(values) / len(values):.1f}" if values else 0})
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
