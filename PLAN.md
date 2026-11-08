# FaceForge accuracy rework plan

Status: approach B approved 2026-10-30. Rebased the same day on recovered work (next section):
snapshot 0.25.0 = 0.24.3 + GitHub PR #1. Parent: 0.24.3.
Author: Claude Code (Sonnet 5.5). Evidence tags: [V] verified on this machine today, [R] read from
the project's own docs/code, [P] proposal, [U] unverified / needs a test.

## Goal

Drag in a face photo, press one button, get a RaceMenu preset that is measurably close to the
photo, using whatever face mods are installed. "Accurate" must become a number the app and the QA
harness can report, not an impression.

## Recovered prior work (found 2026-10-30; the owner had forgotten to mention it)

GitHub `SenjuWoo/FaceForge` PR #1, **closed unmerged**, one commit `70939cd` (author account
`ErenYeger7`, Co-Authored-By Claude Opus 4.8), 2026-08-15, on top of the 0.24.3 release commit.
33 files, +5239/-248. Titled "0.24.26-0.24.28"; the About text says 0.24.15; no CHANGELOG, STATE or
VERSION for 0.24.4-0.24.28 was pushed, so that history is lost and only this squash survives.
Local `main` never contained it, which is why the pre-reset checkout looked unchanged since 0.24.3.

What it adds (read from the diff, then overlaid into 0.25.0):

- `HeadRenderer.cs` (808 lines): C# port of `qa/render-head.py`; renders the player's real chargen
  head (race + EFM morphs + 4 reshape parameters) so the render is measured like a photo.
- `fit.ts` (775): "Analyze & improve" Levenberg-Marquardt over ~75 EFM sliders. Jacobian is measured
  by rendering each slider perturbed; objective is the same 39 scalar measurements; realism hinge
  prior; per-pass debug trace to `Documents\FaceForge Debug`.
- `headRender.ts`, `MatchPanel.tsx`: Match pane with several reference photos and side views, vision
  model "fit score".
- Sculpt: reshape (face width/height, nose-forward, jaw-raise) converted to per-vertex
  `morphs.sculpt` deltas in the exported preset (`racemenu.ts`).
- `BsaArchive.cs`, `BsaMorphIndex.cs`: reads packed `facegenmorphs` inis/tris, i.e. fixes the
  registry incompleteness found today.
- Mod Organizer 2 profile indexing (`Mo2Environment.cs`, `ResolvedDataView.cs`), DDS skin textures
  (`DdsTexture.cs`, new NuGet dependency BCnEncoder.Net), OpenRouter/CLI vision changes.

Verified on the overlaid 0.25.0 tree today: `tsc -b` clean, 100 frontend tests, 96 native
assertions pass. NOT verified: the desktop app was not launched, fit quality was not measured, no
in-game result exists. Limits visible in the code: the objective is 39 scalar ratios (position and
shape information is thrown away), every evaluation is render + detector (slow, noisy), the author's
own note says the front orthographic render is blind to depth, sculpt is four parametric moves
rather than a fitted displacement field, and no colour is written.

Consequence: Phase 2 below is no longer "build a fit"; it is "replace this fit's objective and
Jacobian, and prove with the benchmark that it is better".

## Why 0.24.3 (the shipped one-shot path) is not accurate

1. **Open loop.** [R] 39 hand-defined 2D landmark ratios -> divide by a per-race baseline -> times a
   hand sensitivity -> times `RESPONSE_GAIN` 0.18 -> `tanh`. (`faceAnalysis.ts` `response()`,
   `generateEfmSliders()`.) Nothing ever checks that the resulting head resembles the photo. 22
   releases of tuning since 0.19 had no accuracy metric, so DECISIONS.md can only say "do not tune
   a number because of a complaint".
2. **"EFM sliders are inert on High Poly Head" is REFUTED (earlier drafts of this plan and the
   2026-08-05 STATE.md claimed it).** [V] `FaceForge.Core.Tests --morphs` reports `Complete: false`
   because `High Poly Head.bsa`, `RaceMenu.bsa`, `ECE Sliders for Racemenu.bsa` and
   `AZ_HouseMaid.bsa` pack `facegenmorphs` inis the loose-file reader cannot see. Extracted today
   with houseCARL `housecarl_bsa_extract`: HPH's packed `high poly head.esm\morphs.ini` registers
   `extension = KL\High Poly Head\femaleheadchargen.tri, ... KL\femalehead_efm.tri ...`, and
   `morphs\kl\femalehead_efm.tri` is a valid FRTRI003 file with 3832 vertices and 134 `EFM_*`
   morphs (e.g. `EFM_Jaw_Wide`). So EFM is live on HPH. The loose-file counts below are only the
   registry's incomplete view and must not be read as "dead":

   | head | verts | registered | live | inert |
   |---|---|---|---|---|
   | vanilla female | 996 | 148 | 92 | 56 |
   | vanilla male | 898 | 104 | 89 | 15 |
   | HPH female | 3832 | 148 | 41 | 107 (51 EFM, 32 LDD, 24 other) |
   | HPH male | 3598 | 104 | 38 | 66 (51 EFM, 15 LDD) |

   Consequence: the dead-slider theory is not the cause of "generic in game". The open loop (1),
   missing sculpt (3) and missing colour (4) carry the accuracy problem. The registry's
   incompleteness is still a product defect (it under-reports live sliders on HPH, RaceMenu and
   ECE installs) and a BSA-aware registry is a Phase 1 item. The "Transfer EFM morphs to HPH
   topology" idea in the old STATE.md "Next useful work" is unnecessary: HPH ships those morphs.
3. **No sculpt.** [R] `morphs.sculpt: null`. ROADMAP.md reports five reference presets that all
   carry sparse sculpt (285-3808 vertices) and calls sculpt "the actual likeness"; those presets
   are not on this install (only two Priscilla `.jslot` files are), so that count is unre-checked.
   Sliders alone cannot express a specific face.
4. **No colour.** [R] `tintInfo: []`. No skin tone, lip, brow or hair colour is read from the photo.
   Colour carries more of "looks like her" than jaw width does.
5. **Single-view depth guess.** [R] MediaPipe z is weak; pose is fixed up heuristically
   (`sourceCorrection.ts`, 632 lines).
6. **No ground truth.** Every number is judged by eye in game.

## Approaches considered

| | Approach | Verdict |
|---|---|---|
| A | Patch 0.24.3: retune gain, add tint | Cheap, but keeps the open loop and still has no sculpt. Rejected. |
| **B** | **Closed-loop fit on Skyrim's own morph basis + sparse sculpt + colour, MediaPipe only** | **Recommended.** Permissive licences, single EXE, no new model download, uses the user's mod stack as capability. |
| C | B plus a learned 3D face regressor (FLAME-family) for depth | Optional later plug-in. FLAME classic is non-commercial academic and cannot ship in a public EXE; only FLAME 2023 Open is CC-BY-4.0 ([Max Planck licence pages](https://flame.is.tue.mpg.de/modellicense.html)). SMIRK/DECA/MICA/Pixel3DMM licences and weights are [U]. Add only if the benchmark shows depth-limited error. |

## Architecture (B)

Replace "measure -> ratio -> slider" with "fit".

```text
photo(s) -> MediaPipe 478 landmarks (kept, web layer)  -> pose + occlusion gate (kept)
         -> skin/lip/brow/hair/eye colour sampling (new)
Skyrim head model (Core, new): base mesh + linear basis of every LIVE slider  (TriFile + MorphRegistry exist)
Correspondence (new): 478 landmarks <-> barycentric points on the Skyrim head, derived by
                      render -> same detector -> ray-cast, so detector bias cancels on both sides
Solve (new):  min_w || landmarks_photo - L * V(w) ||^2 + lambda * || w / sigma ||^2,  w in family ranges
              pose/scale solved jointly; sigma from reference presets' slider spread
Residual (new): leftover landmark error -> smooth, capped per-vertex field -> sparse jslot `sculpt`
Appearance (new): tintInfo + ranked eye/brow/hair head parts from the 2,939-record HDPT index
Verify (new): fitted-head preview beside the photo, landmark error score shown in the UI
```

Key properties:

- **Slider routing follows liveness.** The solver only receives sliders that move vertices on the
  chosen head (vanilla or HPH) from any installed family: EFM, CME, ECE, LDD, Face Sculptor
  Expanded, Racemenu Enhancer. No more "EFM or nothing".
- **Linear in `w`**, so the solve is a bounded regularised least squares: milliseconds, no ML
  runtime, testable in the existing native assertion harness. [U] Linearity and exact scaling
  (TRI multiplier, family range, int16 divisor) must be confirmed against an in-game F5 export in
  Phase 0.
- **Sculpt guard rails**: per-vertex cap, left/right symmetry option, normal-flip and
  self-intersection check, preview diff before write.
- **Dependency honesty kept**: a missing required mod is a visible warning, never a silent no-op.

## Phases (one snapshot per version, per versioned-workspace rule)

| Phase | Version | Content | Exit gate |
|---|---|---|---|
| 0 | 0.25.0 | **Benchmark first, no product change.** Synthetic round trip (installed reference presets plus random slider draws -> render -> pipeline -> recovered sliders and vertex error). Photo set scored by landmark error. F5-export ground truth via `qa/measure-exported-head.py`. Confirm morph linearity and scaling. Python venv for prototyping, not the shared interpreter. | 0.24.3 baseline numbers recorded; harness reruns identically. Acceptance numbers for later phases are set here, not now. |
| 1 | 0.25.x | Tint extraction (skin, lips, brows, hair, eye), ranked head parts, accuracy panel, one-click flow (drop photo -> one button). BSA-aware registry already exists in PR #1; verify it, do not rewrite it. | Benchmark improves; existing 100 frontend and 96 native tests green; rendered layout checked with `qa/browser-qa.mjs`. |
| 2 | 0.26.0 | Replace the fit's 39-ratio objective with a dense landmark residual and its render-per-slider Jacobian with the analytic one from the TRI deltas (correspondence derived once by render + same detector). `fit.ts` stays as the fallback. | Synthetic recovery and landmark error beat both 0.24.3 one-shot and the PR #1 fit on the same cases. |
| 3 | 0.27.0 | Residual sculpt (smooth capped displacement field) in place of the four parametric reshapes, with guard rails. | Vertex error vs F5 ground truth improves; user-side RaceMenu load confirmed. |
| 4 | 1.0.0 | Multi-photo consensus, oblique robustness, optional 3D regressor plug-in (approach C). | Benchmark across the photo set; default pipeline switched. |

## UX target

Drop a photo onto the window; race/sex, head and colours are auto-chosen; one **Make preset**
button; advanced panels collapsed; accuracy score and side-by-side preview shown before export.
Output keeps the existing RaceMenu pack and the FollowerForge handoff contract (Export Head ->
FollowerForge) unchanged. Writing into the CharGen presets folder, if added, is an explicit
user-clicked button, never automatic.

## Risks and runtime boundary

- Depth from one frame is ambiguous; the Skyrim-head prior (sigma) carries it. Oblique photos stay
  weakest until Phase 4.
- Sculpt schema acceptance and visual likeness are only provable in RaceMenu. I cannot launch
  Skyrim; every in-game claim stays "tool-validated" until the user confirms.
- A fitted face can be uncanny; priors and caps are the mitigation, a slider "fit strength" is the
  escape hatch.
- Game Data, Vortex staging and installed tools stay read-only throughout.

## Phase 0 result (2026-10-30, synthetic, [U] model; full numbers in qa/bench/BASELINE-2026-10-30.json)

| path | head | slider corr | vertex skill (0 = leave neutral) |
|---|---|---|---|
| one-shot (0.24.3) | hph_female | 0.05 | +0.08 |
| one-shot | vanilla_female / hph_male / vanilla_male | 0.01 / 0.03 / -0.02 | -0.09 / -0.19 / -0.92 |
| PR #1 fit, photo from Python renderer | hph_female | 0.04 | -4.65 |
| PR #1 fit, photo from the fit's own C# renderer | hph_female | 0.05 | -1.77 |

Reading: neither path recovers the face on this test. The fit optimises well (loss 0.15, below the
true sliders' 0.42 in 12/12 cases) but the objective it optimises, 39 detector-read ratios, is not
minimised at the true face, so a better optimiser would not help. Phase 2's job is therefore a new
objective (dense landmark residual, ridge prior toward plausible Skyrim faces), not a new solver.
Limits: synthetic cases, not photographs; fit run on hph_female only; reshape moves unscored in the
vertex metric.

## Phase 2 prototype result (2026-10-30, python, same synthetic benchmark; qa/bench/PHASE2-PROTOTYPE-2026-10-30.json)

Method (`qa/bench/phase2.py`): 468 detector landmarks; the detector's own response to each slider is
MEASURED once per head (render each slider at +-3, detect with 16 jittered re-detections, align to the
neutral frame), giving a dense Jacobian; each photo is solved as a bounded ridge regression with a
per-iteration 2D similarity for the unknown framing. No render per slider and no render per photo.

| head | one-shot skill | PR #1 fit skill | dense fit skill (lambda 30) |
|---|---|---|---|
| hph_female, test seed 1 | +0.08 | -1.77 (same renderer) | **+0.59** |
| hph_female, validation seed 2 | +0.04 | | +0.62 |
| hph_female, dense generator | +0.10 | | +0.57 |
| hph_male | -0.19 | | +0.57 |
| vanilla_female | -0.09 | | +0.40 |
| vanilla_male | -0.92 | | +0.23 |

What the ablations say: assuming landmarks stay glued to surface points (barycentric) explains 0.42 of
the detector's movement and scores +0.38; measuring the response explains 0.70-0.75 and scores +0.59.
Averaging 16 re-detections changed almost nothing (per-detection noise 0.85 px, model error 3-4 px), so
the limit was the model, not noise. lambda 10-300 all land within ~0.06 skill. Slider-space correlation
is still only 0.25-0.35: many sliders are unidentifiable from a front view (depth, near-duplicates),
which is what the ridge prior is for, and why the next gains need depth/side views, not a better solver.

Limits: synthetic cases rendered by the same flat renderer the Jacobian was measured on (no photo
domain gap); [U] linear head model; only EFM head-mesh sliders; vanilla heads have low landmark
explained variance (0.15-0.24) and weaker gains. Real photographs are the open test.

Port (done 2026-10-30, `src/domain/denseFit.ts`, wired into the Match pane as the default "Dense
landmarks" method, "Legacy ratios" kept in a drop-down): Jacobian is measured by the native renderer
on first use (about 10 s here) and cached in localStorage; each photo then takes about 1 s. Measured
headless against the real C# renderer on hph_female, 30 cases: photo and Jacobian from the same
renderer +0.41 (lambda 100) / +0.39 (1000); photo from a different renderer -0.39 at lambda 30 but
+0.34 at lambda 1000, so the default is 1000. That second case is a stand-in for the photo-vs-render
gap and is the main open risk: the port scores below the Python prototype (+0.59) mostly because the
Jacobian renders are 768 px with 4 jitters and the score ignores the eye/mouth sliders the port may
also use. Robust landmark re-weighting was tried and changed nothing; it was removed. Side views and
the sculpt reshape are not used by this method yet. Needs real photographs before it is trusted.

## Colour and parts layer (2026-10-30)

Built: photo skin, lip, iris and hair colours (landmark-region medians), written as a skin-tone tint on
Skyrim's own preset gradient plus `actor.hairColor`; swatches and a toggle in the output panel; iris colour
word added to the eye-part name ranking. Details, the dropped albedo-ratio idea and the limits are in
STATE.md. Next for appearance: read eye textures (TXST/NIF) so eye parts rank by real colour, recolour a
template's Lips layer, hair/brow style matching, and a real check in RaceMenu with the five generated
presets.

## Needed from the owner

1. Approve approach B (C deferred).
2. 5-10 test photos, varied (front, slight turn, glasses/fringe, different skin tones).
3. For 2-3 of them: a hand-made RaceMenu face plus its F5 Export Head files (true ground truth).
4. Confirm the head you play on (assumed High Poly Head, since it is installed).

## Historical: FaceForge 0.22.0 plan (complete)

0.22.0 added a deterministic reliability verdict (pose, pairing, asymmetry, source quality) and a
full-interpretation vs bounded-refinement vision mode, consent-gated. Delivered and tool-validated
in 0.22.0; superseded as the active plan by this document.
