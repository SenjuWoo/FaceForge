"""Benchmarks the PORTED dense fit (TypeScript, real C# renderer) on the bench.py cases.
    python bench_dense.py --head hph_female [--k 30]   needs vite 5173 + BenchHost 5199, bench.py + image_skill.py outputs."""
import argparse, json, subprocess
from pathlib import Path
from headmodel import HEADS, load_efm
from score import score

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
ap = argparse.ArgumentParser(); ap.add_argument("--head", default="hph_female"); ap.add_argument("--k", type=int, default=30)
a = ap.parse_args()
model, sex, hph = load_efm(a.head), HEADS[a.head][2], a.head.startswith("hph")
names = sorted(set(model.sliders) | set(model.skipped))
cases = json.loads((OUT / f"{a.head}.s1.expressible.result.json").read_text())["cases"][: a.k]
sets = {"python_photos": lambda i: OUT / f"{a.head}.s1.expressible.c{i:03d}.png",
        "csharp_photos": lambda i: OUT / f"{a.head}.img" / f"c{i:03d}.truth_y0.png"}
manifest = [{"id": f"{s}:c{i:03d}", "png": str(f(i)), "hph": hph, "sex": sex, "sliderNames": names}
            for s, f in sets.items() for i in range(len(cases))]
mp, rp = OUT / f"{a.head}.dense.manifest.json", OUT / f"{a.head}.dense.recovered.json"
mp.write_text(json.dumps(manifest))
subprocess.run(["node", str(HERE / "run_dense.mjs"), str(mp), str(rp)], check=True)
rec = {r["id"]: r for r in json.loads(rp.read_text())}
truths = [c["truth"] for c in cases]
res = {"head": a.head, "k": len(cases), "method": "ported denseFit.ts, C# HeadRenderer Jacobian (768px), 4 jitters J / 8 jitters photo, lambda 30"}
for s in sets:
    rs = [rec[f"{s}:c{i:03d}"] for i in range(len(cases))]
    res[s] = score(model, truths, [r["sliders"] if r["found"] else None for r in rs])
    res[s]["residual_mean_pct_eye"] = 100 * sum(r.get("residual", 0) for r in rs) / len(rs)
    res[s]["seconds_mean"] = sum(r["seconds"] for r in rs) / len(rs)
res["jacobian_seconds"] = next((r["seconds"] for r in rec.values() if r.get("measured")), None)
(OUT / f"{a.head}.dense.result.json").write_text(json.dumps(res, indent=1))
print(json.dumps(res, indent=1))
