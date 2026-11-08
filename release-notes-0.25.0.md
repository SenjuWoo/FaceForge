FaceForge 0.25.0 - the fit is measured, and colour is written.

This release finishes the accuracy rework that 0.24.3 could not do.

**Measured fit.** FaceForge now renders your installed chargen head, measures how each slider moves
it, and fits a photo's 468 landmarks to that measured response instead of dividing 39 hand-picked
ratios. The older method is still selectable as "Legacy ratios".

**Colour.** Skin tone and hair colour are read from the photo and written into the preset, with
swatches so you can see them before exporting. Skin tone is matched on Skyrim's own skin-tone gradient.

**Vision accounts stop dead-ending.** The reported "I installed it and it still says install" happened
because the app only searched PATH, and a double-clicked EXE inherits a stale PATH. Common install
folders are searched now, and Settings > Locate... points at the program once; the path is remembered
and shown.

**Under the hood.** BSA-packed morph data (High Poly Head, RaceMenu, ECE) is read, MO2 profiles and
BCn skin textures are supported, and every version string is 0.25.0.

Verified: 120 frontend tests, 99 native assertions, browser QA green on one photo analysed straight,
tilted 16 degrees and at a third of the frame, single-file EXE built and launched.

Not verified: an in-game RaceMenu load. The preset has not been looked at by a person inside Skyrim for
this release, so treat the first one you try as a test.

Requires RaceMenu to load the preset, and Expressive Facegen Morphs or the EFM sliders are ignored.

Changelog: https://github.com/SenjuWoo/FaceForge/blob/main/CHANGELOG.txt
