/**
 * Book de-duplication key computation.
 *
 * Produces a stable cross-org dedup key for a book so the same physical title
 * extracted by different orgs maps to a single global `BookExtraction` row.
 *
 * Strategy:
 *   1. Prefer ISBN-13. Strip the supplied ISBN to its significant characters
 *      (digits + a trailing X), accept a valid ISBN-13 as-is, or convert a
 *      valid ISBN-10 -> ISBN-13 (978 prefix + recomputed check digit). When a
 *      valid ISBN-13 results, `dedupKey = "isbn:<isbn13>"`.
 *   2. Otherwise fall back to a normalized title|author slug:
 *      `dedupKey = "slug:<titleAuthorSlug>"`.
 *
 * `titleAuthorSlug` is ALWAYS returned (even when a valid ISBN is present) so
 * callers can persist it for secondary matching / debugging.
 *
 * Pure function. No DB, no React, no external deps.
 *
 * @example
 * // Valid ISBN-10 -> converted to ISBN-13
 * computeDedupKey({ isbn: "0-306-40615-2", title: "Some Book", authors: ["Jane Doe"] });
 * // => {
 * //   dedupKey: "isbn:9780306406157",
 * //   isbn13: "9780306406157",
 * //   titleAuthorSlug: "some book|jane doe",
 * // }
 *
 * @example
 * // No / invalid ISBN -> slug fallback
 * computeDedupKey({ isbn: null, title: "The Great Gatsby!", authors: ["F. Scott Fitzgerald"] });
 * // => {
 * //   dedupKey: "slug:the great gatsby|f scott fitzgerald",
 * //   isbn13: null,
 * //   titleAuthorSlug: "the great gatsby|f scott fitzgerald",
 * // }
 */

export interface ComputeDedupKeyInput {
    isbn?: string | null;
    title: string;
    authors?: string[] | null;
}

export interface ComputeDedupKeyResult {
    dedupKey: string;
    isbn13: string | null;
    titleAuthorSlug: string;
}

/**
 * Strip a raw ISBN string down to its significant characters: ASCII digits and
 * a trailing uppercase X (the ISBN-10 check digit can be 'X' = 10). Hyphens,
 * spaces, and any other noise are removed.
 */
function stripIsbn(raw: string): string {
    return raw.toUpperCase().replace(/[^0-9X]/g, "");
}

/**
 * Validate an ISBN-13 string (exactly 13 digits passing the mod-10 checksum
 * with alternating weights 1 and 3).
 */
function isValidIsbn13(digits: string): boolean {
    if (!/^\d{13}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 13; i++) {
        const d = digits.charCodeAt(i) - 48; // fast parse of '0'-'9'
        sum += i % 2 === 0 ? d : d * 3;
    }
    return sum % 10 === 0;
}

/**
 * Validate an ISBN-10 string (10 chars: 9 digits + a check char that is a digit
 * or 'X', passing the mod-11 weighted checksum).
 */
function isValidIsbn10(value: string): boolean {
    if (!/^\d{9}[0-9X]$/.test(value)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        const ch = value[i];
        const digit = ch === "X" ? 10 : ch.charCodeAt(0) - 48;
        sum += digit * (10 - i);
    }
    return sum % 11 === 0;
}

/**
 * Convert a *valid* ISBN-10 to ISBN-13: drop the ISBN-10 check digit, prepend
 * the "978" prefix, then recompute the ISBN-13 check digit.
 */
function isbn10ToIsbn13(isbn10: string): string {
    const body = "978" + isbn10.slice(0, 9); // 12 digits, no check digit yet
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const d = body.charCodeAt(i) - 48;
        sum += i % 2 === 0 ? d : d * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return body + String(check);
}

/**
 * Resolve a usable ISBN-13 from arbitrary input, or null if none can be derived.
 */
function resolveIsbn13(rawIsbn: string | null | undefined): string | null {
    if (!rawIsbn) return null;
    const stripped = stripIsbn(rawIsbn);

    if (stripped.length === 13) {
        return isValidIsbn13(stripped) ? stripped : null;
    }
    if (stripped.length === 10) {
        if (!isValidIsbn10(stripped)) return null;
        const converted = isbn10ToIsbn13(stripped);
        // Sanity guard: the conversion must itself be a valid ISBN-13.
        return isValidIsbn13(converted) ? converted : null;
    }
    return null;
}

/**
 * Build the normalized `title|firstAuthor` slug:
 *   - lowercased
 *   - all punctuation / non-alphanumeric (except the `|` separator) -> space
 *   - whitespace collapsed to single spaces
 *   - trimmed
 *
 * The `|` between title and author is preserved as a structural separator.
 */
function buildTitleAuthorSlug(title: string, authors?: string[] | null): string {
    const firstAuthor = authors && authors.length > 0 ? authors[0] ?? "" : "";
    return `${title}|${firstAuthor}`
        .toLowerCase()
        // Replace any char that is not a-z, 0-9, or the `|` separator with a space.
        .replace(/[^a-z0-9|]+/g, " ")
        // Collapse whitespace that may surround the separator or runs of spaces.
        .replace(/\s+/g, " ")
        // Tidy spaces directly adjacent to the separator (e.g. "title | author").
        .replace(/\s*\|\s*/g, "|")
        .trim();
}

/**
 * Compute the cross-org dedup key for a book.
 *
 * See module docstring for the full contract and examples.
 */
export function computeDedupKey(input: ComputeDedupKeyInput): ComputeDedupKeyResult {
    const titleAuthorSlug = buildTitleAuthorSlug(input.title, input.authors);
    const isbn13 = resolveIsbn13(input.isbn);

    const dedupKey = isbn13 ? `isbn:${isbn13}` : `slug:${titleAuthorSlug}`;

    return { dedupKey, isbn13, titleAuthorSlug };
}
