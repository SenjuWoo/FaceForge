import { describe, expect, it } from "vitest";
import { extractPhotoColors, robustColor, rgbToInt, rgbaToUint, type Landmark, type Rgb } from "./photoColors";

const W = 400, H = 400;
const SKIN: Rgb = { r: 210, g: 170, b: 150 }, LIPS: Rgb = { r: 180, g: 80, b: 90 };
const IRIS: Rgb = { r: 90, g: 140, b: 80 }, HAIR: Rgb = { r: 60, g: 40, b: 30 }, BG: Rgb = { r: 200, g: 200, b: 200 };

const paint = (data: Uint8ClampedArray, x: number, y: number, c: Rgb) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
};

/** A synthetic head: background, hair, a skin ellipse, lips with a white mouth interior, two irises. */
function syntheticFace(options: { hair?: boolean } = {}) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paint(data, x, y, BG);
  if (options.hair !== false) {
    for (let y = 40; y < 330; y++) for (let x = 80; x < 320; x++) paint(data, x, y, HAIR);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (((x - 200) / 80) ** 2 + ((y - 210) / 125) ** 2 <= 1) paint(data, x, y, SKIN);
      const d = Math.hypot(x - 200, y - 272);
      if (d <= 24) paint(data, x, y, LIPS);
      if (d <= 12) paint(data, x, y, { r: 250, g: 250, b: 250 });
      for (const cx of [160, 240]) {
        const e = Math.hypot(x - cx, y - 180);
        if (e <= 12) paint(data, x, y, IRIS);
        if (e <= 4) paint(data, x, y, { r: 10, g: 10, b: 10 });
      }
    }
  }
  const lm: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => { lm[i] = { x: x / W, y: y / H }; };
  set(234, 120, 200); set(454, 280, 200); set(10, 200, 100); set(152, 200, 320);
  [[50, 150, 220], [280, 250, 220], [205, 155, 245], [425, 245, 245], [151, 200, 120], [108, 165, 118], [337, 235, 118]]
    .forEach(([i, x, y]) => set(i, x, y));
  const ring = (indices: number[], r: number) =>
    indices.forEach((i, k) => set(i, 200 + r * Math.cos((2 * Math.PI * k) / indices.length), 272 + r * Math.sin((2 * Math.PI * k) / indices.length)));
  ring([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146], 22);
  ring([78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95], 10);
  [[468, 160], [473, 240]].forEach(([c, cx], n) => {
    set(c, cx, 180);
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy], k) => set(c + 1 + k, cx + dx * 12, 180 + dy * 12));
    void n;
  });
  return { image: { data, width: W, height: H }, landmarks: lm };
}

const near = (got: Rgb | undefined, want: Rgb, tol = 6) => {
  expect(got).toBeDefined();
  expect(Math.abs(got!.r - want.r)).toBeLessThanOrEqual(tol);
  expect(Math.abs(got!.g - want.g)).toBeLessThanOrEqual(tol);
  expect(Math.abs(got!.b - want.b)).toBeLessThanOrEqual(tol);
};

describe("photo colour extraction", () => {
  it("reads skin, lips, iris and hair from their regions", () => {
    const { image, landmarks } = syntheticFace();
    const colors = extractPhotoColors(image, landmarks);
    near(colors.skin?.color, SKIN);
    near(colors.lips?.color, LIPS);
    near(colors.iris?.color, IRIS);
    near(colors.hair?.color, HAIR);
    for (const e of [colors.skin, colors.lips, colors.iris, colors.hair]) expect(e!.confidence).toBeGreaterThan(0.3);
  });

  it("excludes the white mouth interior from the lip colour", () => {
    const { image, landmarks } = syntheticFace();
    const lips = extractPhotoColors(image, landmarks).lips!.color;
    expect(lips.g).toBeLessThan(120);
  });

  it("gives no hair colour when the surround is just the background", () => {
    const { image, landmarks } = syntheticFace({ hair: false });
    expect(extractPhotoColors(image, landmarks).hair).toBeNull();
  });

  it("refuses to guess without a full landmark set", () => {
    const { image, landmarks } = syntheticFace();
    const colors = extractPhotoColors(image, landmarks.slice(0, 100));
    expect(colors).toEqual({ skin: null, lips: null, iris: null, hair: null });
  });

  it("still reads skin when there are no iris landmarks (468-point model)", () => {
    const { image, landmarks } = syntheticFace();
    const colors = extractPhotoColors(image, landmarks.slice(0, 468));
    near(colors.skin?.color, SKIN);
    expect(colors.iris).toBeNull();
  });

  it("robust colour ignores a specular highlight and a deep shadow", () => {
    const pixels: [number, number, number][] = [];
    for (let i = 0; i < 80; i++) pixels.push([200, 160, 140]);
    for (let i = 0; i < 10; i++) pixels.push([255, 255, 255]);
    for (let i = 0; i < 10; i++) pixels.push([20, 10, 10]);
    expect(robustColor(pixels)).toEqual({ r: 200, g: 160, b: 140 });
    expect(robustColor([])).toBeNull();
  });

  it("packs colours the way RaceMenu stores them", () => {
    expect(rgbToInt({ r: 39, g: 38, b: 35 })).toBe(2565667); // Priscilla preset hairColor
    expect(rgbaToUint({ r: 47, g: 32, b: 19 }, 188)).toBe(3157205011); // Priscilla preset skin tint
    expect(rgbaToUint({ r: 255, g: 255, b: 255 }, 255)).toBe(4294967295); // stays unsigned
  });
});

import { classifyIris, skinToneTint } from "./photoColors";

const lumOf = (c: Rgb) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe("skin tone tint", () => {
  it("puts very pale skin on the lightest Skyrim preset and very dark skin on the darkest", () => {
    expect(skinToneTint({ r: 245, g: 235, b: 225 })).toEqual({ r: 221, g: 221, b: 221 });
    expect(skinToneTint({ r: 50, g: 35, b: 30 })).toEqual({ r: 45, g: 33, b: 30 });
  });

  it("is never lighter for a darker photo", () => {
    let previous = Infinity;
    for (let value = 250; value >= 40; value -= 10) {
      const tint = skinToneTint({ r: value, g: value * 0.8, b: value * 0.7 });
      expect(lumOf(tint)).toBeLessThanOrEqual(previous + 1e-9);
      previous = lumOf(tint);
    }
  });

  it("stays inside the gradient and returns whole 0-255 channels", () => {
    for (const photo of [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, { r: 170, g: 135, b: 115 }]) {
      const tint = skinToneTint(photo);
      for (const channel of [tint.r, tint.g, tint.b]) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(221);
      }
    }
  });
});

describe("iris colour word", () => {
  it("names the common iris colours", () => {
    expect(classifyIris({ r: 60, g: 40, b: 30 })).toBe("brown");
    expect(classifyIris({ r: 100, g: 67, b: 31 })).toBe("brown");
    expect(classifyIris({ r: 110, g: 140, b: 170 })).toBe("blue");
    expect(classifyIris({ r: 90, g: 130, b: 80 })).toBe("green");
    expect(classifyIris({ r: 130, g: 130, b: 135 })).toBe("grey");
    expect(classifyIris({ r: 190, g: 130, b: 40 })).toBe("amber");
    expect(classifyIris({ r: 120, g: 105, b: 70 })).toBe("hazel");
  });
});
