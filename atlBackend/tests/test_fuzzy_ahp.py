from django.test import TestCase

from atlBackend.services.FuzzyATLEquation import calculate_fuzzy_ahp


class FuzzyAhpBlackboxTest(TestCase):
    def test_calculate_fuzzy_ahp_returns_normalized_weights(self):
        result = calculate_fuzzy_ahp(
            ["Thinking Skills", "Communication Skills", "Social Skills"],
            [
                {"left": "Thinking Skills", "right": "Communication Skills", "scale": "Sama penting"},
                {"left": "Thinking Skills", "right": "Social Skills", "scale": "Lebih penting"},
                {"left": "Communication Skills", "right": "Social Skills", "scale": "Sedikit lebih penting"},
            ],
        )
        weights = result["weights"]
        self.assertEqual(set(weights.keys()), {"Thinking Skills", "Communication Skills", "Social Skills"})
        total = sum(float(value) for value in weights.values())
        self.assertAlmostEqual(total, 1.0, places=5)

    def test_empty_criteria_returns_empty_weight(self):
        result = calculate_fuzzy_ahp([], [])
        self.assertEqual(result["weights"], {})
        self.assertEqual(result["sumD"], "0.00")

