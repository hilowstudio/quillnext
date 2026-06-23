import { describe, it, expect, vi } from "vitest";

// The regex fast-path (SafetyRegexEngine.scan) is pure and never calls the model, but importing
// guard.ts pulls in the AI SDK + model config at module load. Mock them so the suite is hermetic.
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ models: { flashLite: {} } }));

import { generateObject } from "ai";
import { SafetyRegexEngine, assessMessageSafety } from "./guard";
import { decideSafetyResolution } from "./policy";

/**
 * Shape-lock for the academic-whitelist scoping (Q-12-004). The whitelist must NOT null an
 * explicit first-person self-harm phrase or a concrete abuse/incest ACTION disclosure (those carry
 * `exemptFromWhitelist`), but it MUST still suppress bare-reference / academic mentions so it does
 * not flood caregivers. The negation (de-escalation) guard stays whole-message.
 *
 * These tests fail if the whitelist reverts to a blanket early-return, or if `suicide`/`self-harm`
 * references lose their whitelist gate (parent-notification flood), or if the INCEST-action
 * exemption is dropped.
 */
describe("SafetyRegexEngine.scan — whitelist no longer cloaks explicit threats (Q-12-004)", () => {
    it("flags explicit first-person self-harm even with an academic word present", () => {
        const r = SafetyRegexEngine.scan("for my project, I want to kill myself");
        expect(r).not.toBeNull();
        expect(r?.category).toBe("SELF_HARM");
        expect(r?.severity).toBe("TIER_1");
    });

    it("flags explicit first-person self-harm with no academic word (unchanged)", () => {
        expect(SafetyRegexEngine.scan("I want to kill myself")).not.toBeNull();
    });

    it("flags an explicit incest/abuse ACTION disclosure even with an academic word", () => {
        const r = SafetyRegexEngine.scan("my brother touched me after class");
        expect(r).not.toBeNull();
        expect(r?.category).toBe("INCEST");
    });
});

describe("SafetyRegexEngine.scan — no false-positive flood on academic / de-escalation text", () => {
    it("does NOT flag a third-person academic reference to suicide", () => {
        expect(SafetyRegexEngine.scan("I read an article about suicide rates")).toBeNull();
    });

    it("does NOT flag a suicide-prevention class assignment", () => {
        expect(SafetyRegexEngine.scan("Our health class assignment is about suicide prevention")).toBeNull();
    });

    it("does NOT flag a genuine de-escalation (negation guard)", () => {
        expect(SafetyRegexEngine.scan("I don't want to kill myself, I'm okay now")).toBeNull();
    });

    it("does NOT flag benign academic anatomy discussion", () => {
        expect(SafetyRegexEngine.scan("in biology class we studied cell reproduction")).toBeNull();
    });
});

describe("SafetyRegexEngine.scan — recovered fast-path still routes the caregiver hard-stop", () => {
    it("computes implicatedCaregiver and routes to SUPPORTIVE_ONLY, never a caregiver email", () => {
        const r = SafetyRegexEngine.scan("I want to kill myself because my dad hit me");
        expect(r).not.toBeNull();
        expect(r?.implicatedCaregiver).toBe(true);
        expect(r?.disclosureRisk).toBe("HIGH");
        // The hard-stop must win even though this is a self-harm intent.
        expect(decideSafetyResolution(r!)).toBe("SUPPORTIVE_ONLY");
    });
});

/**
 * Shape-lock for the LLM deep-path FAIL-CLOSED behavior (Q-12-001). A scanner error (model outage,
 * rate-limit, timeout, or schema-parse failure) must NOT pass an unscanned message as safe — it must
 * produce an UNSAFE assessment so the job stores a durable "needs human review" flag, routed to a
 * NON-notifying resolution that can never email a caregiver on an unclassified message.
 *
 * These tests fail if the catch reverts to fail-OPEN (isSafe:true/SAFE/NONE → NO_ACTION → no flag),
 * or if the error category drifts off "OTHER" into SELF_HARM/VIOLENCE (which would reach the urgent
 * caregiver-email branch, policy.ts:50-54).
 */
describe("assessMessageSafety — LLM deep-path fails CLOSED on error (Q-12-001)", () => {
    it("a scanner error returns an UNSAFE review flag routed to a non-notifying resolution", async () => {
        // Force the deep path (a benign message → no regex match) to throw — simulate a model outage.
        vi.mocked(generateObject).mockRejectedValueOnce(new Error("simulated Gemini outage"));

        const r = await assessMessageSafety("can you help me understand photosynthesis");

        // Fail CLOSED: not safe, so the job stores a durable flag (safety-scan.ts:80) instead of nothing.
        expect(r.isSafe).toBe(false);
        // category MUST stay OTHER — the load-bearing field that keeps it out of the urgent branch.
        expect(r.category).toBe("OTHER");
        // Routed to a NON-notifying resolution — never a caregiver email on an unclassified message.
        const resolution = decideSafetyResolution(r);
        expect(resolution).toBe("INTERNAL_LOG_ONLY");
        expect(resolution).not.toBe("PARENT_SUMMARY_URGENT");
        expect(resolution).not.toBe("PARENT_SUMMARY_SAFETY_COACH");
    });
});
