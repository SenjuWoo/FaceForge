import type {
  FaceAnalysis,
  FaceLandmark,
  MeasurementKey
} from "./faceAnalysis";
import { estimatePose } from "./sourceCorrection";

export type ViewRole = "front" | "left" | "right";

export interface ImageQuality {
  /** 0-1 overall, from the face region only. */
  score: number;
  /** Mean luminance of the central face, 0-1. */
  brightness: number;
  /** Luminance spread over the face crop, 0-1. */
  contrast: number;
  /** 0 = blurred, 1 = sharp, read at the detector's working scale. */
  sharpness: number;
  /** Face bounding box as a share of the frame area. */
  faceCoverage: number;
  /** Face width in source pixels: how much detail the detector actually has to work with. */
  faceWidthPx: number;
  warnings: string[];
}

export interface ViewReport {
  /** The slot the photo was put in. */
  role: ViewRole;
  /** The side the photo actually shows, from its measured turn. */
  detectedRole: ViewRole;
  /** Head turn in degrees; negative = turned to the subject's own left (the renderer's convention). */
  yaw: number;
  quality: ImageQuality;
  score: number;
  used: boolean;
  warnings: string[];
}

export interface AnalyzedView {
  role: ViewRole;
  analysis: FaceAnalysis;
  report: ViewReport;
}

export interface MultiViewResult {
  analysis: FaceAnalysis;
  confidence: number;
  reports: ViewReport[];
}

export interface VideoCandidate<T> {
  value: T;
  /** Head turn in degrees, same convention as ViewReport.yaw. */
  yaw: number;
  quality: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function signedYawOffset(
  landmarks: readonly FaceLandmark[],
  sourceAspectRatio: number
): number {
  const nose = landmarks[1];
  const left = landmarks[234];
  const right = landmarks[454];
  if (!nose || !left || !right) return 0;
  const width = Math.abs(right.x - left.x) * sourceAspectRatio;
  return width > 0
    ? ((nose.x - (left.x + right.x) / 2) * sourceAspectRatio) / width
    : 0;
}

/**
 * The pixels quality is judged on: a grey-scale crop of the face (with a small margin) at the scale
 * the landmark model works at, plus how large the face is in the original photo.
 */
export interface FacePixels {
  gray: Float32Array;
  width: number;
  height: number;
  faceWidthPx: number;
  coverage: number;
}

/**
 * The detector reads a face at about 256 px across, so that is the scale sharpness is judged at: a
 * large photo is shrunk to it (fine detail beyond it cannot help), a small one is never enlarged (an
 * enlarged face would hide its own blur).
 */
const WORKING_FACE_WIDTH = 256;

const ramp = (value: number, low: number, high: number) => clamp01((value - low) / (high - low));

/**
 * Blur estimate from re-blurring (Crete-Roffet et al., "The Blur Effect", 2007): a sharp image loses
 * much of its local variation when blurred again, an already-blurred one hardly changes. Returns 0 for
 * sharp, 1 for fully blurred. It compares the image with itself, so it does not depend on exposure,
 * contrast or how busy the background is -- the faults of the edge-count measure it replaces.
 */
export function blurEffect(gray: Float32Array, width: number, height: number): number {
  const radius = 4;
  let worst = 0;
  for (const horizontal of [true, false]) {
    const lines = horizontal ? height : width;
    const length = horizontal ? width : height;
    if (length < 3) continue;
    let sumOriginal = 0;
    let sumLost = 0;
    const line = new Float32Array(length);
    const blurred = new Float32Array(length);
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < length; i++) line[i] = horizontal ? gray[l * width + i] : gray[i * width + l];
      for (let i = 0; i < length; i++) {
        let sum = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const j = i + k;
          if (j < 0 || j >= length) continue;
          sum += line[j];
          count++;
        }
        blurred[i] = sum / count;
      }
      for (let i = 1; i < length; i++) {
        const original = Math.abs(line[i] - line[i - 1]);
        const reblurred = Math.abs(blurred[i] - blurred[i - 1]);
        sumOriginal += original;
        sumLost += Math.max(0, original - reblurred);
      }
    }
    const blur = sumOriginal > 0 ? (sumOriginal - sumLost) / sumOriginal : 1;
    worst = Math.max(worst, blur);
  }
  return worst;
}

/**
 * Re-blur scores at or below SHARP_BLUR read as fully sharp; at or above BLURRED_BLUR as blurred.
 * Calibrated on real portraits read at the detector's scale: sharp phone and camera photos score
 * 0.40-0.55 (skin is smooth, so even a sharp face loses little when re-blurred), a 4x upscale of a
 * 314 px photo 0.58, and a 4 px Gaussian blur 0.74. Renders of the head score about 0.27.
 */
const SHARP_BLUR = 0.5;
const BLURRED_BLUR = 0.72;

/**
 * Scores a face crop. Each part maps to 0-1 and they are combined as a weighted geometric mean, so
 * one real fault (a blurred, tiny or black face) pulls the score down instead of being averaged away
 * by the parts that are fine.
 */
export function scoreFaceQuality(pixels: FacePixels): ImageQuality {
  const { gray, width, height, faceWidthPx, coverage } = pixels;
  let sum = 0;
  let count = 0;
  let clipped = 0;
  // Exposure is read from the middle of the face (cheeks, nose, forehead), not the hair or the
  // background that the bounding box also catches.
  for (let y = Math.floor(height * 0.25); y < Math.ceil(height * 0.75); y++)
    for (let x = Math.floor(width * 0.25); x < Math.ceil(width * 0.75); x++) {
      const value = gray[y * width + x];
      sum += value;
      count++;
      if (value >= 0.98 || value <= 0.02) clipped++;
    }
  const brightness = count > 0 ? sum / count : 0;
  const clippedShare = count > 0 ? clipped / count : 1;
  let total = 0;
  for (let i = 0; i < gray.length; i++) total += gray[i];
  const mean = gray.length > 0 ? total / gray.length : 0;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += (gray[i] - mean) ** 2;
  const contrast = gray.length > 0 ? Math.sqrt(variance / gray.length) : 0;
  const sharpness = 1 - blurEffect(gray, width, height);

  const sharpPart = Math.max(0.05, ramp(1 - sharpness, BLURRED_BLUR, SHARP_BLUR));
  const resolutionPart = Math.max(0.1, ramp(faceWidthPx, 60, 200));
  const exposurePart = Math.max(
    0.05,
    ramp(brightness, 0.08, 0.3) * (1 - ramp(brightness, 0.8, 0.96)) * (1 - 0.8 * ramp(clippedShare, 0.05, 0.4))
  );
  const contrastPart = Math.max(0.1, ramp(contrast, 0.02, 0.09));
  const score = clamp01(
    sharpPart ** 0.35 * resolutionPart ** 0.25 * exposurePart ** 0.25 * contrastPart ** 0.15
  );

  const warnings: string[] = [];
  if (brightness < 0.2) warnings.push("The face is too dark.");
  if (brightness > 0.82 || clippedShare > 0.25) warnings.push("The face is overexposed.");
  if (contrast < 0.035) warnings.push("The face has very low contrast.");
  if (sharpPart < 0.5) warnings.push("The face looks blurred or out of focus.");
  if (faceWidthPx < 140)
    warnings.push(
      `The face is only ${Math.round(faceWidthPx)} px wide; a closer or higher-resolution photo measures better.`
    );
  return { score, brightness, contrast, sharpness, faceCoverage: coverage, faceWidthPx, warnings };
}

/**
 * Reads the face region of `image` and scores it. `landmarks` must be normalized to this image --
 * the straightened or reframed copy a second detection pass ran on has a different frame.
 */
export function measureImageQuality(
  image: CanvasImageSource,
  width: number,
  height: number,
  landmarks: readonly FaceLandmark[]
): ImageQuality {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of landmarks.slice(0, 468)) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const unavailable = (warning: string): ImageQuality => ({
    score: 0.5,
    brightness: 0.5,
    contrast: 0.1,
    sharpness: 0.5,
    faceCoverage: 0,
    faceWidthPx: 0,
    warnings: [warning]
  });
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY || width <= 0 || height <= 0)
    return unavailable("Image quality could not be read: no face outline.");
  const faceWidthPx = (maxX - minX) * width;
  const coverage = (maxX - minX) * (maxY - minY);
  const marginX = (maxX - minX) * 0.08;
  const marginY = (maxY - minY) * 0.08;
  const sx = Math.max(0, (minX - marginX) * width);
  const sy = Math.max(0, (minY - marginY) * height);
  const sw = Math.min(width, (maxX + marginX) * width) - sx;
  const sh = Math.min(height, (maxY + marginY) * height) - sy;
  const scale = Math.min(1, WORKING_FACE_WIDTH / faceWidthPx);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.round(sw * scale));
  canvas.height = Math.max(8, Math.round(sh * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return unavailable("Image quality sampling was unavailable.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = (data[o] * 0.2126 + data[o + 1] * 0.7152 + data[o + 2] * 0.0722) / 255;
  }
  return scoreFaceQuality({ gray, width: canvas.width, height: canvas.height, faceWidthPx, coverage });
}

/**
 * Turn limits, in degrees from the head's own measured pose. Below SIDE_MIN an angle adds nothing a
 * front photo lacks; past SIDE_MAX the detector is guessing the far half of the face. A three-quarter
 * view (25-45 degrees) is the useful band. The previous limits were written against a nose-offset
 * fraction that reaches its cut-off at about 15 degrees, which rejected every real angle photo.
 */
const SIDE_MIN = 12;
const SIDE_MAX = 60;
const FRONT_TOLERANCE = 12;

export function assessView(
  role: ViewRole,
  analysis: FaceAnalysis,
  _landmarks: readonly FaceLandmark[],
  quality: ImageQuality
): ViewReport {
  const yaw = analysis.correction?.pose?.yawDegrees ?? 0;
  const magnitude = Math.abs(yaw);
  const detectedRole: ViewRole = magnitude < SIDE_MIN ? "front" : yaw < 0 ? "left" : "right";
  const warnings = [...quality.warnings];
  let poseScore: number;
  if (role === "front") {
    poseScore = 1 - ramp(magnitude, 6, 25);
    if (magnitude > FRONT_TOLERANCE)
      warnings.push(`The front photo is turned ${Math.round(magnitude)}°; face the camera for the front view.`);
  } else {
    poseScore =
      magnitude <= 25 ? ramp(magnitude, 10, 25) : magnitude <= 45 ? 1 : 1 - ramp(magnitude, 45, 65);
    if (magnitude < SIDE_MIN)
      warnings.push(
        `This angle is nearly frontal (${Math.round(magnitude)}°), so it adds nothing to the front photo. Turn the head 25-45°.`
      );
    else if (magnitude > SIDE_MAX)
      warnings.push(
        `This is close to a full profile (${Math.round(magnitude)}°); the detector has to guess the hidden half of the face. Use 25-45°.`
      );
    else if (detectedRole !== role)
      warnings.push(`This photo shows the ${detectedRole} side, so it is used as the ${detectedRole} view.`);
  }
  const score = clamp01(quality.score * 0.6 + poseScore * 0.4);
  return {
    role,
    detectedRole,
    yaw: Math.round(yaw * 10) / 10,
    quality,
    score,
    used: role === "front" || (magnitude >= SIDE_MIN && magnitude <= SIDE_MAX && score >= 0.4),
    warnings
  };
}

/** Signed head turn of a detection in degrees, for callers without a full analysis. */
export function yawDegreesOf(landmarks: readonly FaceLandmark[], sourceAspectRatio: number): number {
  return estimatePose(landmarks, sourceAspectRatio).yawDegrees;
}

/**
 * Measurements an angled photo may contribute: vertical positions, which a turn about the vertical
 * axis does not foreshorten. Widths stay with the front photo.
 */
export const VERTICAL_MEASUREMENTS: ReadonlySet<MeasurementKey> = new Set<MeasurementKey>([
  "cheekHeight",
  "jawHeight",
  "lowerFace",
  "eyeVertical",
  "browHeight",
  "noseLength",
  "noseVertical",
  "noseRootHeight",
  "noseWingHeight",
  "mouthVertical"
]);

export function fuseFaceAnalyses(views: readonly AnalyzedView[]): MultiViewResult {
  const front = views.find((view) => view.role === "front");
  if (!front) throw new Error("A front view is required.");
  const accepted = views.filter(
    (view) => view.role === "front" || view.report.used
  );
  const measurements = Object.fromEntries(
    Object.entries(front.analysis.measurements).map(([rawKey, measurement]) => {
      const key = rawKey as MeasurementKey;
      if (!VERTICAL_MEASUREMENTS.has(key)) return [key, measurement];
      let weighted = measurement.value;
      let weight = 1;
      for (const view of accepted) {
        if (view.role === "front") continue;
        const candidate = view.analysis.measurements[key].value;
        const deviation = Math.abs(candidate - measurement.value) /
          Math.max(Math.abs(measurement.value), 0.001);
        if (deviation > 0.18) continue;
        const sideWeight = view.report.score * 0.35;
        weighted += candidate * sideWeight;
        weight += sideWeight;
      }
      const value = weighted / weight;
      return [key, { ...measurement, value, display: value.toFixed(3) }];
    })
  ) as FaceAnalysis["measurements"];
  const sideCount = accepted.filter((view) => view.role !== "front").length;
  const confidence = clamp01(
    0.62 +
      front.report.quality.score * 0.14 +
      sideCount * 0.1
  );
  const reports = views.map((view) => view.report);
  return {
    analysis: {
      ...front.analysis,
      measurements,
      warnings: [
        ...front.analysis.warnings,
        ...reports.flatMap((report) =>
          report.warnings.map((warning) => `${report.role}: ${warning}`)
        ),
        sideCount > 0
          ? `Multi-view fusion used ${sideCount + 1} views at ${Math.round(
              confidence * 100
            )}% source confidence.`
          : "No angled view passed quality and pose checks; front view only was used."
      ]
    },
    confidence,
    reports
  };
}

export function selectVideoViews<T>(
  candidates: readonly VideoCandidate<T>[]
): Partial<Record<ViewRole, VideoCandidate<T>>> {
  const best = (
    predicate: (candidate: VideoCandidate<T>) => boolean,
    score: (candidate: VideoCandidate<T>) => number
  ) =>
    candidates
      .filter(predicate)
      .reduce<VideoCandidate<T> | undefined>(
        (winner, candidate) =>
          !winner || score(candidate) > score(winner) ? candidate : winner,
        undefined
      );
  // Same degree limits as still photos: the sharpest near-frontal frame, and for each side the
  // sharpest frame closest to a 35 degree three-quarter turn.
  const front = best(
    () => true,
    (candidate) => candidate.quality - Math.abs(candidate.yaw) / 20
  );
  const side = (sign: -1 | 1) =>
    best(
      (candidate) =>
        candidate !== front &&
        Math.sign(candidate.yaw) === sign &&
        Math.abs(candidate.yaw) >= SIDE_MIN &&
        Math.abs(candidate.yaw) <= SIDE_MAX,
      (candidate) => candidate.quality - Math.abs(Math.abs(candidate.yaw) - 35) / 40
    );
  return { front, left: side(-1), right: side(1) };
}

/**
 * The yaw to render the head at beside a reference photo: the photo's own measured turn (negative =
 * turned to the subject's left, the renderer's convention), clamped to the side-view limit. A guided
 * slot falls back to its usual 30 degrees only when the turn could not be measured.
 */
export function renderYawFor(source: {
  id: string;
  analysis?: Pick<FaceAnalysis, "correction"> | null;
}): number {
  if (source.id === "front") return 0;
  const measured = source.analysis?.correction?.pose?.yawDegrees;
  if (measured !== undefined && Number.isFinite(measured) && Math.abs(measured) >= 3)
    return Math.max(-SIDE_MAX, Math.min(SIDE_MAX, Math.round(measured)));
  if (source.id === "left") return -30;
  if (source.id === "right") return 30;
  return 0;
}
