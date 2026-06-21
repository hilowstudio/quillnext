export type SafetyResolution =
    | "NO_ACTION"
    | "PARENT_SUMMARY_SAFETY_COACH"
    | "PARENT_SUMMARY_URGENT"
    | "SUPPORTIVE_ONLY"
    | "STUDENT_OPTIONAL_OUTREACH"
    | "INTERNAL_LOG_ONLY";

export interface SafetyAssessment {
    isSafe: boolean;
    severity: "CONCERN" | "DANGER" | "SAFE" | "TIER_1" | "TIER_2" | "TIER_3";
    category: "BULLYING" | "SELF_HARM" | "GROOMING" | "VIOLENCE" | "SEXUAL_CONTENT" | "INCEST" | "BYPASS_ATTEMPT" | "OTHER" | "NONE";
    implicatedCaregiver: boolean;
    reasoning: string;

    // New Nuance Fields
    evidenceLevel: "THOUGHT" | "INTENT" | "PLAN" | "ACTION" | "VICTIM_DISCLOSURE";
    target: "SELF" | "OTHER_CHILD" | "ADULT" | "UNKNOWN";
    relationshipToTarget: "SIBLING" | "STEP_SIBLING" | "PEER" | "ADULT_AUTHORITY" | "ONLINE_STRANGER" | "OTHER";
    coercion: "NONE" | "POSSIBLE" | "LIKELY" | "CONFESSED";
    ageGap: "UNKNOWN" | "SIMILAR" | "OLDER_OTHER" | "OLDER_SELF";
    disclosureRisk: "LOW" | "MEDIUM" | "HIGH";
}
