<p align="center">
  <img src="docs/images/logo.svg" width="72" height="72" alt="FaceForge mark">
</p>

<h1 align="center">FaceForge</h1>

<p align="center"><strong>Photograph to an editable RaceMenu starting preset.</strong></p>

<p align="center">
  Windows tool that measures a face locally and writes a RaceMenu pack you finish in-game.<br>
  It is <strong>not</strong> a Skyrim plugin, not an SKSE DLL, and <strong>must not</strong> be installed into Skyrim <code>Data</code>, Vortex, or Mod Organizer 2.
</p>

<p align="center">
  <a href="https://github.com/SenjuWoo/FaceForge/actions/workflows/ci.yml"><img src="https://github.com/SenjuWoo/FaceForge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-66b6c9?labelColor=11151a" alt="MIT License"></a>
  <a href="https://github.com/SenjuWoo/FaceForge/releases/latest"><img src="https://img.shields.io/github/v/release/SenjuWoo/FaceForge?label=release&color=efa93d" alt="latest release"></a>
</p>

<p align="center">
  <a href="https://github.com/SenjuWoo/FaceForge/releases/latest">Download</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#honest-status">Honest status</a>
  ·
  <a href="CHANGELOG.txt">Changelog</a>
</p>

<p align="center">
  <img src="docs/images/app-hero.png" alt="FaceForge after analyzing a synthetic front portrait: source face, measured proportions, and RaceMenu output panel" width="100%">
</p>

<p align="center"><sub>QA render from the 0.25.0 tree, using the bundled synthetic portrait. Not a claim about every photograph.</sub></p>

## Quick start

**0.25.0 is in this tree and builds, but it is not a published release yet.** The latest public
download is still **[v0.24.3](https://github.com/SenjuWoo/FaceForge/releases/tag/v0.24.3)**.
The 0.25.0 candidate is `FaceForge 0.25.0/`, packaged by `package.ps1`; its numbers are under
"Honest status" below.

1. Unzip **anywhere on the PC** (Desktop, Documents, a tools folder).
2. Double-click **`FaceForge-0.25.0-STANDALONE.exe`**.
3. **Do not** drop the EXE into `Skyrim Special Edition\Data`.
4. **Do not** add this zip as a Vortex or MO2 mod for Skyrim.

No separate .NET install. Needs **Windows 10/11** and **Microsoft Edge WebView2** (usually already installed).

FaceForge only **reads** your game / Vortex / CharGen folders. It does not change your load order.

Running the EXE **under Mod Organizer 2 / USVFS is not supported**. FaceForge detects that injection and explains it instead of a bare WebView2 failure. Run it directly; it still reads the same mods.

## How to use it

1. Run the EXE. Let it find Skyrim and index your setup (read-only).
2. Add a clear front photo (or multi-view / slow turn video).
3. Analyze → pick race/sex → pick installed head parts (hair, eyes, and so on).
4. Export a **RaceMenu preset pack**.
5. In Skyrim: open RaceMenu → load the preset → sculpt if you want → use **Export Head** (not “slider-only / no sculpt”) if you will build a follower next.
6. Optional: open **[FollowerForge](https://github.com/SenjuWoo/FollowerForge)** and build the NPC plugin from that baked head.

**Pair:** FaceForge (face preset) → RaceMenu bake → FollowerForge (NPC plugin).

## Requirements

**Hard**

- Windows 10/11 + WebView2
- Skyrim Special Edition or Anniversary Edition
- RaceMenu (to load and export the preset in-game)

**Optional**

- High Poly Head and any head-part mods you already use
- Expressive Facegen Morphs — FaceForge writes only the `EFM_` family. Without EFM active, RaceMenu silently ignores those values and the character loads as the race default, identical whatever photo was used
- OpenRouter, or a provider CLI, only if you press vision refine (photos stay local unless you do)
- [FollowerForge](https://github.com/SenjuWoo/FollowerForge) after Export Head

## What this is / is not

| It is | It is not |
| --- | --- |
| An out-of-game Windows utility | A downloadable follower character |
| A photo → RaceMenu preset helper | Something you enable in your load order |
| Safe to keep outside the game folder | A replacement for RaceMenu or Creation Kit |

## Honest status

Verified in this tree:

- `FaceForge 0.25.0/` is the ship snapshot (`CURRENT.txt`)
- 121 frontend tests and 99 native assertions
- TypeScript clean, .NET Release clean, 0 warnings
- `qa/browser-qa.mjs` green on one photo analysed three ways (straight, tilted 16°, face at a third of the frame)
- `qa/layout-qa.mjs` green at 1366x768 (100% and 125% scaling), 1280x720 and 1536x960; both QA scripts are
  a CI job, not a manual step
- Packaged `FaceForge-0.25.0-STANDALONE.exe` (FileVersion 0.25.0.0)

Not claimed:

- In-game likeness on an arbitrary photograph
- That a generated preset has been loaded in RaceMenu and looked at by a person
- Photograph guidance (still unwritten)
- A closed explanation for one report of a generic in-game result **with EFM present**

0.24.3 stays downloadable. 0.25.0 changes how a face is measured - the defaults are different, so a 0.25.0 preset is not the same as a 0.24.3 preset for the same photo.

## Build from source

Ship tree: `FaceForge 0.25.0\`. Needs Node.js 20+ (pnpm via Corepack is fine) and the .NET 8 SDK.

```powershell
cd "FaceForge 0.25.0"
.\build.ps1
.\package.ps1
```

## Credits

Local face landmarks use MediaPipe Tasks Vision (Apache 2.0). WebView2, React, Vite, and TypeScript are third-party; see [`FaceForge 0.25.0/THIRD_PARTY_NOTICES.md`](FaceForge%200.25.0/THIRD_PARTY_NOTICES.md).

Skyrim, RaceMenu, and related names belong to their owners. This project is unofficial.

## License

[MIT](LICENSE)

## Notes in 0.25.0

- **The default fit changed.** "Dense landmarks" measures how the installed head actually responds to
  each slider and fits the photo's 468 landmarks to it. "Legacy ratios" keeps the 0.24.3 method.
- **Photo colours are written** as a skin-tone tint on Skyrim's own preset gradient plus the hair
  colour. Lightness is matched, hue is not; lip and iris colours are shown but not written.
- **Vision providers no longer dead-end.** If a Codex / Claude Code / Gemini CLI is installed but not
  found, Settings > Locate... points at its program once and the path is remembered. The resolved path
  is shown in the card.
- **BSA-packed morphs count.** `facegenmorphs` inside High Poly Head / RaceMenu / ECE archives is read,
  which corrects the earlier claim that EFM sliders are inert on High Poly Head.
- Run it directly, not through Mod Organizer 2 / USVFS: FaceForge detects that injection and explains
  it instead of failing with a WebView2 error.

EXE: 129,224,647 bytes. SHA-256: `2460607C8FB2DA734C5AB3B3DEF15A94C4AC9425C1B6CDA2C48CB3C340606A01`.
Zip: 122,343,877 bytes. SHA-256: `A0DE91937ADEADDD6A1964D7A577DBE15A14591EABEE2B5DCF16B8BE2F924E37`.
