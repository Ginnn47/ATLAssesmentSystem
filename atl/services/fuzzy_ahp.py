from math import prod


SCALE_OPTIONS = {
    "Sama penting": [1.0, 1.0, 1.0],
    "Sedikit lebih penting": [2.0, 3.0, 4.0],
    "Lebih penting": [4.0, 5.0, 6.0],
    "Sangat lebih penting": [6.0, 7.0, 8.0],
    "Mutlak lebih penting": [8.0, 9.0, 9.0],
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


def round2(value):
    return round(float(value), 2)


def add_tfn(left, right):
    return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]


def inverse_tfn(value):
    return [1 / value[2], 1 / value[1], 1 / value[0]]


def divide_tfn(left, right):
    return [left[0] / right[2], left[1] / right[1], left[2] / right[0]]


def degree_possibility(first, second):
    l1, m1, u1 = first
    l2, m2, _u2 = second
    if m1 >= m2:
        return 1
    if l2 >= u1:
        return 0

    denominator = (m1 - u1) - (m2 - l2)
    if denominator == 0:
        return 0

    value = (l2 - u1) / denominator
    return max(0, min(1, value))


def centroid(tfn):
    return sum(tfn) / 3


def normalize_crisp(values):
    total = sum(values)
    if total <= 0:
        return [1 / len(values) for _ in values] if values else []
    return [value / total for value in values]


def normalize_pairwise_values(pairwise):
    if isinstance(pairwise, dict):
        return list(pairwise.values())
    return list(pairwise or [])


def build_fuzzy_matrix(criteria, pairwise):
    criteria = list(criteria or [])
    count = len(criteria)
    matrix = [[[1.0, 1.0, 1.0] for _ in range(count)] for _ in range(count)]

    for item in normalize_pairwise_values(pairwise):
        left = item.get("left")
        right = item.get("right")
        scale = item.get("scale") or item.get("linguistic_scale")
        if left not in criteria or right not in criteria:
            continue

        i = criteria.index(left)
        j = criteria.index(right)
        if i == j:
            continue

        tfn = SCALE_OPTIONS.get(scale, SCALE_OPTIONS["Sama penting"])
        matrix[i][j] = tfn
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
    weights = normalize_crisp(geometric_means)
    if not weights:
        return 0.0

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
    if random_index == 0:
        return 0.0
    return round(consistency_index / random_index, 6)


def calculate_geometric_weights(matrix):
    count = len(matrix)
    if count == 0:
        return []
    if count == 1:
        return [1.0]

    row_geometric_means = []
    for row in matrix:
        lower = prod(max(value[0], 0.000001) for value in row) ** (1 / count)
        middle = prod(max(value[1], 0.000001) for value in row) ** (1 / count)
        upper = prod(max(value[2], 0.000001) for value in row) ** (1 / count)
        row_geometric_means.append([lower, middle, upper])

    total = [0.0, 0.0, 0.0]
    for value in row_geometric_means:
        total = add_tfn(total, value)

    fuzzy_weights = [divide_tfn(row_value, total) for row_value in row_geometric_means]
    crisp_weights = normalize_crisp([centroid(value) for value in fuzzy_weights])
    return crisp_weights


def legacy_extent_debug(matrix):
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
    possibility = [[0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        for j in range(count):
            possibility[i][j] = 1 if i == j else degree_possibility(synthetic[i], synthetic[j])

    d_vector = [min(row) for row in possibility] if count else []
    sum_d = sum(d_vector)

    return {
        "sumD": sum_d,
        "debug": {
            "matrix": matrix,
            "rowSums": row_sums,
            "total": total,
            "S": synthetic,
            "V": possibility,
            "d": [f"{value:.2f}" for value in d_vector],
        },
    }


def calculate_fuzzy_ahp(criteria, pairwise):
    criteria = list(criteria or [])
    count = len(criteria)
    if count == 0:
        return {"weights": {}, "sumD": "0.00", "consistency": 0.0, "debug": {}}

    matrix = build_fuzzy_matrix(criteria, pairwise)
    crisp_weights = calculate_geometric_weights(matrix)
    weights = {
        criterion: f"{crisp_weights[index]:.{WEIGHT_PRECISION}f}"
        for index, criterion in enumerate(criteria)
    }
    extent = legacy_extent_debug(matrix)
    extent["debug"]["method"] = "fuzzy_geometric_mean"
    extent["debug"]["crispWeights"] = crisp_weights

    return {
        "weights": weights,
        "sumD": f"{extent['sumD']:.2f}",
        "consistency": calculate_consistency_ratio(matrix),
        "debug": extent["debug"],
    }
