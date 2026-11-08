import { describe, expect, it } from "vitest";
import {
  applySimilarity,
  boundedRidge,
  cachedJacobian,
  deserializeJacobian,
  DENSE_LANDMARKS,
  fitSimilarity,
  forgetJacobian,
  invertSimilarity,
  serializeJacobian,
  storeJacobian,
  solveDense,
  type DenseJacobian
} from "./denseFit";

// Produced by qa/bench/phase2.py (bounded_ridge, umeyama) on a seeded problem; the TypeScript port must agree.
const FIXTURE = {"cols": [[2.0409, -2.02, -0.2813, 0.9578, -0.1828, -0.8865, -2.8282, -0.4448, 0.1938, -0.2148, -1.6389, 0.7096, 1.5906, -0.3723, 0.3492, -0.5964, -0.0044, -0.2433, 0.2246, -0.6086, -0.9785, 0.7675, -0.1922, 0.4847], [-2.5557, -0.2319, -0.668, -0.1998, 0.5405, -0.2917, 1.0213, -1.0764, 1.1116, -0.7828, 0.0614, 1.1564, -1.1912, -1.7182, -0.6392, -0.3212, 1.2136, 0.8172, 2.55, 0.5327, -0.8012, 0.1554, -0.8138, -0.7015], [0.4181, -0.8652, -1.0552, 0.0243, 1.9351, 0.8825, -0.9596, 0.0261, -0.2055, 0.2292, -0.9641, -2.158, 0.3545, 1.6818, -0.8002, 0.2246, 0.7571, -0.7944, 1.4987, -2.279, 0.0433, 1.7599, 1.5049, -0.9306], [-0.5678, 3.323, -0.3908, 1.5458, -0.2696, 0.5804, -1.6686, -0.0527, -0.9259, -2.4939, 0.7572, -0.498, -1.0484, 0.7528, -0.8002, 0.5753, 0.2157, 0.1342, 1.4967, 1.1745, 0.641, 0.7422, 0.6576, 0.4813], [-0.4526, 0.2258, 0.4819, 0.5451, -0.2436, 0.0915, 0.2764, 1.4056, 0.5841, 0.6901, -2.0342, 0.328, 1.406, 0.7536, 1.3701, -1.2491, -0.3172, -0.1108, -2.0395, 1.067, 2.0479, 1.3686, -0.3051, 2.4631], [-0.2156, -0.3526, -0.2386, -0.5052, 1.0023, 0.6701, 0.7005, 0.7474, 0.5825, 0.4914, -0.9145, -0.6092, -0.0217, 1.1379, -1.4604, -1.73, 0.2932, 0.5434, -0.3403, -1.3021, -0.1974, -1.0777, -0.4525, -0.2461]], "r": [3.0731, 7.3855, -3.2489, 8.4718, 0.3559, 1.0128, -14.2858, -1.0719, -3.2018, -10.2581, -2.137, -2.1216, 0.0208, 3.7434, -3.447, 0.4542, 1.5881, -0.5643, 7.6375, 1.0034, 0.1254, 6.0569, 3.1135, 2.3615], "lam": 5.0, "hi": 1.5, "x": [1.5, 0.0, 1.066006282, 1.5, 0.0, 0.0], "src": [-0.4823, 0.1347, 0.8377, 1.0833, 1.0394, 0.1551, 1.6097, -0.283, -0.141, 0.7994, -0.5514, 2.1609, 1.0192, 2.1756, -0.0266, -0.3831, 0.167, 0.7346, -0.5874, 0.3797], "dst": [1.354, -1.0506, 2.4414, 0.7421, 3.1532, -0.3073, 4.0565, -0.5478, 1.4294, -0.0936, 0.2491, 1.3208, 2.1516, 2.1264, 2.166, -1.4777, 1.7959, -0.0207, 1.0693, -0.8297], "scale": 1.300387690448948, "cos": 0.9251295865481132, "sin": 0.37965148240632174, "tx": 1.9831237551852192, "ty": -0.9931762258022021};

const ROWS = DENSE_LANDMARKS * 2;

/** Deterministic pseudo-random numbers so the synthetic Jacobian below is the same on every run. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
};

describe("dense fit solver", () => {
  it("bounded ridge matches the Python prototype, including variables pinned at the bound", () => {
    const x = boundedRidge(
      FIXTURE.cols.map((c: number[]) => Float64Array.from(c)),
      Float64Array.from(FIXTURE.r),
      FIXTURE.lam,
      FIXTURE.hi
    );
    FIXTURE.x.forEach((expected: number, i: number) => expect(x[i]).toBeCloseTo(expected, 6));
    expect(Math.max(...x)).toBeLessThanOrEqual(FIXTURE.hi + 1e-12);
    expect(Math.min(...x)).toBeGreaterThanOrEqual(0);
  });

  it("similarity fit matches the Python prototype and round-trips", () => {
    const src = Float64Array.from(FIXTURE.src);
    const dst = Float64Array.from(FIXTURE.dst);
    const s = fitSimilarity(src, dst);
    expect(s.scale).toBeCloseTo(FIXTURE.scale, 8);
    expect(s.cos).toBeCloseTo(FIXTURE.cos, 8);
    expect(s.sin).toBeCloseTo(FIXTURE.sin, 8);
    expect(s.tx).toBeCloseTo(FIXTURE.tx, 8);
    expect(s.ty).toBeCloseTo(FIXTURE.ty, 8);
    const back = invertSimilarity(s, applySimilarity(s, src));
    src.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 9));
  });

  const syntheticJacobian = (names: string[]): DenseJacobian => {
    const next = rng(11);
    const neutral = Float64Array.from({ length: ROWS }, (_, k) => 100 + (k % 40) * 7 + next() * 5);
    const columns = Array.from({ length: names.length * 2 }, () => Float64Array.from({ length: ROWS }, () => next() * 4));
    return { key: "test", names, delta: 3, neutral, columns };
  };

  it("recovers known slider values through an unknown framing", () => {
    const names = ["EFM_A", "EFM_B", "EFM_C", "EFM_D", "EFM_E"];
    const jac = syntheticJacobian(names);
    const truth = { EFM_A: 1.2, EFM_B: -0.8, EFM_D: 2.0 };
    const x = new Float64Array(names.length * 2);
    x[0] = 1.2; x[names.length + 1] = 0.8; x[3] = 2.0;
    const clean = Float64Array.from(jac.neutral);
    x.forEach((v, c) => { if (v) for (let k = 0; k < ROWS; k++) clean[k] += jac.columns[c][k] * v; });
    const target = applySimilarity({ scale: 0.7, cos: Math.cos(0.2), sin: Math.sin(0.2), tx: 30, ty: -12 }, clean);
    const solved = solveDense(jac, target, 1e-6);
    for (const [name, value] of Object.entries(truth)) expect(solved.sliders[name]).toBeCloseTo(value, 2);
    expect(solved.sliders.EFM_C ?? 0).toBeCloseTo(0, 2);
    expect(solved.residual).toBeLessThan(1e-3);
  });

  it("never returns a slider outside the EFM range", () => {
    const jac = syntheticJacobian(["EFM_A", "EFM_B"]);
    const target = Float64Array.from(jac.neutral, (v, k) => v + jac.columns[0][k] * 50);
    const solved = solveDense(jac, target, 1e-6);
    for (const value of Object.values(solved.sliders)) expect(Math.abs(value)).toBeLessThanOrEqual(3);
  });

  it("rejects landmark sets of the wrong size instead of fitting garbage", () => {
    expect(() => solveDense(syntheticJacobian(["EFM_A"]), new Float64Array(10))).toThrow();
  });

  it("serialised Jacobians round-trip and a truncated one is refused", () => {
    const jac = syntheticJacobian(["EFM_A", "EFM_B"]);
    const text = serializeJacobian(jac);
    const back = deserializeJacobian(text);
    expect(back?.names).toEqual(jac.names);
    expect(back?.columns[1][17]).toBeCloseTo(jac.columns[1][17], 3);
    const broken = JSON.parse(text);
    broken.data = broken.data.slice(0, 40);
    expect(deserializeJacobian(JSON.stringify(broken))).toBeNull();
    expect(deserializeJacobian("not json")).toBeNull();
  });

  // The cache lives in memory for one run: nothing is written to browser storage, and a
  // forgotten key has to look exactly like a key that was never measured.
  it("keeps the measured Jacobian in memory and forgets it on demand", () => {
    const jac = syntheticJacobian(["EFM_A", "EFM_B"]);
    expect(cachedJacobian(jac.key)).toBeNull();
    storeJacobian(jac);
    expect(cachedJacobian(jac.key)?.names).toEqual(jac.names);
    forgetJacobian(jac.key);
    expect(cachedJacobian(jac.key)).toBeNull();
  });
});
