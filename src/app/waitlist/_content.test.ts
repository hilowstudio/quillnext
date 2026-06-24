import { describe, it, expect } from "vitest";
import * as content from "./_content";
import { features } from "./_content";

/**
 * Voice-lint guard. The landing copy follows the owner's two personas, which share one hard rulebook.
 * This test fails the build if a banned word or an em dash slips into `_content.ts`, so the page can't
 * silently drift back into AI-slop. Mirrors the spirit of `checkVoiceViolations` in the hi-low repo.
 */

// Union of the two personas' banned lexicon (Calm Integrator + Reformed Theological Mind).
const BANNED_WORDS = [
    "delve",
    "explore",
    "navigate",
    "foster",
    "enhance",
    "leverage",
    "transformative",
    "robust",
    "comprehensive",
    "pivotal",
    "dynamic",
    "intricacies",
    "nuances",
    "journey",
    "unpack",
];

const BANNED_TRANSITIONS = [
    "furthermore",
    "moreover",
    "in addition",
    "additionally",
    "it is important to note",
    "in conclusion",
    "in summary",
];

function collectStrings(value: unknown, out: string[]): void {
    if (typeof value === "string") {
        out.push(value);
    } else if (Array.isArray(value)) {
        for (const v of value) collectStrings(v, out);
    } else if (value && typeof value === "object") {
        for (const v of Object.values(value)) collectStrings(v, out);
    }
}

const allCopy = (() => {
    const out: string[] = [];
    collectStrings(content, out);
    return out.join("\n");
})();

describe("waitlist copy — voice guardrails", () => {
    it("never uses an em dash (the absolute rule in both personas)", () => {
        expect(allCopy).not.toContain("—");
    });

    it.each(BANNED_WORDS)("never uses the banned word %s", (word) => {
        const regex = new RegExp(`\\b${word}\\b`, "i");
        expect(regex.test(allCopy)).toBe(false);
    });

    it.each(BANNED_TRANSITIONS)("never uses the AI transition %s", (phrase) => {
        expect(allCopy.toLowerCase()).not.toContain(phrase);
    });
});

describe("waitlist copy — structure", () => {
    it("has eight pain-point feature sections", () => {
        expect(features).toHaveLength(8);
    });

    it("every feature has a headline, a body, and at least two Q&A", () => {
        for (const f of features) {
            expect(f.headline.length).toBeGreaterThan(0);
            expect(f.body.length).toBeGreaterThan(0);
            expect(f.faqs.length).toBeGreaterThanOrEqual(2);
            for (const faq of f.faqs) {
                expect(faq.q.length).toBeGreaterThan(0);
                expect(faq.a.length).toBeGreaterThan(0);
            }
        }
    });

    it("uses unique feature ids", () => {
        const ids = features.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
