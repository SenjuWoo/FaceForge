# qa/bench

Scratch harnesses used to measure FaceForge's fit against a synthetic and a real head. None of this
ships inside the EXE; it exists so a change to the measurement pipeline can be scored instead of argued
about.

## Python environment

The bench scripts need numpy, and `image_skill.py` (the photo-versus-render comparison) additionally
needs Pillow. Create the environment next to the scripts:

    python -m venv .venv
    .venv\Scripts\python -m pip install numpy==2.3.4 pillow==12.0.0

`.venv/` is gitignored. There is deliberately no requirements file here: this is a developer-only
environment, and a manifest checked into the repository makes every Pillow advisory a separate
Dependabot alert against a package that never reaches a user.

## What needs what

- `bench.py`, `headmodel.py`, `phase2.py`, `score.py` - numpy only; no browser, no renderer.
- `bench_dense.py`, `bench_same_renderer.py`, `image_skill.py` - also need the Vite dev server (5173)
  and the native BenchHost (5199), plus `node image_skill.mjs`.
- `host/` - the BenchHost project that renders a head through the real C# renderer.
