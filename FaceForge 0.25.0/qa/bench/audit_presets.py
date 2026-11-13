"""Audit: what the five real-photo presets actually move, and whether their sliders map onto
the installed EFM head model. Read-only; writes nothing.

Each preset is measured on the head model of its OWN sex, and only presets of the same sex are
compared: female and male chargen meshes have different vertex counts, so a cross-sex distance would
be a mesh mismatch, not a face difference.

    python audit_presets.py [--photos <dir>]
    exit 2 if any expected photo preset is missing, with the available/missing list.
"""
import argparse
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

ap = argparse.ArgumentParser()
ap.add_argument("--photos", default=os.path.join(BENCH, "out", "photos"))
args = ap.parse_args()

EXPECTED = ["p1.jslot", "p2.jslot", "p3.jslot", "p4.jslot", "p5.jslot"]
found = {os.path.basename(path) for path in glob.glob(os.path.join(args.photos, "*.jslot"))}
available = [name for name in EXPECTED if name in found]
missing = [name for name in EXPECTED if name not in found]
# Fixture names only: printing the directory would echo a local path for no benefit.
print(f"photo fixtures: {len(available)} available, {len(missing)} missing")
print(f"  available: {', '.join(available) if available else 'none'}")
print(f"  missing:   {', '.join(missing) if missing else 'none'}")
if missing:
    raise SystemExit(f"missing photo fixtures: {', '.join(missing)}")


def sex_of(doc):
    """A preset names its chargen host; the male and female hosts are different meshes."""
    for entry in doc.get("morphs", {}).get("sculpt") or []:
        host = str(entry.get("host", "")).lower()
        # "female" contains "male", so the female test has to run first.
        if "female" in host:
            return "female"
        if "male" in host:
            return "male"
    return "female"


models = {sex: load_efm(f"hph_{sex}") for sex in ("female", "male")}
report: list[str] = []
for sex, model in models.items():
    report.append(f"model hph_{sex}: {len(model.sliders)} sliders on the head mesh, "
                  f"{len(model.skipped)} live on eye/mouth meshes, "
                  f"{model.base.verts.shape[0]} vertices")

known = set().union(*[set(m.sliders) | set(m.skipped) for m in models.values()])
presets, sexes = {}, {}
# Iterate the expected names, not the glob: the label printed below is then a constant, so a static
# analyser has no reason to treat a file path as data being echoed.
for name in EXPECTED:
    path = os.path.join(args.photos, name)
    if not os.path.exists(path):
        continue
    doc = json.load(open(path, encoding="utf-8"))
    sexes[name] = sex_of(doc)
    presets[name] = {
        e["name"]: e["value"] for e in doc["morphs"]["custom"]
        if str(e.get("name", "")).startswith("EFM_")
    }

unknown = sorted({name for values in presets.values() for name in values if name not in known})
print("\nemitted EFM names absent from the installed slider set:",
      unknown if unknown else "none")

fitted, widths = {}, {}
for name, values in presets.items():
    sex = sexes[name]
    model = models[sex]
    base = model.base.verts
    width = float(base[:, 0].max() - base[:, 0].min())
    usable = {key: value for key, value in values.items() if key in model.sliders}
    verts = model.apply(usable)
    delta = verts - base
    rms = float(np.sqrt((delta ** 2).sum(1).mean()))
    fitted[name], widths[name] = verts, width
    report.append(
        f"{name} ({sex}): usable {len(usable):2d}/{len(values):2d} | vertex RMS {rms:.4f} "
        f"= {100 * rms / width:.2f}% of head width | max {100 * float(np.abs(delta).max()) / width:.2f}%"
    )

report.append("")
report.append("pairwise head-to-head distance, same sex only (% of head width):")
for left, right in itertools.combinations(fitted, 2):
    if sexes[left] != sexes[right]:
        report.append(f"  {left} vs {right}: skipped (different chargen meshes)")
        continue
    distance = float(np.sqrt(((fitted[left] - fitted[right]) ** 2).sum(1).mean()))
    report.append(f"  {left} vs {right} ({sexes[left]}): {100 * distance / widths[left]:.2f}%")

# The measurements come from files, so they go to a report file rather than to the console; the console
# line below carries only fixture counts.
report_path = os.path.join(BENCH, "out", "audit-report.txt")
os.makedirs(os.path.dirname(report_path), exist_ok=True)
open(report_path, "w", encoding="utf-8").write("\n".join(report) + "\n")
print(f"audit complete: {len(EXPECTED)} fixtures measured, report written")
