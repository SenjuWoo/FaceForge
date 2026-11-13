"""Front render of a morphed head with the same rig the 0.19.0 baseline calibration used.

Reuses qa/render-head.py (flat shading, painted irises, per-head pitch that reads as zero nod) so a
benchmark render is directly comparable with the renders the shipped baselines were measured from.
"""
import importlib.util
from pathlib import Path

from headmodel import ASSETS, read_tri

_spec = importlib.util.spec_from_file_location(
    "render_head", Path(__file__).resolve().parents[1] / "render-head.py")
rh = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rh)

# Pitch that reads as zero nod for each head (properties of the meshes; see render-head.py CANONICAL).
PITCH = {"vanilla_female": 10.3, "hph_female": 8.3, "vanilla_male": 4.2, "hph_male": 4.6}
EYES = {"female": "EyesFemaleChargen.tri", "male": "EyesMaleChargen.tri"}


def render_front(model, sex: str, verts, out_png) -> None:
    eyes = read_tri(ASSETS / EYES[sex])
    deg = PITCH[model.name]
    parts = [
        (rh.pitch(verts, deg), model.base.tris, rh.part_colors(verts, model.base.tris, rh.SKIN)),
        (rh.pitch(eyes.verts, deg), eyes.tris, rh.part_colors(eyes.verts, eyes.tris, rh.SCLERA)),
    ]
    rh.render(parts, str(out_png), eye_part=1)
