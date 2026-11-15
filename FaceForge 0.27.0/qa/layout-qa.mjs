import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Layout gate. 0.24.2 shipped a CSS change that broke every window size and no gate caught it because
// nothing measured the rendered page. This measures the shell at laptop sizes and at Windows scaling,
// and fails when the layout regresses -- it is not a screenshot generator.
const requireFromWeb = createRequire(
  new URL("../src/FaceForge.Web/package.json", import.meta.url)
);
const { chromium } = requireFromWeb("playwright");

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const reportPath = `${root}/qa/layout-qa-report.json`;
const baseUrl = process.env.QA_URL ?? "http://localhost:4173/";

const cases = [
  { label: "1366x768-100", width: 1366, height: 768, scale: 1 },
  { label: "1366x768-125", width: 1366, height: 768, scale: 1.25 },
  { label: "1280x720-100", width: 1280, height: 720, scale: 1 },
  { label: "1536x960-100", width: 1536, height: 960, scale: 1 }
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const item of cases) {
  const page = await browser.newPage({
    viewport: { width: item.width, height: item.height },
    deviceScaleFactor: item.scale
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const measured = await page.evaluate(() => {
    const rootElement = document.getElementById("root");
    const shell = document.querySelector(".app-shell");
    const rail = document.querySelector(".status-rail");
    const footer = document.querySelector(".app-footer") ?? document.querySelector("footer");
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height) };
    };
    return {
      viewport: [window.innerWidth, window.innerHeight],
      rootScrollHeight: rootElement ? rootElement.scrollHeight : null,
      rootClientHeight: rootElement ? rootElement.clientHeight : null,
      shell: rect(shell),
      rail: rect(rail),
      footer: rect(footer),
      panels: [...document.querySelectorAll(".workspace-panel")].map((panel) => rect(panel))
    };
  });

  await page.screenshot({ path: `${root}/qa/layout-${item.label}.png`, fullPage: true });
  await page.close();

  const viewportHeight = measured.viewport[1];
  const failures = [];
  if (!measured.shell) failures.push("app shell missing");
  else if (Math.abs(measured.shell.height - viewportHeight) > 1)
    failures.push(`shell ${measured.shell.height}px does not match viewport ${viewportHeight}px`);
  if (measured.rootScrollHeight !== null && measured.rootClientHeight !== null &&
      measured.rootScrollHeight > measured.rootClientHeight + 1)
    failures.push(`page scrolls (${measured.rootScrollHeight} > ${measured.rootClientHeight})`);
  if (!measured.rail) failures.push("status rail missing");
  else if (measured.rail.bottom > viewportHeight + 1)
    failures.push(`status rail below the viewport (${measured.rail.bottom} > ${viewportHeight})`);
  if (!measured.footer) failures.push("footer missing");
  else if (measured.footer.bottom > viewportHeight + 1)
    failures.push(`footer below the viewport (${measured.footer.bottom} > ${viewportHeight})`);
  if (measured.panels.length !== 3)
    failures.push(`expected 3 workspace panels, found ${measured.panels.length}`);
  else if (measured.panels.some((panel) => !panel || panel.height < 300))
    failures.push(`a workspace panel is shorter than 300px: ${JSON.stringify(measured.panels)}`);
  if (pageErrors.length > 0) failures.push(`page errors: ${pageErrors.join(" | ")}`);

  results.push({ case: item.label, ...measured, pageErrors, failures });
  console.log(`${failures.length === 0 ? "PASS" : "FAIL"} ${item.label} ${failures.join("; ")}`);
}

await browser.close();
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

const failed = results.filter((result) => result.failures.length > 0);
if (failed.length > 0) {
  throw new Error(`Layout QA failed for ${failed.map((result) => result.case).join(", ")}. See ${reportPath}`);
}
