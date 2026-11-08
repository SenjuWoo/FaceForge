// Builds a .jslot per photo with the real TS export path: dense-fit sliders + skin-tone tint + hair colour.
//
//   node make_presets.mjs [--out <dir>] [--url http://127.0.0.1:5173/]
//
// Needs the Vite dev server (default 5173) and the BenchHost results already on disk
// (out/photos.manifest.json, out/photos.dense.json, out/photos.colors.json). Paths resolve from this
// file so the snapshot can move, and Playwright comes from the web project's dev dependency.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const requireFromWeb = createRequire(new URL("../../src/FaceForge.Web/package.json", import.meta.url));
const { chromium } = requireFromWeb("playwright");

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const at = argv.indexOf(flag);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const O = path.resolve(argOf("--out", path.join(HERE, "out"))) + path.sep;
const URL_BASE = argOf("--url", "http://127.0.0.1:5173/");
const manifest = JSON.parse(await readFile(O + "photos.manifest.json", "utf8"));
const fits = Object.fromEntries(JSON.parse(await readFile(O + "photos.dense.json", "utf8")).map((r) => [r.id, r.sliders]));
const colors = JSON.parse(await readFile(O + "photos.colors.json", "utf8"));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(URL_BASE, { waitUntil: "networkidle" });
const summary = {};
for (const m of manifest) {
  const c = colors[m.id];
  const { text, tint } = await page.evaluate(async ({ sliders, c, sex }) => {
    const rm = await import("/src/domain/racemenu.ts");
    const pc = await import("/src/domain/photoColors.ts");
    const appearance = {
      skin: c.skin && c.skin.confidence >= 0.3 ? c.skin.color : null,
      hair: c.hair && c.hair.confidence >= 0.3 ? c.hair.color : null
    };
    const doc = rm.buildRaceMenuPreset(rm.createFreshRaceMenuTemplate(), sliders, false, [], { highPolyHead: true, targetSex: sex, appearance });
    const tintRgb = c.skin ? pc.skinToneTint(c.skin.color) : null;
    return { text: rm.serializeRaceMenuPreset(doc), tint: tintRgb };
  }, { sliders: fits[m.id], c, sex: m.sex });
  await writeFile(O + `photos/${m.id}.jslot`, text);
  const doc = JSON.parse(text);
  summary[m.id] = { tintInfo: doc.tintInfo, hairColor: doc.actor.hairColor, tintRgb: tint, sliders: doc.morphs.custom.length };
}
await browser.close();
await writeFile(O + "photos.presets.json", JSON.stringify({ summary }, null, 1));
for (const [id, s] of Object.entries(summary)) console.log(id, JSON.stringify(s.tintRgb), "tint uint", s.tintInfo?.[0]?.color, "hair", s.hairColor, "sliders", s.sliders);
