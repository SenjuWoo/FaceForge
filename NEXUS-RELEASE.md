# FaceForge - Nexus release kit

| | |
|--|--|
| **Version** | 0.26.0 |
| **Upload** | `FaceForge 0.26.0\NEXUS-UPLOAD\FaceForge-0.26.0-STANDALONE.zip` |
| **Size** | 118,563,185 bytes |
| **SHA-256** | `1F4A420CA030ED2E73E9EF2AC5EDAB433260D6D5AB495B2FFD3E414F14A50D62` |
| **EXE inside** | `FaceForge-0.26.0-STANDALONE.exe`, 125,436,817 bytes, `55EE7F6EA8CB2735098AB2875000BAD934016D5B353E03FAB84B24CA2A7E83FC` |
| **GitHub** | https://github.com/SenjuWoo/FaceForge/releases/tag/v0.26.0 (same bytes; full release, Latest) |
| **On Nexus now** | 0.24.3. 0.25.0 was never uploaded to Nexus, so this upload carries both changelogs. |

## What to paste where

| Nexus field | Source |
|--|--|
| Mod name | `FaceForge` |
| Summary (350 max) | below |
| Description (BBCode) | `NEXUS-UPLOAD\NEXUS-DESCRIPTION.bbcode` - version-free, does not need editing per release |
| File name / version | `FaceForge 0.26.0` / `0.26.0`, category **Main files** |
| File description | first block of `NEXUS-UPLOAD\NEXUS-PASTE-0.26.0.txt` |
| Changelog tab | `NEXUS-UPLOAD\NEXUS-CHANGELOG-0.26.0.txt` (one entry for 0.26.0, one for 0.25.0) |
| Images | `NEXUS-UPLOAD\media-0.26.0\` with captions from `NEXUS-UPLOAD\NEXUS-MEDIA-PLAN.md` |
| Category | Utilities |
| Requirements | Off-site: Microsoft Edge WebView2 Runtime. Nexus: RaceMenu. Optional/recommended: Expressive Facegen Morphs, High Poly Head. Choose each from Nexus search; this kit does not guess page IDs. |
| Permissions | Original code, MIT (`LICENSE`). Third-party: MediaPipe Tasks Vision (Apache 2.0), .NET, WebView2, React - see `THIRD_PARTY_NOTICES.md`. No game assets are redistributed. |
| AI disclosure | Development used AI coding assistants; say so if the page form asks. No AI-generated image is presented as an in-game result. |

Summary:

> A Windows app, not a game mod. It measures a face in a photo on your PC and writes an editable RaceMenu preset - EFM sliders fitted against the head you actually have installed, skin tone, hair colour and your installed head parts. You finish the face in RaceMenu.

## Steps

1. Upload the ZIP above as a new **Main file**, version `0.26.0`. Nexus shows the hash after upload;
   compare it with the SHA-256 above.
2. Move 0.24.3 to **Old versions** (keep it downloadable). 0.24.1 should already be marked obsolete.
3. Replace the page description with `NEXUS-DESCRIPTION.bbcode`; set the summary.
4. Add the changelog entries.
5. Add images 00-04 in order, hero first. Read the provenance note in the media plan first.
6. Optional, once you have loaded a 0.26.0 preset in RaceMenu (`FaceForge 0.26.0\qa\RACEMENU-CHECKLIST-0.26.0.md`): add an in-game
   screenshot to the gallery. Nothing else is pending on the GitHub side.

What was verified for this file, and what was not: `VALIDATION.md`, section "2026-11-13 - 0.26.0".
