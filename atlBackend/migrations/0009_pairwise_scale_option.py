from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0008_single_category_rubric_subskills"),
    ]

    operations = [
        migrations.CreateModel(
            name="PairwiseScaleOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=40)),
                ("label", models.CharField(max_length=80)),
                ("ahp_value", models.PositiveIntegerField(default=1)),
                ("fuzzy_lower", models.FloatField()),
                ("fuzzy_middle", models.FloatField()),
                ("fuzzy_upper", models.FloatField()),
                ("order", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("context", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pairwise_scale_options", to="atl.learningcontext")),
            ],
            options={
                "ordering": ["context__id", "order", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="pairwisescaleoption",
            constraint=models.UniqueConstraint(fields=("context", "code"), name="unique_pairwise_scale_option_per_context"),
        ),
    ]
