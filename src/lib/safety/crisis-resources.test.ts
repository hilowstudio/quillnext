import { describe, it, expect } from "vitest";
import { CRISIS_RESOURCES, getCrisisResources } from "./crisis-resources";

/**
 * Shape-lock for the verified crisis-resource set (Q-12-007). These are surfaced to children, so the
 * contacts must match the values verified against official sources (2026-06-23) and every entry must
 * be renderable (non-empty name + contact). The category selector must lead with the most relevant
 * resource. If a contact number drifts, this test fails loudly — re-verify before changing it.
 */
describe("crisis-resources — verified set (Q-12-007)", () => {
    const byName = Object.fromEntries(CRISIS_RESOURCES.map((r) => [r.name, r]));

    it("carries the verified core contacts verbatim", () => {
        expect(byName["988 Suicide & Crisis Lifeline"].contact).toContain("988");
        expect(byName["Childhelp National Child Abuse Hotline"].contact).toContain("1-800-422-4453");
        expect(byName["Crisis Text Line"].contact).toContain("741741");
        expect(byName["Military Crisis Line"].contact).toContain("988 then Press 1");
        expect(byName["Emergency services"].contact).toContain("911");
    });

    it("every resource is renderable (non-empty name + contact)", () => {
        for (const r of CRISIS_RESOURCES) {
            expect(r.name.trim().length).toBeGreaterThan(0);
            expect(r.contact.trim().length).toBeGreaterThan(0);
        }
    });

    it("leads with 988 for a self-harm category", () => {
        expect(getCrisisResources("SELF_HARM")[0].name).toContain("988");
    });

    it("leads with Childhelp for an abuse/incest category", () => {
        expect(getCrisisResources("INCEST")[0].name).toContain("Childhelp");
    });

    it("returns the full set (no dupes/drops) regardless of category", () => {
        expect(getCrisisResources("SELF_HARM")).toHaveLength(CRISIS_RESOURCES.length);
        expect(getCrisisResources()).toHaveLength(CRISIS_RESOURCES.length);
        // no resource lost or duplicated by the re-ordering
        expect(new Set(getCrisisResources("INCEST").map((r) => r.name)).size).toBe(CRISIS_RESOURCES.length);
    });
});
