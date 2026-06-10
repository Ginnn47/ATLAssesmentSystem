import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("atl", "0003_rubric_item_multi_subskills"),
    ]

    operations = [
        migrations.CreateModel(
            name="AcademicPeriod",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("academic_year", models.CharField(max_length=40)),
                ("semester", models.CharField(max_length=40)),
                ("is_active", models.BooleanField(default=False)),
            ],
            options={"ordering": ["-is_active", "-academic_year", "semester", "name"]},
        ),
        migrations.CreateModel(
            name="SchoolClass",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=40, unique=True)),
                ("display_name", models.CharField(max_length=120)),
                ("level", models.CharField(blank=True, max_length=80)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ["code"], "verbose_name_plural": "school classes"},
        ),
        migrations.CreateModel(
            name="Student",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nis", models.CharField(max_length=40, unique=True)),
                ("full_name", models.CharField(max_length=160)),
                ("avatar_tone", models.CharField(blank=True, max_length=120)),
                ("baseline_overall", models.CharField(blank=True, max_length=20)),
                ("baseline_strength", models.CharField(blank=True, max_length=120)),
                ("baseline_strength_value", models.CharField(blank=True, max_length=20)),
                ("baseline_focus", models.CharField(blank=True, max_length=120)),
                ("baseline_trend_value", models.CharField(blank=True, max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "school_class",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="students", to="atl.schoolclass"),
                ),
            ],
            options={"ordering": ["school_class__code", "full_name"]},
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nip", models.CharField(blank=True, max_length=80)),
                ("role_label", models.CharField(max_length=120)),
                ("role_group", models.CharField(max_length=80)),
                ("status", models.CharField(default="Aktif", max_length=40)),
                ("last_login_label", models.CharField(default="-", max_length=80)),
                (
                    "user",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="atl_profile", to=settings.AUTH_USER_MODEL),
                ),
                ("class_access", models.ManyToManyField(blank=True, related_name="user_profiles", to="atl.schoolclass")),
                ("subject_access", models.ManyToManyField(blank=True, related_name="user_profiles", to="atl.subject")),
            ],
            options={"ordering": ["role_group", "user__first_name", "user__username"]},
        ),
        migrations.AddField(
            model_name="studentassessment",
            name="academic_period",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="student_assessments",
                to="atl.academicperiod",
            ),
        ),
        migrations.AddField(
            model_name="studentassessment",
            name="student_record",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="context_assessments",
                to="atl.student",
            ),
        ),
    ]
