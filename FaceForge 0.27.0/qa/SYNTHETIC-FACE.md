# synthetic-face-seed4243.png

A generated face, not a photograph of a real person. It is the input for the README screenshots and for
`qa/synthetic-face-proof.mjs`, so the public proof never depends on a photo of someone.

| | |
|--|--|
| Made | 2026-11-26, local text-to-image (SwarmUI / ComfyUI backend), no reference image |
| Checkpoint | Terra Unity (Anima 3.8B) |
| Sampler | euler, sgm_uniform, 28 steps, CFG 4.5, 1024x1024 |
| Seed | 4243 |
| Prompt | realistic photograph, passport style front portrait of an adult man, about 35 years old, short brown hair, wearing a plain dark grey t-shirt, neutral relaxed expression, looking straight at camera, soft even frontal studio lighting, plain light grey background, head and shoulders, sharp focus, natural skin texture |
| Negative | anime, cartoon, illustration, drawing, 3d render, shirtless, harsh shadows, tilted head, smile, glasses, hat, hair over face |

`qa/synthetic-neutral-portrait.png` stays the CI fixture for `browser-qa.mjs`; its provenance is not
recorded (STATE.md), so it is not used in public images.
