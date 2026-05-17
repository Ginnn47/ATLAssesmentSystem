from .catalog import STUDENTS
from .scoring import ATL_CATEGORIES, RATING_CODE_MAP, score_student

PERFORMANCE_BAND_MAP = {
    "Sangat Baik": "Excellent",
    "Baik": "Good",
    "Cukup": "Fair",
    "Kurang": "Needs Improvement",
    "-": "Not Assessed",
}


def build_reports(class_name, topic_id, criteria, weights, assessments_by_student, subject_label="", topic_label=""):
    students = STUDENTS.get(class_name, [])
    rows = [
        score_student(
            topic_id,
            student,
            criteria,
            weights,
            assessments_by_student.get(str(student.get("id")), {}),
        )
        for student in students
    ]

    assessed = len([row for row in rows if row.get("rawScore", 0) > 0])
    dist = {"Sangat Baik": 0, "Baik": 0, "Cukup": 0, "Kurang": 0, "Belum Dinilai": 0}
    cat_avg = {category: 0 for category in ATL_CATEGORIES}

    for row in rows:
        predikat = row.get("predikat")
        if predikat == "-":
            dist["Belum Dinilai"] += 1
        elif predikat in dist:
            dist[predikat] += 1
        for category in ATL_CATEGORIES:
            cat_avg[category] += float(row.get("catAverages", {}).get(category) or 0)

    cats = [
        {
            "name": category,
            "val": f"{cat_avg[category] / len(rows):.1f}" if rows else 0,
        }
        for category in ATL_CATEGORIES
    ]
    strongest = sorted(cats, key=lambda item: float(item.get("val") or 0), reverse=True)[0] if cats else None

    return {
        "students": rows,
        "stats": {"assessed": assessed, "dist": dist, "cats": cats, "strongest": strongest},
        "meta": {"className": class_name, "topicId": topic_id, "subjectLabel": subject_label, "topicLabel": topic_label},
    }


def build_student_detail(student, topic_id, criteria, assessments, subject_label="", topic_label=""):
    detail_items = []
    for criterion in criteria:
        name = criterion.get("kriteria") or criterion.get("name")
        levels = criterion.get("levels") or {}
        for atl_name in criterion.get("atl", []):
            rating_key = f"{topic_id}_{name}_{atl_name}"
            rating_label = assessments.get(rating_key)
            rating_code = RATING_CODE_MAP.get(rating_label)
            detail_items.append(
                {
                    "kriteria": name,
                    "atlName": atl_name,
                    "ratingCode": rating_code,
                    "ratingLabel": rating_label or "Not Assessed",
                    "levelDescription": levels.get(rating_code) if rating_code else "No assessment input is available for this indicator yet.",
                }
            )

    predikat_text = PERFORMANCE_BAND_MAP.get(student.get("predikat"), student.get("predikat"))
    total_indicators = len(detail_items)
    assessed_count = len([item for item in detail_items if item.get("ratingCode")])
    if total_indicators == 0:
        summary = f"{student.get('name')} is enrolled in {subject_label}, sub-topic {topic_label}, but no ATL criteria are configured for this topic yet, so a narrative report cannot be generated."
    else:
        summary = f"{student.get('name')} in {subject_label}, sub-topic {topic_label}, achieved a Fuzzy AHP score of {student.get('score')} with the performance band \"{predikat_text}\". Out of {total_indicators} ATL indicators, {assessed_count} indicators have been assessed and are summarized below in report form."

    return {**student, "summaryParagraph": summary, "detailItems": detail_items, "assessedCount": assessed_count, "totalIndicators": total_indicators}
