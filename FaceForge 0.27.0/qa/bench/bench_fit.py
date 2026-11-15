"""Head-to-head on the SAME synthetic cases: one-shot sliders (bench.py result) vs the recovered
PR #1 fit (fit.ts), the fit running against the real C# HeadRenderer via host/BenchHost.

    python bench_fit.py --head hph_female --k 8
Needs: vite on 5173, BenchHost on 5199, and `bench.py --head <h>` already run (cases + renders).
"""
import argparse, json, subprocess
from pathlib import Path
from headmodel import HEADS, load_efm
from score import score

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

ap = argparse.ArgumentParser()
ap.add_argument("--head", default="hph_female")
ap.add_argument("--k", type=int, default=8)
a = ap.parse_args()
tag = f"{a.head}.s1.expressible"
one = json.loads((OUT / f"{tag}.result.json").read_text())
model, sex, hph = load_efm(a.head), HEADS[a.head][2], a.head.startswith("hph")
names = sorted(set(model.sliders) | set(model.skipped))
cases = one["cases"][: a.k]
manifest = [{"id": f"c{i:03d}", "png": str(OUT / f"{tag}.c{i:03d}.png"), "hph": hph, "sex": sex, "sliderNames": names}
            for i in range(len(cases))]
mp, rp = OUT / f"{a.head}.fit.manifest.json", OUT / f"{a.head}.fit.recovered.json"
mp.write_text(json.dumps(manifest))
subprocess.run(["node", str(HERE / "run_fit.mjs"), str(mp), str(rp)], check=True)
fit = json.loads(rp.read_text())
truths = [c["truth"] for c in cases]
fit_recs = [f["sliders"] if f["found"] else None for f in fit]
shot_recs = [c["recovered"] for c in cases]
neutral_zero = {}
res = {"head": a.head, "k": len(cases),
       "oneshot": score(model, truths, shot_recs, one["scores"].get("neutral_bias_rmse_rel_height") and None),
       "fit": score(model, truths, fit_recs),
       "fit_seconds_mean": sum(f["seconds"] for f in fit) / len(fit),
       "fit_renders_mean": sum(f["renders"] for f in fit) / len(fit),
       "fit_reshape": [{k: v for k, v in f["sliders"].items() if k.startswith("__")} for f in fit if f["found"]],
       "caveat": "[U] linear head model; renders not photographs; reshape moves are not scored"}
(OUT / f"{a.head}.fit.result.json").write_text(json.dumps(res, indent=1))
print(json.dumps({k: res[k] for k in ("head", "k", "oneshot", "fit", "fit_seconds_mean", "fit_renders_mean")}, indent=1))
