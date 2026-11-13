// Runs photoColors.extractPhotoColors on photos in the browser. node colors_photos.mjs <list.json [{id,png}]> <out.json>
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
  out[item.id] = await page.evaluate(async (u) => {
    const hr = await import("/src/domain/headRender.ts");
    const pc = await import("/src/domain/photoColors.ts");
    const raw = await hr.rawLandmarksFromDataUrl(u);
    if (!raw) return null;
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = u; });
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    return pc.extractPhotoColors(g.getImageData(0, 0, c.width, c.height), raw.landmarks);
  }, url);
}
await browser.close();
await writeFile(outPath, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
