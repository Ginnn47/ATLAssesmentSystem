RATING_VALUE_MAP = {
    "Exceeding Expectation": 100,
    "Meeting Expectation": 80,
    "Developing Expectation": 60,
    "Progressing Toward Expectation": 40,
    "Need Further Improvement": 20,
    "Need Improvement": 20,
}

RATING_CODE_MAP = {
    "Exceeding Expectation": "EE",
    "Meeting Expectation": "ME",
    "Developing Expectation": "DE",
    "Progressing Toward Expectation": "PTE",
    "Need Further Improvement": "NFI",
    "Need Improvement": "NFI",
}

ATL_CATEGORIES = ["Thinking", "Social", "Communication", "Self-Management", "Research"]


def normalize_rating_label(label):
    return "Need Further Improvement" if label == "Need Improvement" else label


def score_student(topic_id, student, criteria, weights, assessments):
    cat_scores = {category: 0 for category in ATL_CATEGORIES}
    cat_weights = {category: 0 for category in ATL_CATEGORIES}
    total_weighted_score = 0
    total_weight = 0
    fallback_score = 0
    fallback_count = 0

    for criterion in criteria:
        name = criterion.get("kriteria") or criterion.get("name")
        for atl_name in criterion.get("atl", []):
            rating_key = f"{topic_id}_{name}_{atl_name}"
            rating_label = normalize_rating_label(assessments.get(rating_key))
            rating_value = RATING_VALUE_MAP.get(rating_label)
            if not rating_value:
                continue

            weight_key = f"{name} ({atl_name})"
            try:
                weight = float(weights.get(weight_key, 0) or 0)
            except (TypeError, ValueError):
                weight = 0

            if weight > 0:
                total_weighted_score += rating_value * weight
                total_weight += weight
                cat_scores[atl_name] = cat_scores.get(atl_name, 0) + rating_value * weight
                cat_weights[atl_name] = cat_weights.get(atl_name, 0) + weight

            fallback_score += rating_value
            fallback_count += 1

    if total_weight > 0:
        final_score = total_weighted_score / total_weight
    elif fallback_count > 0:
        final_score = fallback_score / fallback_count
    else:
        final_score = 0

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
        **student,
        "score": f"{final_score:.2f}",
        "rawScore": final_score,
        "predikat": predikat,
        "progress": "+2.5" if final_score > 75 else "-1.2",
        "catAverages": {
            category: f"{cat_scores.get(category, 0) / cat_weights[category]:.1f}" if cat_weights.get(category, 0) > 0 else 0
            for category in ATL_CATEGORIES
        },
    }
