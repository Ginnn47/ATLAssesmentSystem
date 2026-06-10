from collections import defaultdict

from .catalog import get_students_for_class
from .contextual_atl import DEFAULT_LEVELS
from .FuzzyATLEquation import score_topic_assessment
from .labels import ATL_CATEGORY_LABELS, ATL_SUBSKILL_ALIASES, SUBSKILL_LABELS, get_score_level


SUBSKILL_CATEGORY_MAP = {
    name: metadata["category"]
    for name, metadata in SUBSKILL_LABELS.items()
}
SUBSKILL_CATEGORY_MAP.update(
    {
        alias: SUBSKILL_CATEGORY_MAP[canonical]
        for alias, canonical in ATL_SUBSKILL_ALIASES.items()
        if canonical in SUBSKILL_CATEGORY_MAP
    }
)

ATL_ORDER = [(name, meta["color"]) for name, meta in ATL_CATEGORY_LABELS.items()]

NO_DATA_LEVEL = {
    "label": "No Data",
    "color": "#A8A29E",
    "tone": "stone",
    "badgeClass": "bg-stone-100 text-stone-500",
    "count": 0,
}


def _score_category(score):
    level = get_score_level(score)
    return {**level, "badgeClass": level.get("badgeClass") or level.get("className")}


def _criterion_dicts(topic):
    context = getattr(topic, "_dashboard_context", None)
    if context:
        criteria = []
        queryset = context.rubric_items.select_related(
            "subskill",
            "subskill__category",
        ).prefetch_related("subskills", "subskills__category")
        for item in queryset:
            linked_subskills = list(item.subskills.all()) or [item.subskill]
            criteria.append(
                {
                    "title": item.title,
                    "topic": item.criteria_topic or "Rubric Evidence",
                    "atl": [subskill.name for subskill in linked_subskills],
                    "categories": [subskill.category.name for subskill in linked_subskills],
                    "levels": item.level_descriptors or DEFAULT_LEVELS,
                }
            )
        if criteria:
            return criteria

    return [
        {
            "title": item.name,
            "topic": "Rubric Evidence",
            "atl": item.atl or [],
            "categories": [
                SUBSKILL_CATEGORY_MAP.get(subskill, "ATL")
                for subskill in (item.atl or [])
            ],
            "levels": item.levels or DEFAULT_LEVELS,
        }
        for item in topic.criteria.all()
    ]


def _score_student_topic(topic_id, criteria, weights, ratings):
    normalized_criteria = []
    for criterion in criteria:
        subskills = criterion.get("atl") or []
        categories = criterion.get("categories") or [
            SUBSKILL_CATEGORY_MAP.get(subskill, "ATL")
            for subskill in subskills
        ]
        normalized_criteria.append({**criterion, "categories": categories})
    equation = score_topic_assessment(topic_id, normalized_criteria, weights, ratings)
    score = equation.get("score")
    calculation_rows = [
        {
            **row,
            "score": round(row.get("score") or 0, 2),
            "weight": round(row.get("weight") or 0, 4),
            "weightedScore": round(row.get("weightedScore") or 0, 2),
        }
        for row in equation.get("calculationRows", [])
    ]
    assessed_criteria = {
        row.get("criterion")
        for row in calculation_rows
        if row.get("criterion")
    }
    return {
        "score": None if score is None else round(score, 2),
        "filled": equation.get("filled", 0),
        "possible": equation.get("possible", 0),
        "assessedCriteria": len(assessed_criteria),
        "totalCriteria": len(normalized_criteria),
        "weightedSubskillRows": len(calculation_rows),
        "weightedTotal": round(equation.get("weightedTotal") or 0, 2),
        "totalWeight": round(equation.get("totalWeight") or 0, 2),
        "calculationRows": calculation_rows,
        "categoryScores": {
            category: round(value)
            for category, value in equation.get("categoryScores", {}).items()
        },
    }


def _student_name(student_id, all_students):
    for students in all_students.values():
        for student in students:
            if str(student.get("id")) == str(student_id):
                return student.get("name") or str(student_id)
    return str(student_id)


def _score_student_across_topics(student, topic_lookup, weights_by_topic, assessments):
    topic_scores = []
    topic_details = []
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
            topic_details.append(
                {
                    "topicId": topic.code,
                    "subject": topic.subject.label,
                    "subjectCode": topic.subject.code,
                    "topic": topic.label,
                    "subTopic": topic.label,
                    "score": result["score"],
                    "level": _score_category(result["score"]),
                    "assessedItems": result["filled"],
                    "totalItems": result["possible"],
                    "assessedCriteria": result.get("assessedCriteria") or 0,
                    "totalCriteria": result.get("totalCriteria") or 0,
                    "weightedSubskillRows": result.get("weightedSubskillRows") or 0,
                    "calculationRows": result.get("calculationRows") or [],
                    "weightedTotal": result.get("weightedTotal") or 0,
                    "totalWeight": result.get("totalWeight") or 0,
                }
            )
        for category, score in result["categoryScores"].items():
            category_values[category].append(score)

    overall = round(sum(topic_scores) / len(topic_scores)) if topic_scores else None
    category_scores = [
        {"category": category, "score": round(sum(values) / len(values))}
        for category, values in category_values.items()
        if values
    ]
    strength = max(category_scores, key=lambda item: item["score"], default=None)
    focus = min(category_scores, key=lambda item: item["score"], default=None)
    return {
        **student,
        "assessedTopics": len(topic_scores),
        "overallScore": overall,
        "overall": "-" if overall is None else f"{overall}%",
        "level": NO_DATA_LEVEL if overall is None else _score_category(overall),
        "strength": strength["category"] if strength else "-",
        "strengthValue": f"{strength['score']}%" if strength else "-",
        "focus": focus["category"] if focus else "-",
        "focusValue": f"{focus['score']}%" if focus else "-",
        "trendValue": "-" if overall is None else f"{'+' if overall >= 70 else '-'}{max(1, round(abs(overall - 70) / 5))}%",
        "categoryScores": category_scores,
        "topicDetails": topic_details,
        "filled": filled,
        "possible": possible,
    }


def build_class_analytics(class_name, topics, contexts, weights_by_topic, assessments):
    topic_lookup = {topic.code: topic for topic in topics}
    context_lookup = {
        context.legacy_topic_code: context
        for context in contexts
        if context.legacy_topic_code
    }
    for topic in topics:
        topic._dashboard_context = context_lookup.get(topic.code)

    students = get_students_for_class(class_name)
    analytics = [
        _score_student_across_topics(student, topic_lookup, weights_by_topic, assessments)
        for student in students
    ]
    assessed = [student for student in analytics if student["overallScore"] is not None]
    average = (
        round(sum(student["overallScore"] for student in assessed) / len(assessed))
        if assessed
        else 0
    )

    distribution = [
        {"key": "ee", **_score_category(90), "range": "85-100", "count": 0},
        {"key": "me", **_score_category(75), "range": "70-84", "count": 0},
        {"key": "de", **_score_category(55), "range": "50-69", "count": 0},
        {"key": "pte", **_score_category(35), "range": "30-49", "count": 0},
        {"key": "nfi", **_score_category(10), "range": "0-29", "count": 0},
    ]
    for bucket in distribution:
        bucket["count"] = len(
            [
                student
                for student in assessed
                if _score_category(student["overallScore"])["label"] == bucket["label"]
            ]
        )

    category_values = defaultdict(list)
    for student in analytics:
        for item in student["categoryScores"]:
            category_values[item["category"]].append(item["score"])
    category_averages = sorted(
        [
            {"category": category, "score": round(sum(values) / len(values))}
            for category, values in category_values.items()
            if values
        ],
        key=lambda item: item["score"],
        reverse=True,
    )
    filled = sum(student["filled"] for student in analytics)
    possible = sum(student["possible"] for student in analytics)
    return {
        "students": analytics,
        "assessedCount": len(assessed),
        "totalStudents": len(students),
        "average": average,
        "averageLevel": _score_category(average) if assessed else NO_DATA_LEVEL,
        "distribution": distribution,
        "dominantCategory": max(distribution, key=lambda item: item["count"]) if assessed else NO_DATA_LEVEL,
        "categoryAverages": category_averages,
        "topFocus": min(category_averages, key=lambda item: item["score"])["category"] if category_averages else "-",
        "completion": round((filled / possible) * 100) if possible else 0,
    }
