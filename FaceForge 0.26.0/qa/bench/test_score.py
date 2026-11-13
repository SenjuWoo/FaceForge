import unittest

from headmodel import load_efm
from score import score


class ScoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = load_efm("vanilla_female")
        cls.truths = [{"EFM_Jaw_Width": 1.5, "EFM_Chin_Width": -1.0},
                      {"EFM_Nose_Width": 2.0, "EFM_Jaw_Width": -0.8}]

    def test_perfect_recovery_scores_one(self):
        s = score(self.model, self.truths, [dict(t) for t in self.truths])
        self.assertAlmostEqual(s["skill"], 1.0, places=6)
        self.assertAlmostEqual(s["slider_corr"], 1.0, places=6)
        self.assertEqual(s["sign_agree"], 1.0)

    def test_neutral_prediction_scores_zero(self):
        s = score(self.model, self.truths, [{} for _ in self.truths])
        self.assertAlmostEqual(s["skill"], 0.0, places=6)

    def test_wrong_sign_is_worse_than_neutral(self):
        flipped = [{k: -v for k, v in t.items()} for t in self.truths]
        self.assertLess(score(self.model, self.truths, flipped)["skill"], 0.0)

    def test_detector_miss_is_counted(self):
        s = score(self.model, self.truths, [None, dict(self.truths[1])])
        self.assertEqual((s["n"], s["found"]), (2, 1))
        self.assertAlmostEqual(s["found_rate"], 0.5)

    def test_all_misses_do_not_crash(self):
        self.assertIsNone(score(self.model, self.truths, [None, None])["skill"])


if __name__ == "__main__":
    unittest.main()
