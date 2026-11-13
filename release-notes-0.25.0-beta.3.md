**Beta 3.** Second audit pass over the code beta 2 did not cover. Same features, still a pre-release:
no preset from this build has been loaded in Skyrim yet.

## Fixed

- **One failed model load no longer ends the session.** A transient failure while loading the face
  landmark model (a file still being extracted, a locked file) was remembered, so every later photo
  failed the same way until FaceForge was restarted. The next attempt starts clean.
- **Measured slider responses follow the install.** They were kept after re-indexing a different MO2
  profile or a changed mod set in the same session. A new index now forgets them.
- **The fit says when a slider could not be measured.** If the detector lost the face in a slider's
  test render, that slider used to stay at zero with no sign of it. The fit notice now lists them.
- **Dependency updates can't blank the window.** React and its DOM package are updated in one pull
  request instead of two.

## Checked and found sound

The head renderer and sculpt conversion, morph registry, MO2 reader, texture decoder, dense fit and
photo-colour code were read in full. Degenerate landmarks (all points equal, noise, a missing point,
sub-pixel spread) produce either a clear error or finite slider values, never an invalid number in an
exported preset.

## Known and left

- On a direct or Vortex install, a plugin that is deployed but disabled in the load order is still
  treated as installed. Every plugin on the test install is active, so this could not be shown to
  matter; the MO2 path does use the profile's active list.
- A loose-file override of a High Poly Head archive morph is ignored by the preview.

## Files

`FaceForge-0.25.0-STANDALONE.exe` - 129,232,434 bytes, SHA-256 `1CD32494B51CB1277D2FBF6F46D0AFE289B28280C1CAD9EFD2D3129EF2E63375`
`FaceForge-0.25.0-STANDALONE.zip` - 122,356,054 bytes, SHA-256 `972989A62012B1F75931E45B42791C86837F31EE4F2F666DDE693B078EECFC27`

Requires Windows 10/11 with WebView2, Skyrim SE/AE, RaceMenu, and Expressive Facegen Morphs.

Changelog: https://github.com/SenjuWoo/FaceForge/blob/main/CHANGELOG.txt
