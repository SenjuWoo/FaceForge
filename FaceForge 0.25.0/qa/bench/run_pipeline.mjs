// Runs the UNMODIFIED FaceForge analysis + slider generation on a list of renders.
//   node run_pipeline.mjs <manifest.json> <recovered.json>
// manifest: [{ id, png, hph, sex }]   (needs `vite` dev server on 127.0.0.1:5173)
// recovered: [{ id, found, sliders: { EFM_*: value }, error? }]
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "file:///C:/Users/karlo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const [manifestPath, outPath] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
const results = [];

for (const item of manifest) {
  try {
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    // A flat-shaded render is not a photograph; Auto could treat it as stylized art and normalize it.
    await page.getByRole("button", { name: "Photo", exact: true }).click();
    await page.locator('input[type="file"]').nth(0).setInputFiles(item.png);
    await page.getByRole("button", { name: "Analyze face" }).click();
    await page.waitForFunction(() => Boolean(window.faceForge?.analysis), null, { timeout: 60_000 });
    const sliders = await page.evaluate(async ({ hph, sex }) => {
      const m = await import("/src/domain/faceAnalysis.ts");
      const groups = m.generateEfmSliders(window.faceForge.analysis, null, null, sex, false, "none", hph);
      return Object.fromEntries(groups.flatMap((g) => g.sliders.map((s) => [s.name, s.value])));
    }, { hph: item.hph, sex: item.sex });
    results.push({ id: item.id, found: true, sliders });
  } catch (error) {
    // A detector miss is a result, not a skipped row: the report counts it.
    results.push({ id: item.id, found: false, sliders: {}, error: String(error).slice(0, 200) });
  }
  console.log(`${item.id}: ${results.at(-1).found ? "ok" : "MISS"}`);
}
await browser.close();
await writeFile(outPath, JSON.stringify(results, null, 1));
