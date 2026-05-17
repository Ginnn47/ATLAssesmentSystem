# Generated manually for the hybrid ATL API transition.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Subject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=40, unique=True)),
                ("label", models.CharField(max_length=120)),
            ],
        ),
        migrations.CreateModel(
            name="Topic",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=80, unique=True)),
                ("label", models.CharField(max_length=160)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("order", models.PositiveIntegerField(default=0)),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="topics", to="atl.subject")),
            ],
            options={"ordering": ["subject__code", "order", "label"]},
        ),
        migrations.CreateModel(
            name="Criterion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("atl", models.JSONField(default=list)),
                ("levels", models.JSONField(default=dict)),
                ("order", models.PositiveIntegerField(default=0)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="criteria", to="atl.topic")),
            ],
            options={"ordering": ["topic__code", "order", "id"]},
        ),
        migrations.CreateModel(
            name="FuzzyWeight",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("weights", models.JSONField(default=dict)),
                ("debug", models.JSONField(blank=True, default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="weights", to="atl.topic")),
            ],
        ),
        migrations.CreateModel(
            name="Assessment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(max_length=80)),
                ("ratings", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assessments", to="atl.topic")),
            ],
        ),
        migrations.AddConstraint(
            model_name="fuzzyweight",
            constraint=models.UniqueConstraint(fields=("topic",), name="unique_fuzzy_weight_per_topic"),
        ),
        migrations.AddConstraint(
            model_name="assessment",
            constraint=models.UniqueConstraint(fields=("student_id", "topic"), name="unique_assessment_per_student_topic"),
        ),
    ]
