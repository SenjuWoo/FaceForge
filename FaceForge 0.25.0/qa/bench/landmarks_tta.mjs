// Landmarks averaged over N jittered re-detections (scale +-6%, roll +-2deg, shift +-4%), each mapped back to
// the original frame, then the per-landmark median. The detector quantises on a small crop, so a single
// detection carries a few pixels of noise. node landmarks_tta.mjs <list.json> <out.json> [N=16] [seed=1]
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "file:///C:/Users/karlo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const [listPath, outPath, nArg = "16", seedArg = "1"] = process.argv.slice(2);
const list = JSON.parse(await readFile(listPath, "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
const out = {};
for (const item of list) {
  const url = "data:image/png;base64," + (await readFile(item.png)).toString("base64");
  const samples = await page.evaluate(async ({ url, n, seed }) => {
    const mp = await import("/src/domain/mediapipe.ts");
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const W = img.naturalWidth, H = img.naturalHeight;
    let a = seed >>> 0;
    const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const result = [];
    for (let k = 0; k < n; k++) {
      const s = k === 0 ? 1 : 1 + (rnd() - 0.5) * 0.12;
      const th = k === 0 ? 0 : ((rnd() - 0.5) * 4 * Math.PI) / 180;
      const dx = k === 0 ? 0 : (rnd() - 0.5) * 0.08 * W, dy = k === 0 ? 0 : (rnd() - 0.5) * 0.08 * H;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      g.translate(W / 2 + dx, H / 2 + dy); g.rotate(th); g.scale(s, s); g.drawImage(img, -W / 2, -H / 2);
      const r = await mp.analyzePortrait(c);
      if (!r.faceLandmarks?.length) continue;
      const L = mp.withPrimaryFaceFirst(r, mp.selectPrimaryFace(r)).faceLandmarks[0];
      if (!L || L.length < 468) continue;
      const cos = Math.cos(th), sin = Math.sin(th);
      result.push(L.slice(0, 468).map((p) => {
        const X = p.x * W - (W / 2 + dx), Y = p.y * H - (H / 2 + dy);
        return [((cos * X + sin * Y) / s + W / 2) / W, ((-sin * X + cos * Y) / s + H / 2) / H, p.z];
      }));
    }
    return result;
  }, { url, n: Number(nArg), seed: Number(seedArg) });
  if (samples.length === 0) { out[item.id] = null; continue; }
  const median = (xs) => { const s = [...xs].sort((p, q) => p - q); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const lm = Array.from({ length: 468 }, (_, i) => [0, 1, 2].map((d) => median(samples.map((s) => s[i][d]))));
  const sd = Array.from({ length: 468 }, (_, i) => {
    const xs = samples.map((s) => s[i][0] * 1024), m = xs.reduce((p, q) => p + q, 0) / xs.length;
    return Math.sqrt(xs.reduce((p, q) => p + (q - m) ** 2, 0) / xs.length);
  });
  out[item.id] = { aspect: 1, lm, n: samples.length, sd_px: sd.reduce((p, q) => p + q, 0) / 468 };
}
await browser.close();
await writeFile(outPath, JSON.stringify(out));
const vals = Object.values(out).filter(Boolean);
console.log(`tta landmarks ${vals.length}/${list.length}, mean samples ${(vals.reduce((p, q) => p + q.n, 0) / vals.length).toFixed(1)}, mean x-noise ${(vals.reduce((p, q) => p + q.sd_px, 0) / vals.length).toFixed(2)}px`);
