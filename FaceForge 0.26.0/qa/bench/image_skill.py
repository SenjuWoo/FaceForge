"""Pixel-space comparison including the fit's reshape moves. skill = 1 - sum(err_method)/sum(err_neutral)
against the render of the TRUTH sliders, front (yaw 0) and 35 degrees (depth the front fit cannot see)."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
head = sys.argv[1] if len(sys.argv) > 1 else "hph_female"
one = json.loads((OUT / f"{head}.s1.expressible.result.json").read_text())["cases"]
fit = json.loads((OUT / f"{head}.fit.recovered.json").read_text())
cases = [{"id": f"c{i:03d}", "truth": c["truth"], "oneshot": c["recovered"] or {}, "fit": fit[i]["sliders"]}
         for i, c in enumerate(one[: len(fit)]) if fit[i]["found"]]
(OUT / f"{head}.img.cases.json").write_text(json.dumps(cases))
img = OUT / f"{head}.img"
subprocess.run(["node", str(HERE / "image_skill.mjs"), str(OUT / f"{head}.img.cases.json"), str(img), head], check=True)

def load(c, name, yaw):
    p = img / f"{c['id']}.{name}_y{yaw}.png"
    return np.asarray(Image.open(p).convert("L")).astype(np.float32) / 255 if p.exists() else None

res = {}
for yaw in (0, 35):
    err = {"oneshot": 0.0, "fit": 0.0, "neutral": 0.0}
    for c in cases:
        t = load(c, "truth", yaw)
        for m in err:
            r = load(c, m, yaw)
            if t is not None and r is not None:
                err[m] += float(np.abs(r - t).mean())
    res[f"yaw{yaw}"] = {m: (1 - err[m] / err["neutral"] if err["neutral"] else None) for m in ("oneshot", "fit")} | {"neutral_err_sum": err["neutral"]}
(OUT / f"{head}.img.result.json").write_text(json.dumps(res, indent=1))
print(json.dumps(res, indent=1))
