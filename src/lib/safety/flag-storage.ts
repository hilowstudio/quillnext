import { SafetyAssessment } from "./types";
import { isCaregiverHardStop } from "./policy";

export interface StoredFlagContent {
    message: string;
    reasoning: string;
}

/**
 * Builds the persisted `message` snippet + `reasoning` for a SafetyFlag, applying data minimization
 * for caregiver hard-stop flags (Q-12-009).
 *
 * SafetyFlag rows are org-readable, so when the caregiver is implicated OR the child fears disclosure
 * we must NOT persist the child's raw disclosure where that caregiver could later read it. For those
 * flags we store category/severity/evidence only — redacting both the message snippet and the
 * content-bearing reasoning. The `[EVIDENCE:LEVEL]` tag is ALWAYS kept: future scans parse it from the
 * stored reasoning for pattern escalation (safety-scan.ts), and the level alone carries no disclosure.
 *
 * Normal (non-hard-stop) flags keep the 100-char snippet + the assessment reasoning — those can still
 * drive a caregiver summary email, and the caregiver is not the implicated party.
 *
 * This is the app-layer half of Q-12-009. The full fix is a separate access-restricted store (schema).
 */
export function buildStoredFlagContent(message: string, assessment: SafetyAssessment): StoredFlagContent {
    const evidenceTag = `[EVIDENCE:${assessment.evidenceLevel}]`;

    if (isCaregiverHardStop(assessment)) {
        return {
            message: "[redacted — caregiver hard-stop]",
            reasoning: `${evidenceTag} [redacted — caregiver hard-stop]`,
        };
    }

    const snippet = message.substring(0, 100) + (message.length > 100 ? "..." : "");
    return {
        message: snippet,
        reasoning: `${evidenceTag} ${assessment.reasoning}`,
    };
}
