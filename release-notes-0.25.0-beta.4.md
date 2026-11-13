**Beta 4.** Dependency updates only; no behaviour change. Still a pre-release: no preset from this build
has been loaded in Skyrim yet.

## What changed

- TypeScript 7, Vite 8.3.7, the React plugin 6.3.0, React and React DOM 19.3.1, the MediaPipe landmark
  library 1.2.2, and a newer CI artifact action. All six open dependency updates were reviewed and applied
  together so they cannot conflict or leave React and React DOM out of step.
- The face landmarks MediaPipe 1.2.2 produces for five test photographs are identical to those from 1.2.0,
  so the fit is not affected.

## Verified in this build

- 136 frontend tests, 131 native assertions, 0 build warnings
- Browser QA and layout QA green
- The download ZIP was extracted and its EXE driven: photo analysis works, the network probe is refused,
  navigation away is refused

Not verified: anything the game renders, and a live vision request to a model.

## Files

`FaceForge-0.25.0-STANDALONE.exe` - 129,379,846 bytes, SHA-256 `821A5106DDA562987D653D1428CDB1980D2CC77739399260DBB80BBB1C09CF13`
`FaceForge-0.25.0-STANDALONE.zip` - 122,498,437 bytes, SHA-256 `E7F67A2E454552E22A5BBC87721CD958D6CC7D4CC0F9278B01C34C73DD66221E`

Requires Windows 10/11 with WebView2, Skyrim SE/AE, RaceMenu, and Expressive Facegen Morphs.

Changelog: https://github.com/SenjuWoo/FaceForge/blob/main/CHANGELOG.txt
