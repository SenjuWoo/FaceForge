import { describe, expect, it } from "vitest";
import { EFM_FIT_SLIDERS, fitStageVariables } from "./fit";

describe("legacy ratio fit stages", () => {
  const stage = (label: RegExp, available: readonly string[]) =>
    fitStageVariables(available).find((item) => label.test(item.label))?.vars ?? [];

  // The mouth stage matched names by upper-casing them and comparing against "EFM_Oral", which is
  // not upper case, so the mouth-opening sliders were never fitted with the mouth.
  it("fits the mouth-opening sliders in the mouth stage", () => {
    const vars = stage(/^Mouth/, ["EFM_Oral_Width", "EFM_Oral_Height", "EFM_Lip_Width", "EFM_Nose_Width"]);
    expect(vars).toEqual(["EFM_Oral_Width", "EFM_Oral_Height", "EFM_Lip_Width"]);
  });

  it("lists each slider once", () => {
    expect(new Set(EFM_FIT_SLIDERS).size).toBe(EFM_FIT_SLIDERS.length);
  });

  // The eye stage matched "EFM_EYES", which leaves out the eyelid, eyeball, eye-socket and iris
  // sliders -- all of which move the eye measurements that stage answers to.
  it("gives every fitted EFM slider a stage before the final polish", () => {
    const staged = new Set(
      fitStageVariables(EFM_FIT_SLIDERS)
        .filter((item) => item.label !== "Overall polish")
        .flatMap((item) => item.vars)
    );
    const unstaged = EFM_FIT_SLIDERS.filter(
      (name) => !staged.has(name) && name !== "EFM_Cheek_Depth"
    );
    expect(unstaged).toEqual([]);
  });
});
