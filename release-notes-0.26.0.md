**FaceForge 0.26.0.** An audit of the code earlier passes had not read line by line, the fixes it
found, and faster head previews. No preset from this build has been loaded in RaceMenu yet; everything
below was verified out of game.

## Fixed

- **The "Compact soft midface" style did the opposite of its description.** It widened the cheeks,
  nose bridge and jaw instead of narrowing them. Its fit score was also on an outdated scale.
- **Brow and eye descriptions** used to rank head parts called every face "wide" and "wide-set".
- **Child head parts are no longer offered** for an adult character when their race list is unknown.
- **High Poly Head parts can no longer drop off** the appearance list.
- **The window no longer slides up** when you scroll past the end of a panel.
- **Legacy ratios fit** now fits the mouth-opening, eyelid, eyeball, eye-socket, iris and cheek-shape
  sliders in their own stages.
- **Loose morph files override archived ones**, as in the game.
- Smaller download: an unused 12.9 MB runtime left in 0.25.0-beta.4 is gone.

## Faster

- Head previews and the measured fit reuse the meshes they already read: a batch of 64 renders is
  about three times faster once warm, with byte-identical output.

## Verified in this build

- 148 frontend tests, 139 native assertions, 0 build warnings
- Browser QA (including a new check that the window does not scroll) and layout QA at four sizes
- The download ZIP extracted and its EXE driven against a real install: it indexes, analyses a photo,
  runs the dense fit, refuses network access and refuses navigation

Not verified: anything the game renders, and a live vision request to a model.

## Files

`FaceForge-0.26.0-STANDALONE.exe` - 125,436,817 bytes, SHA-256 `55EE7F6EA8CB2735098AB2875000BAD934016D5B353E03FAB84B24CA2A7E83FC`
`FaceForge-0.26.0-STANDALONE.zip` - 118,563,185 bytes, SHA-256 `1F4A420CA030ED2E73E9EF2AC5EDAB433260D6D5AB495B2FFD3E414F14A50D62`

Requires Windows 10/11 with WebView2, Skyrim SE/AE and RaceMenu. Expressive Facegen Morphs is needed for
the EFM sliders to do anything.

Changelog: https://github.com/SenjuWoo/FaceForge/blob/main/CHANGELOG.txt
