# FaceForge validation

Active candidate: **0.25.0** — built, packaged and pushed to main, **not published**. Its gates are in
"FaceForge 0.25.0 (in progress)" below; the runtime check that is still missing is an in-game RaceMenu
load.

Latest public release: **0.24.3**. Its validation section is kept for reference after the 0.25.0 one.

## FaceForge 0.24.3 (published)


Status: tool-validated standalone release. In-game likeness is untested, and the OpenRouter
fix is not runtime-confirmed — see "Not verified" below.

0.24.2 is withdrawn. It passed every gate below except the one that mattered: nobody looked at
the rendered page. Its layout regression is recorded in CHANGELOG and DECISIONS.

## Authority and version gate

- Authoritative project: `FaceForge`; parent: 0.24.2 (withdrawn); active: 0.24.3.
- Snapshot created by full copy of 0.24.2 with build outputs excluded (node_modules, dist,
  bin, obj, artifacts, TestResults, mediapipe wasm, embedded web bundle).
- Version strings bumped in build.ps1, package.ps1, README.md, ExportPackager.cs,
  OpenRouterVision.cs, EmbeddedWebBundle.cs, FaceForge.Desktop.csproj, package.json,
  AboutModal.tsx, racemenu.ts. Historical references in `faceAnalysis.ts` left as written.
- Game, Vortex, MO2, CharGen, and installed-tool trees were read-only. SSEEdit / xEdit /
  Creation Kit not launched.
- CURRENT, VERSION, CHANGELOG, STATE, DECISIONS, GITHUB, NEXUS-RELEASE, and VALIDATION updated.

## Rendered layout

Vite dev server against the installed build cache, measured through the browser rather than
asserted from the stylesheet.

- 1092x614 (a 1366x768 panel at 125% scaling): shell 680px tall, `#root` scrollable
  (scrollHeight 680 vs clientHeight 614), `.status-rail` bottom at 680 before scrolling and
  fully inside the viewport after scrolling 66px. Workspace panels fixed at 562px; the output
  panel scrolls internally over 2720px of content.
- 1280x720: shell height 720px, exactly equal to the viewport, no page scroll on `#root` or
  the document. All three workspace panels 602px — unchanged from 0.24.1 behaviour.

## Build and package

- `package.ps1`: PASS.
- Frontend: 9 files / 100 tests PASS.
- Native core: 96 assertions PASS, 1 preset, 4 plugins.
- TypeScript build + Vite production build: PASS.
- .NET Release: 0 warnings / 0 errors.
- Publish single-file gate: one `FaceForge.exe`.
- Launch check: packaged EXE ran for 14 seconds and was then stopped. FileVersion 0.24.3.0.
- EXE: `FaceForge-0.24.3-STANDALONE.exe`, 125,978,736 bytes,
  SHA-256 `73BF90EA0A2A5B4D52E19BB7DABF592AB13BA192F5F4C7A8F42F2DFFE2D200E0`.
- ZIP: `FaceForge-0.24.3-STANDALONE.zip`, 119,141,039 bytes,
  SHA-256 `4B3B01A0D4868D92897E22EABB0057958F1F30D071ADD03A92CFF57D84596F05`,
  containing the EXE and README.md only.

## Coverage added since 0.24.1

- OpenRouter routing: asserts `data_collection: "deny"` is sent and that `zdr` and
  `require_parameters` are absent. The previous suite asserted the broken routing and had to
  be corrected.
- `ExtractJsonObject`: bare object, fenced object, brace inside a string literal, prose with no
  object (rejected), truncated object (rejected).
- `DescribeFailure`: upstream error text is carried through instead of replaced.

## Not verified

- **The OpenRouter fix is not runtime-confirmed.** No live request was made — that needs a key
  and credits. The diagnosis (an empty provider pool returned as 404) is derived from the
  request FaceForge sent and from OpenRouter's documented routing behaviour, and the assertions
  cover the request shape, not the response. Structural validation is not runtime confirmation.
- **The MO2 detection was not exercised under a real MO2 launch.** The usvfs module check and
  the `MO_PROFILE` fallback are both untriggered in this environment.
- **The layout was measured, not seen.** Element geometry was read from the live page; no
  screenshot was captured, so nothing rules out a purely visual defect that does not move a box.
- **In-game likeness is untested**, as in every prior release. The EFM warning addresses a known
  silent-failure path; it does not close the open report of a generic result with EFM present.

## Standing gap

`qa/browser-qa.mjs` is not part of `build.ps1`. A CSS change can therefore reach a published
build with every gate green, which is exactly how 0.24.2 shipped.


## FaceForge 0.25.0 (in progress) -- 2026-10-30

- Overlay of GitHub PR #1 onto 0.24.3: `tsc -b` clean; vitest 100 passed; native `Core.Tests` 96
  assertions PASS; bench unit tests 9 passed; bench determinism self-check PASS.
- Phase 0 benchmark numbers: `FaceForge 0.25.0/qa/bench/BASELINE-2026-10-30.json` (see STATE.md).
- NOT verified: the desktop app was never launched; no real photograph was run; no in-game RaceMenu
  load; the linear head model is unconfirmed against an F5 export; no EXE built from 0.25.0.
- Game Data, Vortex staging and installed tools were read-only; High Poly Head.bsa morph files were
  extracted to `qa/bench/cache/` (gitignored), not into Data.
- Phase 2 prototype: 12 bench unit tests pass (umeyama, bounded ridge, scorer, head model). Results
  are synthetic only; no real photograph, no desktop app run, no in-game load. The dev servers started
  for the runs (Vite 5173, BenchHost 5199) were stopped afterwards.
- Phase 2 port: tsc clean; vitest 106 passed; native Core.Tests 96 assertions PASS. Dense fit run headless
  through the real C# renderer (BenchHost) on 30 synthetic cases; UI not clicked through; no EXE built;
  no real photograph; no in-game load. Vite (5173) and BenchHost (5199) stopped afterwards.
- Colour layer: tsc clean; vitest 120 passed; native 96 assertions PASS; `vite build` OK; UI rendered in a
  browser with a real photo (swatches shown, no console errors). Five presets built through the real export
  path from real photos. NOT verified: loading any of them in RaceMenu, whether the tint looks right in game,
  the desktop EXE (not built from this tree), lip tints, eye-texture colour.

## FaceForge 0.25.0 (in progress) -- 2026-11-07 build gate

- `build.ps1` end to end: PASS (pnpm install --frozen-lockfile, vitest 120, vite build, native
  Core.Tests 99 assertions, Desktop Release build).
- `package.ps1`: PASS, single-file gate one EXE. `FaceForge-0.25.0-STANDALONE.exe`, 129,218,037 bytes,
  SHA-256 `137231862CD42C1E8B9E3F7FC30E946FF060DC464F6C708F1826FB7C2C91EFBE`, FileVersion 0.25.0.0.
  Launch check: ran 10 s and was stopped. Not released, not pushed.
- Vision provider detection exercised on this machine with a GUI-like PATH (`~/.local/bin` and the npm
  folders removed): `claude` resolves to `C:\Users\karlo\.local\bin\claude.exe`; `codex` and
  `gemini` are not installed here. A stored override is honoured at the stored path.
- Three new native assertions: a folder pick resolves the command inside it; a `.ps1` pick resolves to
  its sibling `.cmd`; a missing path resolves to nothing.
- `qa/browser-qa.mjs` runs to completion again (root derived from the script path, real
  "Analysis complete" wait). Report: no console, page or HTTP errors, generated families `EFM` only.
  STALE AND FAILING, so the browser gate is NOT green: `symmetryIsQualityOnly`, `poseCorrectionVisible`,
  `rotatedTiltDetected` (this UI has no `.pose-grid` readout) and `smallFaceReframed` (warning-list text
  changed).
- Settings dialog rendered at 1536x960: provider card with Install / Locate… / Official help, the path
  row and the hint. The double-encoded apostrophes ("providerâ€™s") are fixed.
- Layout measured at 1366x768 (100% and 125% scaling) and 1536x960: shell equals the viewport, no
  page scroll, status rail at the bottom and visible, three panels 650/820 px, footer visible, no
  page errors.
- `browser-qa.mjs` re-run after the Jacobian cache moved out of localStorage: all checks green,
  64 of 64 declared EFM sliders written, no console/page/HTTP errors.
- Packaged EXE launched with PATH cut to `C:\Windows\system32;C:\Windows` and stayed up for 8 s.
- CI on GitHub (`Build + run core tests (latest snapshot)`) passed on the pushed SHA.

