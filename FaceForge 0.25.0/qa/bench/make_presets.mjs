// Builds a .jslot per photo with the real TS export path: dense-fit sliders + skin-tone tint + hair colour.
// node make_presets.mjs   (needs vite 5173 and BenchHost 5199; reads out/photos.* produced earlier)
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "file:///C:/Users/karlo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const O = "Z:/Backup/!Skyrim/!Ai modding workspace/FaceForge/FaceForge-main/FaceForge 0.25.0/qa/bench/out/";
const manifest = JSON.parse(await readFile(O + "photos.manifest.json", "utf8"));
const fits = Object.fromEntries(JSON.parse(await readFile(O + "photos.dense.json", "utf8")).map((r) => [r.id, r.sliders]));
const colors = JSON.parse(await readFile(O + "photos.colors.json", "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
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
