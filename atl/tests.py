from django.test import TestCase

from .models import (
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    LearningContext,
    RubricScale,
    StudentAssessment,
)
from .services.contextual_atl import (
    calculate_student_context_score,
    ensure_contextual_seed,
    get_context,
    rubric_scale_to_score,
)
from .services.fuzzy_ahp import calculate_fuzzy_ahp


class ContextualFuzzyAHPTests(TestCase):
    def setUp(self):
        ensure_contextual_seed()
        self.context = get_context("singing_christmas_carol")

    def test_pairwise_matrix_uses_reciprocal_tfn_values(self):
        result = calculate_fuzzy_ahp(
            ["Interpersonal relationships", "Exchanging-information", "Organization skills"],
            [
                {"left": "Interpersonal relationships", "right": "Exchanging-information", "scale": "Lebih penting"},
                {"left": "Interpersonal relationships", "right": "Organization skills", "scale": "Sangat lebih penting"},
                {"left": "Exchanging-information", "right": "Organization skills", "scale": "Sedikit lebih penting"},
            ],
        )

        matrix = result["debug"]["matrix"]
        self.assertEqual(matrix[0][1], [4.0, 5.0, 6.0])
        self.assertAlmostEqual(matrix[1][0][0], 1 / 6)
        self.assertAlmostEqual(matrix[1][0][1], 1 / 5)
        self.assertAlmostEqual(matrix[1][0][2], 1 / 4)
        self.assertNotEqual(result["consistency"], 0.042)

    def test_rubric_centroid_scores_match_plan(self):
        self.assertAlmostEqual(rubric_scale_to_score(RubricScale.objects.get(code="ME")), 0.7)
        self.assertAlmostEqual(rubric_scale_to_score(RubricScale.objects.get(code="EE")), 0.9)
        self.assertAlmostEqual(rubric_scale_to_score(RubricScale.objects.get(code="DE")), 0.5)

    def test_final_score_matches_simple_flow_example(self):
        scoring_context = LearningContext.objects.create(
            grade="Grade 3",
            subject_name="Singing",
            unit_name="Simple Choir Scoring Test",
        )
        subskills = {
            name: self.context.mappings.select_related("subskill")
            .get(subskill__name=name)
            .subskill
            for name in ["Interpersonal relationships", "Exchanging-information", "Organization skills"]
        }
        for order, subskill in enumerate(subskills.values()):
            ContextATLMapping.objects.create(context=scoring_context, subskill=subskill, order=order)

        rubric_items = [
            ("Ensemble Balance", "Interpersonal relationships"),
            ("Rhythm & Tempo Accuracy", "Exchanging-information"),
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
                    "Exchanging-information": "0.30",
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
