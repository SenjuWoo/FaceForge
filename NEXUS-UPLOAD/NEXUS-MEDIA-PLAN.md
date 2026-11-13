# FaceForge - Nexus media plan (0.26.0)

All images are screenshots of the released 0.26.0 EXE (SHA-256 `55EE7F6EA8CB2735098AB2875000BAD934016D5B353E03FAB84B24CA2A7E83FC`), extracted from the upload ZIP and
driven over the WebView2 debugging port on 2026-11-13, at the app's own window size (1534x958 CSS px).
No version or date is drawn on the hero, so it survives later releases.

| # | File | Caption (paste) | Alt text | Purpose |
|--|--|--|--|--|
| 0 | `media-0.26.0/00-hero.png` (1920x1080) | FaceForge: a photo in, an editable RaceMenu preset out. | FaceForge window with a portrait, its landmark mesh, and a render of the fitted Skyrim head. | Hero / thumbnail |
| 1 | `media-0.26.0/01-analysis.png` | After analysis: the photo's landmarks, what was corrected (tilt, turn, nod) and the race and sex the preset targets. | Source panel with landmark overlay and pose-correction readout. | Core feature |
| 2 | `media-0.26.0/02-fit.png` | After "Analyze & improve": sliders fitted from 468 landmarks against the installed head, shown front and in profile. | Match panel with the photo beside a front and profile render of the fitted head. | Proof the fit runs on the real head |
| 3 | `media-0.26.0/03-sliders.png` | Every generated slider stays editable before export. | Output panel listing face and jaw sliders with values. | Detail |
| 4 | `media-0.26.0/04-race-style.png` | Race suggestions rank shape only, and say when races measure the same. Optional style nudges are labelled as such. | Race foundation and geometry style cards. | Configuration |

Provenance and rights:
- Author: the FaceForge project; captured from the final build. The hero adds a title band and scales
  screenshot 2 (ImageMagick); nothing else is edited.
- The portrait is `qa/synthetic-neutral-portrait.png`, the project's QA fixture. **Its generation source
  is not recorded in the repository - confirm it is synthetic and yours to show before uploading.**
- The rendered head uses the test install's chargen meshes and skin texture (vanilla Skyrim meshes, High
  Poly Head, an installed skin texture). They appear as the tool's output, as in any RaceMenu screenshot;
  credit High Poly Head if the page lists visible mods.
- No ENB, ReShade or post-processing: these are application screenshots, not game screenshots.

Not captured (needs the game; add when you have them):
- An in-game RaceMenu screenshot of a 0.26.0 preset loaded at its target race and sex, ideally beside the
  photo and the FaceForge preview. Without it the page must not imply an in-game result.
- Optional short clip: photo -> Analyze -> Analyze & improve -> Export, from the app.
