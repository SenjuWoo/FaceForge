// Runs the PORTED dense fit (src/domain/denseFit.ts) headless against the real C# HeadRenderer.
//   node run_dense.mjs <manifest.json> <recovered.json>      manifest: [{ id, png, hph, sex, sliderNames }]
// The slider Jacobian is measured on the first case of each head configuration and cached in the page's
// localStorage, which persists across the page loads of this one browser process.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "file:///C:/Users/karlo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const [manifestPath, outPath, hostUrl = "http://127.0.0.1:5199/"] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
page.setDefaultTimeout(600_000);
await page.addInitScript(() => {
  const listeners = new Set();
  window.chrome = { webview: {
    postMessage: (m) => window.__nativePost(m).then((r) => { if (r) for (const l of listeners) l({ data: r }); }),
    addEventListener: (_t, l) => listeners.add(l), removeEventListener: (_t, l) => listeners.delete(l) } };
});
await page.exposeFunction("__nativePost", async (m) => {
  if (m?.type !== "render-heads") return null;
  const r = await fetch(hostUrl, { method: "POST", body: JSON.stringify(m) });
  return { type: "heads-rendered", payload: await r.json() };
});
const results = [];
for (const item of manifest) {
  const started = Date.now();
  try {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    const url = "data:image/png;base64," + (await readFile(item.png)).toString("base64");
    const out = await page.evaluate(async ({ url, item }) => {
      const m = await import("/src/domain/denseFit.ts");
      return m.denseFitSliders({ meta: { sex: item.sex, highPoly: item.hph, race: null }, sliderNames: item.sliderNames, photoUrl: url, initial: {}, lambda: item.lambda });
    }, { url, item });
    results.push({ id: item.id, found: true, sliders: out.sliders, residual: out.residual, measured: out.measuredJacobian, seconds: (Date.now() - started) / 1000 });
  } catch (error) {
    results.push({ id: item.id, found: false, sliders: {}, error: String(error).slice(0, 300), seconds: (Date.now() - started) / 1000 });
  }
  const last = results.at(-1);
  console.log(`${item.id}: ${last.found ? "ok" : "FAIL " + last.error} ${last.seconds}s${last.measured ? " (measured Jacobian)" : ""}`);
  await writeFile(outPath, JSON.stringify(results, null, 1));
}
await browser.close();
