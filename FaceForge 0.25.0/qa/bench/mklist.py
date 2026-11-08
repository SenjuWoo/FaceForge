import json, sys
from pathlib import Path
OUT = Path(__file__).resolve().parent / "out"
tag = sys.argv[1]
n = len(json.loads((OUT / f"{tag}.result.json").read_text())["cases"])
items = [{"id": "neutral", "png": str(OUT / f"{tag}.neutral.png").replace("\\", "/")}] + \
        [{"id": f"c{i:03d}", "png": str(OUT / f"{tag}.c{i:03d}.png").replace("\\", "/")} for i in range(n)]
(OUT / f"{tag}.list.json").write_text(json.dumps(items))
