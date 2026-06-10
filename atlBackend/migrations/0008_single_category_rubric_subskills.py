from django.db import migrations


def normalize_item_subskills(apps, schema_editor):
    ContextRubricItem = apps.get_model("atl", "ContextRubricItem")
    db_alias = schema_editor.connection.alias

    for item in ContextRubricItem.objects.using(db_alias).all():
        selected = list(item.subskills.using(db_alias).select_related("category").all())
        if not selected and item.subskill_id:
            selected = [item.subskill]
        if len(selected) <= 1:
            continue

        ordered = []
        seen = set()
        for subskill in selected:
            if not subskill or subskill.id in seen:
                continue
            ordered.append(subskill)
            seen.add(subskill.id)
        if len(ordered) <= 1:
            continue

        counts = {}
        first_seen = {}
        for index, subskill in enumerate(ordered):
            counts[subskill.category_id] = counts.get(subskill.category_id, 0) + 1
            first_seen.setdefault(subskill.category_id, index)

        majority_category_id = min(
            counts,
            key=lambda category_id: (-counts[category_id], first_seen[category_id]),
        )
        normalized = [subskill for subskill in ordered if subskill.category_id == majority_category_id]
        if not normalized:
            continue

        item.subskill_id = normalized[0].id
        item.save(update_fields=["subskill"], using=db_alias)
        item.subskills.set([subskill.id for subskill in normalized])


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0007_topic_is_active"),
    ]

    operations = [
        migrations.RunPython(normalize_item_subskills, migrations.RunPython.noop),
    ]
