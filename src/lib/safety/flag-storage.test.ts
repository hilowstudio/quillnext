import { describe, it, expect } from "vitest";
import { buildStoredFlagContent } from "./flag-storage";
import { SafetyAssessment } from "./types";

/**
 * Shape-lock for SafetyFlag data minimization on caregiver hard-stops (Q-12-009). SafetyFlag rows are
 * org-readable, so when the caregiver is implicated OR the child fears disclosure, the child's raw
 * disclosure must NOT be persisted where that caregiver could later read it. We store
 * category/severity/evidence only — redacting the message snippet AND the content-bearing reasoning,
 * while ALWAYS keeping the [EVIDENCE:LEVEL] tag (load-bearing for future pattern escalation).
 *
 * These tests fail if a hard-stop flag persists the raw snippet/reasoning, or if the evidence tag is
 * dropped (which would break pattern escalation), or if a normal flag loses its snippet.
 */
const base: SafetyAssessment = {
    isSafe: false,
    severity: "TIER_1",
    category: "SELF_HARM",
    implicatedCaregiver: false,
    reasoning: "placeholder",
    evidenceLevel: "ACTION",
    target: "SELF",
    relationshipToTarget: "OTHER",
    coercion: "NONE",
    ageGap: "UNKNOWN",
    disclosureRisk: "LOW",
};
const make = (o: Partial<SafetyAssessment>): SafetyAssessment => ({ ...base, ...o });

describe("buildStoredFlagContent — data minimization for hard-stop flags (Q-12-009)", () => {
    it("keeps the snippet + reasoning for a normal (non-hard-stop) flag", () => {
        const r = buildStoredFlagContent(
            "I want to hurt myself badly",
            make({ evidenceLevel: "ACTION", reasoning: "self-harm behavior" }),
        );
        expect(r.message).toContain("I want to hurt myself");
        expect(r.reasoning).toBe("[EVIDENCE:ACTION] self-harm behavior");
    });

    it("redacts snippet AND reasoning for a caregiver-implicated flag, keeping the evidence tag", () => {
        const r = buildStoredFlagContent(
            "my dad hits me every night",
            make({ implicatedCaregiver: true, evidenceLevel: "VICTIM_DISCLOSURE", reasoning: "father is abusive" }),
        );
        expect(r.message).not.toContain("dad");
        expect(r.message).not.toContain("hits");
        expect(r.reasoning).not.toContain("father");
        expect(r.reasoning).toContain("[EVIDENCE:VICTIM_DISCLOSURE]");
    });

    it("redacts when the child fears disclosure (disclosureRisk HIGH) even without an implicated caregiver", () => {
        const r = buildStoredFlagContent(
            "please don't tell my mom, she will kick me out",
            make({ disclosureRisk: "HIGH", evidenceLevel: "VICTIM_DISCLOSURE", reasoning: "fear of disclosure" }),
        );
        expect(r.message).not.toContain("mom");
        expect(r.reasoning).toContain("[EVIDENCE:VICTIM_DISCLOSURE]");
        expect(r.reasoning).not.toContain("fear of disclosure");
    });

    it("truncates a long snippet to 100 chars + ellipsis for a normal flag", () => {
        const long = "a".repeat(250);
        const r = buildStoredFlagContent(long, make({}));
        expect(r.message).toBe("a".repeat(100) + "...");
    });
});
