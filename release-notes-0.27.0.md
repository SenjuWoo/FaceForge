**FaceForge 0.27.0.** Left and right angle photos work, and the image quality score reflects the
photo. Everything below was verified out of game; no preset from this build has been loaded in
RaceMenu yet.

## Fixed

- **Angle photos are used.** A side view used to pass only at about 2-15 degrees of turn, so every
  real three-quarter photo was ignored. Views are now judged by the head's measured turn: 25-45° is
  ideal, 12-60° is accepted.
- **Left and right are read correctly.** The side was read backwards, so correctly placed photos were
  told they showed the opposite side. A photo in the wrong slot is now simply used as the side it shows.
- **The quality score sees blur and resolution.** It is read from the face at the landmark model's
  own scale. Good photos now score 90-100% instead of being called blurred; a blurred photo is named.
- **The front photo's turn** is measured properly, so a straight photo no longer reads as turned or
  unreliable.
- **Angle renders match the photo.** The Match pane and vision refinement render each angle at the
  photo's own turn and side.
- **The view slots say why** a photo was ignored ("only 4° turned") and how it was used.
- **Less disk use.** Old unpacked copies of the interface from earlier builds are removed on start
  (one test profile went from 510 MB to 35 MB).
- A clear message when the WebView2 runtime is missing.

## Removed

- The automatic nose-depth pass that used angle photos: tested against a head with a known nose, it
  could not recover it and moved the nose by noise. The manual "Nose forward" control stays.

## Verified in this build

- 162 frontend tests, 147 native assertions, 0 build warnings
- Browser QA (including Guided multi-view) and layout QA at four sizes
- The download ZIP extracted and its EXE driven against a real install: analysis, dense fit, Guided
  multi-view with angled images used on the correct sides, network and navigation refused

Not verified: anything the game renders, and a live vision request to a model.

## Files

`FaceForge-0.27.0-STANDALONE.exe` - 125,445,990 bytes, SHA-256 `38967EDE43524C88683F70C8559A92AFDB8F049680B59C3A0F2FC495514E51C1`
`FaceForge-0.27.0-STANDALONE.zip` - 118,566,624 bytes, SHA-256 `8172DC6000F2A3556011AC3F8854A0D191C5B6CA7A4A220A2DD3D9870F35DDA3`

Requires Windows 10/11 with WebView2, Skyrim SE/AE and RaceMenu. Expressive Facegen Morphs is needed for
the EFM sliders to do anything.

Changelog: https://github.com/SenjuWoo/FaceForge/blob/main/CHANGELOG.txt
