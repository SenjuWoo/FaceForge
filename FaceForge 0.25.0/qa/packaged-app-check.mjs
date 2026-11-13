// Checks the packaged EXE itself, not the dev bundle: the interface loads, a photo analyses, the page
// cannot open a network connection, and the window cannot be navigated away.
//
// Start the released EXE with the WebView2 debugging port open first (qa/PACKAGED-APP-EXPORT.md):
//   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222'
//   Start-Process <extracted>/FaceForge-<version>-STANDALONE.exe
// then: node qa/packaged-app-check.mjs
// It needs an installed Skyrim to index, so it is a release step on a modded machine, not a CI job.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const photo = path.join(root, "qa", "synthetic-neutral-portrait.png");
const { chromium } = createRequire(new URL("../src/FaceForge.Web/package.json", import.meta.url))("playwright");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts()[0].pages()[0];
await page.waitForLoadState("domcontentloaded");
const result = { url: page.url(), title: await page.title() };

// 1. The page cannot reach the usage logger's endpoint (page policy + host filter).
result.outboundBlocked = await page.evaluate(async () => {
  try {
    await fetch("https://odml.pa.googleapis.com/v1/log", { method: "POST", body: "probe" });
    return false;
  } catch {
    return true;
  }
});
// 2. An image request to another host is answered by the host filter, not the network.
result.foreignImageBlocked = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(false);
      image.onerror = () => resolve(true);
      image.src = "https://www.google.com/favicon.ico?faceforge-probe";
    })
);
// 3. Wait for the automatic index, then analyse a photo: proves the model and WASM still load.
await page.waitForFunction(() => /indexed .* source mods|not detected/i.test(document.body.innerText), null, { timeout: 240000 });
await page.locator('input[type="file"]').nth(0).setInputFiles(photo);
await page.getByRole("button", { name: /^Analyze face$/i }).click();
await page.waitForFunction(() => /Status:\s*Ready/.test(document.body.innerText), null, { timeout: 120000 });
result.analysed = true;
result.statusText = (await page.evaluate(() => document.body.innerText.match(/Analysis complete[^\n]*/)?.[0])) ?? null;
// 4. The window refuses to navigate away from the embedded interface.
await page.evaluate(() => { window.location.href = "https://example.com/"; });
await page.waitForTimeout(2500);
result.urlAfterNavigationAttempt = page.url();
result.navigationBlocked = result.urlAfterNavigationAttempt.startsWith("https://app.faceforge/");
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!result.outboundBlocked || !result.foreignImageBlocked || !result.analysed || !result.navigationBlocked) {
  throw new Error("Packaged-app check failed.");
}
