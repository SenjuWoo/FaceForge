// Raw MediaPipe landmarks (normalized x,y,z + aspect) for a list of PNGs, using the app's own detector
// path (headRender.rawLandmarksFromDataUrl). node landmarks.mjs <list.json [{id,png}]> <out.json>
import { readFile, writeFile } from "node:fs/promises";
// Playwright is resolved from the web project, which already depends on it.
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../../src/FaceForge.Web/package.json", import.meta.url))("playwright");
const [listPath, outPath] = process.argv.slice(2);
const list = JSON.parse(await readFile(listPath, "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
const out = {};
for (const item of list) {
  const url = "data:image/png;base64," + (await readFile(item.png)).toString("base64");
  const raw = await page.evaluate(async (u) => {
    const m = await import("/src/domain/headRender.ts");
    const r = await m.rawLandmarksFromDataUrl(u);
    return r && { aspect: r.aspect, lm: r.landmarks.map((p) => [p.x, p.y, p.z]) };
  }, url);
  out[item.id] = raw; // null when the detector found no face: counted as a miss downstream
}
await browser.close();
await writeFile(outPath, JSON.stringify(out));
console.log(`landmarks for ${Object.values(out).filter(Boolean).length}/${list.length}`);
