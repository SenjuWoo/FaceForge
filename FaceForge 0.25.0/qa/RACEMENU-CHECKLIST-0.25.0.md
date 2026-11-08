# Manual RaceMenu check — FaceForge 0.25.0

Run this before calling 0.25.0 a release. Nothing in the automated suite has ever loaded a preset in
Skyrim; every number below is an out-of-game measurement.

## What the five presets already measure

They were produced headless (no head parts selected, no sculpt), from the owner's five photos.
`qa/bench/audit_presets.py` reads them back through the installed High Poly Head EFM model:

| preset | EFM sliders | head-mesh sliders | movement (RMS of head width) | largest vertex |
|---|---|---|---|---|
| p1 (front) | 53 | 49 | 1.96% | 5.44% |
| p2 (front) | 55 | 46 | 1.02% | 2.82% |
| p3 (turned, mouth open) | 43 | 36 | 0.99% | 5.04% |
| p4 (front) | 58 | 52 | 0.65% | 2.04% |
| p5 (male, front) | 52 | 47 | 0.58% | 1.62% |

Head-to-head distance between two different photos is 0.43–2.47% of head width. So expect **subtle**
shape differences between presets, not a new face. If p1 and p2 look identical in game, that is
consistent with these numbers and is not by itself a bug — but say so, because it decides whether the
prior needs loosening in a future version.

Sculpt data in all five is an empty host shell (`data: []`), by design for High Poly Head. No head
parts are carried, because the generator ran without a selection.

## Before you start

- RaceMenu installed; Expressive Facegen Morphs active; High Poly Head active if the presets target it.
- Copy the presets into a **new Vortex mod folder** (`SKSE/Plugins/CharGen/Presets/`), never into
  `Data` directly, then enable and deploy it.
- Start a throwaway character or a save you can throw away. Pick the race and sex **first** — a jslot
  does not carry them. p1–p4 are female, p5 is male.

## Checks, per preset

1. **Does it load at all** — no error, no grey or black face, no missing-texture placeholder.
2. **Load p1, note what changed** from the race default: jaw, chin, nose, brow, mouth. Write down one
   sentence per feature. That is the ground truth for steps 3–5.
3. **Load p2 without changing anything else.** Does the head visibly change from p1? Compare jaw width,
   nose length, mouth size. ("no visible change" is a valid, useful answer.)
4. **Load p4** (the most conservative preset, 0.65%). If p4 is indistinguishable from the race default,
   the movement is below the visible threshold in game, which matches the measurement.
5. **Load p3** last and separately — it is the turned, open-mouth photo and its shape is the least
   trustworthy. Expect it to look off; note how.
6. **Load p5 on a male character.** Same checks.
7. **Skin tone:** does the face sit at roughly the photo's lightness, or too dark / too grey / too
   light? This is the one setting no out-of-game test can confirm.
8. **Hair colour:** wear a hair part, then check the colour matches the photo's hair.
9. **Head parts:** in the app, select a hair, eyes and brows, export a **new** preset, and confirm the
   character changes to those parts on load. The five test presets carry none.

## Report back

For each preset: loaded (yes/no), shape change vs default (none / subtle / clear), skin tone (right /
too dark / too grey), hair colour (right / wrong), any visual defect. One screenshot per preset next to
its source photo is worth more than any number in this file.
