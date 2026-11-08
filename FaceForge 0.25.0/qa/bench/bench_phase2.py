"""Scores the dense-landmark fit (phase2.py) on the synthetic cases of bench.py, plus a diagnostic of
how well the barycentric landmark model predicts what the detector reads on a deformed head.
    python bench_phase2.py --head hph_female [--lam 1 10 100 1000]   (needs out/<head>.lm.json from landmarks.mjs)"""
import argparse, json
from pathlib import Path
import numpy as np
from headmodel import load_efm
from phase2 import LandmarkModel, fit, umeyama, empirical_jacobian, SIZE
from score import score

OUT = Path(__file__).resolve().parent / "out"
ap = argparse.ArgumentParser()
ap.add_argument("--head", default="hph_female"); ap.add_argument("--tag", default=None)
ap.add_argument("--jac", action="store_true", help="use the measured detector Jacobian"); ap.add_argument("--delta", type=float, default=3.0)
ap.add_argument("--lam", type=float, nargs="+", default=[1, 10, 100, 1000, 10000])
a = ap.parse_args()
tag = a.tag or f"{a.head}.s1.expressible"
model = load_efm(a.head)
cases = json.loads((OUT / f"{tag}.result.json").read_text())["cases"]
lmj = json.loads((OUT / f"{tag}.lm.json").read_text())
px = lambda e: np.array(e["lm"])[:468, :2] * SIZE
lm = LandmarkModel(model, px(lmj["neutral"]))
if a.jac:
    lm.J = empirical_jacobian(lm, json.loads((OUT / f"{a.head}.jac.lm.json").read_text()), a.delta)
truths = [c["truth"] for c in cases]
det = [px(lmj[f"c{i:03d}"]) if lmj.get(f"c{i:03d}") else None for i in range(len(cases))]

# 1. Is the landmark model right? Explained variance of detector landmarks by predict(truth).
err = null = 0.0
for t, d in zip(truths, det):
    if d is None: continue
    xv = np.concatenate([[max(t.get(n, 0.0), 0.0) for n in lm.names], [max(-t.get(n, 0.0), 0.0) for n in lm.names]])
    pred = lm.neutral_px + (lm.J @ xv).reshape(-1, 2) if a.jac else lm.predict(model.apply(t))
    s, r, tr = umeyama(pred, d); back = (d - tr) @ r / s
    s0, r0, t0 = umeyama(lm.neutral_px, d); back0 = (d - t0) @ r0 / s0
    err += ((back - pred) ** 2).sum(); null += ((back0 - lm.neutral_px) ** 2).sum()
print(f"landmark model explained variance: {1 - err / null:.3f}  (rms error {np.sqrt(err/ (468*len(truths))):.2f}px, null rms {np.sqrt(null/(468*len(truths))):.2f}px)")

# 2. Fit and score.
rows = []
for lam in a.lam:
    recs = [fit(lm, d, lam) if d is not None else None for d in det]
    s = score(model, truths, recs)
    rows.append((lam, s))
    print(f"lam={lam:8g} corr={s['slider_corr']:.3f} sign={s['sign_agree']:.3f} skill={s['skill']:.3f} rmse={s['rmse_rel_height']*100:.2f}% (null {s['null_rmse_rel_height']*100:.2f}%)")
json.dump({"head": a.head, "landmark_model_explained_variance": 1 - err / null, "by_lambda": [{"lam": l, **s} for l, s in rows]},
          open(OUT / f"{tag}.phase2{'.jac' if a.jac else ''}.json", "w"), indent=1)
