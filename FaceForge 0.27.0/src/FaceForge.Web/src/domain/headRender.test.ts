/**
 * The sculpt bridge is the one place where a failed reshape could look like success: the native side
 * used to answer with an empty list and no error, and the export wrote an empty host shell. These
 * tests pin the three outcomes the export logic depends on -- a reported failure, an empty result,
 * and a silent host -- so the caller can always tell them apart.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const posted: any[] = [];
const listeners: Array<(message: any) => void> = [];

vi.mock("./nativeBridge", () => ({
  postNative: (message: any) => {
    posted.push(message);
    return true;
  },
  subscribeNative: (handler: (message: any) => void) => {
    listeners.push(handler);
    return () => {
      const index = listeners.indexOf(handler);
      if (index >= 0) listeners.splice(index, 1);
    };
  }
}));

import { computeSculpt, reshapeExportBlock } from "./headRender";

// vitest runs in a node environment; computeSculpt uses window.setTimeout for its timeout guard.
beforeEach(() => {
  posted.length = 0;
  listeners.length = 0;
  (globalThis as any).window = { setTimeout, clearTimeout };
});

function answer(payload: Record<string, unknown>) {
  for (const handler of [...listeners]) handler({ type: "sculpt-computed", payload });
}

describe("computeSculpt", () => {
  it("rejects with the native reason instead of resolving an empty sculpt", async () => {
    const pending = computeSculpt({ sex: "female", highPoly: true, race: "NordRace" }, {});
    answer({ requestId: posted[0].requestId, sculpt: [], error: "The head mesh could not be loaded" });
    await expect(pending).rejects.toThrow(/head mesh could not be loaded/i);
  });

  it("resolves an empty sculpt as empty, so the caller can refuse to export it", async () => {
    const pending = computeSculpt({ sex: "female", highPoly: true, race: "NordRace" }, {});
    answer({ requestId: posted[0].requestId, sculpt: [], divisor: 10000 });
    const result = await pending;
    expect(result.entries).toEqual([]);
  });

  // A browser has no renderer, so a reshape the preview shows would vanish on export. The export
  // path asks this before it writes anything.
  it("blocks an export that carries a reshape but has no renderer to bake it", () => {
    expect(reshapeExportBlock(true, false)).toMatch(/needs the desktop app/i);
  });

  it("allows a plain preset without a reshape in the browser", () => {
    expect(reshapeExportBlock(false, false)).toBeNull();
  });

  it("allows a reshape when the desktop renderer is present", () => {
    expect(reshapeExportBlock(true, true)).toBeNull();
  });

  it("rejects when the native side never answers", async () => {
    const pending = computeSculpt({ sex: "female", highPoly: false, race: null }, {}, 5);
    await expect(pending).rejects.toThrow(/did not respond in time/i);
  });
});
