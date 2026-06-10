from .catalog import get_students_for_class
from .FuzzyATLEquation import ATL_CATEGORIES, RATING_CODE_MAP, rating_score, score_student
from .labels import SCORE_LEVEL_ORDER, SCORE_LEVELS, get_score_level, normalize_atl_category, normalize_score_band

ATL_CATEGORY_ORDER = ATL_CATEGORIES

def score_level(score):
    return get_score_level(score)


def score_band_display(label):
    normalized = normalize_score_band(label)
    for level in SCORE_LEVELS:
        if level["label"] == normalized:
            return level.get("fullLabel") or level.get("description") or normalized
    return normalized


def build_teacher_insight(name, subject_label, topic_label, score, detail_items, assessed_count, total_indicators):
    assessed = [item for item in detail_items if item.get("ratingCode")]
    level = score_level(score)
    strong = [item for item in assessed if item.get("ratingCode") in {"EE", "ME"}]
    focus = [item for item in assessed if item.get("ratingCode") in {"DE", "PTE", "NFI"}]
    strong_text = ", ".join(dict.fromkeys((item.get("atlName") or item.get("kriteria") or "") for item in strong[:2] if item.get("atlName") or item.get("kriteria")))
    focus_text = ", ".join(dict.fromkeys((item.get("atlName") or item.get("kriteria") or "") for item in focus[:2] if item.get("atlName") or item.get("kriteria")))
    evidence = next((item.get("levelDescription") for item in assessed if item.get("levelDescription")), "")
    level_label = level.get("fullLabel") or level.get("description") or level["label"]
    sentence = (
        f"{name} berada pada level {level_label} dalam {subject_label} ({topic_label}) dengan skor ATL {float(score or 0):.2f}, "
        f"berdasarkan {assessed_count}/{total_indicators} indikator softskill ATL yang sudah dinilai."
    )
    if strong_text:
        sentence += f" Kekuatan utama tampak pada {strong_text}."
    if focus_text:
        sentence += f" Area yang perlu diperkuat adalah {focus_text}."
    if evidence:
        sentence += f" Catatan rubric utama: {evidence}"
    return sentence


def build_atl_category_scores(detail_items, cat_averages=None):
    buckets = {category: [] for category in ATL_CATEGORY_ORDER}
    for category in ATL_CATEGORY_ORDER:
        raw = (cat_averages or {}).get(category)
        if raw not in (None, "", 0, "0"):
            try:
                buckets[category].append(float(raw))
            except (TypeError, ValueError):
                pass

    for item in detail_items:
        code = item.get("ratingCode")
        score = rating_score(code)
        if score is None:
            continue
        categories = []
        if item.get("subskills"):
            categories = [subskill.get("category", {}).get("name") for subskill in item.get("subskills") or []]
        if not categories and item.get("categoryName"):
            categories = [name.strip() for name in str(item.get("categoryName")).split(",")]
        if not categories:
            categories = [normalize_atl_category(item.get("atlName"))]
        for category in categories:
            normalized = normalize_atl_category(category)
            if normalized in buckets:
                buckets[normalized].append(score)

    return [
        {
            "name": category,
            "score": round(sum(values) / len(values), 1) if values else 0,
            "assessedIndicators": len(values),
            "level": score_level(sum(values) / len(values) if values else 0),
        }
        for category, values in buckets.items()
    ]


def enrich_student_report(student, detail_items, subject_label="", topic_label="", total_indicators=0, assessed_count=0):
    raw_score = float(student.get("rawScore") if student.get("rawScore") is not None else student.get("score") or 0)
    assessed_total = assessed_count or len([item for item in detail_items if item.get("ratingCode")])
    indicator_total = total_indicators or len(detail_items)
    category_scores = build_atl_category_scores(detail_items, student.get("catAverages") or {})
    insight = build_teacher_insight(
        student.get("name"),
        subject_label,
        topic_label,
        raw_score,
        detail_items,
        assessed_total,
        indicator_total,
    )
    return {
        "teacherInsight": insight,
        "atlLevel": score_level(raw_score),
        "atlCategoryScores": category_scores,
    }


def build_reports(class_name, topic_id, criteria, weights, assessments_by_student, subject_label="", topic_label=""):
    students = get_students_for_class(class_name)
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
    dist = {label: 0 for label in [*SCORE_LEVEL_ORDER, "No Data"]}
    cat_avg = {category: 0 for category in ATL_CATEGORIES}

    for row in rows:
        predikat = normalize_score_band(row.get("predikat"))
        if predikat in dist:
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

    predikat_text = score_band_display(student.get("predikat"))
    total_indicators = len(detail_items)
    assessed_count = len([item for item in detail_items if item.get("ratingCode")])
    if total_indicators == 0:
        summary = f"{student.get('name')} is enrolled in {subject_label}, sub-topic {topic_label}, but no ATL criteria are configured for this topic yet, so a narrative report cannot be generated."
    else:
        summary = f"{student.get('name')} in {subject_label}, sub-topic {topic_label}, achieved a Fuzzy AHP score of {student.get('score')} with the performance band \"{predikat_text}\". Out of {total_indicators} ATL indicators, {assessed_count} indicators have been assessed and are summarized below in report form."

    visual = enrich_student_report(student, detail_items, subject_label, topic_label, total_indicators, assessed_count)
    return {**student, "summaryParagraph": summary, "detailItems": detail_items, "assessedCount": assessed_count, "totalIndicators": total_indicators, **visual}
