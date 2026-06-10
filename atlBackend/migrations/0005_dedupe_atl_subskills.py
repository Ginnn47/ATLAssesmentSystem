from django.db import migrations


CANONICAL_SUBSKILLS = {
    "Critical Thingking",
    "Creative Thingking",
    "InformationTransfer",
    "Reflection / Metacognitive",
    "Textual Literacy",
    "Media Literacy",
    "Ethical use of information",
    "Exchanging-information",
    "Literacy skills",
    "ICT skills",
    "Interpersonal relationships",
    "Social-emotional intelligence",
    "Organization skills",
    "State of Mind",
}

SUBSKILL_ALIASES = {
    "Critical-thinking skills": "Critical Thingking",
    "Creative-thinking skills": "Creative Thingking",
    "Transfer skills": "InformationTransfer",
    "Reflection / Metacognitive skills": "Reflection / Metacognitive",
    "Information-literacy skills": "Textual Literacy",
    "Media-literacy skills": "Media Literacy",
    "Ethical use of media/information": "Ethical use of information",
    "Exchanging-information skills": "Exchanging-information",
    "Active Listening": "Exchanging-information",
    "Developing positive interpersonal relationships": "Interpersonal relationships",
    "Developing social-emotional intelligence": "Social-emotional intelligence",
    "Collaboration": "Interpersonal relationships",
    "Social Awareness": "Social-emotional intelligence",
    "Self Regulation": "State of Mind",
    "Engagement": "State of Mind",
}


def replace_text(value):
    if not isinstance(value, str):
        return value
    result = value
    for alias, canonical in sorted(SUBSKILL_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        result = result.replace(alias, canonical)
    return result


def merge_value(existing, incoming):
    if isinstance(existing, dict) and isinstance(incoming, dict):
        merged = dict(existing)
        merged.update(incoming)
        return merged
    if existing in (None, "", {}, []):
        return incoming
    return existing


def normalize_json(value):
    if isinstance(value, dict):
        normalized = {}
        for key, item in value.items():
            normalized_key = replace_text(key)
            normalized_item = normalize_json(item)
            if normalized_key in normalized:
                normalized[normalized_key] = merge_value(normalized[normalized_key], normalized_item)
            else:
                normalized[normalized_key] = normalized_item
        return normalized
    if isinstance(value, list):
        return [normalize_json(item) for item in value]
    return replace_text(value)


def find_m2m_fields(through_model, item_model, subskill_model):
    item_field = None
    subskill_field = None
    for field in through_model._meta.fields:
        remote_model = getattr(getattr(field, "remote_field", None), "model", None)
        if remote_model == item_model:
            item_field = field
        if remote_model == subskill_model:
            subskill_field = field
    return item_field, subskill_field


def dedupe_subskills(apps, schema_editor):
    ATLSubskill = apps.get_model("atl", "ATLSubskill")
    ContextATLMapping = apps.get_model("atl", "ContextATLMapping")
    ContextRubricItem = apps.get_model("atl", "ContextRubricItem")
    PairwiseComparison = apps.get_model("atl", "PairwiseComparison")
    ContextWeightSnapshot = apps.get_model("atl", "ContextWeightSnapshot")
    FuzzyWeight = apps.get_model("atl", "FuzzyWeight")
    Assessment = apps.get_model("atl", "Assessment")

    subskills_by_name = {item.name: item for item in ATLSubskill.objects.select_related("category")}

    for alias_name, canonical_name in SUBSKILL_ALIASES.items():
        alias = subskills_by_name.get(alias_name)
        canonical = subskills_by_name.get(canonical_name)
        if not alias or not canonical:
            continue

        for mapping in ContextATLMapping.objects.filter(subskill=alias):
            duplicate = ContextATLMapping.objects.filter(
                context_id=mapping.context_id,
                subskill=canonical,
            ).exclude(id=mapping.id).first()
            if duplicate:
                mapping.delete()
            else:
                mapping.subskill_id = canonical.id
                mapping.save(update_fields=["subskill"])

        ContextRubricItem.objects.filter(subskill=alias).update(subskill=canonical)

        through_model = ContextRubricItem.subskills.through
        item_field, subskill_field = find_m2m_fields(through_model, ContextRubricItem, ATLSubskill)
        if item_field and subskill_field:
            for row in through_model.objects.filter(**{subskill_field.name: alias}):
                item_id = getattr(row, item_field.attname)
                duplicate = through_model.objects.filter(
                    **{
                        item_field.attname: item_id,
                        subskill_field.name: canonical,
                    }
                ).exclude(id=row.id).first()
                if duplicate:
                    row.delete()
                else:
                    setattr(row, subskill_field.attname, canonical.id)
                    row.save(update_fields=[subskill_field.name])

        for comparison in PairwiseComparison.objects.filter(left_subskill=alias) | PairwiseComparison.objects.filter(right_subskill=alias):
            next_left_id = canonical.id if comparison.left_subskill_id == alias.id else comparison.left_subskill_id
            next_right_id = canonical.id if comparison.right_subskill_id == alias.id else comparison.right_subskill_id
            if next_left_id == next_right_id:
                comparison.delete()
                continue
            duplicate = PairwiseComparison.objects.filter(
                context_id=comparison.context_id,
                left_subskill_id=next_left_id,
                right_subskill_id=next_right_id,
            ).exclude(id=comparison.id).first()
            if duplicate:
                comparison.delete()
            else:
                comparison.left_subskill_id = next_left_id
                comparison.right_subskill_id = next_right_id
                comparison.save(update_fields=["left_subskill", "right_subskill"])

    for snapshot in ContextWeightSnapshot.objects.all():
        snapshot.subskill_weights = normalize_json(snapshot.subskill_weights or {})
        snapshot.debug = normalize_json(snapshot.debug or {})
        snapshot.save(update_fields=["subskill_weights", "debug"])

    for weight in FuzzyWeight.objects.all():
        weight.weights = normalize_json(weight.weights or {})
        weight.debug = normalize_json(weight.debug or {})
        weight.save(update_fields=["weights", "debug"])

    for assessment in Assessment.objects.all():
        assessment.ratings = normalize_json(assessment.ratings or {})
        assessment.save(update_fields=["ratings"])

    ATLSubskill.objects.filter(name__in=SUBSKILL_ALIASES.keys()).delete()
    ATLSubskill.objects.exclude(name__in=CANONICAL_SUBSKILLS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0004_school_student_userprofile_period"),
    ]

    operations = [
        migrations.RunPython(dedupe_subskills, migrations.RunPython.noop),
    ]
