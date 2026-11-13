import { describe, expect, it } from "vitest";
import type { AppearanceChoice } from "./nativeBridge";
import {
  installHasHighPolyHeadFace,
  filterHeadPartsForTarget,
  isChildHeadPart,
  isHighPolyHeadChoice,
  preferHeadPart,
  rankAppearanceChoices,
  scoreHeadPartPreference
} from "./headPartPreferences";

const choice = (
  partial: Partial<AppearanceChoice> &
    Pick<AppearanceChoice, "category" | "displayName" | "formIdentifier" | "pluginName">
): AppearanceChoice => ({
  editorId: partial.editorId ?? null,
  sourceMod: partial.sourceMod ?? null,
  masters: partial.masters ?? [],
  missingMasters: partial.missingMasters ?? [],
  matchEvidence: partial.matchEvidence ?? "test",
  sex: partial.sex ?? "female",
  playable: partial.playable ?? true,
  validRacesEditorId: partial.validRacesEditorId ?? null,
  validRaces: partial.validRaces ?? ["NordRace"],
  typeFromRecord: partial.typeFromRecord ?? true,
  ...partial
});

describe("head part preferences", () => {
  it("detects High Poly Head face meshes from plugin and source names", () => {
    const hph = choice({
      category: "face",
      displayName: "FemaleHead",
      formIdentifier: "High Poly Head.esm|000A06",
      pluginName: "High Poly Head.esm",
      sourceMod: "High Poly Head"
    });
    const vanilla = choice({
      category: "face",
      displayName: "FemaleHeadNord",
      formIdentifier: "Skyrim.esm|05150F",
      pluginName: "Skyrim.esm",
      sourceMod: "Skyrim base game"
    });
    expect(isHighPolyHeadChoice(hph)).toBe(true);
    expect(isHighPolyHeadChoice(vanilla)).toBe(false);
    expect(installHasHighPolyHeadFace([vanilla, hph])).toBe(true);
    expect(scoreHeadPartPreference(hph)).toBeGreaterThan(scoreHeadPartPreference(vanilla));
  });

  it("prefers High Poly Head over vanilla for the active race and sex", () => {
    const vanilla = choice({
      category: "face",
      displayName: "FemaleHeadNord",
      formIdentifier: "Skyrim.esm|05150F",
      pluginName: "Skyrim.esm",
      sex: "female",
      validRaces: ["NordRace"]
    });
    const hph = choice({
      category: "face",
      displayName: "FemaleHead",
      formIdentifier: "High Poly Head.esm|000A06",
      pluginName: "High Poly Head.esm",
      sourceMod: "High Poly Head SE",
      sex: "female",
      validRaces: ["NordRace", "BretonRace"]
    });
    const maleHph = choice({
      category: "face",
      displayName: "MaleHead",
      formIdentifier: "High Poly Head.esm|000B01",
      pluginName: "High Poly Head.esm",
      sex: "male",
      validRaces: ["NordRace"]
    });
    const preferred = preferHeadPart([vanilla, maleHph, hph], "face", "NordRace", "female");
    expect(preferred?.formIdentifier).toBe("High Poly Head.esm|000A06");
  });

  it("returns null when nothing fits the race/sex filter", () => {
    const onlyMale = choice({
      category: "face",
      displayName: "MaleHead",
      formIdentifier: "High Poly Head.esm|000B01",
      pluginName: "High Poly Head.esm",
      sex: "male",
      validRaces: ["NordRace"]
    });
    expect(preferHeadPart([onlyMale], "face", "NordRace", "female")).toBeNull();
  });
});

describe("ranking the appearance list", () => {
  // The panel cut the list to 80 alphabetically and only then sorted High Poly Head parts first, so
  // on an install with hundreds of hair records an HPH part named after "A..80" never appeared.
  it("puts a preferred High Poly Head part on the list even when it sorts last by name", () => {
    const vanilla = Array.from({ length: 120 }, (_, index) =>
      choice({
        category: "brows",
        displayName: `Brow ${String(index).padStart(3, "0")}`,
        formIdentifier: `Skyrim.esm|${index.toString(16).padStart(6, "0")}`,
        pluginName: "Skyrim.esm"
      })
    );
    const hph = choice({
      category: "brows",
      displayName: "Zz HPH Brows",
      formIdentifier: "High Poly Head.esm|000900",
      pluginName: "High Poly Head.esm"
    });
    const ranked = rankAppearanceChoices([...vanilla, hph], "", "", 80);
    expect(ranked).toHaveLength(80);
    expect(ranked[0].item.formIdentifier).toBe(hph.formIdentifier);
  });

  it("ranks a name that matches the photo target above an equally preferred part", () => {
    const plain = choice({ category: "brows", displayName: "Brow Plain", formIdentifier: "A.esp|1", pluginName: "A.esp" });
    const named = choice({ category: "brows", displayName: "Brow Straight", formIdentifier: "A.esp|2", pluginName: "A.esp" });
    const ranked = rankAppearanceChoices([plain, named], "", "medium-width, mostly straight", 80);
    expect(ranked[0].item.formIdentifier).toBe("A.esp|2");
    expect(ranked[0].nameScore).toBe(1);
  });

  it("filters by the search text across names, plugins and form ids", () => {
    const a = choice({ category: "hair", displayName: "Long", formIdentifier: "KS Hairdos.esp|00A1", pluginName: "KS Hairdos.esp" });
    const b = choice({ category: "hair", displayName: "Short", formIdentifier: "Skyrim.esm|00B2", pluginName: "Skyrim.esm" });
    expect(rankAppearanceChoices([a, b], "hairdos", "", 80).map((r) => r.item)).toEqual([a]);
  });
});

describe("child head parts", () => {
  // Seen on a real install: with their ValidRaces list unresolved, child heads from several mods
  // (MaleHeadChildAltmer, BSKChildHeadElfFemale, HeadArgonianChild) passed the race gate and were
  // offered as the head mesh for an adult character. RaceMenu never offers them to a player.
  const adult = choice({ category: "face", displayName: "FemaleHeadNord", formIdentifier: "Skyrim.esm|1", pluginName: "Skyrim.esm" });
  const children = [
    choice({ category: "face", displayName: "MaleHeadChildAltmer", formIdentifier: "A.esm|2", pluginName: "A.esm", sex: "unflagged", validRaces: [] }),
    choice({ category: "face", displayName: "BSKChildHeadElfFemale", formIdentifier: "B.esm|3", pluginName: "B.esm", validRaces: [] }),
    choice({ category: "face", displayName: "Head", editorId: "HeadArgonianChild", formIdentifier: "C.esm|4", pluginName: "C.esm", validRaces: [] }),
    choice({ category: "hair", displayName: "Braids", validRacesEditorId: "HeadPartsChildRaces", formIdentifier: "D.esm|5", pluginName: "D.esm" })
  ];

  it("recognises child parts by record name, editor id or race list", () => {
    expect(children.every(isChildHeadPart)).toBe(true);
    expect(isChildHeadPart(adult)).toBe(false);
  });

  it("never offers or auto-picks a child part for a character", () => {
    expect(filterHeadPartsForTarget([adult, ...children], "face", "NordRace", "female")).toEqual([adult]);
    expect(preferHeadPart(children, "face", "NordRace", "female")).toBeNull();
  });
});
