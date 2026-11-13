import { afterEach, describe, expect, it, vi } from "vitest";
import { getFaceLandmarker, selectPrimaryFace, withPrimaryFaceFirst } from "./mediapipe";
import type { FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";

// Only the construction path is faked; the pure selection helpers below never touch the library.
const library = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FaceLandmarker: { createFromOptions: library.create },
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) }
}));

const box = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): NormalizedLandmark[] => {
  // A tight four-corner mesh is enough for the bounding-box scorer.
  const point = (x: number, y: number): NormalizedLandmark => ({
    x,
    y,
    z: 0,
    visibility: 1
  });
  return [point(minX, minY), point(maxX, minY), point(maxX, maxY), point(minX, maxY)];
};

const fakeResult = (faces: NormalizedLandmark[][]): FaceLandmarkerResult =>
  ({
    faceLandmarks: faces,
    faceBlendshapes: faces.map((_, index) => ({
      categories: [{ categoryName: `face${index}`, score: 1 - index * 0.1, index, displayName: "" }],
      headIndex: index,
      headName: `face${index}`
    })),
    facialTransformationMatrixes: faces.map(() => ({ rows: 4, columns: 4, data: new Array(16).fill(0) }))
  }) as FaceLandmarkerResult;

describe("primary face selection", () => {
  it("keeps a single face at index 0", () => {
    const result = fakeResult([box(0.3, 0.3, 0.7, 0.7)]);
    expect(selectPrimaryFace(result)).toBe(0);
  });

  it("prefers the largest face when two are present", () => {
    // Small background face first, large subject second — the old code failed here.
    const result = fakeResult([
      box(0.05, 0.05, 0.2, 0.2),
      box(0.25, 0.2, 0.75, 0.8)
    ]);
    expect(selectPrimaryFace(result)).toBe(1);
  });

  it("nudges toward the frame centre when sizes are close", () => {
    const result = fakeResult([
      box(0.02, 0.35, 0.32, 0.65),
      box(0.35, 0.35, 0.65, 0.65)
    ]);
    expect(selectPrimaryFace(result)).toBe(1);
  });

  it("reorders landmarks and blendshapes so the subject is first", () => {
    const result = fakeResult([
      box(0.05, 0.05, 0.15, 0.15),
      box(0.3, 0.3, 0.7, 0.7)
    ]);
    const primary = selectPrimaryFace(result);
    const ordered = withPrimaryFaceFirst(result, primary);
    expect(primary).toBe(1);
    expect(ordered.faceLandmarks[0]).toBe(result.faceLandmarks[1]);
    expect(ordered.faceBlendshapes[0].categories[0].categoryName).toBe("face1");
    expect(ordered.faceLandmarks).toHaveLength(2);
  });
});

describe("landmarker construction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    library.create.mockReset();
  });

  it("retries after a failed load instead of caching the failure for the rest of the session", async () => {
    vi.stubGlobal("window", { location: { href: "https://app.faceforge/index.html" } });
    // GPU delegate fails, then the CPU fallback fails too: the whole load rejects.
    library.create
      .mockRejectedValueOnce(new Error("gpu unavailable"))
      .mockRejectedValueOnce(new Error("model file unreadable"))
      .mockResolvedValue({ detect: vi.fn() });

    await expect(getFaceLandmarker()).rejects.toThrow("model file unreadable");
    // A transient failure (file briefly locked, WASM not yet extracted) must not poison later attempts.
    await expect(getFaceLandmarker()).resolves.toBeDefined();
  });
});
