/**
 * Appearance colours read from a photo: skin, lips, iris and hair.
 *
 * Shape is only part of a likeness; a head with the right proportions but default skin, hair and eyes
 * does not read as the person. Each colour is a robust median over pixels at regions defined by the 478
 * MediaPipe landmarks, so it is a pure function of an image buffer and landmarks (no canvas needed to
 * test it). Every value is an ESTIMATE from one photograph: lighting, white balance, makeup and filters
 * all move it, which is why each result carries a confidence rather than being presented as fact.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ImageDataLike {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** Normalised landmark, as MediaPipe returns it (x, y in 0..1 of the image). */
export interface Landmark {
  x: number;
  y: number;
}

export interface ColorEstimate {
  color: Rgb;
  /** 0..1: how much usable evidence backed the estimate. Not a probability. */
  confidence: number;
}

export interface PhotoColors {
  skin: ColorEstimate | null;
  lips: ColorEstimate | null;
  /** Mean of the two irises that could be read. */
  iris: ColorEstimate | null;
  hair: ColorEstimate | null;
}

// MediaPipe face-mesh indices.
const FACE_LEFT = 234, FACE_RIGHT = 454, FACE_TOP = 10, CHIN = 152;
const SKIN_PATCHES = [50, 280, 205, 425, 151, 108, 337]; // cheeks, lower cheeks, forehead
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const IRISES: readonly (readonly number[])[] = [
  [468, 469, 470, 471, 472],
  [473, 474, 475, 476, 477]
];

type Pixel = readonly [number, number, number];

const luminance = (p: Pixel) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Per-channel median of the pixels between two luminance quantiles (drops shadow and specular). */
export function robustColor(pixels: readonly Pixel[], lo = 0.2, hi = 0.9): Rgb | null {
  if (pixels.length === 0) return null;
  const sorted = [...pixels].sort((a, b) => luminance(a) - luminance(b));
  const from = Math.floor(sorted.length * lo);
  const to = Math.max(from + 1, Math.ceil(sorted.length * hi));
  const kept = sorted.slice(from, to);
  const med = (channel: 0 | 1 | 2) => {
    const values = kept.map((p) => p[channel]).sort((a, b) => a - b);
    const mid = values.length >> 1;
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  };
  return { r: Math.round(med(0)), g: Math.round(med(1)), b: Math.round(med(2)) };
}

const pixelAt = (image: ImageDataLike, x: number, y: number): Pixel | null => {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return null;
  const i = (iy * image.width + ix) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2]];
};

function samplePatch(image: ImageDataLike, cx: number, cy: number, radius: number): Pixel[] {
  const out: Pixel[] = [];
  const r = Math.max(1, Math.round(radius));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const p = pixelAt(image, cx + dx, cy + dy);
      if (p) out.push(p);
    }
  }
  return out;
}

function inPolygon(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) / 255;
}

function borderColor(image: ImageDataLike): Rgb {
  const strip = Math.max(1, Math.round(Math.min(image.width, image.height) * 0.02));
  const pixels: Pixel[] = [];
  for (let k = 0; k < strip; k++) {
    for (let x = 0; x < image.width; x += 4) {
      const top = pixelAt(image, x, k), bottom = pixelAt(image, x, image.height - 1 - k);
      if (top) pixels.push(top);
      if (bottom) pixels.push(bottom);
    }
    for (let y = 0; y < image.height; y += 4) {
      const left = pixelAt(image, k, y), right = pixelAt(image, image.width - 1 - k, y);
      if (left) pixels.push(left);
      if (right) pixels.push(right);
    }
  }
  return robustColor(pixels, 0, 1) ?? { r: 0, g: 0, b: 0 };
}

export function extractPhotoColors(image: ImageDataLike, landmarks: readonly Landmark[]): PhotoColors {
  const empty: PhotoColors = { skin: null, lips: null, iris: null, hair: null };
  if (landmarks.length < 468 || image.width <= 0 || image.height <= 0) return empty;
  const px = (i: number): [number, number] => [landmarks[i].x * image.width, landmarks[i].y * image.height];
  const [lx, ly] = px(FACE_LEFT), [rx, ry] = px(FACE_RIGHT), [tx, ty] = px(FACE_TOP), [cx, cy] = px(CHIN);
  const faceWidth = Math.hypot(rx - lx, ry - ly);
  const faceHeight = Math.hypot(cx - tx, cy - ty);
  if (!(faceWidth > 8 && faceHeight > 8)) return empty;

  // Skin: cheeks and forehead, shadow and highlight trimmed off.
  const skinPixels: Pixel[] = [];
  for (const index of SKIN_PATCHES) {
    const [x, y] = px(index);
    skinPixels.push(...samplePatch(image, x, y, faceWidth * 0.035));
  }
  const skinColor = robustColor(skinPixels, 0.2, 0.85);
  const skin = skinColor && { color: skinColor, confidence: clamp01(skinPixels.length / 400) };

  // Lips: inside the outer ring, outside the inner ring (so teeth and mouth interior are excluded).
  const outer = LIPS_OUTER.map(px), inner = LIPS_INNER.map(px);
  const xs = outer.map((p) => p[0]), ys = outer.map((p) => p[1]);
  const lipPixels: Pixel[] = [];
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (!inPolygon(x, y, outer) || inPolygon(x, y, inner)) continue;
      const p = pixelAt(image, x, y);
      if (p) lipPixels.push(p);
    }
  }
  const lipColor = robustColor(lipPixels, 0.1, 0.9);
  const lips = lipColor && { color: lipColor, confidence: clamp01(lipPixels.length / 150) };

  // Iris: an annulus around each iris centre (the dark pupil and eyelid shadow fall below the trim).
  const irisColors: Rgb[] = [];
  let irisEvidence = 0;
  if (landmarks.length >= 478) {
    for (const [centre, ...ring] of IRISES) {
      const [ix, iy] = px(centre);
      const radius = ring.reduce((s, i) => s + Math.hypot(px(i)[0] - ix, px(i)[1] - iy), 0) / ring.length;
      if (!(radius >= 2)) continue;
      const pixels: Pixel[] = [];
      for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
        for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
          const d = Math.hypot(dx, dy);
          // Lower part of the annulus only: the upper iris sits under the lid and its shadow.
          if (d < radius * 0.45 || d > radius * 0.9 || dy < -radius * 0.2) continue;
          const p = pixelAt(image, ix + dx, iy + dy);
          if (p) pixels.push(p);
        }
      }
      // The iris is the most saturated thing in the annulus (sclera and lid skin are not): keep that half.
      pixels.sort((a, b) => Math.max(...b) - Math.min(...b) - (Math.max(...a) - Math.min(...a)));
      pixels.length = Math.ceil(pixels.length / 2);
      const color = robustColor(pixels, 0.1, 0.9);
      if (color) {
        irisColors.push(color);
        irisEvidence += pixels.length;
      }
    }
  }
  const iris = irisColors.length
    ? {
        color: {
          r: Math.round(irisColors.reduce((s, c) => s + c.r, 0) / irisColors.length),
          g: Math.round(irisColors.reduce((s, c) => s + c.g, 0) / irisColors.length),
          b: Math.round(irisColors.reduce((s, c) => s + c.b, 0) / irisColors.length)
        },
        confidence: clamp01(irisEvidence / 120)
      }
    : null;

  // Hair: patches above the forehead and beside the face, keeping only those that are neither
  // background nor skin. A bald head, a hat or a plain backdrop of the same colour yields no estimate.
  const lateral: [number, number] = [(rx - lx) / faceWidth, (ry - ly) / faceWidth];
  const up: [number, number] = [(tx - cx) / faceHeight, (ty - cy) / faceHeight];
  const candidates: [number, number][] = [];
  for (const k of [0.08, 0.16]) {
    for (const s of [-0.25, -0.12, 0.12, 0.25]) {
      candidates.push([tx + up[0] * k * faceHeight + lateral[0] * s * faceWidth, ty + up[1] * k * faceHeight + lateral[1] * s * faceWidth]);
    }
  }
  for (const dy of [-0.1, 0, 0.1]) {
    candidates.push([lx - lateral[0] * 0.1 * faceWidth - up[0] * dy * faceHeight, ly - lateral[1] * 0.1 * faceWidth - up[1] * dy * faceHeight]);
    candidates.push([rx + lateral[0] * 0.1 * faceWidth - up[0] * dy * faceHeight, ry + lateral[1] * 0.1 * faceWidth - up[1] * dy * faceHeight]);
  }
  const background = borderColor(image);
  const kept: Pixel[] = [];
  let keptPatches = 0;
  for (const [x, y] of candidates) {
    const patch = samplePatch(image, x, y, faceWidth * 0.025);
    const colour = robustColor(patch, 0.1, 0.9);
    if (!colour || patch.length < 12) continue;
    if (colorDistance(colour, background) < 0.1) continue;
    if (skinColor && colorDistance(colour, skinColor) < 0.06) continue;
    kept.push(...patch);
    keptPatches++;
  }
  const hairColor = robustColor(kept, 0.1, 0.9);
  const hair = hairColor && { color: hairColor, confidence: clamp01(keptPatches / candidates.length) };

  return { skin, lips, iris, hair };
}

/** 0x00RRGGBB, the integer RaceMenu stores for hair colour and the colour part of a tint. */
export const rgbToInt = (c: Rgb): number => ((c.r & 255) << 16) | ((c.g & 255) << 8) | (c.b & 255);

/** 0xAARRGGBB as an unsigned integer, the way a RaceMenu `tintInfo` colour is stored (alpha = intensity). */
export const rgbaToUint = (c: Rgb, alpha: number): number =>
  (((alpha & 255) << 24) | rgbToInt(c)) >>> 0;

/**
 * Skyrim's own skin-tone tint presets, lightest to darkest: Skyrim.esm colour records
 * HumanFemaleSkinWhite01..10 then HumanSkinDarkSkin05..10 (read from the load order, 2026-10-30). A skin
 * tint MULTIPLIES the head skin texture, so these are the values RaceMenu itself offers; staying on this
 * gradient keeps the result inside what the game was built for.
 */
const SKIN_TONE_GRADIENT: readonly Rgb[] = [
  [221, 221, 221], [206, 205, 204], [185, 179, 170], [172, 159, 151], [155, 139, 132],
  [145, 119, 111], [143, 114, 101], [130, 106, 98], [125, 99, 85], [115, 97, 79],
  [81, 61, 53], [71, 51, 39], [67, 44, 33], [53, 39, 34], [48, 33, 22], [45, 33, 30]
].map(([r, g, b]) => ({ r, g, b }));

const lum = (c: Rgb) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Photographed lightness range mapped onto the gradient: very pale skin ~235, very dark skin ~70. */
const PHOTO_LIGHT = 235, PHOTO_DARK = 70;

/**
 * The skin-tone tint for a photographed skin colour: the point on Skyrim's skin-tone gradient with the
 * matching lightness. Lightness only; hue is not matched (the gradient carries its own warmth), and
 * exposure shifts the result, so it is a starting tone to adjust in RaceMenu.
 * [U] The photo-lightness to preset mapping is a calibration choice, not measured in game.
 */
export function skinToneTint(photo: Rgb): Rgb {
  const first = lum(SKIN_TONE_GRADIENT[0]);
  const last = lum(SKIN_TONE_GRADIENT[SKIN_TONE_GRADIENT.length - 1]);
  const t = clamp01((lum(photo) - PHOTO_DARK) / (PHOTO_LIGHT - PHOTO_DARK));
  const target = last + t * (first - last);
  for (let i = 0; i < SKIN_TONE_GRADIENT.length - 1; i++) {
    const hi = lum(SKIN_TONE_GRADIENT[i]), lo = lum(SKIN_TONE_GRADIENT[i + 1]);
    if (target <= hi && target >= lo) {
      const f = hi === lo ? 0 : (hi - target) / (hi - lo);
      const a = SKIN_TONE_GRADIENT[i], b = SKIN_TONE_GRADIENT[i + 1];
      return {
        r: Math.round(a.r + f * (b.r - a.r)),
        g: Math.round(a.g + f * (b.g - a.g)),
        b: Math.round(a.b + f * (b.b - a.b))
      };
    }
  }
  return SKIN_TONE_GRADIENT[target > first ? 0 : SKIN_TONE_GRADIENT.length - 1];
}

/** The Skyrim skin-tone mask, always the first tint layer of a playable race in the vanilla list. */
export const SKIN_TONE_TEXTURE = "Actors\\Character\\Character Assets\\TintMasks\\SkinTone.dds";

export type IrisClass = "brown" | "hazel" | "amber" | "green" | "blue" | "grey";

/**
 * A colour word for an iris colour, used only to rank installed eye parts whose names carry colour words.
 * Hue/saturation/value rules; dark, low-saturation irises (most brown eyes at photo size) fall to "brown".
 * Light eyes in a small or low-resolution photo are unreliable, which is why callers gate on confidence.
 */
export function classifyIris(c: Rgb): IrisClass {
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
  const v = max / 255, s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === c.r) h = ((c.g - c.b) / d) % 6;
    else if (max === c.g) h = (c.b - c.r) / d + 2;
    else h = (c.r - c.g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (v < 0.3) return "brown";
  if (s < 0.12) return "grey";
  if (h >= 165 && h <= 270) return s >= 0.15 ? "blue" : "grey";
  if (h >= 70 && h < 165) return "green";
  if (h >= 28 && h < 70) return v >= 0.45 && s >= 0.5 ? "amber" : s >= 0.3 && v >= 0.4 ? "hazel" : "brown";
  return "brown";
}
