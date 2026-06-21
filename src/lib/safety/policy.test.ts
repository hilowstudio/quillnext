import { describe, it, expect } from "vitest";
import { decideSafetyResolution } from "./policy";
import { SafetyAssessment } from "./types";

/**
 * Shape-lock for the urgent-notify routing (Q-12-003). The "must-notify" branch is keyed on
 * (category, evidenceLevel, target) and is INDEPENDENT of the severity label: the classifier is
 * given no severity-vocabulary guidance, so a genuine self-harm/violence concern it happens to
 * label "CONCERN"/"TIER_3" must still escalate, and INTENT-level ideation must reach the urgent
 * path (not a gentle coach email). The caregiver hard-stop must always take precedence.
 *
 * These tests fail if someone re-introduces a severity gate on the urgent branch, drops INTENT,
 * or weakens the hard-stop precedence.
 */
const base: SafetyAssessment = {
    isSafe: false,
    severity: "CONCERN",
    category: "SELF_HARM",
    implicatedCaregiver: false,
    reasoning: "test",
    evidenceLevel: "INTENT",
    target: "SELF",
    relationshipToTarget: "OTHER",
    coercion: "NONE",
    ageGap: "UNKNOWN",
    disclosureRisk: "LOW",
};
const make = (o: Partial<SafetyAssessment>): SafetyAssessment => ({ ...base, ...o });

describe("decideSafetyResolution — severity-label-independent urgent routing (Q-12-003)", () => {
    it("escalates a self-harm INTENT labeled CONCERN to PARENT_SUMMARY_URGENT (the bug fix)", () => {
        // Previously fell through to STUDENT_OPTIONAL_OUTREACH because CONCERN was not TIER_1/TIER_2.
        expect(decideSafetyResolution(make({ severity: "CONCERN", evidenceLevel: "INTENT" }))).toBe(
            "PARENT_SUMMARY_URGENT",
        );
    });

    it("escalates a self-harm INTENT labeled TIER_3 to PARENT_SUMMARY_URGENT", () => {
        expect(decideSafetyResolution(make({ severity: "TIER_3", evidenceLevel: "INTENT" }))).toBe(
            "PARENT_SUMMARY_URGENT",
        );
    });

    it("escalates a self-harm PLAN labeled TIER_1 to PARENT_SUMMARY_URGENT (unchanged)", () => {
        expect(decideSafetyResolution(make({ severity: "TIER_1", evidenceLevel: "PLAN" }))).toBe(
            "PARENT_SUMMARY_URGENT",
        );
    });

    it("escalates a violence INTENT toward another child to PARENT_SUMMARY_URGENT (was a coach email)", () => {
        expect(
            decideSafetyResolution(
                make({ category: "VIOLENCE", target: "OTHER_CHILD", evidenceLevel: "INTENT", severity: "TIER_1" }),
            ),
        ).toBe("PARENT_SUMMARY_URGENT");
    });

    it("does NOT escalate a mere THOUGHT (ideation without intent/plan/action)", () => {
        expect(decideSafetyResolution(make({ severity: "CONCERN", evidenceLevel: "THOUGHT" }))).toBe(
            "STUDENT_OPTIONAL_OUTREACH",
        );
    });
});

describe("decideSafetyResolution — caregiver hard-stop precedence is preserved", () => {
    it("never escalates toward an implicated caregiver, even for a TIER_1 self-harm intent", () => {
        expect(
            decideSafetyResolution(make({ severity: "TIER_1", evidenceLevel: "INTENT", implicatedCaregiver: true })),
        ).toBe("SUPPORTIVE_ONLY");
    });

    it("never escalates when the child fears disclosure (disclosureRisk HIGH)", () => {
        expect(
            decideSafetyResolution(make({ severity: "TIER_1", evidenceLevel: "PLAN", disclosureRisk: "HIGH" })),
        ).toBe("SUPPORTIVE_ONLY");
    });
});

describe("decideSafetyResolution — unrelated branches unchanged", () => {
    it("SAFE → NO_ACTION", () => {
        expect(decideSafetyResolution(make({ isSafe: true, severity: "SAFE", category: "NONE" }))).toBe("NO_ACTION");
    });

    it("sibling INCEST thought → STUDENT_OPTIONAL_OUTREACH (handled by the sibling branch, not urgent)", () => {
        expect(
            decideSafetyResolution(
                make({
                    category: "INCEST",
                    relationshipToTarget: "SIBLING",
                    evidenceLevel: "THOUGHT",
                    target: "OTHER_CHILD",
                    severity: "TIER_1",
                }),
            ),
        ).toBe("STUDENT_OPTIONAL_OUTREACH");
    });
});
