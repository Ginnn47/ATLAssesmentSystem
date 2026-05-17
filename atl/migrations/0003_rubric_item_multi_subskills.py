# Generated manually for multi-subskill rubric items.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0002_contextual_atl"),
    ]

    operations = [
        migrations.AddField(
            model_name="contextrubricitem",
            name="criteria_topic",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="contextrubricitem",
            name="subskills",
            field=models.ManyToManyField(blank=True, related_name="multi_rubric_items", to="atl.atlsubskill"),
        ),
    ]
