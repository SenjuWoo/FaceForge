"""Synthetic round-trip benchmark of the one-shot (generateEfmSliders) path.

    python bench.py --head hph_female --n 30 --seed 1 [--pool expressible|all]
    python bench.py --selfcheck

Needs the Vite dev server on 127.0.0.1:5173 (cd src/FaceForge.Web && npx vite --host 127.0.0.1).
Truth sliders are drawn on the [U] linear head model in headmodel.py, so every number measures the
pipeline against that model, not against the game, and renders are not photographs.
"""
import argparse
import json
import socket
import subprocess
import sys
from pathlib import Path

import numpy as np

from headmodel import HEADS, load_efm
from render import render_front
from score import score

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"


def run_pipeline(manifest: list, tag: str) -> list:
    OUT.mkdir(exist_ok=True)
    m_path, r_path = OUT / f"{tag}.manifest.json", OUT / f"{tag}.recovered.json"
    m_path.write_text(json.dumps(manifest))
    subprocess.run(["node", str(HERE / "run_pipeline.mjs"), str(m_path), str(r_path)], check=True)
    return json.loads(r_path.read_text())


def bench(head: str, n: int, seed: int, pool_mode: str, tag: str, gen: str = "sparse") -> dict:
    with socket.socket() as s:
        if s.connect_ex(("127.0.0.1", 5173)) != 0:
            sys.exit("Vite dev server is not listening on 127.0.0.1:5173")
    model, sex, hph = load_efm(head), HEADS[head][2], head.startswith("hph")
    OUT.mkdir(exist_ok=True)

    def item(case_id, w):
        png = OUT / f"{tag}.{case_id}.png"
        render_front(model, sex, model.apply(w), png)
        return {"id": case_id, "png": str(png), "hph": hph, "sex": sex}

    # The neutral head is also the bias probe: a face needing no correction should export ~zero.
    neutral = run_pipeline([item("neutral", {})], f"{tag}.neutral")[0]
    if not neutral["found"]:
        sys.exit(f"detector missed the neutral {head} render: {neutral.get('error')}")
    expressible = sorted(set(neutral["sliders"]) & set(model.sliders))
    pool = expressible if pool_mode == "expressible" else sorted(model.sliders)

    rng = np.random.default_rng(seed)
    truths = []
    for _ in range(n):
        if gen == "dense":   # every pool slider active, N(0, 0.8) clipped to the EFM range: a fuller, face-like draw
            vals = np.clip(np.round(rng.normal(0.0, 0.8, len(pool)), 2), -3.0, 3.0)
            truths.append(dict(zip(pool, vals.tolist())))
            continue
        k = int(rng.integers(6, 13))
        names = sorted(str(x) for x in rng.choice(pool, k, replace=False))
        truths.append(dict(zip(names, np.round(rng.uniform(-2.0, 2.0, k), 2).tolist())))

    recovered = run_pipeline([item(f"c{i:03d}", w) for i, w in enumerate(truths)], f"{tag}.cases")
    recs = [r["sliders"] if r["found"] else None for r in recovered]
    result = {
        "head": head, "n": n, "seed": seed, "pool": pool_mode, "gen": gen,
        "pool_size": len(pool), "expressible_sliders": len(expressible),
        "scores": score(model, truths, recs, neutral["sliders"]),
        "caveat": "[U] linear head model, rendered not photographed, EFM family only, head mesh only",
        "cases": [{"truth": t, "recovered": r} for t, r in zip(truths, recs)],
    }
    (OUT / f"{tag}.result.json").write_text(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--head", default="hph_female", choices=sorted(HEADS))
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--pool", default="expressible", choices=["expressible", "all"])
    ap.add_argument("--tag"); ap.add_argument("--gen", default="sparse", choices=["sparse", "dense"])
    ap.add_argument("--selfcheck", action="store_true")
    a = ap.parse_args()
    if a.selfcheck:
        r1 = bench("hph_female", 3, 7, "expressible", "selfcheck1")
        r2 = bench("hph_female", 3, 7, "expressible", "selfcheck2")
        same = r1["cases"] == r2["cases"] and r1["scores"] == r2["scores"]
        print("SELFCHECK", "PASS: identical" if same else "FAIL: runs differ")
        sys.exit(0 if same else 1)
    res = bench(a.head, a.n, a.seed, a.pool, a.tag or f"{a.head}.s{a.seed}.{a.pool}", a.gen)
    print(json.dumps(res["scores"], indent=1))
