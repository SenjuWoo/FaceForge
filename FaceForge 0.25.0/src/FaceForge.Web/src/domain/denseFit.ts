import { renderHeads, reshapedRenderRequest, RESHAPE_KEYS, type RenderTargetMeta } from "./headRender";
import { analyzePortrait, selectPrimaryFace, withPrimaryFaceFirst } from "./mediapipe";

/**
 * Dense-landmark fit ("Analyze & improve", default method).
 *
 * The ratio-based fit in fit.ts optimises 39 detector-read ratios, an objective that is not lowest at
 * the true face (qa/bench: on synthetic faces its own loss for the TRUE sliders is higher than for the
 * sliders it finds, and it scores worse than leaving the head neutral). This replaces the objective:
 *
 *   1. Measure, once per head, how every slider moves the detector's 468 landmarks (render each slider
 *      at +-DENSE_DELTA through the native renderer, detect, align to the neutral render). That is a
 *      dense Jacobian of the REAL forward model, detector quirks included.
 *   2. For a photo: detect landmarks (averaged over a few jittered re-detections), solve the unknown
 *      framing as a 2D similarity, then a bounded ridge regression for the slider values.
 *
 * Linear in the sliders, so a photo costs one small solve and no renders. Positive and negative morphs
 * are separate non-negative variables, netted at the end. Prototype and benchmark: qa/bench/phase2.py.
 */

export const DENSE_LANDMARKS = 468;
const ROWS = DENSE_LANDMARKS * 2;
export const DENSE_DELTA = 3;
/** EFM sliders are bounded at +-3 in RaceMenu (EFM_RANGE in faceAnalysis.ts). */
export const DENSE_LIMIT = 3;
/**
 * Ridge strength. Photo and Jacobian from the same renderer: 100 -> +0.41, 1000 -> +0.39. Photo from a
 * different renderer (a stand-in for a real photograph's domain gap): 30 -> -0.39, 1000 -> +0.34. A real
 * photograph is further from the flat render than either, so the stronger prior is the safer default.
 */
export const DENSE_LAMBDA = 1000;
const JACOBIAN_RENDER_SIZE = 768; // the native renderer clamps size to 128-768
const BATCH = 20;
const MAX_DETECT_EDGE = 1536;
const CACHE_VERSION = 1;
/** Outer eye corners, used only to express the residual in units of eye distance. */
const EYE_CORNERS: readonly [number, number] = [33, 263];

/** Flat [x0, y0, x1, y1, ...] pixel coordinates. */
export type Points = Float64Array;

export interface Similarity {
  scale: number;
  cos: number;
  sin: number;
  tx: number;
  ty: number;
}

/** Least-squares 2D similarity (no reflection) with dst ~ scale * R * src + t. */
export function fitSimilarity(src: Points, dst: Points): Similarity {
  const n = src.length / 2;
  let msx = 0, msy = 0, mdx = 0, mdy = 0;
  for (let i = 0; i < n; i++) {
    msx += src[2 * i]; msy += src[2 * i + 1]; mdx += dst[2 * i]; mdy += dst[2 * i + 1];
  }
  msx /= n; msy /= n; mdx /= n; mdy /= n;
  let dot = 0, cross = 0, norm = 0;
  for (let i = 0; i < n; i++) {
    const ax = src[2 * i] - msx, ay = src[2 * i + 1] - msy;
    const bx = dst[2 * i] - mdx, by = dst[2 * i + 1] - mdy;
    dot += ax * bx + ay * by;
    cross += ax * by - ay * bx;
    norm += ax * ax + ay * ay;
  }
  const h = Math.hypot(dot, cross);
  if (norm <= 0 || h <= 0) return { scale: 1, cos: 1, sin: 0, tx: mdx - msx, ty: mdy - msy };
  const cos = dot / h, sin = cross / h, scale = h / norm;
  return {
    scale, cos, sin,
    tx: mdx - scale * (cos * msx - sin * msy),
    ty: mdy - scale * (sin * msx + cos * msy)
  };
}

export function applySimilarity(s: Similarity, pts: Points): Points {
  const out = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = s.scale * (s.cos * pts[i] - s.sin * pts[i + 1]) + s.tx;
    out[i + 1] = s.scale * (s.sin * pts[i] + s.cos * pts[i + 1]) + s.ty;
  }
  return out;
}

export function invertSimilarity(s: Similarity, pts: Points): Points {
  const out = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] - s.tx, y = pts[i + 1] - s.ty;
    out[i] = (s.cos * x + s.sin * y) / s.scale;
    out[i + 1] = (-s.sin * x + s.cos * y) / s.scale;
  }
  return out;
}

/** Solves the symmetric positive-definite system A x = b in place of A (Cholesky). */
function solveSpd(a: Float64Array, b: Float64Array, n: number): Float64Array {
  for (let j = 0; j < n; j++) {
    let d = a[j * n + j];
    for (let k = 0; k < j; k++) d -= a[j * n + k] * a[j * n + k];
    if (!(d > 0)) throw new Error("Dense fit: ridge system is not positive definite.");
    d = Math.sqrt(d);
    a[j * n + j] = d;
    for (let i = j + 1; i < n; i++) {
      let s = a[i * n + j];
      for (let k = 0; k < j; k++) s -= a[i * n + k] * a[j * n + k];
      a[i * n + j] = s / d;
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= a[i * n + k] * y[k];
    y[i] = s / a[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= a[k * n + i] * x[k];
    x[i] = s / a[i * n + i];
  }
  return x;
}

/** min ||J x - r||^2 + lambda ||x||^2 subject to 0 <= x <= hi, by repeatedly freezing violators. */
export function boundedRidge(
  columns: readonly Float64Array[],
  r: Float64Array,
  lambda: number,
  hi: number,
  rounds = 25
): Float64Array {
  const n = columns.length;
  const m = r.length;
  const jtj = new Float64Array(n * n);
  const jtr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ci = columns[i];
    let s = 0;
    for (let k = 0; k < m; k++) s += ci[k] * r[k];
    jtr[i] = s;
    for (let j = i; j < n; j++) {
      const cj = columns[j];
      let t = 0;
      for (let k = 0; k < m; k++) t += ci[k] * cj[k];
      jtj[i * n + j] = t;
      jtj[j * n + i] = t;
    }
  }
  const x = new Float64Array(n);
  const free = new Array<boolean>(n).fill(true);
  for (let round = 0; round < rounds; round++) {
    const f: number[] = [];
    const fixed: number[] = [];
    for (let i = 0; i < n; i++) (free[i] ? f : fixed).push(i);
    const size = f.length;
    if (size === 0) break;
    const a = new Float64Array(size * size);
    const b = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      let s = jtr[f[i]];
      for (const q of fixed) s -= jtj[f[i] * n + q] * x[q];
      b[i] = s;
      for (let j = 0; j < size; j++) a[i * size + j] = jtj[f[i] * n + f[j]] + (i === j ? lambda : 0);
    }
    const solved = solveSpd(a, b, size);
    for (let i = 0; i < size; i++) x[f[i]] = solved[i];
    let anyBad = false;
    for (let i = 0; i < n; i++) {
      if (x[i] < 0) { x[i] = 0; free[i] = false; anyBad = true; }
      else if (x[i] > hi) { x[i] = hi; free[i] = false; anyBad = true; }
    }
    if (!anyBad) break;
  }
  return x;
}

/** The measured response of the detector's landmarks to every slider, for one head configuration. */
export interface DenseJacobian {
  key: string;
  names: string[];
  delta: number;
  /** Neutral-render landmarks, 936 numbers in neutral-render pixels. */
  neutral: Points;
  /** 2n columns of 936: the n positive-morph responses, then the n negative-morph responses, per slider unit. */
  columns: Float64Array[];
  /**
   * Render ids ("EFM_X|pos") whose landmarks could not be read. Their column is all zeros, so those
   * slider directions cannot move in a fit; this list is how that is said out loud.
   */
  unreadable?: string[];
}

export interface DenseSolution {
  /** Net slider values in [-DENSE_LIMIT, DENSE_LIMIT]; sliders the photo does not move are omitted. */
  sliders: Record<string, number>;
  /** RMS landmark residual after the fit, as a fraction of the eye-corner distance. */
  residual: number;
  iterations: number;
}

export function solveDense(
  jac: DenseJacobian,
  target: Points,
  lambda = DENSE_LAMBDA,
  iterations = 8
): DenseSolution {
  const n = jac.names.length;
  if (target.length !== ROWS || jac.neutral.length !== ROWS) throw new Error("Dense fit expects 468 landmarks.");
  let x: Float64Array = new Float64Array(2 * n);
  let back: Points = target;
  for (let it = 0; it < iterations; it++) {
    const pred = predict(jac, x);
    back = invertSimilarity(fitSimilarity(pred, target), target);
    const resid = new Float64Array(ROWS);
    for (let k = 0; k < ROWS; k++) resid[k] = back[k] - jac.neutral[k];
    x = boundedRidge(jac.columns, resid, lambda, DENSE_LIMIT);
  }
  const pred = predict(jac, x);
  back = invertSimilarity(fitSimilarity(pred, target), target);
  let sq = 0;
  for (let k = 0; k < ROWS; k++) sq += (back[k] - pred[k]) ** 2;
  const rms = Math.sqrt(sq / DENSE_LANDMARKS);
  const [a, b] = EYE_CORNERS;
  const eye = Math.hypot(jac.neutral[2 * a] - jac.neutral[2 * b], jac.neutral[2 * a + 1] - jac.neutral[2 * b + 1]);
  const sliders: Record<string, number> = {};
  jac.names.forEach((name, i) => {
    const value = Math.max(-DENSE_LIMIT, Math.min(DENSE_LIMIT, x[i] - x[n + i]));
    if (Math.abs(value) > 1e-6) sliders[name] = Math.round(value * 1000) / 1000;
  });
  return { sliders, residual: eye > 0 ? rms / eye : rms, iterations };
}

function predict(jac: DenseJacobian, x: Float64Array): Points {
  const out = Float64Array.from(jac.neutral);
  for (let c = 0; c < x.length; c++) {
    if (x[c] === 0) continue;
    const col = jac.columns[c];
    for (let k = 0; k < ROWS; k++) out[k] += col[k] * x[c];
  }
  return out;
}

// --- detection (browser) ---------------------------------------------------------------------

export interface DetectedPoints {
  points: Points;
  width: number;
  height: number;
  samples: number;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((p, q) => p - q);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded."));
    image.src = url;
  });

/**
 * 468 landmarks in pixel coordinates of the (possibly downscaled) working image, taken as the median
 * of `jitters` re-detections (scale +-6%, roll +-2 deg, shift +-4%) mapped back to the original frame.
 * The first detection is unjittered; if it finds no face the photo is rejected (null).
 */
export async function detectDensePoints(url: string, jitters = 4): Promise<DetectedPoints | null> {
  const image = await loadImage(url);
  const fit = Math.min(1, MAX_DETECT_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * fit));
  const height = Math.max(1, Math.round(image.naturalHeight * fit));
  let seed = 1;
  const random = () => { // mulberry32: jitter must be reproducible run to run
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const samples: Points[] = [];
  for (let k = 0; k < Math.max(1, jitters); k++) {
    const s = k === 0 ? 1 : 1 + (random() - 0.5) * 0.12;
    const th = k === 0 ? 0 : ((random() - 0.5) * 4 * Math.PI) / 180;
    const dx = k === 0 ? 0 : (random() - 0.5) * 0.08 * width;
    const dy = k === 0 ? 0 : (random() - 0.5) * 0.08 * height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#000";
    g.fillRect(0, 0, width, height);
    g.translate(width / 2 + dx, height / 2 + dy);
    g.rotate(th);
    g.scale(s, s);
    g.drawImage(image, -width / 2, -height / 2, width, height);
    const result = await analyzePortrait(canvas);
    const landmarks = result.faceLandmarks?.length
      ? withPrimaryFaceFirst(result, selectPrimaryFace(result)).faceLandmarks[0]
      : undefined;
    if (!landmarks || landmarks.length < DENSE_LANDMARKS) {
      if (k === 0) return null;
      continue;
    }
    const cos = Math.cos(th), sin = Math.sin(th);
    const pts = new Float64Array(ROWS);
    for (let i = 0; i < DENSE_LANDMARKS; i++) {
      const x = landmarks[i].x * width - (width / 2 + dx);
      const y = landmarks[i].y * height - (height / 2 + dy);
      pts[2 * i] = (cos * x + sin * y) / s + width / 2;
      pts[2 * i + 1] = (-sin * x + cos * y) / s + height / 2;
    }
    samples.push(pts);
  }
  const points = new Float64Array(ROWS);
  for (let k = 0; k < ROWS; k++) points[k] = median(samples.map((p) => p[k]));
  return { points, width, height, samples: samples.length };
}

// --- measuring and caching the Jacobian ------------------------------------------------------

export interface DenseProgress {
  label: string;
  fraction: number;
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
};

export const jacobianKey = (meta: RenderTargetMeta, names: readonly string[]): string => {
  let hash = 5381;
  for (const ch of names.join(",")) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `ff.dense.v${CACHE_VERSION}.${meta.sex}.${meta.highPoly ? "hph" : "van"}.${meta.race ?? "neutral"}.${names.length}.${hash.toString(36)}`;
};

export async function measureJacobian(
  meta: RenderTargetMeta,
  names: readonly string[],
  options: { jitters?: number; signal?: AbortSignal; onProgress?: (p: DenseProgress) => void } = {}
): Promise<DenseJacobian> {
  const { jitters = 4, signal, onProgress } = options;
  const renderMeta: RenderTargetMeta = { ...meta, size: JACOBIAN_RENDER_SIZE };
  const requests = [
    { id: "neutral", sliders: {} as Record<string, number> },
    ...names.flatMap((name) => [
      { id: `${name}|pos`, sliders: { [name]: DENSE_DELTA } },
      { id: `${name}|neg`, sliders: { [name]: -DENSE_DELTA } }
    ])
  ];
  const detected = new Map<string, DetectedPoints | null>();
  for (let start = 0; start < requests.length; start += BATCH) {
    throwIfAborted(signal);
    const batch = requests.slice(start, start + BATCH);
    const images = await renderHeads(
      renderMeta,
      batch.map((item) => reshapedRenderRequest(item.id, item.sliders)),
      120000
    );
    for (const item of batch) {
      throwIfAborted(signal);
      const url = images.get(item.id);
      detected.set(item.id, url ? await detectDensePoints(url, jitters) : null);
    }
    onProgress?.({
      label: "Measuring how this head responds to each slider (one time)",
      fraction: Math.min(1, (start + batch.length) / requests.length)
    });
  }
  return assembleJacobian(meta, names, detected);
}

/** Builds the Jacobian from the detections of the neutral render and of every slider at +-DENSE_DELTA. */
export function assembleJacobian(
  meta: RenderTargetMeta,
  names: readonly string[],
  detected: ReadonlyMap<string, DetectedPoints | null>
): DenseJacobian {
  const neutral = detected.get("neutral");
  if (!neutral) throw new Error("The detector could not read the neutral head render. Confirm Skyrim is indexed.");
  const unreadable: string[] = [];
  const column = (id: string): Float64Array => {
    const d = detected.get(id);
    if (!d) {
      // The render is missing or the detector found no face in it. The slider direction then has no
      // measured effect; it is recorded so the fit result can say so instead of looking complete.
      unreadable.push(id);
      return new Float64Array(ROWS);
    }
    const mapped = applySimilarity(fitSimilarity(d.points, neutral.points), d.points);
    const out = new Float64Array(ROWS);
    for (let k = 0; k < ROWS; k++) out[k] = (mapped[k] - neutral.points[k]) / DENSE_DELTA;
    return out;
  };
  return {
    key: jacobianKey(meta, names),
    names: [...names],
    delta: DENSE_DELTA,
    neutral: neutral.points,
    columns: [...names.map((n) => column(`${n}|pos`)), ...names.map((n) => column(`${n}|neg`))],
    unreadable
  };
}

const toBase64 = (floats: Float32Array): string => {
  const bytes = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const fromBase64 = (text: string): Float32Array => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

export function serializeJacobian(jac: DenseJacobian): string {
  const flat = new Float32Array((jac.columns.length + 1) * ROWS);
  flat.set(jac.neutral, 0);
  jac.columns.forEach((col, i) => flat.set(col, (i + 1) * ROWS));
  return JSON.stringify({ key: jac.key, names: jac.names, delta: jac.delta, data: toBase64(flat) });
}

export function deserializeJacobian(text: string): DenseJacobian | null {
  try {
    const parsed = JSON.parse(text) as { key: string; names: string[]; delta: number; data: string };
    const flat = fromBase64(parsed.data);
    const count = parsed.names.length * 2;
    if (flat.length !== (count + 1) * ROWS) return null;
    return {
      key: parsed.key,
      names: parsed.names,
      delta: parsed.delta,
      neutral: Float64Array.from(flat.subarray(0, ROWS)),
      columns: Array.from({ length: count }, (_, i) => Float64Array.from(flat.subarray((i + 1) * ROWS, (i + 2) * ROWS)))
    };
  } catch {
    return null;
  }
}

const memory = new Map<string, DenseJacobian>();

/**
 * In-memory only, per app run. The measurement costs about ten seconds once, and this is a desktop
 * app: browser storage for a cache of parity data is more risk than the reload is worth, and a static
 * analyser is right to flag a browser-storage write of a serialised blob. Re-measuring is the fallback
 * path that already exists.
 */
export function cachedJacobian(key: string): DenseJacobian | null {
  return memory.get(key) ?? null;
}

export function storeJacobian(jac: DenseJacobian): void {
  memory.set(jac.key, jac);
}

export function forgetJacobian(key: string): void {
  memory.delete(key);
}

/** Forgets every measured Jacobian, for when the install behind them has been re-indexed. */
export function clearJacobians(): void {
  memory.clear();
}

export interface DenseFitOptions {
  meta: RenderTargetMeta;
  sliderNames: readonly string[];
  /** Front photo (data or blob URL). */
  photoUrl: string;
  /** Existing slider record; reshape sentinels in it are carried through untouched. */
  initial?: Record<string, number>;
  /** Ridge strength override (default DENSE_LAMBDA); used by the benchmark. */
  lambda?: number;
  signal?: AbortSignal;
  onProgress?: (p: DenseProgress) => void;
}

export interface DenseFitResult {
  sliders: Record<string, number>;
  residual: number;
  measuredJacobian: boolean;
  /** Slider names with at least one direction whose head render the detector could not read. */
  unreadableSliders: string[];
}

export async function denseFitSliders(options: DenseFitOptions): Promise<DenseFitResult> {
  const { meta, sliderNames, photoUrl, initial = {}, signal, onProgress } = options;
  if (sliderNames.length === 0) throw new Error("No EFM sliders are available for this head.");
  const key = jacobianKey(meta, sliderNames);
  let jac = cachedJacobian(key);
  const measured = jac === null;
  if (!jac) {
    jac = await measureJacobian(meta, sliderNames, { signal, onProgress });
    storeJacobian(jac);
  }
  throwIfAborted(signal);
  onProgress?.({ label: "Reading the photo", fraction: 1 });
  const photo = await detectDensePoints(photoUrl, 8);
  if (!photo) throw new Error("The detector could not read a face in this photo.");
  const solution = solveDense(jac, photo.points, options.lambda);
  const sliders: Record<string, number> = {};
  for (const key of RESHAPE_KEYS) if (initial[key] !== undefined) sliders[key] = initial[key];
  // Every fitted slider is written, zeros included: the caller merges this over the existing values, and a
  // slider the photo does not move must not keep a value from an earlier one-shot pass.
  for (const name of sliderNames) sliders[name] = solution.sliders[name] ?? 0;
  const unreadableSliders = [...new Set((jac.unreadable ?? []).map((id) => id.split("|")[0]))];
  return { sliders, residual: solution.residual, measuredJacobian: measured, unreadableSliders };
}
