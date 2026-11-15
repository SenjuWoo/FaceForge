import { describe, expect, it } from "vitest";
import { rgbaToUint, skinToneTint } from "./photoColors";
import {
  buildRaceMenuPreset,
  createFreshRaceMenuTemplate,
  parseRaceMenuTemplate,
  sanitizePresetName,
  serializeRaceMenuPreset
} from "./racemenu";

const validTemplate = JSON.stringify({
  actor: { weight: 50, hairColor: 123 },
  modNames: ["Skyrim.esm", "High Poly Head.esm"],
  headParts: [{ type: 1, formIdentifier: "High Poly Head.esm|000A06" }],
  morphs: {
    custom: [
      { name: "EFM_Nose_Width", value: 1.25 },
      { name: "CME_EyesUpDown", value: -0.4 }
    ],
    sculpt: {
      host: "KL\\High Poly Head\\FemaleHeadCharGen.tri",
      vertices: 3832,
      data: [[12, 1, 2, 3]]
    },
    sculptDivisor: 10000
  },
  version: {
    formatVersion: 3,
    runtimeVersion: 17039392,
    signature: 1163086675,
    skseVersion: 33554736
  }
});

describe("RaceMenu template engine", () => {
  it("parses format 3 evidence and dependencies", () => {
    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    expect(template.summary).toMatchObject({
      formatVersion: 3,
      headPartCount: 1,
      customMorphCount: 2,
      hasSculpt: true,
      weight: 50
    });
    expect(template.summary.dependencies).toEqual([
      "Expressive Facegen Morphs.esl",
      "High Poly Head.esm",
      "Skyrim.esm"
    ]);
    expect(template.summary.sculptHostCount).toBe(1);
  });

  it("parses multi-host sculpt arrays and head-part dependencies", () => {
    const document = JSON.parse(validTemplate);
    document.modNames = ["Skyrim.esm"];
    document.headParts.push({
      type: 8,
      formIdentifier: "Exact Brows.esp|000801"
    });
    document.morphs.sculpt = [
      document.morphs.sculpt,
      {
        host: "Actors\\Character\\Character Assets\\EyesFemaleChargen.tri",
        vertices: 176,
        data: []
      }
    ];
    const template = parseRaceMenuTemplate(JSON.stringify(document), "multi.jslot");
    expect(template.summary.sculptHostCount).toBe(2);
    expect(template.summary.sculptHosts).toContain(
      "Actors\\Character\\Character Assets\\EyesFemaleChargen.tri"
    );
    expect(template.summary.dependencies).toContain("Exact Brows.esp");
  });

  it("updates only generated EFM keys, clears sculpt, and clamps to the RaceMenu range", () => {
    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    const output = buildRaceMenuPreset(
      template,
      { EFM_Nose_Width: 3.4567, EFM_Lip_Width: -2, EFM_Jaw_Width: -9.1 },
      false
    );
    const morphs = output.morphs as {
      custom: Array<{ name: string; value: number }>;
      sculpt: unknown;
    };
    expect(morphs.sculpt).toBeNull();
    expect(morphs.custom).toContainEqual({ name: "CME_EyesUpDown", value: -0.4 });
    // Anything past the EFM slider range is truncated rather than written out of bounds; the
    // 0.6.0 packages carried values up to 8.5 and rendered as caricatures in game.
    expect(morphs.custom).toContainEqual({ name: "EFM_Nose_Width", value: 3 });
    expect(morphs.custom).toContainEqual({ name: "EFM_Jaw_Width", value: -3 });
    expect(morphs.custom).toContainEqual({ name: "EFM_Lip_Width", value: -2 });
    expect(output.actor).toEqual({ weight: 50, hairColor: 123 });
  });

  it("declares empty HPH sculpt hosts without inventing vertex deltas", () => {
    const template = createFreshRaceMenuTemplate();
    const output = buildRaceMenuPreset(
      template,
      { EFM_Jaw_Width: 1 },
      false,
      [],
      { highPolyHead: true, targetSex: "female" }
    );
    const morphs = output.morphs as {
      sculpt: Array<{ host: string; vertices: number; data: unknown[] }>;
    };
    expect(Array.isArray(morphs.sculpt)).toBe(true);
    expect(morphs.sculpt.length).toBeGreaterThanOrEqual(1);
    expect(morphs.sculpt[0].host).toContain("High Poly Head");
    expect(morphs.sculpt[0].vertices).toBe(3832);
    // D-004: hosts only — no guessed dx/dy/dz.
    expect(morphs.sculpt[0].data).toEqual([]);
  });

  it("preserves the existing sculpt when selected", () => {
    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    const output = buildRaceMenuPreset(template, { EFM_Jaw_Width: 2 }, true);
    const morphs = output.morphs as { sculpt: { host: string } };
    expect(morphs.sculpt.host).toContain("FemaleHeadCharGen.tri");
  });

  it("rejects wrong format versions and unsupported generated keys", () => {
    expect(() =>
      parseRaceMenuTemplate(
        JSON.stringify({ morphs: {}, version: { formatVersion: 2 } }),
        "old.jslot"
      )
    ).toThrow(/formatVersion 3/);

    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    // A family FaceForge has no established range for.
    expect(() => buildRaceMenuPreset(template, { ZZZ_GuessedKey: 4 }, false)).toThrow(
      /unsupported/
    );
    // An integer type selector: its value picks a numbered vanilla shape, so writing it as a
    // morph would silently swap the nose for whichever one happens to sit at that index.
    expect(() => buildRaceMenuPreset(template, { CME_NoseType: 12 }, false)).toThrow(
      /unsupported/
    );
  });

  it("clamps each family to its own range, not the EFM range", () => {
    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    const output = buildRaceMenuPreset(
      template,
      { EFM_Nose_Width: 5, CME_NoseLength: 5, NSK_MouthWidth: -5 },
      false
    );
    const morphs = output.morphs as { custom: Array<{ name: string; value: number }> };
    expect(morphs.custom).toContainEqual({ name: "EFM_Nose_Width", value: 3 });
    expect(morphs.custom).toContainEqual({ name: "CME_NoseLength", value: 1 });
    expect(morphs.custom).toContainEqual({ name: "NSK_MouthWidth", value: -1 });
  });

  it("rejects malformed and structurally incomplete templates", () => {
    expect(() => parseRaceMenuTemplate("{not json", "broken.jslot")).toThrow(
      /not valid JSON/
    );
    expect(() =>
      parseRaceMenuTemplate(
        JSON.stringify({ version: { formatVersion: 3 } }),
        "missing-morphs.jslot"
      )
    ).toThrow(/morphs/);

    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    expect(() => buildRaceMenuPreset(template, { EFM_Nose_Width: Number.NaN }, false)).toThrow(
      /finite/
    );
  });

  it("serializes valid JSON and sanitizes Windows file names", () => {
    const template = parseRaceMenuTemplate(validTemplate, "Base.jslot");
    const output = buildRaceMenuPreset(template, {}, true);
    expect(() => JSON.parse(serializeRaceMenuPreset(output))).not.toThrow();
    expect(sanitizePresetName('  My:Face*Preset?.jslot  ')).toBe("My_Face_Preset_");
  });

  it("builds a valid photo-first preset without a source JSlot", () => {
    const template = createFreshRaceMenuTemplate(65);
    const output = buildRaceMenuPreset(template, { EFM_Nose_Width: 2.5 }, false);
    expect(template.foundation).toBe("fresh");
    expect(template.summary.dependencies).toContain("Expressive Facegen Morphs.esl");
    expect(output.headParts).toEqual([]);
    expect(output.actor).toEqual({ weight: 65 });
    expect((output.morphs as { custom: unknown[] }).custom).toContainEqual({
      name: "EFM_Nose_Width",
      value: 2.5
    });
    expect(() =>
      parseRaceMenuTemplate(serializeRaceMenuPreset(output), "fresh.jslot")
    ).not.toThrow();
  });

  it("writes exact selected head-part records and their plugin dependencies", () => {
    const output = buildRaceMenuPreset(
      createFreshRaceMenuTemplate(),
      {},
      false,
      [
        { formIdentifier: "TRE_Brows.esp|000D92" },
        { formIdentifier: "Koralina's Eyebrows.esp|000800" }
      ]
    );
    expect(output.headParts).toEqual([
      { formIdentifier: "TRE_Brows.esp|000D92" },
      { formIdentifier: "Koralina's Eyebrows.esp|000800" }
    ]);
    expect(output.modNames).toEqual([
      "Expressive Facegen Morphs.esl",
      "Koralina's Eyebrows.esp",
      "Skyrim.esm",
      "TRE_Brows.esp"
    ]);
  });

  // A RaceMenu preset holds one head part per HDPT type (a real one on this machine carries types
  // 0,1,2,3,4,7 - never the same type twice). Appending beside the template's part would give the game
  // two candidates for one slot.
  it("replaces the template part in the same HDPT slot instead of adding a second one", () => {
    const template = parseRaceMenuTemplate(
      JSON.stringify({
        actor: { weight: 50 },
        modNames: ["Skyrim.esm", "Hair.esp", "Brow.esp"],
        headParts: [
          { formId: 111, formIdentifier: "Hair.esp|000001", type: 3 },
          { formId: 222, formIdentifier: "Brow.esp|000002", type: 6 }
        ],
        morphs: { custom: [], sculpt: null, sculptDivisor: 10000 },
        version: {
          formatVersion: 3,
          runtimeVersion: 17039392,
          signature: 1163086675,
          skseVersion: 33685600
        }
      }),
      "Base.jslot"
    );
    const output = buildRaceMenuPreset(template, {}, false, [
      { formIdentifier: "NewBrow.esp|000003", headPartType: 6 }
    ]);
    expect(output.headParts).toEqual([
      { formId: 111, formIdentifier: "Hair.esp|000001", type: 3 },
      { formIdentifier: "NewBrow.esp|000003", type: 6 }
    ]);
  });

  it("finds the slot of a template part that carries no type", () => {
    const template = parseRaceMenuTemplate(
      JSON.stringify({
        actor: { weight: 50 },
        modNames: ["Skyrim.esm", "Hair.esp"],
        headParts: [{ formIdentifier: "Hair.esp|000001" }],
        morphs: { custom: [], sculpt: null, sculptDivisor: 10000 },
        version: {
          formatVersion: 3,
          runtimeVersion: 17039392,
          signature: 1163086675,
          skseVersion: 33685600
        }
      }),
      "Old.jslot"
    );
    const output = buildRaceMenuPreset(
      template,
      {},
      false,
      [{ formIdentifier: "NewHair.esp|00000A", headPartType: 3 }],
      { headPartTypeOf: (identifier) => (identifier === "Hair.esp|000001" ? 3 : null) }
    );
    expect(output.headParts).toEqual([{ formIdentifier: "NewHair.esp|00000A", type: 3 }]);
  });

  // A part whose HDPT record never resolved has no slot, so RaceMenu cannot apply it. Exporting it
  // anyway would claim an appearance the preset cannot deliver.
  it("refuses an untyped head part when strict slots are requested", () => {
    expect(() =>
      buildRaceMenuPreset(
        createFreshRaceMenuTemplate(),
        {},
        false,
        [{ formIdentifier: "NameOnly.esp|000001" }],
        { strictHeadParts: true }
      )
    ).toThrow(/no known HDPT slot/i);
  });

  it("refuses two selections for one slot when strict slots are requested", () => {
    expect(() =>
      buildRaceMenuPreset(
        createFreshRaceMenuTemplate(),
        {},
        false,
        [
          { formIdentifier: "A.esp|000001", headPartType: 3 },
          { formIdentifier: "B.esp|000002", headPartType: 3 }
        ],
        { strictHeadParts: true }
      )
    ).toThrow(/slot 3/i);
  });
});

describe("photo colours in the preset", () => {
  const B = String.fromCharCode(92);
  const SKIN = ["Actors", "Character", "Character Assets", "TintMasks", "SkinTone.dds"].join(B);
  const LIPS = ["Actors", "Character", "Character Assets", "TintMasks", "FemaleHeadNord_Lips.dds"].join(B);
  const photo = { r: 220, g: 180, b: 160 };

  it("writes a skin-tone tint at index 0 and the hair colour into a fresh preset", () => {
    const out = buildRaceMenuPreset(createFreshRaceMenuTemplate(), {}, false, [], {
      appearance: { skin: photo, hair: { r: 39, g: 38, b: 35 } }
    });
    const tints = out.tintInfo as { color: number; index: number; texture: string }[];
    expect(tints).toHaveLength(1);
    expect(tints[0].index).toBe(0);
    expect(tints[0].texture).toBe(SKIN);
    // alpha 255 (full strength), colour = the point on Skyrim's skin-tone gradient for this photo
    expect(tints[0].color).toBe(rgbaToUint(skinToneTint(photo), 255));
    expect((out.actor as { hairColor: number }).hairColor).toBe(2565667);
  });

  it("recolours the template's own skin-tone layer, keeps its index and its other layers", () => {
    const template = createFreshRaceMenuTemplate();
    template.document.tintInfo = [
      { color: 3157205011, index: 5, texture: SKIN },
      { color: 16777215, index: 6, texture: LIPS }
    ];
    const out = buildRaceMenuPreset(template, {}, false, [], { appearance: { skin: photo } });
    const tints = out.tintInfo as { color: number; index: number }[];
    expect(tints).toHaveLength(2);
    expect(tints[0].index).toBe(5);
    expect(tints[0].color).not.toBe(3157205011);
    expect(tints[1]).toEqual({ color: 16777215, index: 6, texture: LIPS });
  });

  it("leaves tints and hair colour alone when no colours are supplied", () => {
    const template = parseRaceMenuTemplate(validTemplate, "t.jslot");
    const out = buildRaceMenuPreset(template, {}, true);
    expect((out.actor as { hairColor: number }).hairColor).toBe(123);
    expect(out.tintInfo).toBeUndefined();
  });
});
