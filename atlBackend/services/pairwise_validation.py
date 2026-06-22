from itertools import combinations

from .validation_messages import VALIDATION_MESSAGES


CR_THRESHOLD = 0.10
EXTREME_SCALE_VALUES = {7, 9}
DOMINANT_WEIGHT_THRESHOLD = 0.60
WEIGHT_GAP_THRESHOLD = 0.45


def build_message(key, **kwargs):
    template = VALIDATION_MESSAGES[key]
    return {
        "title": template["title"],
        "message": template["message"].format(**kwargs),
        "severity": template["severity"],
    }


def _as_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _option_tfn(option):
    tfn = option.get("tfn") or [
        option.get("fuzzyLower") or option.get("lower"),
        option.get("fuzzyMiddle") or option.get("middle"),
        option.get("fuzzyUpper") or option.get("upper"),
    ]
    return [_as_float(value) for value in tfn]


def validate_tfn_scale_options(scale_options):
    errors = []
    warnings = []
    normalized = []
    previous_middle = None

    for option in sorted(scale_options or [], key=lambda item: _as_float(item.get("ahpValue") or item.get("ahp_value"))):
        current = dict(option)
        label = current.get("label") or current.get("code") or "Scale"
        ahp_value = _as_float(current.get("ahpValue") or current.get("ahp_value") or current.get("value"))
        lower, middle, upper = _option_tfn(current)

        if lower <= 0 or middle <= 0 or upper <= 0 or lower > middle or middle > upper:
            errors.append({"type": "tfn_invalid", **build_message("tfn_invalid"), "relatedScale": label})

        if previous_middle is not None and ahp_value > 1 and middle < previous_middle:
            warnings.append({
                "type": "scale_order_warning",
                **build_message("scale_order_warning"),
                "relatedScale": label,
                "requiresAcknowledgement": True,
                "requiresReason": False,
            })

        if ahp_value >= 1:
            previous_middle = middle
        current["tfn"] = [lower, middle, upper]
        current["reciprocal"] = [round(1 / upper, 4) if upper else 0, round(1 / middle, 4) if middle else 0, round(1 / lower, 4) if lower else 0]
        normalized.append(current)

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings, "scaleOptions": normalized}


def _comparison_items(packages):
    for package_key, package in (packages or {}).items():
        criteria = list(dict.fromkeys(package.get("subskills") or package.get("criteria") or []))
        for item in package.get("pairwise") or package.get("pairwiseTrace") or []:
            yield package_key, package, criteria, item


def _scale_lookup(scale_options):
    return {
        item.get("label"): {
            "ahpValue": _as_float(item.get("ahpValue") or item.get("ahp_value") or item.get("value")),
            "middle": _option_tfn(item)[1],
        }
        for item in scale_options or []
        if item.get("label")
    }


def _directed_comparison_map(criteria, comparisons, scale_options):
    lookup = _scale_lookup(scale_options)
    mapping = {}
    for item in comparisons or []:
        left = item.get("left")
        right = item.get("right")
        if left not in criteria or right not in criteria or left == right:
            continue
        scale = item.get("scale") or item.get("linguistic_scale")
        value = lookup.get(scale, {}).get("middle", 1.0)
        mapping[(left, right)] = value
        mapping[(right, left)] = 1 / value if value else 1.0
    return mapping


def validate_transitivity(packages, scale_options):
    warnings = []
    for _, package, criteria, _ in _comparison_items(packages):
        comparison_map = _directed_comparison_map(criteria, package.get("pairwise") or package.get("pairwiseTrace") or [], scale_options)
        for a, b, c in combinations(criteria, 3):
            triples = [(a, b, c), (a, c, b), (b, a, c), (b, c, a), (c, a, b), (c, b, a)]
            for first, second, third in triples:
                ab = comparison_map.get((first, second))
                bc = comparison_map.get((second, third))
                ac = comparison_map.get((first, third))
                if ab is not None and bc is not None and ac is not None and ab > 1 and bc > 1 and ac <= 1:
                    warnings.append({
                        "type": "transitivity",
                        **build_message("transitivity_warning", criterion_a=first, criterion_b=second, criterion_c=third),
                        "relatedCriteria": [first, second, third],
                        "requiresAcknowledgement": True,
                        "requiresReason": False,
                    })
    return warnings


def validate_pedagogical_warnings(packages, scale_options, final_weights=None):
    warnings = []
    lookup = _scale_lookup(scale_options)
    for _, _, _, item in _comparison_items(packages):
        scale = item.get("scale") or item.get("linguistic_scale")
        scale_value = lookup.get(scale, {}).get("ahpValue", 1)
        if int(scale_value) in EXTREME_SCALE_VALUES:
            warnings.append({
                "type": "extreme_pairwise",
                **build_message("extreme_pairwise_warning", scale_value=int(scale_value), criterion_a=item.get("left"), criterion_b=item.get("right")),
                "relatedCriteria": [item.get("left"), item.get("right")],
                "requiresAcknowledgement": True,
                "requiresReason": True,
            })

    weight_rows = []
    for name, weight in (final_weights or {}).items():
        if str(name).startswith("__"):
            continue
        weight_rows.append({"name": name, "weight": _as_float(weight)})
    weight_rows.sort(key=lambda item: item["weight"], reverse=True)
    if weight_rows and weight_rows[0]["weight"] >= DOMINANT_WEIGHT_THRESHOLD:
        warnings.append({
            "type": "dominant_weight",
            **build_message("dominant_weight_warning", criterion_a=weight_rows[0]["name"]),
            "relatedCriteria": [weight_rows[0]["name"]],
            "requiresAcknowledgement": True,
            "requiresReason": True,
        })
    if len(weight_rows) >= 2 and weight_rows[0]["weight"] - weight_rows[1]["weight"] >= WEIGHT_GAP_THRESHOLD:
        warnings.append({
            "type": "dominant_weight_gap",
            **build_message("dominant_weight_warning", criterion_a=weight_rows[0]["name"]),
            "relatedCriteria": [weight_rows[0]["name"]],
            "requiresAcknowledgement": True,
            "requiresReason": True,
        })
    return warnings


def build_validation_summary(
    reciprocal_valid,
    saaty_valid,
    cr_value,
    transitivity_warnings,
    pedagogical_warnings,
    tfn_valid=True,
    scale_saved=True,
    pairwise_complete=True,
    acknowledged=False,
):
    cr_valid = cr_value is not None and cr_value <= CR_THRESHOLD
    warnings_need_ack = bool(transitivity_warnings or pedagogical_warnings)
    can_calculate = tfn_valid and saaty_valid and scale_saved and pairwise_complete
    can_save_draft = tfn_valid and pairwise_complete
    can_apply_weight = tfn_valid and reciprocal_valid and saaty_valid and scale_saved and pairwise_complete and cr_valid and (not warnings_need_ack or acknowledged)

    summary = {
        "reciprocalCheck": {
            "label": "Reciprocal Check",
            "status": "valid" if reciprocal_valid else "invalid",
            "value": "Valid" if reciprocal_valid else "Invalid",
            "severity": "success" if reciprocal_valid else "danger",
            "message": build_message("reciprocal_valid" if reciprocal_valid else "reciprocal_invalid")["message"],
        },
        "saatyScaleCheck": {
            "label": "Saaty Scale Check",
            "status": "valid" if saaty_valid else "invalid",
            "value": "Valid" if saaty_valid else "Invalid",
            "severity": "success" if saaty_valid else "danger",
            "message": build_message("saaty_valid" if saaty_valid else "saaty_invalid")["message"],
        },
        "consistencyRatio": {
            "label": "Consistency Ratio",
            "status": "valid" if cr_valid else "invalid",
            "value": "Not calculated" if cr_value is None else f"{cr_value:.2f} {'Good' if cr_valid else 'Review Required'}",
            "severity": "success" if cr_valid else "danger",
            "message": build_message("cr_valid" if cr_valid else "cr_invalid")["message"],
        },
        "transitivityCheck": {
            "label": "Transitivity Check",
            "status": "valid" if not transitivity_warnings else "warning",
            "value": "Valid" if not transitivity_warnings else f"{len(transitivity_warnings)} warnings",
            "severity": "success" if not transitivity_warnings else "warning",
            "message": "No transitivity issue detected." if not transitivity_warnings else "Some comparison patterns may need review.",
        },
        "pedagogicalWarning": {
            "label": "Pedagogical Warning",
            "status": "valid" if not pedagogical_warnings else "warning",
            "value": "Valid" if not pedagogical_warnings else f"{len(pedagogical_warnings)} warnings",
            "severity": "success" if not pedagogical_warnings else "warning",
            "message": "No extreme dominance detected." if not pedagogical_warnings else "Some ATL criteria may dominate the weighting model.",
        },
    }
    errors = []
    if not can_apply_weight:
        errors.append({"type": "apply_locked", **build_message("apply_locked")})
    return {
        "canCalculate": can_calculate,
        "canSaveDraft": can_save_draft,
        "canApplyWeight": can_apply_weight,
        "summary": summary,
        "warnings": list(transitivity_warnings or []) + list(pedagogical_warnings or []),
        "errors": errors,
    }


def validate_weighting_payload(packages, scale_options, result=None, acknowledged=False):
    scale_validation = validate_tfn_scale_options(scale_options)
    valid_labels = {item.get("label") for item in scale_validation["scaleOptions"]}
    invalid_pairwise = []
    expected = 0
    actual = 0
    for package in (packages or {}).values():
        criteria = list(dict.fromkeys(package.get("subskills") or package.get("criteria") or []))
        comparisons = package.get("pairwise") or package.get("pairwiseTrace") or []
        expected += len(list(combinations(criteria, 2)))
        actual += len(comparisons)
    for _, _, _, item in _comparison_items(packages):
        scale = item.get("scale") or item.get("linguistic_scale")
        if scale not in valid_labels:
            invalid_pairwise.append(scale)
    saaty_valid = not invalid_pairwise
    pairwise_complete = expected == 0 or actual >= expected
    transitivity = validate_transitivity(packages, scale_validation["scaleOptions"])
    pedagogical = validate_pedagogical_warnings(packages, scale_validation["scaleOptions"], (result or {}).get("weights"))
    summary = build_validation_summary(
        reciprocal_valid=True,
        saaty_valid=saaty_valid,
        cr_value=(result or {}).get("consistency"),
        transitivity_warnings=transitivity,
        pedagogical_warnings=pedagogical,
        tfn_valid=scale_validation["valid"],
        scale_saved=True,
        pairwise_complete=pairwise_complete,
        acknowledged=acknowledged,
    )
    summary["warnings"] = scale_validation["warnings"] + summary["warnings"]
    summary["errors"] = scale_validation["errors"] + summary["errors"]
    if not pairwise_complete:
        summary["canCalculate"] = False
        summary["canApplyWeight"] = False
    return summary
