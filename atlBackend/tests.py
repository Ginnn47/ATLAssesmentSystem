import json
import tempfile
from itertools import combinations
from pathlib import Path

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from .models import (
    Assessment,
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    ATLSubskill,
    FuzzyWeight,
    LearningContext,
    RubricScale,
    PairwiseScaleOption,
    SchoolClass,
    Student,
    StudentAssessment,
    Subject,
    Topic,
    UserProfile,
)
from .services.contextual_atl import (
    calculate_student_context_score,
    ensure_contextual_seed,
    get_context,
    rubric_scale_to_score,
)
from .services.FuzzyATLEquation import calculate_fuzzy_ahp
from .services.excel_export import EXCEL_MIME
from .services.labels import ATL_CANONICAL_HIERARCHY, ATL_SUBSKILL_ALIASES, SUBSKILL_LABELS, get_score_level, normalize_score_band


class ContextualFuzzyAHPTests(TestCase):
    def setUp(self):
        ensure_contextual_seed()
        self.context = get_context("singing_christmas_carol")

    def test_pairwise_matrix_uses_reciprocal_tfn_values(self):
        result = calculate_fuzzy_ahp(
            ["Interpersonal relationships", "Exchanging Information", "Organization skills"],
            [
                {"left": "Interpersonal relationships", "right": "Exchanging Information", "scale": "Lebih penting"},
                {"left": "Interpersonal relationships", "right": "Organization skills", "scale": "Sangat lebih penting"},
                {"left": "Exchanging Information", "right": "Organization skills", "scale": "Sedikit lebih penting"},
            ],
        )

        matrix = result["debug"]["matrix"]
        self.assertEqual(matrix[0][1], [4.0, 5.0, 6.0])
        self.assertAlmostEqual(matrix[1][0][0], 1 / 6)
        self.assertAlmostEqual(matrix[1][0][1], 1 / 5)
        self.assertAlmostEqual(matrix[1][0][2], 1 / 4)
        self.assertNotEqual(result["consistency"], 0.042)

    def test_synthetic_extent_equal_comparisons_produce_equal_weights(self):
        criteria = ["Critical Thingking", "Creative Thingking", "InformationTransfer"]
        result = calculate_fuzzy_ahp(
            criteria,
            [
                {"left": left, "right": right, "scale": "Sama penting"}
                for left, right in combinations(criteria, 2)
            ],
        )

        self.assertEqual(result["debug"]["method"], "synthetic_extent")
        for weight in result["weights"].values():
            self.assertAlmostEqual(float(weight), 1 / 3, places=5)

    def test_editable_equal_scale_keeps_diagonal_neutral_and_uses_reciprocal(self):
        result = calculate_fuzzy_ahp(
            ["Critical Thingking", "Creative Thingking"],
            [{"left": "Critical Thingking", "right": "Creative Thingking", "scale": "Sama penting"}],
            scale_options={"Sama penting": [1, 1, 2]},
        )

        matrix = result["debug"]["matrix"]
        self.assertEqual(matrix[0][0], [1.0, 1.0, 1.0])
        self.assertEqual(matrix[1][1], [1.0, 1.0, 1.0])
        self.assertEqual(matrix[0][1], [1.0, 1.0, 2.0])
        self.assertEqual(matrix[1][0], [0.5, 1.0, 1.0])

    def test_missing_pairwise_stays_neutral_even_if_equal_scale_is_fuzzy(self):
        result = calculate_fuzzy_ahp(
            ["Critical Thingking", "Creative Thingking"],
            [],
            scale_options={"Sama penting": [1, 1, 2]},
        )

        matrix = result["debug"]["matrix"]
        self.assertEqual(matrix[0][1], [1.0, 1.0, 1.0])
        self.assertEqual(matrix[1][0], [1.0, 1.0, 1.0])

    def test_context_flow_exposes_backend_weighting_packages(self):
        response = self.client.get("/api/contexts/singing_christmas_carol/flow/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("weightingPackages", payload)
        self.assertIn("hasSavedWeight", payload)
        self.assertIn(payload["weightSource"], ["saved", "equal-fallback"])
        self.assertEqual(payload["hasSavedWeight"], payload["weightSource"] == "saved")

        packages = list(payload["weightingPackages"].values())
        self.assertTrue(packages)
        package = next(item for item in packages if len(item["subskills"]) > 1)
        self.assertEqual(len(package["pairs"]), len(list(combinations(package["subskills"], 2))))
        expected_pair_keys = {
            frozenset((pair["left"], pair["right"]))
            for pair in package["pairs"]
        }
        self.assertLessEqual(len(package["pairwise"]), len(package["pairs"]))
        self.assertTrue(
            all(
                frozenset((pair["left"], pair["right"])) in expected_pair_keys
                for pair in package["pairwise"]
            )
        )
        self.assertIn("weights", package)
        self.assertIn("debug", package)
        self.assertIn("scaleOptions", payload)
        self.assertTrue(payload["scaleOptions"])

    def test_seeded_rubric_items_use_one_atl_category_each(self):
        for item in self.context.rubric_items.prefetch_related("subskills", "subskills__category"):
            subskills = list(item.subskills.all()) or [item.subskill]
            category_ids = {subskill.category_id for subskill in subskills}
            self.assertLessEqual(len(category_ids), 1, item.title)

    def test_rubric_api_normalizes_mixed_subskills_to_majority_category(self):
        user = User.objects.create_user(username="admin", password="pass12345")
        UserProfile.objects.create(user=user, role_label="Admin", role_group="Admin", status="Aktif")
        self.client.force_login(user)
        thinking = list(ATLSubskill.objects.filter(category__name="Thinking Skills").order_by("order")[:2])
        self_management = ATLSubskill.objects.filter(category__name="Self-Management Skills").order_by("order").first()

        response = self.client.post(
            "/api/contexts/singing_christmas_carol/rubric-items/",
            data=json.dumps(
                {
                    "title": "Majority Category Rule Test",
                    "criteriaTopic": "Creating",
                    "subskillIds": [thinking[0].id, self_management.id, thinking[1].id],
                    "levels": {"NFI": "a", "PTE": "b", "DE": "c", "ME": "d", "EE": "e"},
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        subskills = response.json()["rubricItem"]["subskills"]
        self.assertEqual(len(subskills), 2)
        self.assertEqual({item["category"]["name"] for item in subskills}, {"Thinking Skills"})

    def test_canonical_subskill_registry_has_exactly_fourteen_unique_names(self):
        hierarchy_names = [
            subskill
            for category in ATL_CANONICAL_HIERARCHY
            for subskill in category["subskills"]
        ]

        self.assertEqual(len(hierarchy_names), 14)
        self.assertEqual(len(set(hierarchy_names)), 14)
        self.assertEqual(set(hierarchy_names), set(SUBSKILL_LABELS))
        self.assertTrue(all(canonical in SUBSKILL_LABELS for canonical in ATL_SUBSKILL_ALIASES.values()))

    def test_rubric_centroid_scores_match_plan(self):
        self.assertAlmostEqual(rubric_scale_to_score(RubricScale.objects.get(code="ME")), 0.7)
        self.assertAlmostEqual(rubric_scale_to_score(RubricScale.objects.get(code="EE")), 0.9)
        self.assertAlmostEqual(rubric_scale_to_score(RubricScale.objects.get(code="DE")), 0.5)

    def test_final_score_levels_use_expectation_scale(self):
        samples = [(90, "EE"), (75, "ME"), (55, "DE"), (35, "PTE"), (10, "NFI")]

        for score, expected in samples:
            self.assertEqual(get_score_level(score)["label"], expected)
        self.assertEqual(normalize_score_band("Excellent"), "EE")
        self.assertEqual(normalize_score_band("Good"), "ME")
        self.assertEqual(normalize_score_band("Average"), "DE")
        self.assertEqual(normalize_score_band("Low"), "PTE")
        self.assertEqual(normalize_score_band("Critical"), "NFI")

    def test_final_score_matches_simple_flow_example(self):
        scoring_context = LearningContext.objects.create(
            grade="Grade 3",
            subject_name="Singing",
            unit_name="Simple Choir Scoring Test",
        )
        subskills = {
            name: ATLSubskill.objects.get(name=name)
            for name in ["Interpersonal relationships", "Exchanging Information", "Organization skills"]
        }
        for order, subskill in enumerate(subskills.values()):
            ContextATLMapping.objects.create(context=scoring_context, subskill=subskill, order=order)

        rubric_items = [
            ("Ensemble Balance", "Interpersonal relationships"),
            ("Rhythm & Tempo Accuracy", "Exchanging Information"),
            ("Focus & Attention", "Organization skills"),
        ]
        for order, (title, subskill_name) in enumerate(rubric_items):
            item = ContextRubricItem.objects.create(
                context=scoring_context,
                subskill=subskills[subskill_name],
                title=title,
                criteria_topic="Choir Performance",
                order=order,
            )
            item.subskills.set([subskills[subskill_name]])

        ContextWeightSnapshot.objects.update_or_create(
            context=scoring_context,
            defaults={
                "subskill_weights": {
                    "Interpersonal relationships": "0.55",
                    "Exchanging Information": "0.30",
                    "Organization skills": "0.15",
                },
                "consistency_ratio": 0,
                "debug": {},
            },
        )

        ratings = {
            "Ensemble Balance": "ME",
            "Rhythm & Tempo Accuracy": "EE",
            "Focus & Attention": "DE",
        }
        for item_title, scale_code in ratings.items():
            rubric_item = scoring_context.rubric_items.get(title=item_title)
            StudentAssessment.objects.update_or_create(
                student_id="michael",
                context=scoring_context,
                rubric_item=rubric_item,
                defaults={"rubric_scale": RubricScale.objects.get(code=scale_code)},
            )

        score = calculate_student_context_score("michael", scoring_context)
        self.assertAlmostEqual(score["rawScore"], 73)
        self.assertEqual(score["score"], "73.00")


class ReportExcelExportTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.settings_override = override_settings(BASE_DIR=Path(self.temp_dir.name))
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.archive_dir = Path(self.temp_dir.name) / "Document Output"
        self.user = User.objects.create_user(username="exporter", password="atl12345")
        UserProfile.objects.create(user=self.user, role_label="Evaluator", role_group="Evaluator", status="Aktif")
        self.client.force_login(self.user)

    def post_export(self, payload, origin=None):
        extra = {"HTTP_ORIGIN": origin} if origin else {}
        return self.client.post(
            "/api/reports/export/",
            data=json.dumps(payload),
            content_type="application/json",
            **extra,
        )

    def test_report_export_returns_xlsx_file(self):
        response = self.post_export(
            {
                "meta": {
                    "filename": "ATL Report Test.xlsx",
                    "className": "3A - Primary",
                    "subject": "Singing",
                    "subTopic": "Christmas Carol",
                    "rowCount": 1,
                    "generatedAt": "2026-06-03",
                },
                "columns": [
                    {"key": "no", "label": "NO"},
                    {"key": "name", "label": "NAME"},
                    {"key": "score", "label": "SCORE"},
                ],
                "rows": [{"no": 1, "name": "Siswa A", "score": 70}],
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], EXCEL_MIME)
        self.assertIn('attachment; filename="ATL_Report_Test.xlsx"', response["Content-Disposition"])
        self.assertEqual(response.content[:2], b"PK")
        archived_file = self.archive_dir / response["X-Archived-Filename"]
        self.assertEqual(archived_file.name, "ATL_Report_Test.xlsx")
        self.assertTrue(archived_file.exists())
        self.assertEqual(archived_file.read_bytes(), response.content)

    def test_report_export_requires_login(self):
        self.client.logout()
        response = self.post_export(
            {
                "meta": {"filename": "ATL Report Test.xlsx"},
                "columns": [{"key": "name", "label": "NAME"}],
                "rows": [{"name": "Siswa A"}],
            }
        )

        self.assertIn(response.status_code, [401, 403])
        self.assertFalse(self.archive_dir.exists())

    def test_report_export_requires_columns(self):
        response = self.post_export({"meta": {}, "columns": [], "rows": []})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Columns are required for Excel export.")
        self.assertFalse(self.archive_dir.exists())

    def test_report_export_sanitizes_filename(self):
        response = self.post_export(
            {
                "meta": {"filename": "ATL Report / 3A * IPA"},
                "columns": [{"key": "name", "label": "NAME"}],
                "rows": [{"name": "Siswa A"}],
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('filename="ATL_Report_3A_IPA.xlsx"', response["Content-Disposition"])
        self.assertTrue((self.archive_dir / "ATL_Report_3A_IPA.xlsx").exists())

    def test_report_export_keeps_archive_history_when_filename_exists(self):
        payload = {
            "meta": {"filename": "ATL Same.xlsx"},
            "columns": [{"key": "name", "label": "NAME"}],
            "rows": [{"name": "Siswa A"}],
        }

        first = self.post_export(payload)
        second = self.post_export(payload)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first["X-Archived-Filename"], "ATL_Same.xlsx")
        self.assertNotEqual(first["X-Archived-Filename"], second["X-Archived-Filename"])
        self.assertTrue(second["X-Archived-Filename"].startswith("ATL_Same_"))
        self.assertEqual(len(list(self.archive_dir.glob("ATL_Same*.xlsx"))), 2)

    def test_report_export_allows_both_vite_dev_origins(self):
        payload = {
            "meta": {"filename": "ATL Report"},
            "columns": [{"key": "name", "label": "NAME"}],
            "rows": [{"name": "Siswa A"}],
        }

        for origin in ["http://127.0.0.1:5173", "http://localhost:5173"]:
            response = self.post_export(payload, origin=origin)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Access-Control-Allow-Origin"], origin)


class AssessmentSyncTests(TestCase):
    def setUp(self):
        ensure_contextual_seed()
        self.user = User.objects.create_user(username="teacher", password="atl12345")
        UserProfile.objects.create(user=self.user, role_label="PJ Mapel", role_group="PJ Mapel", status="Aktif")
        self.client.force_login(self.user)
        self.subject, _ = Subject.objects.get_or_create(code="singing", defaults={"label": "Singing"})
        self.topic, _ = Topic.objects.get_or_create(
            subject=self.subject,
            code="singing_christmas_carol",
            defaults={"label": "Choir"},
        )
        self.school_class, _ = SchoolClass.objects.get_or_create(
            code="3A",
            defaults={"display_name": "3A - Primary", "level": "Primary", "is_active": True},
        )
        Student.objects.update_or_create(
            id=1,
            defaults={
                "nis": "NIS 202104012",
                "full_name": "Adzana Ashel Angelia",
                "school_class": self.school_class,
                "avatar_tone": "from-amber-200 to-yellow-400",
                "is_active": True,
            },
        )
        self.context = get_context("singing_christmas_carol")
        self.rubric_item = self.context.rubric_items.prefetch_related("subskills").first()
        self.subskill = list(self.rubric_item.subskills.all())[0]
        self.rating_key = f"singing_christmas_carol_{self.rubric_item.title}_{self.subskill.name}"

    def post_assessment(self, ratings, teacher_note="", clear=False):
        return self.client.post(
            "/api/assessments/",
            data=json.dumps(
                {
                    "studentId": "1",
                    "topic": "singing_christmas_carol",
                    "ratings": ratings,
                    "teacherNote": teacher_note,
                    "clear": clear,
                }
            ),
            content_type="application/json",
        )

    def test_assessment_post_saves_legacy_and_context_rows(self):
        response = self.post_assessment({self.rating_key: "Meeting Expectation"}, teacher_note="Draft sudah final.")

        self.assertEqual(response.status_code, 200)
        legacy = Assessment.objects.get(student_id="1", topic=self.topic)
        self.assertEqual(legacy.ratings[self.rating_key], "Meeting Expectation")
        self.assertTrue(
            StudentAssessment.objects.filter(
                student_id="1",
                context=self.context,
                rubric_item=self.rubric_item,
                rubric_scale__code="ME",
                evaluator="teacher",
                teacher_note="Draft sudah final.",
            ).exists()
        )
        payload = response.json()
        self.assertEqual(
            payload["assessments"]["1"]["singing_christmas_carol"][self.rating_key],
            "Meeting Expectation",
        )

    def test_assessment_post_rejects_topic_without_criteria_with_specific_message(self):
        empty_topic, _ = Topic.objects.update_or_create(
            subject=self.subject,
            code="singing_empty_topic",
            defaults={"label": "Empty Topic", "is_active": True},
        )
        response = self.client.post(
            "/api/assessments/",
            data=json.dumps({"studentId": "1", "topic": empty_topic.code, "ratings": {"dummy": "Meeting Expectation"}}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Assessment belum tersedia, belum ada kriteria untuk mapel ini.")

    def test_assessment_post_for_context_rubric_topic_does_not_return_generic_unavailable(self):
        response = self.post_assessment({self.rating_key: "Meeting Expectation"})

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json().get("error"), "Assessment unavailable")

    def test_batch_assessment_post_saves_multiple_students_in_one_request(self):
        Student.objects.update_or_create(
            id=2,
            defaults={
                "nis": "NIS 202104013",
                "full_name": "Student Dua",
                "school_class": self.school_class,
                "avatar_tone": "from-sky-200 to-blue-400",
                "is_active": True,
            },
        )
        response = self.client.post(
            "/api/assessments/",
            data=json.dumps(
                {
                    "items": [
                        {"studentId": "1", "topic": "singing_christmas_carol", "ratings": {self.rating_key: "Meeting Expectation"}},
                        {"studentId": "2", "topic": "singing_christmas_carol", "ratings": {self.rating_key: "Exceeding Expectation"}},
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["items"]), 2)
        self.assertEqual(payload["savedCount"], 2)
        self.assertEqual([item["status"] for item in payload["items"]], ["saved", "saved"])
        self.assertEqual(Assessment.objects.filter(topic=self.topic, student_id__in=["1", "2"]).count(), 2)
        context_rows = list(
            StudentAssessment.objects.filter(context=self.context, student_id__in=["1", "2"])
            .values("student_id", "evaluator", "rubric_scale__code")
            .order_by("student_id")
        )
        self.assertEqual(
            context_rows,
            [
                {"student_id": "1", "evaluator": "teacher", "rubric_scale__code": "ME"},
                {"student_id": "2", "evaluator": "teacher", "rubric_scale__code": "EE"},
            ],
        )

    def test_batch_assessment_rejects_empty_item_without_deleting_existing_value(self):
        self.post_assessment({self.rating_key: "Meeting Expectation"})
        response = self.client.post(
            "/api/assessments/",
            data=json.dumps(
                {
                    "items": [
                        {"studentId": "1", "topic": "singing_christmas_carol", "ratings": {}},
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("clear=true", response.json()["error"])
        legacy = Assessment.objects.get(student_id="1", topic=self.topic)
        self.assertEqual(legacy.ratings[self.rating_key], "Meeting Expectation")
        self.assertEqual(StudentAssessment.objects.filter(student_id="1", context=self.context).count(), 1)

    def test_assessment_post_rejects_empty_ratings_without_explicit_clear(self):
        self.post_assessment({self.rating_key: "Meeting Expectation"})
        response = self.post_assessment({})

        self.assertEqual(response.status_code, 400)
        self.assertIn("clear=true", response.json()["error"])
        legacy = Assessment.objects.get(student_id="1", topic=self.topic)
        self.assertEqual(legacy.ratings[self.rating_key], "Meeting Expectation")
        self.assertEqual(StudentAssessment.objects.filter(student_id="1", context=self.context).count(), 1)

    def test_assessment_post_clear_explicitly_removes_context_ratings(self):
        self.post_assessment({self.rating_key: "Meeting Expectation"})
        response = self.post_assessment({}, clear=True)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "cleared")
        self.assertFalse(Assessment.objects.filter(student_id="1", topic=self.topic).exists())
        self.assertEqual(StudentAssessment.objects.filter(student_id="1", context=self.context).count(), 0)

    def test_assessment_preview_scores_draft_without_persisting_it(self):
        response = self.client.post(
            "/api/assessments/preview/",
            data=json.dumps(
                {
                    "items": [
                        {"studentId": "1", "topic": "singing_christmas_carol", "ratings": {self.rating_key: "Meeting Expectation"}},
                        {"studentId": "2", "topic": "singing_christmas_carol", "ratings": {self.rating_key: "Exceeding Expectation"}},
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json()["scores"]["1"]["rawScore"], 0)
        self.assertGreater(response.json()["scores"]["2"]["rawScore"], response.json()["scores"]["1"]["rawScore"])
        self.assertEqual(Assessment.objects.count(), 0)
        self.assertEqual(StudentAssessment.objects.count(), 0)

    def test_assessment_preview_requires_login(self):
        self.client.logout()
        response = self.client.post(
            "/api/assessments/preview/",
            data=json.dumps(
                {
                    "items": [
                        {"studentId": "1", "topic": "singing_christmas_carol", "ratings": {self.rating_key: "Meeting Expectation"}},
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertIn(response.status_code, [401, 403])
        self.assertEqual(Assessment.objects.count(), 0)
        self.assertEqual(StudentAssessment.objects.count(), 0)

    def test_report_requires_login(self):
        self.client.logout()
        response = self.client.get(
            "/api/reports/",
            data={"class": "3A - Primary", "topic": "singing_christmas_carol"},
        )

        self.assertIn(response.status_code, [401, 403])

    def test_report_with_configured_criteria_returns_no_data_before_assessment(self):
        response = self.client.get(
            "/api/reports/",
            data={"class": "3A - Primary", "topic": "singing_christmas_carol"},
        )

        self.assertEqual(response.status_code, 200)
        student = next(item for item in response.json()["students"] if str(item["id"]) == "1")
        self.assertEqual(student["rawScore"], 0)
        self.assertEqual(student["predikat"], "No Data")
        self.assertEqual(student["assessedCount"], 0)
        self.assertGreater(student["totalIndicators"], 0)

    def test_report_uses_saved_context_assessment(self):
        self.post_assessment({self.rating_key: "Meeting Expectation"}, teacher_note="Latihan artikulasi masih perlu dijaga.")

        response = self.client.get(
            "/api/reports/",
            data={"class": "3A - Primary", "topic": "singing_christmas_carol"},
        )

        self.assertEqual(response.status_code, 200)
        student = next(item for item in response.json()["students"] if str(item["id"]) == "1")
        self.assertGreater(student["rawScore"], 0)
        self.assertGreater(student["assessedCount"], 0)
        self.assertIn("Paling dikuasai:", student["teacherInsight"])
        self.assertIn("Perlu dipelajari lebih lanjut:", student["teacherInsight"])
        self.assertIn("Catatan guru: Latihan artikulasi masih perlu dijaga.", student["teacherInsight"])


class WeightPersistenceTests(TestCase):
    def setUp(self):
        ensure_contextual_seed()
        self.user = User.objects.create_user(username="academic", password="atl12345")
        UserProfile.objects.create(user=self.user, role_label="Akademik", role_group="Akademik", status="Aktif")
        self.client.force_login(self.user)
        self.subject, _ = Subject.objects.get_or_create(code="singing", defaults={"label": "Singing"})
        self.topic, _ = Topic.objects.get_or_create(
            subject=self.subject,
            code="singing_christmas_carol",
            defaults={"label": "Choir"},
        )
        self.context = get_context("singing_christmas_carol")

    def test_context_weight_save_updates_snapshot_and_legacy_weight(self):
        rubric_item = self.context.rubric_items.get(title="Role Play & Musical Contribution")
        subskills = [item.name for item in rubric_item.subskills.all()]
        package_key = f"rubric-{rubric_item.id}"
        flat_key = f"{rubric_item.title} ({subskills[0]})"
        payload = {
            "persist": True,
            "pairwise": {
                "__criterionPackages": True,
                "weights": {flat_key: "0.750000"},
                "savedAt": "2026-06-03T12:00:00",
                "activity": {"topicId": "singing_christmas_carol", "topicLabel": "Choir"},
                "packages": {
                    package_key: {
                        "title": rubric_item.title,
                        "subskills": subskills,
                        "pairwise": [
                            {"left": left, "right": right, "scale": "Sama penting"}
                            for left, right in combinations(subskills, 2)
                        ],
                        "weights": {"Interpersonal relationships": "0.750000"},
                        "consistency": 0.02,
                    }
                },
            },
        }

        response = self.client.post(
            "/api/contexts/singing_christmas_carol/weights/calculate/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        get_response = self.client.get("/api/contexts/singing_christmas_carol/weights/")

        self.assertEqual(response.status_code, 200)
        snapshot = ContextWeightSnapshot.objects.get(context=self.context)
        legacy = FuzzyWeight.objects.get(topic=self.topic)
        self.assertEqual(snapshot.subskill_weights[flat_key], f"{1 / len(subskills):.6f}")
        self.assertNotEqual(snapshot.subskill_weights[flat_key], "0.750000")
        self.assertEqual(snapshot.subskill_weights["__activity"]["topicLabel"], "Choir")
        self.assertIn(package_key, legacy.weights["packages"])
        self.assertEqual(get_response.json()["packages"][package_key]["title"], rubric_item.title)

    def test_context_weight_save_rejects_incomplete_pairwise(self):
        rubric_item = self.context.rubric_items.get(title="Role Play & Musical Contribution")
        subskills = [item.name for item in rubric_item.subskills.all()]
        response = self.client.post(
            "/api/contexts/singing_christmas_carol/weights/calculate/",
            data=json.dumps(
                {
                    "persist": True,
                    "pairwise": {
                        "__criterionPackages": True,
                        "packages": {
                            f"rubric-{rubric_item.id}": {
                                "title": rubric_item.title,
                                "subskills": subskills,
                                "pairwise": [],
                            }
                        },
                    },
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_pairwise_scale_can_be_edited_per_context(self):
        response = self.client.put(
            "/api/contexts/singing_christmas_carol/pairwise-scale/",
            data=json.dumps(
                {
                    "options": [
                        {"code": "equal", "fuzzyLower": 1, "fuzzyMiddle": 1, "fuzzyUpper": 2},
                    ]
                }
            ),
            content_type="application/json",
        )
        flow_response = self.client.get("/api/contexts/singing_christmas_carol/flow/")

        self.assertEqual(response.status_code, 200)
        equal_scale = next(item for item in response.json()["scaleOptions"] if item["code"] == "equal")
        self.assertEqual(equal_scale["tfn"], [1.0, 1.0, 2.0])
        self.assertEqual(equal_scale["reciprocal"], [0.5, 1.0, 1.0])
        self.assertEqual(
            PairwiseScaleOption.objects.get(context=self.context, code="equal").fuzzy_upper,
            2,
        )
        self.assertEqual(
            next(item for item in flow_response.json()["scaleOptions"] if item["code"] == "equal")["tfn"],
            [1.0, 1.0, 2.0],
        )

    def test_context_weight_calculation_uses_saved_pairwise_scale(self):
        self.client.put(
            "/api/contexts/singing_christmas_carol/pairwise-scale/",
            data=json.dumps({"options": [{"code": "equal", "fuzzyLower": 1, "fuzzyMiddle": 1, "fuzzyUpper": 2}]}),
            content_type="application/json",
        )
        rubric_item = next(
            item for item in self.context.rubric_items.prefetch_related("subskills").all()
            if item.subskills.count() > 1
        )
        subskills = [item.name for item in rubric_item.subskills.all()]
        response = self.client.post(
            "/api/contexts/singing_christmas_carol/weights/calculate/",
            data=json.dumps(
                {
                    "persist": False,
                    "pairwise": {
                        "__criterionPackages": True,
                        "packages": {
                            f"rubric-{rubric_item.id}": {
                                "title": rubric_item.title,
                                "subskills": subskills,
                                "pairwise": [
                                    {"left": subskills[0], "right": subskills[1], "scale": "Sama penting"}
                                ],
                            }
                        },
                    },
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        package = next(iter(response.json()["packages"].values()))
        matrix = package["debug"]["matrix"]
        self.assertEqual(matrix[0][0], [1.0, 1.0, 1.0])
        self.assertEqual(matrix[0][1], [1.0, 1.0, 2.0])
        self.assertEqual(matrix[1][0], [0.5, 1.0, 1.0])

    def test_pairwise_scale_rejects_invalid_tfn(self):
        response = self.client.put(
            "/api/contexts/singing_christmas_carol/pairwise-scale/",
            data=json.dumps(
                {
                    "options": [
                        {"code": "important", "fuzzyLower": 5, "fuzzyMiddle": 4, "fuzzyUpper": 6},
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_pairwise_scale_reset_restores_default(self):
        self.client.put(
            "/api/contexts/singing_christmas_carol/pairwise-scale/",
            data=json.dumps({"options": [{"code": "equal", "fuzzyLower": 1, "fuzzyMiddle": 1, "fuzzyUpper": 2}]}),
            content_type="application/json",
        )
        response = self.client.post("/api/contexts/singing_christmas_carol/pairwise-scale/reset/")

        self.assertEqual(response.status_code, 200)
        equal_scale = next(item for item in response.json()["scaleOptions"] if item["code"] == "equal")
        self.assertEqual(equal_scale["tfn"], [1.0, 1.0, 1.0])


class TopicDeletionTests(TestCase):
    def setUp(self):
        ensure_contextual_seed()
        self.user = User.objects.create_user(username="topic-admin", password="atl12345")
        UserProfile.objects.create(user=self.user, role_label="Akademik", role_group="Akademik", status="Aktif")
        self.client.force_login(self.user)
        self.client.get("/api/topics/")

    def test_delete_topic_archives_it_and_removes_context(self):
        response = self.client.delete("/api/topics/singing_christmas_carol/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Topic.objects.get(code="singing_christmas_carol").is_active)
        self.assertFalse(LearningContext.objects.filter(legacy_topic_code="singing_christmas_carol").exists())
        subjects = self.client.get("/api/topics/").json()["subjects"]
        topic_ids = [topic["id"] for subject in subjects for topic in subject["topics"]]
        self.assertNotIn("singing_christmas_carol", topic_ids)

    def test_delete_topic_requires_login(self):
        self.client.logout()
        response = self.client.delete("/api/topics/singing_christmas_carol/")

        self.assertEqual(response.status_code, 401)
        self.assertTrue(Topic.objects.get(code="singing_christmas_carol").is_active)


class ClassDeletionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="class-admin", password="atl12345")
        UserProfile.objects.create(user=self.user, role_label="Admin", role_group="Admin", status="Aktif")
        self.client.force_login(self.user)
        self.school_class = SchoolClass.objects.create(code="9Z", display_name="9Z - Primary", level="Primary", is_active=True)
        Student.objects.create(nis="NIS 9001", full_name="Student One", school_class=self.school_class, is_active=True)
        teacher = User.objects.create_user(username="teacher-9z", password="atl12345")
        self.profile = UserProfile.objects.create(user=teacher, role_label="Guru Wali Kelas", role_group="Guru Wali Kelas", status="Aktif")
        self.profile.class_access.add(self.school_class)

    def test_delete_class_hides_class_students_and_access(self):
        response = self.client.delete("/api/classes/?code=9Z")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(SchoolClass.objects.get(code="9Z").is_active)
        self.assertFalse(Student.objects.get(nis="NIS 9001").is_active)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.class_access.filter(code="9Z").exists())
        class_codes = [item["code"] for item in self.client.get("/api/classes/").json()["classes"]]
        self.assertNotIn("9Z", class_codes)


class AuthManagementTests(TestCase):
    def post_login(self, username, password):
        return self.client.post(
            "/api/auth/login/",
            data=json.dumps({"username": username, "password": password}),
            content_type="application/json",
        )

    def test_active_profile_can_login_and_me_returns_role(self):
        user = User.objects.create_user(username="wali", password="atl12345", first_name="Guru", last_name="Wali")
        UserProfile.objects.create(user=user, nip="NIP001", role_label="Guru Wali Kelas", role_group="Guru Wali Kelas", status="Aktif")

        login_response = self.post_login("wali", "atl12345")
        me_response = self.client.get("/api/auth/me/")

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["user"]["roleLabel"], "Guru Wali Kelas")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["user"]["username"], "wali")
        self.assertNotEqual(me_response.json()["user"]["lastLogin"], "-")

    def test_superuser_without_profile_logs_in_as_admin(self):
        User.objects.create_superuser(
            username="Ginnn",
            password="atl12345",
            first_name="Gin",
            last_name="Admin",
        )

        login_response = self.post_login("Ginnn", "atl12345")
        me_response = self.client.get("/api/auth/me/")

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["user"]["name"], "Gin Admin")
        self.assertEqual(login_response.json()["user"]["roleLabel"], "Admin")
        self.assertEqual(me_response.json()["user"]["role"], "Admin")
        self.assertIn("sessionid", login_response.cookies)
        self.assertTrue(UserProfile.objects.filter(user__username="Ginnn", role_group="Admin").exists())

    def test_inactive_profile_cannot_login(self):
        user = User.objects.create_user(username="inactive", password="atl12345")
        UserProfile.objects.create(user=user, role_label="PJ Mapel", role_group="PJ Mapel", status="Nonaktif")

        response = self.post_login("inactive", "atl12345")

        self.assertEqual(response.status_code, 403)

    def test_mutation_requires_active_profile(self):
        user = User.objects.create_user(username="no-profile", password="atl12345")
        self.client.force_login(user)

        response = self.client.post(
            "/api/assessments/",
            data=json.dumps({"studentId": "1", "topic": "singing_christmas_carol", "ratings": {}}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
