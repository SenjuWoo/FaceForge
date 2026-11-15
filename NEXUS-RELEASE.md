# FaceForge - Nexus release kit

| | |
|--|--|
| **Version** | 0.27.0 |
| **Upload** | `FaceForge 0.27.0\NEXUS-UPLOAD\FaceForge-0.27.0-STANDALONE.zip` |
| **Size** | 118,566,624 bytes |
| **SHA-256** | `8172DC6000F2A3556011AC3F8854A0D191C5B6CA7A4A220A2DD3D9870F35DDA3` |
| **EXE inside** | `FaceForge-0.27.0-STANDALONE.exe`, 125,445,990 bytes, `38967EDE43524C88683F70C8559A92AFDB8F049680B59C3A0F2FC495514E51C1` |
| **GitHub** | https://github.com/SenjuWoo/FaceForge/releases/tag/v0.27.0 (same bytes; full release, Latest) |
| **On Nexus now** | Check the page: if the last Nexus file is older than 0.26.0, paste every block of the changelog file. |

## What to paste where

| Nexus field | Source |
|--|--|
| Mod name | `FaceForge` |
| Summary (350 max) | below |
| Description (BBCode) | `NEXUS-UPLOAD\NEXUS-DESCRIPTION.bbcode` - version-free, does not need editing per release |
| File name / version | `FaceForge 0.27.0` / `0.27.0`, category **Main files** |
| File description | first block of `NEXUS-UPLOAD\NEXUS-PASTE-0.27.0.txt` |
| Changelog tab | `NEXUS-UPLOAD\NEXUS-CHANGELOG-0.27.0.txt` (one entry per version since the last Nexus upload) |
| Images | `NEXUS-UPLOAD\media-0.27.0\` with captions from `NEXUS-UPLOAD\NEXUS-MEDIA-PLAN.md` |
| Category | Utilities |
| Requirements | Off-site: Microsoft Edge WebView2 Runtime. Nexus: RaceMenu. Optional/recommended: Expressive Facegen Morphs, High Poly Head. Choose each from Nexus search; this kit does not guess page IDs. |
| Permissions | Original code, MIT (`LICENSE`). Third-party: MediaPipe Tasks Vision (Apache 2.0), .NET, WebView2, React - see `THIRD_PARTY_NOTICES.md`. No game assets are redistributed. |
| AI disclosure | Development used AI coding assistants; say so if the page form asks. No AI-generated image is presented as an in-game result. |

Summary:

> A Windows app, not a game mod. It measures a face in a photo on your PC and writes an editable RaceMenu preset - EFM sliders fitted against the head you actually have installed, skin tone, hair colour and your installed head parts. You finish the face in RaceMenu.

## Steps

1. Upload the ZIP above as a new **Main file**, version `0.27.0`. Nexus shows the hash after upload;
   compare it with the SHA-256 above.
2. Move 0.24.3 to **Old versions** (keep it downloadable). 0.24.1 should already be marked obsolete.
3. Replace the page description with `NEXUS-DESCRIPTION.bbcode`; set the summary.
4. Add the changelog entries.
5. Add images 00-05 in order, hero first. Read the provenance note in the media plan first.
6. Optional, once you have loaded a 0.27.0 preset in RaceMenu (`FaceForge 0.27.0\qa\RACEMENU-CHECKLIST-0.27.0.md`): add an in-game
   screenshot to the gallery. Nothing else is pending on the GitHub side.

What was verified for this file, and what was not: `VALIDATION.md`, section "2026-11-13 - 0.27.0".
