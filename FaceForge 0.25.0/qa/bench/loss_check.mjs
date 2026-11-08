// Is the fit's problem the optimiser or the objective? Scores truth / neutral / one-shot / fit slider
// sets with the fit's own loss against targets read from the truth render. node loss_check.mjs <cases.json> <out.json> <head> [n]
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "file:///C:/Users/karlo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const [casesPath, outPath, head, nArg = "12"] = process.argv.slice(2);
const cases = JSON.parse(await readFile(casesPath, "utf8")).slice(0, Number(nArg));
const sex = head.endsWith("female") ? "female" : "male";
const hph = head.startsWith("hph");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
await page.addInitScript(() => {
  const listeners = new Set();
  window.chrome = { webview: {
    postMessage: (m) => window.__nativePost(m).then((r) => { if (r) for (const l of listeners) l({ data: r }); }),
    addEventListener: (_t, l) => listeners.add(l), removeEventListener: (_t, l) => listeners.delete(l) } };
});
await page.exposeFunction("__nativePost", async (m) => {
  if (m?.type !== "render-heads") return null;
  const r = await fetch("http://127.0.0.1:5199/", { method: "POST", body: JSON.stringify(m) });
  return { type: "heads-rendered", payload: await r.json() };
});
const rows = [];
for (const c of cases) {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Photo", exact: true }).click();
  await page.locator('input[type="file"]').nth(0).setInputFiles(c.png);
  await page.getByRole("button", { name: "Analyze face" }).click();
  await page.waitForFunction(() => Boolean(window.faceForge?.analysis), null, { timeout: 60_000 });
  rows.push(await page.evaluate(async ({ c, sex, hph }) => {
    const fit = await import("/src/domain/fit.ts");
    const fa = await import("/src/domain/faceAnalysis.ts");
    const targets = fit.buildTargetsFromViews([window.faceForge.analysis]);
    const baseline = fa.baselinesForTarget(null, sex, false, "none", hph);
    const meta = { sex, highPoly: hph, race: null };
    const out = { id: c.id };
    for (const name of ["truth", "neutral", "oneshot", "fit"]) {
      out[name] = await fit.scoreSliders({ meta, initial: name === "neutral" ? {} : c[name], targets, baseline });
    }
    return out;
  }, { c, sex, hph }));
  console.log(JSON.stringify(rows.at(-1)));
}
await browser.close();
await writeFile(outPath, JSON.stringify(rows, null, 1));
