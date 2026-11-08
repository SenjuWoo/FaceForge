"""Audit: what the five real-photo presets actually move, and whether their sliders map onto
the installed EFM head model. Read-only; writes nothing."""
import glob
import itertools
import json
import os
import sys

import numpy as np

BENCH = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BENCH)
os.chdir(BENCH)
from headmodel import load_efm  # noqa: E402

model = load_efm("hph_female")
print(f"model sliders {len(model.sliders)} | skipped on eye/mouth meshes {len(model.skipped)}")
print("head vertices", model.base.verts.shape,
      "| extent", np.round(model.base.verts.max(0) - model.base.verts.min(0), 3))

known = set(model.sliders) | set(model.skipped)
presets = {}
for path in sorted(glob.glob(os.path.join(BENCH, "out", "photos", "p*.jslot"))):
    doc = json.load(open(path, encoding="utf-8"))
    presets[os.path.basename(path)] = {
        e["name"]: e["value"] for e in doc["morphs"]["custom"]
        if str(e.get("name", "")).startswith("EFM_")
    }

unknown = sorted({name for values in presets.values() for name in values if name not in known})
print("\nemitted EFM names absent from the installed slider set:",
      unknown if unknown else "none")

base = model.base.verts
width = float(base[:, 0].max() - base[:, 0].min())
fitted = {}
for name, values in presets.items():
    usable = {key: value for key, value in values.items() if key in model.sliders}
    verts = model.apply(usable)
    delta = verts - base
    rms = float(np.sqrt((delta ** 2).sum(1).mean()))
    fitted[name] = verts
    print(f"{name}: usable {len(usable):2d}/{len(values):2d} | vertex RMS {rms:.4f} "
          f"= {100 * rms / width:.2f}% of head width | max {100 * float(np.abs(delta).max()) / width:.2f}%")

print("\npairwise head-to-head distance (% of head width):")
for left, right in itertools.combinations(fitted, 2):
    distance = float(np.sqrt(((fitted[left] - fitted[right]) ** 2).sum(1).mean()))
    print(f"  {left} vs {right}: {100 * distance / width:.2f}%")
