import { describe, it, expect } from "vitest";
import { composeKindGuidance } from "./kind-prompts";

describe("composeKindGuidance", () => {
  it("renders guidance for a known contentType and appends band sizing", () => {
    const out = composeKindGuidance("QUIZ", "EARLY_ELEMENTARY");
    expect(out).toContain("answer key");
    expect(out).toContain("few items"); // EARLY sizing note
  });

  it("returns base guidance without a band note when no band is given", () => {
    const out = composeKindGuidance("RUBRIC", null);
    expect(out).toContain("performance levels");
    expect(out).not.toContain("few items");
  });

  it("returns empty for an unknown or absent contentType", () => {
    expect(composeKindGuidance("HAXX", "MIDDLE")).toBe("");
    expect(composeKindGuidance(null, "MIDDLE")).toBe("");
  });
});
