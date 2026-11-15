"""Renders every head-mesh EFM slider at +-DELTA so the detector's own response can be measured (dense Jacobian).
    python jac_cases.py hph_female [delta=3]   -> out/<head>.jac.list.json (then run landmarks_tta.mjs on it)"""
import json, sys
from pathlib import Path
from headmodel import HEADS, load_efm
from render import render_front

OUT = Path(__file__).resolve().parent / "out"
head, delta = sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
model, sex = load_efm(head), HEADS[head][2]
items = []
for name in sorted(model.sliders):
    for sign, tag in ((1, "pos"), (-1, "neg")):
        png = OUT / f"{head}.jac.{name}.{tag}.png"
        render_front(model, sex, model.apply({name: sign * delta}), png)
        items.append({"id": f"{name}|{tag}", "png": str(png).replace("\\", "/")})
(OUT / f"{head}.jac.list.json").write_text(json.dumps(items))
print(len(items), "renders")
