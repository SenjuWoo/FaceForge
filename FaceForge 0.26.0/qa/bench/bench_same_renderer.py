"""Best case for the fit: the 'photo' is rendered by the SAME C# renderer the fit uses (no domain gap).
    python bench_same_renderer.py --head hph_female --k 30   (needs vite 5173, BenchHost 5199, bench.py + image_skill.py run)
Scores one-shot and fit on the same cases as bench.py; vertex skill on the [U] linear model."""
import argparse, json, subprocess
from pathlib import Path
from headmodel import HEADS, load_efm
from score import score

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
ap = argparse.ArgumentParser(); ap.add_argument("--head", default="hph_female"); ap.add_argument("--k", type=int, default=30)
a = ap.parse_args()
model, sex, hph = load_efm(a.head), HEADS[a.head][2], a.head.startswith("hph")
cases = json.loads((OUT / f"{a.head}.s1.expressible.result.json").read_text())["cases"][: a.k]
names = sorted(set(model.sliders) | set(model.skipped))
png = lambda i: str(OUT / f"{a.head}.img" / f"c{i:03d}.truth_y0.png")
man = [{"id": f"c{i:03d}", "png": png(i), "hph": hph, "sex": sex, "sliderNames": names} for i in range(len(cases))]
mp = OUT / f"{a.head}.same.manifest.json"; mp.write_text(json.dumps(man))
shot_p, fit_p = OUT / f"{a.head}.same.oneshot.json", OUT / f"{a.head}.same.fit.json"
subprocess.run(["node", str(HERE / "run_pipeline.mjs"), str(mp), str(shot_p)], check=True)
subprocess.run(["node", str(HERE / "run_fit.mjs"), str(mp), str(fit_p)], check=True)
shot, fit = json.loads(shot_p.read_text()), json.loads(fit_p.read_text())
truths = [c["truth"] for c in cases]
res = {"head": a.head, "k": len(cases), "renderer": "C# HeadRenderer for both photo and fit",
       "oneshot": score(model, truths, [s["sliders"] if s["found"] else None for s in shot]),
       "fit": score(model, truths, [f["sliders"] if f["found"] else None for f in fit]),
       "caveat": "[U] linear head model; vertex score ignores reshape moves"}
(OUT / f"{a.head}.same.result.json").write_text(json.dumps(res, indent=1))
print(json.dumps({k: res[k] for k in ("oneshot", "fit")}, indent=1))
