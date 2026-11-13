// Runs the recovered "Analyze & improve" fit (fit.ts, PR #1) headless, against the real C# HeadRenderer.
//   node run_fit.mjs <manifest.json> <recovered.json> [hostUrl=http://127.0.0.1:5199/]
// manifest: [{ id, png, hph, sex, sliderNames: [...] }]; needs vite on 5173 and BenchHost on 5199.
// The page sees a fake WebView2 bridge; only "render-heads" is answered (by the host), the rest is ignored.
import { readFile, writeFile } from "node:fs/promises";
// Playwright is resolved from the web project, which already depends on it.
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../../src/FaceForge.Web/package.json", import.meta.url))("playwright");

const [manifestPath, outPath, hostUrl = "http://127.0.0.1:5199/"] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
let renders = 0;

await page.addInitScript(() => {
  const listeners = new Set();
  window.chrome = {
    webview: {
      postMessage: (message) => {
        window.__nativePost(message).then((reply) => {
          if (reply) for (const listener of listeners) listener({ data: reply });
        });
      },
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener)
    }
  };
});
await page.exposeFunction("__nativePost", async (message) => {
  if (message?.type !== "render-heads") return null;
  renders += message.requests?.length ?? 0;
  const response = await fetch(hostUrl, { method: "POST", body: JSON.stringify(message) });
  return { type: "heads-rendered", payload: await response.json() };
});

const results = [];
for (const item of manifest) {
  const started = Date.now();
  const before = renders;
  try {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Photo", exact: true }).click();
    await page.locator('input[type="file"]').nth(0).setInputFiles(item.png);
    await page.getByRole("button", { name: "Analyze face" }).click();
    await page.waitForFunction(() => Boolean(window.faceForge?.analysis), null, { timeout: 60_000 });
    const fit = await page.evaluate(async ({ hph, sex, sliderNames }) => {
      const fitModule = await import("/src/domain/fit.ts");
      const analysisModule = await import("/src/domain/faceAnalysis.ts");
      const analysis = window.faceForge.analysis;
      return fitModule.fitSliders({
        meta: { sex, highPoly: hph, race: null },
        initial: {},
        targets: fitModule.buildTargetsFromViews([analysis]),
        baseline: analysisModule.baselinesForTarget(null, sex, false, "none", hph),
        sliders: sliderNames,
        profileTargets: [],
        iterations: 5
      });
    }, { hph: item.hph, sex: item.sex, sliderNames: item.sliderNames });
    results.push({ id: item.id, found: true, sliders: fit.sliders, loss: fit.loss, seconds: (Date.now() - started) / 1000, renders: renders - before });
  } catch (error) {
    results.push({ id: item.id, found: false, sliders: {}, error: String(error).slice(0, 300), seconds: (Date.now() - started) / 1000, renders: renders - before });
  }
  const last = results.at(-1);
  console.log(`${item.id}: ${last.found ? "ok" : "FAIL " + last.error} ${last.seconds}s ${last.renders} renders`);
  await writeFile(outPath, JSON.stringify(results, null, 1));
}
await browser.close();
