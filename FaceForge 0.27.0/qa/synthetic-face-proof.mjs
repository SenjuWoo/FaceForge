// Public proof run: the built web bundle analyses qa/synthetic-face-seed4243.png (a generated face,
// provenance in qa/SYNTHETIC-FACE.md) with the real landmark model and exports a RaceMenu preset.
// Prints one JSON summary; exits 1 if the page made any outbound request or threw.
//
// Needs `pnpm install` and `pnpm build` in src/FaceForge.Web, plus `pnpm exec playwright install chromium`.
// usage: node qa/synthetic-face-proof.mjs [--out <folder for the .jslot>] [--port 4180]
import { readFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const webRoot = path.join(root, "src", "FaceForge.Web");
const photo = path.join(root, "qa", "synthetic-face-seed4243.png");
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const outDir = path.resolve(arg("--out", path.join(tmpdir(), "faceforge-proof")));
const port = Number(arg("--port", "4180"));
await mkdir(outDir, { recursive: true });

const requireFromWeb = createRequire(path.join(webRoot, "package.json"));
const { chromium } = requireFromWeb("playwright");
// vite's package exports hide bin/, so take the CLI from the web project's own node_modules link.
const viteBin = path.join(webRoot, "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteBin, "preview", "--port", String(port), "--strictPort"], {
  cwd: webRoot,
  stdio: "ignore",
  windowsHide: true
});

let browser;
try {
  const base = `http://localhost:${port}/`;
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (attempt > 60) throw new Error(`vite preview did not answer on ${port}; run pnpm build first.`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
  const outbound = [];
  const pageErrors = [];
  const isLocal = (url) => /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|about:)/.test(url);
  page.on("request", (request) => { if (!isLocal(request.url())) outbound.push(request.url()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').nth(0).setInputFiles(photo);
  await page.getByRole("button", { name: "Analyze face" }).click();
  await page.getByText("Analysis complete").first().waitFor({ timeout: 60_000 });
  const statusText = await page.locator(".status-message").innerText();
  const held = Number(statusText.match(/(\d+) sliders? (?:was|were) left at neutral/)?.[1] ?? 0);
  const pose = (await page.locator(".pose-grid strong").allInnerTexts()).slice(0, 3);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Preset Pack" }).click();
  const download = await downloadPromise;
  const presetPath = path.join(outDir, download.suggestedFilename());
  await download.saveAs(presetPath);
  const preset = JSON.parse(await readFile(presetPath, "utf8"));
  const sliders = (preset?.morphs?.custom ?? []).filter((entry) => /^EFM_/.test(entry?.name ?? ""));
  const moved = sliders.filter((entry) => Math.abs(Number(entry.value) || 0) >= 0.005);
  const largest = [...moved].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 6);

  const summary = {
    photo: path.basename(photo),
    status: statusText.split(".")[0],
    pose_tilt_turn_nod: pose.join(" / "),
    preset: path.basename(presetPath),
    preset_sections: Object.keys(preset).join(", "),
    efm_sliders_written: sliders.length,
    efm_sliders_moved: moved.length,
    held_at_neutral_unmeasurable: held,
    largest_moves: Object.fromEntries(largest.map((entry) => [entry.name, entry.value])),
    outbound_requests: outbound.length,
    page_errors: pageErrors.length
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = outbound.length === 0 && pageErrors.length === 0 && sliders.length > 0 ? 0 : 1;
} finally {
  await browser?.close();
  server.kill();
}
