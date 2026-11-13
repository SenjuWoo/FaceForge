# Manual RaceMenu check — FaceForge 0.26.0

Run this before calling 0.26.0 a release. Nothing in the automated suite has ever loaded a preset in
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
| p5 (male, front) | 52 | 47 | 0.59% | 1.62% |

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

## Two more checks added after the head-part export fix

10. **Male preset on a male character.** p5 was measured on the male chargen mesh (3598 verts) and must
    be loaded on a male character of the race the preset targets; loading it on a female character is a
    mesh mismatch and will look broken.
11. **Head parts actually apply.** After loading a preset, check the part name shown in RaceMenu's Head
    tab for each slot (hair, brows, eyes, face). If a slot shows the race default instead of the part
    named in the pack's `appearance-selections.json`, that is the defect this fix targets — report it.

## FollowerForge handoff (only if you will build an NPC)

1. In RaceMenu, after the look is right, choose **Sculpt > Export Head** and give it the preset's name.
   That command writes the mesh; **Save Preset** writes only the `.jslot`.
2. Confirm the three files that share the preset name are present in the deployed location — the game's
   `Data` folder, or the mod manager's overwrite folder when the game runs under one:
   `Data\SKSE\Plugins\CharGen\Presets\<name>.jslot`
   `Data\SKSE\Plugins\CharGen\<name>.nif`
   `Data\SKSE\Plugins\CharGen\<name>.dds`
   There is no `femalehead.nif` in this flow; the export is named after the preset.
3. Point FollowerForge at that `<name>.nif` / `<name>.dds` pair and build the plugin. If FollowerForge
   cannot find the head, the Export Head step — not FaceForge — is what failed.

## What to send back

- One screenshot per preset: character face in RaceMenu, same race, same lighting, same camera angle.
- For the "does it look like the photo" question, a second screenshot of the preset beside its source
  photo, cropped to the face.
- The RaceMenu Head tab for one preset, showing the part names per slot.
- For the FollowerForge check, the file list from step 2.
