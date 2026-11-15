import tempfile
import unittest
from pathlib import Path

import numpy as np

from headmodel import HEADS, load_efm, read_tri


class HeadModelTests(unittest.TestCase):
    def test_hph_efm_tri_parses_to_eof(self):
        tri = read_tri(HEADS["hph_female"][1])
        self.assertEqual(len(tri.verts), 3832)
        self.assertEqual(len(tri.morphs), 134)
        self.assertIn("EFM_Jaw_Wide", tri.morphs)

    def test_truncated_tri_raises(self):
        data = HEADS["hph_female"][1].read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.tri"
            bad.write_bytes(data[:-10])
            with self.assertRaises(ValueError):
                read_tri(bad)

    def test_zero_is_base_and_pair_is_one_sided(self):
        model = load_efm("hph_female")
        self.assertTrue(model.sliders, "no EFM slider resolved on HPH female")
        name = "EFM_Jaw_Width"
        self.assertIn(name, model.sliders)
        neg, pos = model.sliders[name]
        np.testing.assert_array_equal(model.apply({}), model.base.verts)
        up = model.apply({name: 1.5}) - model.base.verts
        down = model.apply({name: -1.5}) - model.base.verts
        np.testing.assert_allclose(up, 1.5 * model.morphs[pos], atol=1e-5)
        np.testing.assert_allclose(down, 1.5 * model.morphs[neg], atol=1e-5)
        self.assertGreater(np.abs(up).max(), 0)

    def test_every_head_resolves_or_reports_skips(self):
        for head in HEADS:
            model = load_efm(head)
            self.assertGreater(len(model.sliders), 0, head)
            self.assertFalse(set(model.sliders) & set(model.skipped), head)


if __name__ == "__main__":
    unittest.main()
