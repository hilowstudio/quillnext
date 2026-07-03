import { describe, it, expect } from "vitest";
import { CONSTITUTION, MORAL_FLOOR, FAITH_GUARDRAILS, EPISTEMICS } from "./constitution";
import { FAITH_PROMPTS, composeFaithFrame, composeFamilyProfile } from "./faith-traditions";

describe("constitution", () => {
  it("assembles the four non-negotiable blocks", () => {
    for (const tag of ["<frame>", "<epistemics>", "<moral_floor>", "<guardrails>"]) {
      expect(CONSTITUTION).toContain(tag);
    }
  });

  it("carries the load-bearing non-negotiables", () => {
    expect(MORAL_FLOOR.toLowerCase()).toContain("abortion");
    expect(MORAL_FLOOR).toContain("never as morally neutral");
    expect(FAITH_GUARDRAILS).toContain("Westboro");
    expect(EPISTEMICS).toContain("INFERENCE");
  });
});

describe("FAITH_PROMPTS", () => {
  it("maps every tradition to a non-empty block (Record<FaithBackground> is total at compile time)", () => {
    for (const [key, block] of Object.entries(FAITH_PROMPTS)) {
      expect(block, key).toBeTruthy();
      expect(block.length, key).toBeGreaterThan(20);
    }
  });

  it("PROTESTANT and OTHER_PROTESTANT share the generic Protestant block", () => {
    expect(FAITH_PROMPTS.PROTESTANT).toBe(FAITH_PROMPTS.OTHER_PROTESTANT);
  });

  it("Orthodox jurisdictions extend the Eastern Orthodox base with a heritage line", () => {
    expect(FAITH_PROMPTS.GREEK_ORTHODOX).toContain("Greek patristic");
    expect(FAITH_PROMPTS.GREEK_ORTHODOX).toContain("theosis"); // the shared base
    expect(FAITH_PROMPTS.RUSSIAN_ORTHODOX).toContain("Julian calendar");
  });
});

describe("composeFaithFrame", () => {
  it("always includes the constitution, even with no faith set", () => {
    const frame = composeFaithFrame(null);
    expect(frame).toContain("<constitution>");
    expect(frame).not.toContain("<family_profile>");
  });

  it("wraps the family's tradition block in a family_profile", () => {
    const frame = composeFaithFrame("BAPTIST");
    expect(frame).toContain("<constitution>");
    expect(frame).toContain('<tradition name="BAPTIST">');
    expect(frame).toContain("believer's baptism by immersion");
  });

  it("composeFamilyProfile is empty when no faith is set", () => {
    expect(composeFamilyProfile(null)).toBe("");
  });
});
