// Renders truth / one-shot / fit / neutral heads (reshape included) at yaw 0 and 35 through the real
// C# renderer so they can be compared pixel-wise. node image_skill.mjs <cases.json> <outDir> <head>
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "file:///C:/Users/karlo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const [casesPath, outDir, head] = process.argv.slice(2);
const cases = JSON.parse(await readFile(casesPath, "utf8"));
const [, sex] = [0, head.endsWith("male") && !head.endsWith("female") ? "male" : "female"];
const highPoly = head.startsWith("hph");
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
for (const c of cases) {
  const requests = await page.evaluate(async ({ c }) => {
    const { reshapedRenderRequest } = await import("/src/domain/headRender.ts");
    const sets = { truth: c.truth, oneshot: c.oneshot, fit: c.fit, neutral: {} };
    return Object.entries(sets).flatMap(([name, s]) =>
      [0, 35].map((yaw) => reshapedRenderRequest(`${name}_y${yaw}`, s, { yaw })));
  }, { c });
  const response = await fetch("http://127.0.0.1:5199/", {
    method: "POST",
    body: JSON.stringify({ requestId: c.id, sex, highPoly, race: null, size: 512, requests })
  });
  const { images } = await response.json();
  for (const image of images) {
    await writeFile(`${outDir}/${c.id}.${image.id}.png`, Buffer.from(image.dataUrl.split(",")[1], "base64"));
  }
}
await browser.close();
