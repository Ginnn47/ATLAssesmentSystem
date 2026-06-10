"""Single source of truth for Fuzzy-AHP and ATL score equations."""

from itertools import combinations
from math import prod


NEUTRAL_TFN = [1.0, 1.0, 1.0]
DEFAULT_PAIRWISE_SCALE_OPTIONS = (
    {"code": "equal", "label": "Sama penting", "ahpValue": 1, "tfn": [1.0, 1.0, 1.0]},
    {"code": "slight", "label": "Sedikit lebih penting", "ahpValue": 3, "tfn": [2.0, 3.0, 4.0]},
    {"code": "important", "label": "Lebih penting", "ahpValue": 5, "tfn": [4.0, 5.0, 6.0]},
    {"code": "very_important", "label": "Sangat lebih penting", "ahpValue": 7, "tfn": [6.0, 7.0, 8.0]},
    {"code": "absolute", "label": "Mutlak lebih penting", "ahpValue": 9, "tfn": [8.0, 9.0, 9.0]},
)
SCALE_OPTIONS = {
    item["label"]: item["tfn"]
    for item in DEFAULT_PAIRWISE_SCALE_OPTIONS
}

WEIGHT_PRECISION = 6
RI_TABLE = {
    1: 0.0,
    2: 0.0,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
}

RUBRIC_SCALE_DEFINITIONS = (
    ("EE", "Exceeding Expectation", 0.8, 0.9, 1.0),
    ("ME", "Meeting Expectation", 0.6, 0.7, 0.8),
    ("DE", "Developing Expectation", 0.4, 0.5, 0.6),
    ("PTE", "Progressing Toward Expectation", 0.2, 0.3, 0.4),
    ("NFI", "Need Further Improvement", 0.0, 0.1, 0.2),
)

RATING_CODE_MAP = {
    **{code: code for code, _label, _lower, _middle, _upper in RUBRIC_SCALE_DEFINITIONS},
    **{label: code for code, label, _lower, _middle, _upper in RUBRIC_SCALE_DEFINITIONS},
    "Need Improvement": "NFI",
}

RATING_SCORE_BY_CODE = {
    code: round(middle * 100)
    for code, _label, _lower, middle, _upper in RUBRIC_SCALE_DEFINITIONS
}
RATING_VALUE_MAP = {
    value: RATING_SCORE_BY_CODE[code]
    for value, code in RATING_CODE_MAP.items()
}

ATL_CATEGORIES = ["Thinking Skills", "Research Skills", "Communication Skills", "Social Skills", "Self-Management Skills"]


def add_tfn(left, right):
    return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]


def inverse_tfn(value):
    return [1 / value[2], 1 / value[1], 1 / value[0]]


def divide_tfn(left, right):
    return [left[0] / right[2], left[1] / right[1], left[2] / right[0]]


def degree_possibility(first, second):
    _l1, m1, u1 = first
    l2, m2, _u2 = second
    if m1 >= m2:
        return 1.0
    if l2 >= u1:
        return 0.0

    denominator = (m1 - u1) - (m2 - l2)
    if denominator == 0:
        return 0.0
    return max(0.0, min(1.0, (l2 - u1) / denominator))


def normalize_values(values):
    total = sum(values)
    if total <= 0:
        return [1 / len(values) for _ in values] if values else []
    return [value / total for value in values]


def normalize_pairwise_values(pairwise):
    if isinstance(pairwise, dict):
        return list(pairwise.values())
    return list(pairwise or [])


def normalize_scale_options(scale_options=None):
    if not scale_options:
        return {label: list(tfn) for label, tfn in SCALE_OPTIONS.items()}
    if isinstance(scale_options, dict):
        normalized = {}
        for key, value in scale_options.items():
            if isinstance(value, dict):
                label = value.get("label") or key
                tfn = value.get("tfn") or [
                    value.get("fuzzyLower"),
                    value.get("fuzzyMiddle"),
                    value.get("fuzzyUpper"),
                ]
            else:
                label = key
                tfn = value
            if _valid_tfn(tfn):
                normalized[label] = [float(tfn[0]), float(tfn[1]), float(tfn[2])]
        return normalized or {label: list(tfn) for label, tfn in SCALE_OPTIONS.items()}
    normalized = {}
    for item in scale_options:
        label = item.get("label") or item.get("scale")
        tfn = item.get("tfn") or [
            item.get("fuzzyLower"),
            item.get("fuzzyMiddle"),
            item.get("fuzzyUpper"),
        ]
        if label and _valid_tfn(tfn):
            normalized[label] = [float(tfn[0]), float(tfn[1]), float(tfn[2])]
    return normalized or {label: list(tfn) for label, tfn in SCALE_OPTIONS.items()}


def _valid_tfn(tfn):
    if not isinstance(tfn, (list, tuple)) or len(tfn) != 3:
        return False
    try:
        lower, middle, upper = [float(value) for value in tfn]
    except (TypeError, ValueError):
        return False
    return lower > 0 and middle > 0 and upper > 0 and lower <= middle <= upper


def tfn_for_scale(scale, scale_options=None):
    options = normalize_scale_options(scale_options)
    return list(options.get(scale) or NEUTRAL_TFN)


def build_fuzzy_matrix(criteria, pairwise, scale_options=None):
    criteria = list(criteria or [])
    count = len(criteria)
    matrix = [[list(NEUTRAL_TFN) for _ in range(count)] for _ in range(count)]

    for item in normalize_pairwise_values(pairwise):
        left = item.get("left")
        right = item.get("right")
        scale = item.get("scale") or item.get("linguistic_scale")
        if left not in criteria or right not in criteria or left == right:
            continue
        i = criteria.index(left)
        j = criteria.index(right)
        tfn = tfn_for_scale(scale, scale_options)
        matrix[i][j] = list(tfn)
        matrix[j][i] = inverse_tfn(tfn)

    return matrix


def calculate_consistency_ratio(matrix):
    count = len(matrix)
    if count <= 2:
        return 0.0

    crisp_matrix = [[cell[1] for cell in row] for row in matrix]
    geometric_means = [
        prod(max(value, 0.000001) for value in row) ** (1 / count)
        for row in crisp_matrix
    ]
    weights = normalize_values(geometric_means)
    weighted_sums = [
        sum(crisp_matrix[row][col] * weights[col] for col in range(count))
        for row in range(count)
    ]
    lambda_values = [
        weighted_sums[index] / weights[index]
        for index in range(count)
        if weights[index] > 0
    ]
    if not lambda_values:
        return 0.0

    lambda_max = sum(lambda_values) / len(lambda_values)
    consistency_index = max(0.0, (lambda_max - count) / (count - 1))
    random_index = RI_TABLE.get(count, 1.49)
    return round(consistency_index / random_index, 6) if random_index else 0.0


def calculate_synthetic_extent(matrix):
    count = len(matrix)
    row_sums = []
    for row in matrix:
        current = [0.0, 0.0, 0.0]
        for value in row:
            current = add_tfn(current, value)
        row_sums.append(current)

    total = [0.0, 0.0, 0.0]
    for value in row_sums:
        total = add_tfn(total, value)

    synthetic = [divide_tfn(row_sum, total) for row_sum in row_sums] if count else []
    possibility = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        for j in range(count):
            possibility[i][j] = 1.0 if i == j else degree_possibility(synthetic[i], synthetic[j])

    d_vector = [min(row) for row in possibility] if count else []
    weights = normalize_values(d_vector)
    return {
        "weights": weights,
        "sumD": sum(d_vector),
        "debug": {
            "method": "synthetic_extent",
            "matrix": matrix,
            "rowSums": row_sums,
            "total": total,
            "S": synthetic,
            "V": possibility,
            "d": [f"{value:.2f}" for value in d_vector],
        },
    }


def pairwise_trace(criteria, pairwise, scale_options=None):
    criteria = list(criteria or [])
    valid_names = set(criteria)
    trace = []
    seen = set()
    for item in normalize_pairwise_values(pairwise):
        left = item.get("left")
        right = item.get("right")
        if left not in valid_names or right not in valid_names or left == right:
            continue
        pair_id = frozenset((left, right))
        if pair_id in seen:
            continue
        seen.add(pair_id)
        scale = item.get("scale") or item.get("linguistic_scale") or "Sama penting"
        trace.append(
            {
                "left": left,
                "right": right,
                "scale": scale,
                "tfn": tfn_for_scale(scale, scale_options),
            }
        )
    return trace


def calculate_fuzzy_ahp(criteria, pairwise, scale_options=None):
    criteria = list(criteria or [])
    if not criteria:
        return {
            "weights": {},
            "sumD": "0.00",
            "consistency": 0.0,
            "debug": {"method": "synthetic_extent"},
        }

    matrix = build_fuzzy_matrix(criteria, pairwise, scale_options=scale_options)
    extent = calculate_synthetic_extent(matrix)
    weights = {
        criterion: f"{extent['weights'][index]:.{WEIGHT_PRECISION}f}"
        for index, criterion in enumerate(criteria)
    }
    return {
        "weights": weights,
        "sumD": f"{extent['sumD']:.2f}",
        "consistency": calculate_consistency_ratio(matrix),
        "debug": extent["debug"],
    }


def expected_pairs(criteria):
    return [{"left": left, "right": right} for left, right in combinations(criteria or [], 2)]


def calculate_weighting_packages(packages, require_complete=False, scale_options=None):
    package_items = packages.items() if isinstance(packages, dict) else (
        (str(index), item) for index, item in enumerate(packages or [])
    )
    calculated_packages = {}
    flat_weights = {}
    incomplete = []

    for package_key, raw_package in package_items:
        package = dict(raw_package or {})
        criteria = list(dict.fromkeys(package.get("subskills") or package.get("criteria") or []))
        comparisons = package.get("pairwise") or package.get("pairwiseTrace") or []
        trace = pairwise_trace(criteria, comparisons, scale_options=scale_options)
        pairs = expected_pairs(criteria)
        result = calculate_fuzzy_ahp(criteria, trace, scale_options=scale_options)
        complete = len(trace) >= len(pairs)
        if not complete:
            incomplete.append(package.get("title") or package_key)
        calculated = {
            **package,
            **result,
            "subskills": criteria,
            "pairs": pairs,
            "pairwiseTrace": trace,
            "pairwiseFilled": len(trace),
            "pairwiseExpected": len(pairs),
            "pairwiseComplete": complete,
        }
        calculated_packages[str(package_key)] = calculated
        title = package.get("title") or str(package_key)
        for subskill, weight in result["weights"].items():
            flat_weights[f"{title} ({subskill})"] = weight

    if require_complete and incomplete:
        raise ValueError(
            "Lengkapi seluruh pairwise comparison sebelum menyimpan bobot: "
            + ", ".join(incomplete)
        )

    consistency_values = [
        float(package.get("consistency") or 0)
        for package in calculated_packages.values()
    ]
    first_package = next(iter(calculated_packages.values()), {})
    first_debug = first_package.get("debug") or {}
    return {
        "weights": flat_weights,
        "packages": calculated_packages,
        "sumD": first_package.get("sumD", "0.00"),
        "consistency": max(consistency_values) if consistency_values else 0.0,
        "debug": {**first_debug, "method": "synthetic_extent", "packages": calculated_packages},
        "complete": not incomplete,
        "incompletePackages": incomplete,
    }


def rating_score(value):
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value) * 100 if float(value) <= 1 else float(value)
    return RATING_VALUE_MAP.get(value)


def rubric_scale_fraction(scale):
    score = RATING_VALUE_MAP.get(getattr(scale, "code", None))
    if score is None:
        score = rating_score(getattr(scale, "label", None))
    return float(score or 0) / 100


def weight_for(weights, criterion_title, subskill):
    weights = weights or {}
    for package in (weights.get("packages") or {}).values():
        if package.get("title") == criterion_title:
            try:
                return float((package.get("weights") or {}).get(subskill) or 0)
            except (TypeError, ValueError):
                return 0.0
    for key in (f"{criterion_title} ({subskill})", subskill):
        try:
            value = float(weights.get(key) or 0)
        except (TypeError, ValueError):
            value = 0.0
        if value > 0:
            return value
    return 0.0


def calculate_weighted_entries(entries, weights):
    weighted_total = 0.0
    total_weight = 0.0
    fallback_total = 0.0
    fallback_count = 0
    category_scores = {}
    subskill_scores = {}
    calculation_rows = []

    for entry in entries or []:
        score = rating_score(entry.get("rating"))
        if score is None:
            continue
        criterion = entry.get("criterion") or ""
        subskill = entry.get("subskill") or ""
        category = entry.get("category") or ""
        weight = weight_for(weights, criterion, subskill)
        calculation_rows.append(
            {
                "criterion": criterion,
                "subskill": subskill,
                "category": category,
                "rating": entry.get("rating"),
                "score": score,
                "weight": weight,
            }
        )
        if weight > 0:
            weighted_total += score * weight
            total_weight += weight
        fallback_total += score
        fallback_count += 1
        if category:
            category_scores.setdefault(category, []).append(score)
        if subskill:
            subskill_scores.setdefault(subskill, []).append(score)

    if total_weight > 0:
        final_score = weighted_total / total_weight
        display_weighted_total = weighted_total
        display_total_weight = total_weight
    elif fallback_count:
        final_score = fallback_total / fallback_count
        display_weighted_total = fallback_total
        display_total_weight = fallback_count
    else:
        final_score = None
        display_weighted_total = 0.0
        display_total_weight = 0.0

    has_weighted_rows = total_weight > 0
    calculation_rows = [
        {
            **row,
            "weight": row["weight"] if row["weight"] > 0 else (0.0 if has_weighted_rows else 1.0),
            "weightedScore": row["score"] * (row["weight"] if row["weight"] > 0 else (0.0 if has_weighted_rows else 1.0)),
        }
        for row in calculation_rows
    ]

    return {
        "score": final_score,
        "filled": fallback_count,
        "weightedTotal": display_weighted_total,
        "totalWeight": display_total_weight,
        "calculationRows": calculation_rows,
        "categoryScores": {
            category: sum(values) / len(values)
            for category, values in category_scores.items()
            if values
        },
        "subskillScores": {
            subskill: sum(values) / len(values)
            for subskill, values in subskill_scores.items()
            if values
        },
    }


def score_topic_assessment(topic_id, criteria, weights, ratings):
    from .labels import SUBSKILL_LABELS, normalize_atl_category
    
    entries = []
    possible = 0
    for criterion in criteria or []:
        title = criterion.get("title") or criterion.get("kriteria") or criterion.get("name") or ""
        subskills = criterion.get("atl") or criterion.get("subskills") or []
        categories = criterion.get("categories") or []
        for index, subskill in enumerate(subskills):
            if isinstance(subskill, dict):
                subskill_name = subskill.get("name") or ""
                category = (subskill.get("category") or {}).get("name") or ""
            else:
                subskill_name = subskill
                category = ""
            
            # Fallback ke categories array jika category masih kosong
            if not category and index < len(categories):
                category = categories[index] or ""
            
            # Fallback ke SUBSKILL_LABELS jika category masih kosong
            if not category and subskill_name in SUBSKILL_LABELS:
                category = SUBSKILL_LABELS[subskill_name].get("category", "")
            
            # Normalize category name
            if category:
                category = normalize_atl_category(category)
                
            possible += 1
            entries.append(
                {
                    "criterion": title,
                    "subskill": subskill_name,
                    "category": category,
                    "rating": (ratings or {}).get(f"{topic_id}_{title}_{subskill_name}"),
                }
            )
    result = calculate_weighted_entries(entries, weights)
    return {**result, "possible": possible}


def score_student(topic_id, student, criteria, weights, assessments):
    from .labels import get_score_level

    result = score_topic_assessment(topic_id, criteria, weights, assessments)
    final_score = result.get("score") or 0
    category_scores = result.get("categoryScores") or {}
    return {
        **student,
        "score": f"{final_score:.2f}",
        "rawScore": final_score,
        "predikat": "No Data" if final_score == 0 else get_score_level(final_score)["label"],
        "progress": "+2.5" if final_score > 75 else "-1.2",
        "catAverages": {
            **{category: 0 for category in ATL_CATEGORIES},
            **{category: f"{score:.1f}" for category, score in category_scores.items()},
        },
    }
