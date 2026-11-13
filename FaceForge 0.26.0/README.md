# FaceForge 0.26.0 — Windows tool (not a Skyrim mod)

**This is a Windows application.** It is **not** a Skyrim plugin, not an SKSE DLL, and
**must not** be installed into Skyrim `Data`, Vortex, or Mod Organizer 2 as a game mod.

FaceForge turns a photograph into an **editable RaceMenu starting preset**. You finish
the face in RaceMenu in-game. For a full NPC follower afterward, use **FollowerForge**.

---

## What to download / what you get

| File | What it is |
|------|------------|
| `FaceForge-0.26.0-STANDALONE.exe` | The whole tool (double-click to run) |
| This `README.md` | How to use it |

No .NET install. Needs **Windows 10/11** with **Microsoft Edge WebView2** (usually already installed).

---

## How to install the TOOL (not the game)

1. Unzip this download **anywhere on your PC** (Desktop, Documents, Tools folder, etc.).
2. Double-click **`FaceForge-0.26.0-STANDALONE.exe`**.
3. **Do not** drop the EXE into `Skyrim Special Edition\Data`.
4. **Do not** add this zip as a Vortex/MO2 mod for Skyrim.

FaceForge only **reads** your game/Vortex/CharGen folders. It does not change your load order.

Running the EXE **under Mod Organizer 2 / USVFS is not supported**. FaceForge detects that
injection and explains it instead of failing on startup. Run it directly; it reads the same mods.

---

## How to use it (short)

1. Run the EXE. Let it find Skyrim and index your setup (read-only).
2. Add a clear front photo. A slight turn is handled; a heavy turn or an open mouth is not.
3. Analyze → pick race/sex → pick installed head parts (hair, eyes, etc.).
4. Export a **RaceMenu preset pack**.
5. In Skyrim: open RaceMenu → load the preset → sculpt if you want → use **Export Head**
   (not "slider-only / no sculpt") if you will build a follower next.
6. Optional: open **FollowerForge** and build the NPC plugin from that baked head.

Optional AI vision is the only step that sends anything off the PC, and only when you configure an
account and press the button. The window itself is not allowed to open network connections: the
bundled landmark library contains a usage logger, and FaceForge blocks it. If a ChatGPT/Claude/Gemini
CLI is installed but not detected, Settings → **Locate…** points FaceForge at its program once; the
path is remembered.

---

## What it leaves on your PC, and removing it

FaceForge has no installer. To remove it, delete the EXE, then delete this folder if you want every
trace gone:

- `%LOCALAPPDATA%\FaceForge` — the unpacked interface, WebView2 browser data, and the provider paths
  you set with Locate…

It writes nothing to the game folder, the mod manager or the registry. Exported packs go only where
you save them.

---

## Requirements

**Hard**
- Skyrim Special Edition or Anniversary Edition
- RaceMenu (to load/export the preset in-game)
- Windows 10/11 + WebView2

**Optional**
- High Poly Head and any head-part mods you already use
- Expressive Facegen Morphs — without it RaceMenu ignores the `EFM_` values and every preset
  loads as the race default
- [FollowerForge](https://github.com/SenjuWoo/FollowerForge) — builds the follower NPC after Export Head

---

## What this is / is not

| It is | It is not |
|-------|-----------|
| An out-of-game Windows utility | A downloadable follower character |
| A photo → RaceMenu preset helper | Something you enable in your load order |
| Safe to keep outside the game folder | A replacement for RaceMenu or Creation Kit |

---

## Known limitations in 0.26.0

- The preset has not been checked in RaceMenu for this build. Treat your first one as a test.
- Skin tone is matched by lightness only; strong lighting or makeup in the photo is not reproduced.
- Lip and iris colours are shown but not written; eye parts are ranked by name, not texture colour.
- One photo, single view: depth is guessed, so a turned or open-mouth photo is weaker.
- The sculpt output is four parametric moves, not a per-vertex fitted displacement.

---

## Pair tool

**FaceForge** (face preset) → RaceMenu bake → **FollowerForge** (NPC plugin).

GitHub: https://github.com/SenjuWoo/FaceForge

0.26.0 is a full release, but no preset from it has been loaded in Skyrim yet, so the in-game look is unproven. The changelog is in the repository's `CHANGELOG.txt`.
