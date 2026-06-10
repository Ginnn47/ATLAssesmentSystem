from django.db import migrations


FINAL_NAME = "Exchanging Information"
ALIAS_NAMES = {
    "Exchanging-information",
    "Exchanging-information skills",
    "Active Listening",
}


def replace_text(value):
    if not isinstance(value, str):
        return value
    result = value
    for alias in sorted(ALIAS_NAMES, key=len, reverse=True):
        result = result.replace(alias, FINAL_NAME)
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


def get_final_subskill(ATLCategory, ATLSubskill):
    communication, _ = ATLCategory.objects.get_or_create(
        name="Communication Skills",
        defaults={"order": 2},
    )
    final = ATLSubskill.objects.filter(category=communication, name=FINAL_NAME).first()
    source = ATLSubskill.objects.filter(category=communication, name="Exchanging-information").first()

    if final:
        if source and final.order != source.order:
            final.order = source.order
            final.save(update_fields=["order"])
        return final

    if source:
        source.name = FINAL_NAME
        source.save(update_fields=["name"])
        return source

    final, _ = ATLSubskill.objects.get_or_create(
        category=communication,
        name=FINAL_NAME,
        defaults={"order": 0},
    )
    return final


def relink_aliases(apps, schema_editor):
    ATLCategory = apps.get_model("atl", "ATLCategory")
    ATLSubskill = apps.get_model("atl", "ATLSubskill")
    ContextATLMapping = apps.get_model("atl", "ContextATLMapping")
    ContextRubricItem = apps.get_model("atl", "ContextRubricItem")
    PairwiseComparison = apps.get_model("atl", "PairwiseComparison")
    ContextWeightSnapshot = apps.get_model("atl", "ContextWeightSnapshot")
    FuzzyWeight = apps.get_model("atl", "FuzzyWeight")
    Assessment = apps.get_model("atl", "Assessment")

    final = get_final_subskill(ATLCategory, ATLSubskill)
    aliases = ATLSubskill.objects.filter(name__in=ALIAS_NAMES).exclude(id=final.id)

    through_model = ContextRubricItem.subskills.through
    item_field, subskill_field = find_m2m_fields(through_model, ContextRubricItem, ATLSubskill)

    for alias in aliases:
        for mapping in ContextATLMapping.objects.filter(subskill=alias):
            duplicate = ContextATLMapping.objects.filter(
                context_id=mapping.context_id,
                subskill=final,
            ).exclude(id=mapping.id).first()
            if duplicate:
                mapping.delete()
            else:
                mapping.subskill_id = final.id
                mapping.save(update_fields=["subskill"])

        ContextRubricItem.objects.filter(subskill=alias).update(subskill=final)

        if item_field and subskill_field:
            for row in through_model.objects.filter(**{subskill_field.name: alias}):
                item_id = getattr(row, item_field.attname)
                duplicate = through_model.objects.filter(
                    **{
                        item_field.attname: item_id,
                        subskill_field.name: final,
                    }
                ).exclude(id=row.id).first()
                if duplicate:
                    row.delete()
                else:
                    setattr(row, subskill_field.attname, final.id)
                    row.save(update_fields=[subskill_field.name])

        comparisons = PairwiseComparison.objects.filter(left_subskill=alias) | PairwiseComparison.objects.filter(right_subskill=alias)
        for comparison in comparisons:
            next_left_id = final.id if comparison.left_subskill_id == alias.id else comparison.left_subskill_id
            next_right_id = final.id if comparison.right_subskill_id == alias.id else comparison.right_subskill_id
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

    ATLSubskill.objects.filter(name__in=ALIAS_NAMES).exclude(id=final.id).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0005_dedupe_atl_subskills"),
    ]

    operations = [
        migrations.RunPython(relink_aliases, migrations.RunPython.noop),
    ]
