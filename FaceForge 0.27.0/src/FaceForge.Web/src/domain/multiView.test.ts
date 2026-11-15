import { describe, expect, it } from "vitest";
import { viewSlotStatus } from "../components/SourcePanel";
import {
  createNeutralAnalysis,
  MEASUREMENT_KEYS,
  type FaceAnalysis,
  type FaceLandmark
} from "./faceAnalysis";
import {
  assessView,
  fuseFaceAnalyses,
  renderYawFor,
  scoreFaceQuality,
  selectVideoViews,
  signedYawOffset,
  type AnalyzedView,
  type FacePixels,
  type ImageQuality,
  type ViewRole
} from "./multiView";

const landmarks = (noseX = 0.5): FaceLandmark[] => {
  const values = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  values[1] = { x: noseX, y: 0.5 };
  values[234] = { x: 0.25, y: 0.5 };
  values[454] = { x: 0.75, y: 0.5 };
  return values;
};

const analysis = (vertical = 0.5, width = 0.9): FaceAnalysis => ({
  ...createNeutralAnalysis(),
  measurements: Object.fromEntries(MEASUREMENT_KEYS.map((key) => [
    key,
    {
      key,
      label: key,
      value: key === "cheekWidth" ? width : vertical,
      display: (key === "cheekWidth" ? width : vertical).toFixed(3)
    }
  ])) as FaceAnalysis["measurements"],
  symmetry: 90
});

const view = (
  role: ViewRole,
  value: FaceAnalysis,
  used = true,
  score = 0.8
): AnalyzedView => ({
  role,
  analysis: value,
  report: {
    role,
    detectedRole: role,
    yaw: role === "left" ? -30 : role === "right" ? 30 : 0,
    quality: {
      score,
      brightness: 0.5,
      contrast: 0.2,
      sharpness: 0.8,
      faceCoverage: 0.2,
      faceWidthPx: 400,
      warnings: []
    },
    score,
    used,
    warnings: []
  }
});

describe("multi-view analysis", () => {
  it("keeps width-sensitive measurements owned by the front view", () => {
    const result = fuseFaceAnalyses([
      view("front", analysis(0.5, 0.9)),
      view("left", analysis(0.54, 0.5)),
      view("right", analysis(0.54, 1.3))
    ]);
    expect(result.analysis.measurements.cheekWidth.value).toBe(0.9);
    expect(result.analysis.measurements.cheekHeight.value).toBeGreaterThan(0.5);
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it("rejects a contradictory angled measurement instead of distorting output", () => {
    const result = fuseFaceAnalyses([
      view("front", analysis(0.5)),
      view("left", analysis(0.8))
    ]);
    expect(result.analysis.measurements.cheekHeight.value).toBe(0.5);
  });

  it("measures signed yaw and selects useful video frames", () => {
    expect(signedYawOffset(landmarks(0.46), 1)).toBeLessThan(0);
    // Degrees, negative = turned to the subject's own left (the renderer's convention). A real
    // three-quarter view is 25-45 degrees; the old fraction-based window topped out near 15.
    const selected = selectVideoViews([
      { value: "left", yaw: -32, quality: 0.8 },
      { value: "front", yaw: 1, quality: 0.75 },
      { value: "right", yaw: 35, quality: 0.85 },
      { value: "profile", yaw: 80, quality: 1 }
    ]);
    expect(selected.front?.value).toBe("front");
    expect(selected.left?.value).toBe("left");
    expect(selected.right?.value).toBe("right");
  });
});

/**
 * A face-like crop: random overlapping shapes (features, hair strands, shadows) of many sizes over a
 * mid-tone, with fine grain. Non-periodic, so blur reads the way it does on a photo.
 */
const faceTexture = (size = 256, gain = 1): Float32Array => {
  const out = new Float32Array(size * size).fill(0.5);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let shape = 0; shape < 160; shape++) {
    const w = 3 + Math.floor(random() * 40);
    const h = 3 + Math.floor(random() * 40);
    const x0 = Math.floor(random() * (size - w));
    const y0 = Math.floor(random() * (size - h));
    const tone = 0.2 + random() * 0.6;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out[y * size + x] = tone;
  }
  for (let i = 0; i < out.length; i++)
    out[i] = Math.min(1, Math.max(0, (out[i] + (random() - 0.5) * 0.04) * gain));
  return out;
};

const boxBlur = (input: Float32Array, size: number, radius: number): Float32Array => {
  const pass = (source: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(source.length);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let sum = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
          sum += source[yy * size + xx];
          count++;
        }
        out[y * size + x] = sum / count;
      }
    return out;
  };
  return pass(pass(input, true), false);
};

const pixels = (gray: Float32Array, faceWidthPx = 420): FacePixels => ({
  gray,
  width: 256,
  height: 256,
  faceWidthPx,
  coverage: 0.2
});

describe("face image quality", () => {
  // Reported: a good, sharp photo was rated low and called blurred. The old score shrank the whole
  // frame to 128 px before looking for edges, so a sharp portrait, a blurred one and an upscaled
  // thumbnail all scored 0.64-0.65. Quality is now read from the face at the detector's scale.
  it("rates a sharp, well-exposed, well-resolved face highly with no warnings", () => {
    const quality = scoreFaceQuality(pixels(faceTexture()));
    expect(quality.score).toBeGreaterThanOrEqual(0.8);
    expect(quality.warnings).toEqual([]);
  });

  it("tells a blurred face from a sharp one", () => {
    const sharp = scoreFaceQuality(pixels(faceTexture()));
    const blurred = scoreFaceQuality(pixels(boxBlur(faceTexture(), 256, 4)));
    expect(blurred.score).toBeLessThan(sharp.score - 0.25);
    expect(blurred.warnings.join(" ")).toMatch(/blur|focus/i);
  });

  it("says when a face has too few pixels to measure well", () => {
    const small = scoreFaceQuality(pixels(faceTexture(), 70));
    expect(small.score).toBeLessThan(0.6);
    expect(small.warnings.join(" ")).toMatch(/70 px wide/);
  });

  it("flags a dark face", () => {
    const dark = scoreFaceQuality(pixels(faceTexture(256, 0.22)));
    expect(dark.warnings.join(" ")).toMatch(/dark/i);
    expect(dark.score).toBeLessThan(0.6);
  });
});

const turned = (yawDegrees: number): FaceAnalysis => {
  const base = createNeutralAnalysis();
  return {
    ...base,
    correction: { ...base.correction, pose: { ...base.correction.pose, yawDegrees } }
  };
};

const goodQuality: ImageQuality = {
  score: 0.9,
  brightness: 0.5,
  contrast: 0.2,
  sharpness: 0.8,
  faceCoverage: 0.2,
  faceWidthPx: 400,
  warnings: []
};

describe("angled views", () => {
  // Reported: left/right photos "don't even work". Side views were only accepted between about 2
  // and 15 degrees of turn, so a real three-quarter photo was always "too close to a full profile".
  it("uses an ordinary three-quarter photo", () => {
    for (const yaw of [-45, -35, -25, -15]) {
      const report = assessView("left", turned(yaw), landmarks(), goodQuality);
      expect(report.used, `left at ${yaw} degrees`).toBe(true);
      expect(report.detectedRole).toBe("left");
      expect(report.warnings.join(" ")).not.toMatch(/profile|opposite|other side/i);
    }
    expect(assessView("right", turned(32), landmarks(), goodQuality).used).toBe(true);
  });

  it("rejects a near-frontal angle and a full profile, and says which", () => {
    const frontal = assessView("left", turned(-5), landmarks(), goodQuality);
    expect(frontal.used).toBe(false);
    expect(frontal.warnings.join(" ")).toMatch(/frontal/i);
    const profile = assessView("left", turned(-75), landmarks(), goodQuality);
    expect(profile.used).toBe(false);
    expect(profile.warnings.join(" ")).toMatch(/full profile/i);
  });

  // A photo in the wrong slot used to be told it "was relabeled automatically" while nothing was
  // relabeled. It is now reported as the side it shows, and still used.
  it("uses a photo put in the wrong slot as the side it actually shows", () => {
    const report = assessView("left", turned(35), landmarks(), goodQuality);
    expect(report.used).toBe(true);
    expect(report.detectedRole).toBe("right");
    expect(report.warnings.join(" ")).toMatch(/right side/i);
  });

  // The front pose score came from the nose's offset between the face edges, which is noisy: a
  // photo 1.3 degrees off axis scored 0.11 for pose. It now comes from the head's measured turn.
  it("scores a straight front photo as straight", () => {
    const straight = assessView("front", turned(1.5), landmarks(0.44), goodQuality);
    expect(straight.score).toBeGreaterThanOrEqual(0.85);
    expect(straight.warnings).toEqual([]);
    const turnedFront = assessView("front", turned(24), landmarks(), goodQuality);
    expect(turnedFront.score).toBeLessThan(straight.score);
    expect(turnedFront.warnings.join(" ")).toMatch(/turned/i);
  });

  it("reports the turn in degrees", () => {
    expect(assessView("right", turned(30), landmarks(), goodQuality).yaw).toBe(30);
  });
});

describe("render angle for a reference photo", () => {
  // Added angles used to render at the unsigned nose offset times 140, so every one faced the same
  // way; guided sides were pinned at 30 degrees whatever the photo's real turn.
  it("renders each photo at its own measured turn, on its own side", () => {
    expect(renderYawFor({ id: "angle-1", analysis: turned(-38) })).toBe(-38);
    expect(renderYawFor({ id: "angle-2", analysis: turned(41) })).toBe(41);
    expect(renderYawFor({ id: "left", analysis: turned(-27) })).toBe(-27);
    expect(renderYawFor({ id: "front", analysis: turned(9) })).toBe(0);
  });

  it("falls back to the slot's usual angle when the turn could not be measured", () => {
    expect(renderYawFor({ id: "left", analysis: null })).toBe(-30);
    expect(renderYawFor({ id: "right", analysis: undefined })).toBe(30);
    expect(renderYawFor({ id: "angle-3", analysis: null })).toBe(0);
  });

  it("never renders past the side-view limit", () => {
    expect(renderYawFor({ id: "angle-4", analysis: turned(-85) })).toBe(-60);
  });
});

describe("view slot status", () => {
  it("says why an angle photo was ignored instead of only quoting its quality", () => {
    expect(viewSlotStatus(assessView("left", turned(-4), landmarks(), goodQuality))).toBe("Ignored · only 4° turned");
    expect(viewSlotStatus(assessView("left", turned(-75), landmarks(), goodQuality))).toBe("Ignored · 75°, too close to profile");
    expect(viewSlotStatus(assessView("right", turned(-33), landmarks(), goodQuality))).toBe("Used · left 33° · 90%");
  });
});
