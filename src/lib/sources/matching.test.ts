import { describe, it, expect } from "vitest";

import { normalize, authorLastName, scoreTitleAuthor } from "./matching";

/**
 * Shape-lock for the shared fuzzy matcher (Q-13-002). gutenberg.ts was converged onto these helpers
 * (it previously carried byte-identical private copies + a bespoke `scoreMatch`), so a future
 * "simplification" of `scoreTitleAuthor` that drops the 3-char containment floor, the either-direction
 * containment, or the author-surname reject would silently change matching for EVERY adapter. These
 * tests fail if any of those load-bearing invariants regress. (First unit test for the sources layer.)
 */

describe("normalize", () => {
    it("lowercases, strips punctuation, and collapses whitespace", () => {
        expect(normalize("Moby-Dick; Or, The Whale")).toBe("moby dick or the whale");
    });

    it("is null-safe (returns empty string for nullish input)", () => {
        expect(normalize(null as unknown as string)).toBe("");
        expect(normalize("")).toBe("");
    });
});

describe("authorLastName", () => {
    it('extracts the surname from "Last, First"', () => {
        expect(authorLastName("Melville, Herman")).toBe("melville");
    });

    it('extracts the surname from "First Last"', () => {
        expect(authorLastName("Herman Melville")).toBe("melville");
    });

    it("is null-safe", () => {
        expect(authorLastName("")).toBe("");
        expect(authorLastName(null as unknown as string)).toBe("");
    });
});

describe("scoreTitleAuthor", () => {
    it("scores an exact normalized-title match (no author) at 2", () => {
        expect(scoreTitleAuthor("Moby Dick", [], "moby dick", null)).toBe(2);
    });

    it("accepts subtitle containment but scores it below an exact match", () => {
        const contained = scoreTitleAuthor("Moby Dick; Or, The Whale", [], "moby dick", null);
        expect(contained).not.toBeNull();
        expect(contained!).toBeLessThan(2); // length penalty pushes a sprawling title below the bare title
    });

    it("rejects a sub-3-char title overlap (the containment floor)", () => {
        expect(scoreTitleAuthor("ab", [], "ab", null)).toBeNull();
    });

    it("rejects a non-matching title", () => {
        expect(scoreTitleAuthor("War and Peace", [], "moby dick", null)).toBeNull();
    });

    it("rejects when an author was requested but no surname matches (wrong-author guard)", () => {
        expect(scoreTitleAuthor("Moby Dick", ["Jane Austen"], "moby dick", "melville")).toBeNull();
    });

    it("adds a point when the requested author surname is present", () => {
        expect(scoreTitleAuthor("Moby Dick", ["Herman Melville"], "moby dick", "melville")).toBe(3);
    });

    it("matches the Gutendex author shape the gutenberg adapter feeds it", () => {
        // gutenberg.ts:scoreMatch maps each Gutendex `{ name: "Last, First" }` to its name string,
        // then delegates here — so the catalog's "Melville, Herman" must satisfy a "melville" request.
        const gutendexAuthors = [{ name: "Melville, Herman" }]
            .map((a) => (a && typeof a.name === "string" ? a.name : ""))
            .filter(Boolean);
        expect(scoreTitleAuthor("Moby Dick", gutendexAuthors, "moby dick", "melville")).toBe(3);
    });
});
