# Generated manually for contextual ATL Fuzzy-AHP v2.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ATLCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["order", "name"]},
        ),
        migrations.CreateModel(
            name="LearningContext",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grade", models.CharField(blank=True, max_length=80)),
                ("subject_name", models.CharField(max_length=120)),
                ("unit_name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True)),
                ("legacy_topic_code", models.CharField(blank=True, max_length=80, null=True, unique=True)),
            ],
            options={"ordering": ["subject_name", "unit_name", "id"]},
        ),
        migrations.CreateModel(
            name="RubricScale",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=12, unique=True)),
                ("label", models.CharField(max_length=120)),
                ("fuzzy_lower", models.FloatField()),
                ("fuzzy_middle", models.FloatField()),
                ("fuzzy_upper", models.FloatField()),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["order", "code"]},
        ),
        migrations.CreateModel(
            name="ATLSubskill",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True)),
                ("order", models.PositiveIntegerField(default=0)),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subskills", to="atl.atlcategory")),
            ],
            options={"ordering": ["category__order", "order", "name"]},
        ),
        migrations.CreateModel(
            name="ContextATLMapping",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("context", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mappings", to="atl.learningcontext")),
                ("subskill", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="context_mappings", to="atl.atlsubskill")),
            ],
            options={"ordering": ["context__id", "order", "subskill__name"]},
        ),
        migrations.CreateModel(
            name="ContextRubricItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("level_descriptors", models.JSONField(default=dict)),
                ("order", models.PositiveIntegerField(default=0)),
                ("context", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rubric_items", to="atl.learningcontext")),
                ("subskill", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rubric_items", to="atl.atlsubskill")),
            ],
            options={"ordering": ["context__id", "order", "title"]},
        ),
        migrations.CreateModel(
            name="ContextWeightSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subskill_weights", models.JSONField(default=dict)),
                ("consistency_ratio", models.FloatField(default=0)),
                ("debug", models.JSONField(blank=True, default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="weight_snapshot", to="atl.learningcontext")),
            ],
        ),
        migrations.CreateModel(
            name="PairwiseComparison",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("linguistic_scale", models.CharField(max_length=80)),
                ("expert_user", models.CharField(blank=True, max_length=120)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pairwise_comparisons", to="atl.learningcontext")),
                ("left_subskill", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="left_pairwise_comparisons", to="atl.atlsubskill")),
                ("right_subskill", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="right_pairwise_comparisons", to="atl.atlsubskill")),
            ],
            options={"ordering": ["context__id", "id"]},
        ),
        migrations.CreateModel(
            name="StudentAssessment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(max_length=80)),
                ("teacher_note", models.TextField(blank=True)),
                ("evaluator", models.CharField(blank=True, max_length=120)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_assessments", to="atl.learningcontext")),
                ("rubric_item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_assessments", to="atl.contextrubricitem")),
                ("rubric_scale", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="student_assessments", to="atl.rubricscale")),
            ],
            options={"ordering": ["context__id", "student_id", "rubric_item__order"]},
        ),
        migrations.AddConstraint(
            model_name="atlsubskill",
            constraint=models.UniqueConstraint(fields=("category", "name"), name="unique_atl_subskill_per_category"),
        ),
        migrations.AddConstraint(
            model_name="contextatlmapping",
            constraint=models.UniqueConstraint(fields=("context", "subskill"), name="unique_context_subskill_mapping"),
        ),
        migrations.AddConstraint(
            model_name="contextrubricitem",
            constraint=models.UniqueConstraint(fields=("context", "title"), name="unique_context_rubric_item_title"),
        ),
        migrations.AddConstraint(
            model_name="pairwisecomparison",
            constraint=models.UniqueConstraint(fields=("context", "left_subskill", "right_subskill"), name="unique_context_pairwise_direction"),
        ),
        migrations.AddConstraint(
            model_name="studentassessment",
            constraint=models.UniqueConstraint(fields=("student_id", "context", "rubric_item"), name="unique_student_context_rubric_assessment"),
        ),
    ]
