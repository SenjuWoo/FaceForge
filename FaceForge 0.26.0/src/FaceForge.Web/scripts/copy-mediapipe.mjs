import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(root, "node_modules", "@mediapipe", "tasks-vision");
const outputRoot = resolve(root, "public", "mediapipe");

// Start from an empty folder. Copying over the old one kept files a newer package no longer ships:
// 0.25.0-beta.4 embedded MediaPipe 1.2.0's unused no-SIMD runtime (12.9 MB) next to 1.2.2's.
await rm(resolve(outputRoot, "wasm"), { recursive: true, force: true });
await mkdir(resolve(outputRoot, "wasm"), { recursive: true });
await cp(resolve(packageRoot, "wasm"), resolve(outputRoot, "wasm"), {
  recursive: true,
  force: true
});

for (const candidate of ["LICENSE", "README.md"]) {
  try {
    await copyFile(resolve(packageRoot, candidate), resolve(outputRoot, candidate));
  } catch {
    // Package layouts vary; the release manifest records the pinned package and license.
  }
}
