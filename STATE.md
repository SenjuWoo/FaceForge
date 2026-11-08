# FaceForge state

## 2026-11-08 (release cleanup)

- Docs corrected: the in-snapshot `README.md` still described 0.24.3 and `START HERE.txt` still said
  0.23.1 (both now 0.25.0, and both name the 0.25.0 EXE). The root README no longer advertises an
  unpublished 0.25.0 release; 0.24.3 is stated as the latest public download. `VALIDATION.md` leads
  with 0.25.0 and keeps 0.24.3 as history. The two stale "browser-QA still failing" bullets are gone.
- `package.ps1` is now the only packaging step: it reads the version from `VERSION.txt`, refuses to
  build when the EXE FileVersion disagrees with it, stages exactly the EXE and `README.md`, fails on
  any other file in the inventory, and writes `NEXUS-UPLOAD\FaceForge-<version>-STANDALONE.zip`
  itself. One command produces both shippable files and prints both hashes.
- Browser QA is portable and enforced: Playwright is a dev dependency resolved through the web
  project's `package.json` (no absolute path into a user cache), the browser comes from
  `pnpm exec playwright install chromium`, and a new `qa/layout-qa.mjs` asserts shell height, page
  scroll, status rail, footer and three panels at 1366x768 (100% and 125% scaling), 1280x720 and
  1536x960. Both scripts run as a `browser` job in CI.
- Bench re-check after the dense-fit cache change: `bench.py --selfcheck` reports identical;
  12 bench unit tests pass. One-shot `hph_female` n=8 seed 1: slider corr 0.059, sign
  agreement 0.40, vertex skill +0.16 - inside sampling noise of the recorded n=30 baseline
  (0.05 / 0.37-0.45 / +0.08), and that path did not change.
- Artifacts rebuilt by `package.ps1`: EXE 129,218,679 bytes, SHA-256
  `0D19CB8C1A56ABB5CBBF9B4366A1ABCD047F6E5DA18F54F230448E4FDB0DCF00`; ZIP 122,336,580 bytes,
  SHA-256 `893EDF429DA50F9BF533D13EF520F7AA13BD6F4643AFD8FEF2B52E3DBA929A3D`, inventory
  `FaceForge-0.25.0-STANDALONE.exe` + `README.md`.
- Found by the new browser gate on its first run: the Dependabot bump on main raised `react` to
  19.3.1 while `react-dom` stayed 19.2.8, and React refuses to run with mismatched versions
  (minified error #527, blank window). 0.25.0 pins both at 19.2.8, which is react-dom's newest
  stable. The published 0.24.3 snapshot is left untouched, so its source tree still carries the
  mismatch; its released EXE predates the bump and is unaffected.

## 2026-11-07 (continued after a Claude Code usage stop)

- The interrupted session (`~/.claude/projects/Z--Backup--Skyrim--Ai-modding-workspace-FaceForge/
  323ab87b-….jsonl`, 2,154 records) was recovered: it stopped right after the colour layer, having
  handed the owner five presets to test in RaceMenu. Nothing was in flight; the next planned item
  was eye-texture colour ranking for head parts.
- Fixed the reported "it keeps telling me to install the latest versions" (Nexus, 2026-08-14).
  Provider detection was PATH-only, and a double-clicked EXE inherits Explorer's PATH, so an
  installed CLI read as missing with no way to point at it. Now: known install folders are searched
  (`%APPDATA%\npm`, `~/.local/bin`, `.bun/bin`, `.volta/bin`, `%LOCALAPPDATA%\npm|pnpm|Programs\codex`,
  WindowsApps), a manual path per provider is stored in `%LOCALAPPDATA%\FaceForge\vision-paths.json`,
  and Settings has a **Locate…** button (file or folder; a `.ps1` pick resolves to its sibling
  `.cmd`/`.exe`). Verified here: with PATH stripped to a GUI-like set, `claude.exe` is found in
  `~/.local/bin`; `codex`/`gemini` are genuinely absent; a stored override turns "not installed" into
  "installed" at the stored path. `dotnet run --project src/FaceForge.Core.Tests -- --vision` prints
  the stored overrides and the resolved statuses.
- `build.ps1` could not complete on this machine: `Get-Command pnpm` resolves the `pnpm.ps1` shim,
  which re-parses arguments, so `install --frozen-lockfile` reached pnpm as one token and failed.
  It now prefers the `.cmd`/`.exe` shim and the flag is quoted. The full gate runs green.
- `qa/browser-qa.mjs` could not run at all: it hardcoded the pre-reset 0.12.0 path, waited for a
  "63 values" label that no longer exists, and crashed on a missing `.pose-grid` readout. Root is now
  derived from the script location, the wait is the real "Analysis complete" status, and a missing
  pose readout reports `null` (fails the tilt check) instead of throwing. It completes and writes its
  report. The four stale UI expectations were then fixed; see the 2026-11-08 entry above.
- Version strings unified to 0.25.0 everywhere (were 0.24.3 / 0.24.15 / 0.24.28 / 0.23.2).
- Built `FaceForge-0.25.0-STANDALONE.exe` (126,867,574 bytes, SHA-256 `0D0483D7…`, FileVersion
  0.25.0.0; launch check 10 s alive then stopped, and again with a stripped PATH).
- 0.25.0 is on GitHub main at `22f8513` (first commit `1a5189a`, then `22d7275`, then the
  dense-fit cache fix); CI green on the last two SHAs, and Dependabot / CodeQL / secret scanning all
  read 0 open alerts afterwards. Two alerts the push
  opened were fixed at source rather than dismissed: 27 Dependabot alerts from a
  `qa/bench/requirements.txt` that pinned Pillow for a developer-only venv (the manifest is now
  a README instruction, `.venv/` is ignored), and a CodeQL "clear text storage" finding on the
  dense-fit Jacobian cache in localStorage (the cache is memory-only per run now; the head is
  measured once per launch, about ten seconds).
- Not released: no tag, no GitHub release, no Nexus file version. That waits on an in-game check.
- Still open: no in-game RaceMenu load of any preset (p1..p5 from the colour layer are untested);
  eye parts still rank by name only.

## 2026-10-30 (later): lost work found on GitHub, overlaid into 0.25.0

- Owner pointed at GitHub. `SenjuWoo/FaceForge` PR #1 (closed, unmerged, commit `70939cd`,
  2026-08-15, "0.24.26-0.24.28") holds a native head renderer, a measured-Jacobian fit ("Analyze &
  improve"), Match pane, sculpt reshape, BSA/MO2/DDS support. `main` never had it. Details and
  limits: PLAN.md "Recovered prior work".
- Active snapshot is now `FaceForge 0.25.0` = 0.24.3 + those 33 files (path-conflict check against
  later `main` changes: none). CURRENT.txt points at it. Product version strings still read 0.24.3.
- Verified there: `tsc -b` clean; vitest 100 passed; native `Core.Tests` 96 assertions PASS. New
  NuGet dependency BCnEncoder.Net (declared 2.1.4, restore resolved 2.2.0, warning NU1603).
- Not verified: desktop app launch, fit quality, in-game result. Versions 0.24.4-0.24.25 and their
  notes are unrecoverable from GitHub.
- Phase 0 benchmark DONE (`FaceForge 0.25.0/qa/bench/`, numbers in `BASELINE-2026-10-30.json`):
  synthetic round trip on a [U] linear EFM head model, seed 1, 30 cases, determinism self-check
  passes, 9 unit tests pass. Detector found the face in 30/30 renders on every head.
  * One-shot path (== 0.24.3 code): slider correlation 0.05 (hph_female), sign agreement 0.37-0.45
    (below a coin flip), vertex skill +0.08 hph_female / -0.09 vanilla_female / -0.19 hph_male /
    -0.92 vanilla_male (0 = no better than leaving the head neutral). Only EFM_Nose_Height,
    Lip_Height, Lip_Width recover well (corr 0.8-0.98) and at 10-30% of the true magnitude.
  * Recovered PR #1 fit, hph_female, 30 cases, ~8 s and ~400 renders per case: vertex skill -4.65
    with python-rendered photos, -1.77 in the best case (photo rendered by the same C# renderer).
    Pixel-space skill incl. reshape: -2.4 front, -3.0 at yaw 35 (one-shot -0.37 / -0.34).
  * Why (12 cases, same renderer): the fit's own loss for the TRUE sliders has median 0.42 vs 0.81
    for the neutral head, and the fit reaches 0.15, lower than truth in 12/12. The optimiser works;
    the 39-ratio objective does not single out the true face (it is under-determined and noisy).
    Not isolated: how much of the 0.42 floor is photo-path vs render-path processing.
  * Caveats: synthetic sparse sliders, not photos; model [U] until an F5 export is compared; vertex
    score ignores the fit's reshape moves (pixel score includes them); only hph_female was run for the
    fit. A real-photo result may differ. No in-game result exists.
- Phase 2 PROTOTYPE done in python (not in the product): dense landmark fit with a measured detector
  Jacobian, `qa/bench/phase2.py`, results `PHASE2-PROTOTYPE-2026-10-30.json`. Vertex skill on the same
  cases: hph_female +0.59 (one-shot +0.08, PR #1 fit -1.77), hph_male +0.57 (-0.19), vanilla_female
  +0.40 (-0.09), vanilla_male +0.23 (-0.92); stable on a held-out seed (+0.62) and a dense generator
  (+0.57). Same synthetic-only caveats; 12 bench unit tests pass. Next: port to TypeScript, then a
  real-photo check (needs the owner's test photos).
- Phase 2 PORTED (2026-10-30): `FaceForge 0.25.0/src/FaceForge.Web/src/domain/denseFit.ts` + Match pane
  wiring (default method "Dense landmarks", fallback to the ratio fit on failure or by choice, "Re-measure
  head" button). Verified: `tsc -b` clean, vitest 106 passed (6 new, incl. parity with the Python
  solver on a seeded fixture), native 96 assertions PASS. Benchmarked headless via the real C# renderer
  (hph_female, 30 cases, `PHASE2-PORT-2026-10-30.json`): +0.41 best case, +0.34 with a photo from a
  different renderer at the default lambda 1000 (it was -0.39 at lambda 30). NOT verified: the desktop
  app was not launched, the Match pane UI was not clicked through, no real photograph, nothing in game.
  Other heads were not re-run through the port. No EXE built; version strings still 0.24.3.
- First real photos (owner sent 5, 2026-10-30; copies in gitignored `qa/bench/out/photos/`, not committed):
  dense fit run through the real renderer, side-by-side sheets `out/photos/p*.sheet*.png`. Frontal photos
  (4 female, 1 male): residual 2.2-5.1% of eye distance, shape changes from the neutral head are SUBTLE
  at the default lambda 1000 and not recognisably the person; the head is still bald, untinted, default
  brows. One turned, mouth-open photo (residual 8-9%) went wrong: at lambda 100 four sliders hit the +-3
  rail and the chin narrowed unnaturally, i.e. yaw and expression were read as face shape. No pose or
  expression compensation exists in the dense method. Conclusion: the shape fit is not the main gap any
  more; colour/head parts, pose and expression handling, and a larger-authority sculpt are.
- COLOUR LAYER built (2026-10-30, `domain/photoColors.ts`, `appearance.ts`, export in `racemenu.ts`, UI in the
  output panel): reads skin, lip, iris and hair colour from the front photo at landmark-defined regions; the
  export writes a skin-tone tint (`tintInfo`, index 0, SkinTone.dds, or recolours the template's own SkinTone
  layer) and `actor.hairColor`; "Apply photo colours" toggle with swatches and confidences. Iris colour only
  feeds the existing eye-part ranking by name. Verified: tsc clean, vitest 120 passed (14 new), native 96
  assertions, `vite build` OK, UI rendered with a real photo and no console errors, and five real `.jslot`
  files built through the real export path (`qa/bench/out/photos/p1..p5.jslot`, gitignored).
  * Wrong idea found and dropped: tint = photo / installed skin albedo. The installed head texture averages
    only (128,110,102) so every channel ratio exceeded 1 and clamped to white. The tint is now the point on
    Skyrim's own skin-tone preset gradient (Skyrim.esm COLO HumanFemaleSkinWhite01-10, HumanSkinDarkSkin05-10)
    with the matching lightness; lightness only, hue not matched. The albedo code was removed again.
  * Limits: one photo each, so lighting, white balance and makeup move every colour; the photo-lightness to
    preset mapping is a calibration choice [U]; tint multiply semantics are inferred from the preset values,
    not confirmed in game; lip colour is shown but not written (its tint index is race-specific and Core does
    not read race tint lists; a template with a Lips layer could be recoloured later); light eyes in a small
    photo read wrong (the 300x400 photo's blue eyes came out grey-brown at confidence 0.43, so it is not used).
  * Head parts: eye parts are suggested by NAME only. Of 1866 installed eye parts only about 21% carry
    brown/blue/green in their EditorID (78/179/143) and many are follower-specific, so a real fix needs eye
    textures read from NIF/TXST. Hair and brow STYLE matching is not done.
  * Version strings in this tree are inconsistent (an earlier note here said they all read 0.24.3, which was
    wrong): build.ps1, package.ps1, EmbeddedWebBundle.cs, OpenRouterVision.cs say 0.24.28; the Desktop csproj
    says 0.24.15; package.json, ExportPackager.cs, racemenu.ts say 0.24.3. Make them one 0.25.0 at release.

## 2026-10-30 rework kickoff (Claude Code) -- plan proposed, no code changed

- Active version still `0.24.3`. Rework plan: `PLAN.md` (status PROPOSED, awaiting approval).
- Recovery check after PC reset: local tree equals GitHub `SenjuWoo/FaceForge` main (last feature
  release 0.24.3, 2026-08-12; later commits are only Dependabot and doc/link edits). No other
  FaceForge folder in `Z:\Backup` or the user profile; no earlier Claude session for this project.
  Any unpublished work after 2026-08-12 is not on this machine.
- CORRECTION (verified 2026-10-30): the "51 EFM sliders are inert on High Poly Head" finding
  below (2026-08-05) is WRONG. `--morphs` reads loose files only (`Complete: false`; four BSAs pack
  facegenmorphs inis). `High Poly Head.bsa` ships `morphs\kl\femalehead_efm.tri` (3832 vertices, 134
  EFM_* morphs, FRTRI003 parsed to end of file) and registers it in its packed
  `high poly head.esm\morphs.ini`. EFM is live on HPH. Same for the old idea "transfer EFM morphs to
  HPH topology" -- unnecessary. The registry should read BSAs (houseCARL `housecarl_bsa_extract`
  works; BSArch did not).
- Python 3.14 shared runtime has no numpy/scipy/PIL/onnx/mediapipe; QA scripts need a venv.
  GPU: RTX 4080 SUPER 16 GB. dotnet 10.0.403, node v26.13.0.
- `qa/*.mjs` and `render-head.py` were not run; only the native `--morphs` report was.

---

- Active version: `FaceForge 0.24.3` (parent 0.24.2, withdrawn), tool-validated release.
- Final EXE: `FaceForge-0.24.3-STANDALONE.exe`, 125,978,736 bytes.
- SHA-256: `73BF90EA0A2A5B4D52E19BB7DABF592AB13BA192F5F4C7A8F42F2DFFE2D200E0`.
- FileVersion 0.24.3.0; launch verified (still running after 14s, then stopped).
- Tests: 100 frontend, 96 native assertions. TypeScript clean, .NET Release clean, 0 warnings.
- Rendered-layout check at 1092x614 and 1280x720 (see below) -- this is what 0.24.2 skipped.
- Product version: `0.24.3`; public distribution remains exactly one self-contained EXE.

## What changed in 0.24.3

0.24.2 is withdrawn. Its small-screen fix relaxed `.app-shell` from `height: 100%` to
`min-height: 100%`, and the shell is a `58px minmax(0, 1fr) 82px` grid -- a `1fr` track only
resolves against a definite height. Without one the middle track sized to content, the
workspace panels stopped scrolling internally, and they grew to their full content length.
The source panel's portrait area stretched down several screens.

Restored to `height: 100%` with the original `min-height: 680px` floor. That floor is what
makes a short viewport reachable, and it was already in 0.24.1 -- only the root `overflow:
hidden` -> `auto` was ever needed.

Measured in a rendered browser:

    1092x614 (a 1366x768 laptop at 125% scaling)
      shell 680px, root scrollable, status rail at 680 and fully visible after a 66px scroll
      workspace panels fixed at 562px; output panel scrolls internally over 2720px of content

    1280x720
      shell 720px, fills the viewport exactly, no page scroll; all three panels 602px

Everything else from 0.24.2 carries forward byte-for-byte. The measurement pipeline is
untouched; exported presets remain identical to 0.24.1.

## What changed in 0.24.2 (withdrawn)

Four defects reported on the Nexus page, plus one warning for a fifth that is only partly
explained. The measurement pipeline is untouched; exported presets are identical to 0.24.1.

**OpenRouter 404.** `OpenRouterVision.cs` pinned `provider: { zdr, data_collection,
require_parameters }` together with a strict `response_format`. Routing clauses intersect,
and the intersection was empty for every model, which OpenRouter returns as 404. Only
`data_collection: "deny"` survives. Dropping `require_parameters` means a provider may ignore
`response_format`, so `ExtractJsonObject` now recovers the object from a fenced or
prose-wrapped reply with a brace-balanced, string-aware scan, and `DescribeFailure` surfaces
the upstream error text instead of guessing at key/credits/model.

**Small screens.** `html`/`body`/`#root` were `overflow: hidden` against a 680px
`.app-shell` minimum height. ~614 CSS px of usable height on a 1366x768 panel at 125%
scaling clipped the export row with nothing to scroll. Overflow is `auto`, shell is
`min-height: 100%`. `min-width: 980px` unchanged.

**MO2.** `IsRunningUnderModOrganizer` checks the loaded modules for `usvfs*` and falls back
to `MO_PROFILE`. On a match, the WebView2 startup failure is replaced with an explanation.
Not a workaround -- running under USVFS is still unsupported.

**Dependency panel.** A present plugin with an unidentified source mod rendered as "missing"
beside a counter that called it present. Now "present, source mod not identified". A warning
card appears when `EFM_PLUGIN` is absent, because FaceForge writes only the `EFM_` family and
RaceMenu silently discards all of it without that mod.

### Open

The "generic result in game" report is not closed. The EFM warning explains the case where
EFM is missing, and one reporter had it present. Slider gain was inspected and left alone:
`RESPONSE_GAIN` 0.18 against sensitivities of 14-38 lands inside the range hand-authored
presets occupy, so there is no measured reason to move it. Needs a photo plus the exported
`.jslot` to go further. Photograph guidance is still unwritten.

## What changed in 0.24.1

FaceForge stops applying the same measurement several times, and stops letting a guessed baseline
sculpt at full strength. Both defects predate 0.23.x; both were found from a preset the user
exported and loaded in game, which came out flat with enormous flat brows.

**One measurement, one family.** EFM, CME, NSK and SPG are separate mods registering separate morph
targets, and RaceMenu sums every registered morph onto the head. 31 of 39 measurements were being
written into 2-3 families at once, so the same displacement landed on the face two to four times.
Confirmed on this install: EFM's `human.ini` maps `EFM_Jaw_Width` to `EFM_Jaw_Narrow`/`EFM_Jaw_Wide`,
while the vanilla `FemaleHeadChargen.tri` behind RaceMenu's `CME_JawWidth` carries
`JawNarrow`/`JawWide` and holds no `EFM_`-prefixed morph at all. Each measurement now writes only the
highest-priority family the install offers and the head can move; a single family's own fan-out is
left alone.

Only fires when a slider inventory is loaded — without one FaceForge writes EFM alone, which is why
exports made before loading an inventory were unaffected.

**Guessed baselines are capped.** A baseline is a divisor, so a small wrong one is a multiplier, not
a bias. On the reported export every *measured* baseline put the face within 10% of neutral
(nose -7%, jaw -10%) while every *guessed* one threw it to the end of the range (brow height +70%,
brow width +78%, brow thickness +168%). 0.19.0 was right to refuse to calibrate these against a
render — Skyrim's brows and irises are textures, so the neutral head has no brow geometry — but the
estimate was still handed a measurement's authority. `browHeight`, `browWidth`, `browThickness`,
`irisSize` and `lipGap` now keep direction and ordering but cap at 30% of family range. `browAngle`
divides degrees rather than a baseline and is excluded.

Net on the reported preset: EFM_Brow_Height 2.30 -> 0.90, EFM_Brow_Width 2.43 -> 0.90,
EFM_Brow_Thickness 2.93 -> 0.90, EFM_Oral_Height -2.16 -> -0.90, nine duplicate sliders dropped,
and everything on a measured baseline (jaw, nose, cheeks, mouth width) unchanged.

**0.24.1 then removed three of the five guesses entirely.** The rendered numbers had been in
`qa/race-calibration.json` since 0.20.0 and pass 0.19.0's own acceptance rule (reject only when the
heads disagree by more than half the mean): browWidth 4.0% spread, browThickness 8.5%, browHeight
24.3%. The guesses they replace were 40%, 63% and 30% low. Only irisSize (51.2%) and lipGap (169.2%)
genuinely fail the rule; they stay estimated and capped, with their values moved to the measured
median so they no longer sit at the extreme of the observed range. The three 0.90s above become
0.80, 0.28 and -0.02 -- measurements rather than the limiter.

**0.24.1 also detects a covered forehead.** MediaPipe returns brow landmarks whether or not a brow
is visible, so a fringe was being measured as a brow. FaceForge now compares cheek, forehead and
brow patches from the analysed frame and fades the brow axes when the forehead is not skin. The
brow band corroborates by material match with the forehead, not by difference from skin, so a cast
shadow is damped rather than trusted.

## Measured on this installation, 2026-08-05

| head | vertices | registered sliders | live | inert |
|---|---|---|---|---|
| vanilla female | 996 | 148 | 86 | 62 |
| vanilla male | 898 | 104 | 89 | 15 |
| High Poly Head female | 3832 | 148 | 35 | 113 |
| High Poly Head male | 3598 | 104 | 38 | 66 |

**51 EFM sliders are live on the vanilla head and inert on High Poly Head.** Expressive Facegen
Morphs registers its extension against `Actors\Character\Character Assets\FemaleHeadChargen.tri` and
ships 996-vertex morphs; the HPH head is 3832, and nothing on this install registers an EFM
extension against the `KL\High Poly Head` path. The EFM sliders that survive on HPH are the ones
whose morphs sit on the eye and mouth meshes, which HPH does not replace.

This corrects a documented assumption in `hphCalibration.ts` ("High Poly Head ships its own
EFM-compatible morphs"). It is a gating question, not a gain question — the response-gain
conclusion in that file is unaffected.

Reproduce: `dotnet run --project src/FaceForge.Core.Tests -- --morphs "<Data>" NordRace`.

## Handoff questions from the FollowerForge session, answered

1. **Does RaceMenu's Export Head bake slider shaping into vertices?** Yes.
   `qa/measure-exported-head.py` fits an exported head against the full 122-morph vanilla set with
   each opposed pair as one bounded variable. The FaceForge-built Inoue export leaves **58.6%** of
   its displacement outside that set; the hand-made, sculpt-carrying Silvia export leaves **57.9%**.
   Two heads built by different routes retain the same proportion of non-vanilla shape, so extension
   morphs and sculpt alike survive into the exported geometry. The jslot carries no vertex data; the
   exported NIF does. An unconstrained fit is worthless here — it puts +6978 on `CheeksUp` against
   −6976 on `CheeksDown` and "explains" anything.
2. **Does FaceForge derive the skin tone?** No. It writes no `tintInfo` at all; a fresh template
   ships `tintInfo: []`. The RGB(206,205,204) darkening in the reported preset came from the
   foundation preset the user loaded.
3. **Head part `type` ordinals.** FaceForge writes head parts as `{ formIdentifier }` with no `type`
   field. The ordinals in the reported preset are inherited from the foundation. RaceMenu resolves
   by FormID, which is consistent with the preset loading correctly.

## Runtime boundary

No runtime confirmation of 0.24.0. The before/after values are computed from the shipped formula and
the defects are measured from installed files; neither is an in-game observation. The user-side test
is to re-export the same photograph with 0.24.0 and load it on the same HPH character -- the brows
should read as brows rather than as slabs, and the rest of the face should be recognisably the shape
0.23.2 produced. SSEEdit, xEdit, and Creation Kit were not launched. Skyrim Data, Vortex staging,
CharGen, and installed tools stayed read-only.

## Next useful work

1. **Calibrate irisSize and lipGap.** Three of the five were adopted in 0.24.1; these two fail the
   disagreement rule and remain estimates on a cap. lipGap varies 169% across rendered heads because
   a closed mouth's lip separation is near zero and noise dominates; irisSize varies 51% because two
   of twenty heads are outliers (DarkElf male 0.0707, Elder male 0.1177) and the iris is a texture on
   a sphere. Either needs a different reference than a neutral render -- a rendered head wearing a
   real brow/eye head-part, or a photo corpus -- not another guess.
2. **Validate occlusion detection against real photos.** The thresholds (0.10 skin variation, 0.22
   occluder distance) are set from the pale-skin/brown-fringe case that prompted it and from the
   fact that a false positive is cheap. They have not been swept over a range of skin tones,
   lighting, or head coverings. This is the highest-value next measurement.
3. **Transfer EFM morphs to High Poly Head topology.** The morphs exist at 996 vertices and HPH is a
   subdivision of the same head with the same UVs, so a barycentric transfer would make ~51 sliders
   live again rather than merely honest. This is the single largest remaining fidelity gain and it
   is bounded work; it needs its own version and a render-and-measure check.
4. **Read slider inis out of BSAs.** ECE Sliders for Racemenu ships its `morphs.ini`/`races.ini`
   inside a BSA, so its CME/SPG sliders are invisible to the registry and fall through to the
   permissive path. BSArch cannot unpack that archive (it lists but extracts nothing), so this needs
   a BSA reader rather than a shell-out.
5. Calibrate the reliability thresholds against a small real-photo set, especially turned faces; the
   current 12% asymmetry and 180-pair gates deliberately catch the known 26% / 155-pair defect.
6. The diagnostic preview draws `correctedLandmarks`, which mirror-averaging only symmetrises for
   paired points — 155 of 478 on the known turned photo — so the contour ring alternates between
   symmetrised and raw points and reads as a sawtooth. Cosmetic; measurements are unaffected because
   the measurement landmarks are always paired.
