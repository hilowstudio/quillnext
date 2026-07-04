import { describe, it, expect } from "vitest";
import {
  gradeBandLabel,
  difficultyLabel,
  gradeLevelToBand,
  gradeStringToBand,
  GRADE_BAND_IDS,
} from "./grade-bands";

describe("grade-bands", () => {
  it("labels known band ids, null otherwise", () => {
    expect(gradeBandLabel("MIDDLE")).toBe("Middle School (6–8)");
    expect(gradeBandLabel("ADULT")).toBe("Adult / General");
    expect(gradeBandLabel("bogus")).toBeNull();
    expect(gradeBandLabel(null)).toBeNull();
    expect(gradeBandLabel(undefined)).toBeNull();
  });

  it("labels difficulty ids", () => {
    expect(difficultyLabel("BELOW")).toBe("below grade level");
    expect(difficultyLabel("AT")).toBe("at grade level");
    expect(difficultyLabel(undefined)).toBeNull();
  });

  it("maps a spine grade level (0=K..12) to a band", () => {
    expect(gradeLevelToBand(0)).toBe("EARLY_ELEMENTARY");
    expect(gradeLevelToBand(2)).toBe("EARLY_ELEMENTARY");
    expect(gradeLevelToBand(3)).toBe("UPPER_ELEMENTARY");
    expect(gradeLevelToBand(6)).toBe("MIDDLE");
    expect(gradeLevelToBand(9)).toBe("HIGH");
    expect(gradeLevelToBand(12)).toBe("HIGH");
    expect(gradeLevelToBand(null)).toBeNull();
    expect(gradeLevelToBand(undefined)).toBeNull();
  });

  it("maps a Learner.currentGrade string to a band", () => {
    expect(gradeStringToBand("Kindergarten")).toBe("EARLY_ELEMENTARY");
    expect(gradeStringToBand("2nd Grade")).toBe("EARLY_ELEMENTARY");
    expect(gradeStringToBand("4th Grade")).toBe("UPPER_ELEMENTARY");
    expect(gradeStringToBand("7th Grade")).toBe("MIDDLE");
    expect(gradeStringToBand("11th Grade")).toBe("HIGH");
    expect(gradeStringToBand(null)).toBeNull();
    expect(gradeStringToBand("Adult")).toBeNull();
  });

  it("exposes exactly the 5 band ids as a non-empty tuple", () => {
    expect(GRADE_BAND_IDS.length).toBe(5);
    expect(GRADE_BAND_IDS).toContain("ADULT");
  });
});
