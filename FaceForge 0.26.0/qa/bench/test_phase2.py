import unittest

import numpy as np

from phase2 import bounded_ridge, umeyama


class Phase2Tests(unittest.TestCase):
    def test_umeyama_recovers_a_known_similarity(self):
        rng = np.random.default_rng(0)
        src = rng.normal(size=(50, 2))
        th, s, t = 0.3, 1.7, np.array([4.0, -2.0])
        r = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
        dst = s * src @ r.T + t
        s2, r2, t2 = umeyama(src, dst)
        np.testing.assert_allclose([s2], [s], atol=1e-9)
        np.testing.assert_allclose(r2, r, atol=1e-9)
        np.testing.assert_allclose(t2, t, atol=1e-9)

    def test_bounded_ridge_matches_truth_when_inside_bounds(self):
        rng = np.random.default_rng(1)
        j = rng.normal(size=(40, 6))
        truth = np.array([0.5, 0, 1.0, 0, 2.0, 0.1])
        x = bounded_ridge(j, j @ truth, lam=1e-9, hi=3.0)
        np.testing.assert_allclose(x, truth, atol=1e-4)

    def test_bounded_ridge_never_leaves_its_box(self):
        rng = np.random.default_rng(2)
        j = rng.normal(size=(30, 8))
        x = bounded_ridge(j, j @ np.array([9, -9, 5, 0, 0, 0, 1, 1.0]), lam=1e-3, hi=3.0)
        self.assertTrue(((x >= 0) & (x <= 3.0)).all())


if __name__ == "__main__":
    unittest.main()
