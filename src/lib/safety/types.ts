import { z } from "zod";

export type SafetyResolution =
    | "NO_ACTION"
    | "PARENT_SUMMARY_SAFETY_COACH"
    | "PARENT_SUMMARY_URGENT"
    | "SUPPORTIVE_ONLY"
    | "STUDENT_OPTIONAL_OUTREACH"
    | "INTERNAL_LOG_ONLY";

/**
 * Single source of truth for the detector's output shape. `SafetyAssessment` is derived from this
 * schema via `z.infer` so the type can never drift from what `generateObject` actually validates
 * (Q-12-013 b — was a hand-maintained interface). guard.ts imports `safetySchema` for the LLM
 * deep-path; policy.ts and safety-scan.ts consume the inferred `SafetyAssessment` type. Kept here
 * (not guard.ts) so importing the contract does not pull in the AI SDK — policy.test.ts stays hermetic.
 */
export const safetySchema = z.object({
    isSafe: z.boolean(),
    severity: z.enum(["CONCERN", "DANGER", "SAFE", "TIER_1", "TIER_2", "TIER_3"]),
    category: z.enum(["BULLYING", "SELF_HARM", "GROOMING", "VIOLENCE", "SEXUAL_CONTENT", "INCEST", "BYPASS_ATTEMPT", "OTHER", "NONE"]),
    implicatedCaregiver: z.boolean().describe("Whether a parent, guardian, or teacher is the source of the threat."),
    reasoning: z.string(),

    // Nuance fields
    evidenceLevel: z.enum(["THOUGHT", "INTENT", "PLAN", "ACTION", "VICTIM_DISCLOSURE"]),
    target: z.enum(["SELF", "OTHER_CHILD", "ADULT", "UNKNOWN"]),
    relationshipToTarget: z.enum(["SIBLING", "STEP_SIBLING", "PEER", "ADULT_AUTHORITY", "ONLINE_STRANGER", "OTHER"]),
    coercion: z.enum(["NONE", "POSSIBLE", "LIKELY", "CONFESSED"]),
    ageGap: z.enum(["UNKNOWN", "SIMILAR", "OLDER_OTHER", "OLDER_SELF"]),
    disclosureRisk: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("HIGH if notifying parents increases risk (fear of retaliation/shame)."),
});

export type SafetyAssessment = z.infer<typeof safetySchema>;
