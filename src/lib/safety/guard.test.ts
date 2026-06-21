import { describe, it, expect, vi } from "vitest";

// The regex fast-path (SafetyRegexEngine.scan) is pure and never calls the model, but importing
// guard.ts pulls in the AI SDK + model config at module load. Mock them so the suite is hermetic.
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ models: { flashLite: {} } }));

import { SafetyRegexEngine } from "./guard";
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
