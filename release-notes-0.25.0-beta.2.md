**Beta 2.** Same feature set as beta 1, after a full audit of the code. Still a pre-release for the
same reason: no preset from this build has been loaded in Skyrim yet.

## Fixed

**Vision through an installed CLI did not work.**
- Claude Code never received its prompt: it was passed after an option that takes a list, so the CLI
  read it as part of that list and reported that it was given no input.
- No npm-installed CLI (Codex, Gemini, Claude Code via npm) could be started. FaceForge picked the
  wrong one of the three files npm installs, and launched `.cmd` files with a command line Windows
  could not parse.
- A signed-out CLI was reported as "did not return a JSON object". It now says what the CLI said.

**Privacy and safety.**
- The interface could reach the network: the bundled landmark library contains a usage logger that
  posts to a Google endpoint. The window is now offline by construction, and that is tested.
- A developer trace was left on: the "Legacy ratios" fit saved rendered images into
  `Documents\FaceForge Debug`. It is off.
- A refused or failed export no longer replaces an existing ZIP with an empty file.
- The desktop bridge only accepts messages from the built-in interface, and the window cannot be
  navigated anywhere else.

**Smaller.** A damaged `.tri` from a mod is rejected cleanly; a failed render fails at once instead of
after 30 seconds; two interface texts that still described the wrong RaceMenu command now name
**Sculpt > Export Head**; the download README lists what the tool leaves on the PC and how to remove it.

## Verified in this build

- 131 frontend tests, 131 native assertions, 0 build warnings
- Browser QA (photo to preset, three poses) and layout QA at four window sizes
- The download ZIP was extracted and its EXE driven: photo analysis works, the network probe is
  refused, navigation away is refused

Not verified: anything the game renders, and a live vision request to a model.

## Files

`FaceForge-0.25.0-STANDALONE.exe` - 129,232,432 bytes, SHA-256 `4AC2D24BEB32542CC12937DE3EB38F46BB904A549B5B69EE6A604C2AD4535C5C`
`FaceForge-0.25.0-STANDALONE.zip` - 122,355,391 bytes, SHA-256 `35CD28E71AB152F3748AADBC3EB047CDB1A73366F72B7633278E77866D3EF360`

Requires Windows 10/11 with WebView2, Skyrim SE/AE, RaceMenu, and Expressive Facegen Morphs.

Changelog: https://github.com/SenjuWoo/FaceForge/blob/main/CHANGELOG.txt
