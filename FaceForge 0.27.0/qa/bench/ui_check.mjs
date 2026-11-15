// Loads the app in a browser, analyses one photo and screenshots the result. node ui_check.mjs <png> <out.png>
// Playwright is resolved from the web project, which already depends on it.
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../../src/FaceForge.Web/package.json", import.meta.url))("playwright");
const [png, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("XNNPACK")) errors.push(m.text()); });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Photo", exact: true }).click();
await page.locator('input[type="file"]').nth(0).setInputFiles(png);
await page.getByRole("button", { name: "Analyze face" }).click();
await page.waitForFunction(() => Boolean(window.faceForge?.analysis), null, { timeout: 60_000 });
await page.getByText("Apply photo colours").waitFor({ timeout: 30_000 });
await page.getByText("Apply photo colours").scrollIntoViewIfNeeded();
await page.screenshot({ path: out });
const swatches = await page.locator(".color-swatch").evaluateAll((els) => els.map((e) => ({ label: e.textContent, color: e.querySelector(".swatch").style.background })));
console.log(JSON.stringify({ swatches, errors }));
await browser.close();
