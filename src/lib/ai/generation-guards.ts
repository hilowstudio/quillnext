import { generateText, generateObject } from "ai";

/**
 * Grounded-generation guards (Phase 1 of docs/specs/grounded-generation.md).
 *
 * These helpers make generation treat the available source facts as authoritative
 * "canonical facts", forbid unverifiable verbatim quotes, and run a best-effort
 * verify/revise pass that fixes contradictions, garbled questions, and ungrounded
 * quotes BEFORE the resource is stored. No DB schema change; helps every source.
 *
 * IMPORTANT: the verify functions are intentionally defensive — they NEVER throw.
 * On any error they return the original draft unchanged so generation never fails
 * because the (optional) verification step hiccuped. They also run OUTSIDE the
 * tenant-stamped withTenant DB write (they are pure AI calls, no DB access).
 */

/**
 * Prompt fragment injected into generation: the model does not have the full source
 * text, so it must never present invented/paraphrased text as a verbatim quotation.
 */
export const QUOTE_GROUNDING_RULE: string = `QUOTE GROUNDING RULE (mandatory):
You do NOT have the full source text. Do NOT include any verbatim quotation presented as being from the work. If a quotation would help, insert a placeholder like "[Parent: insert a quote from <chapter/section> about <topic>]". Never present invented or paraphrased text inside quotation marks as a direct quote. Prefer paraphrase + citation of the chapter/section.`;

/**
 * Variant of the quote rule used when the prompt ALSO carries a "VERIFIED SOURCE EXCERPTS"
 * block (Phase 3 RAG grounding). Here verbatim quotation IS allowed — but ONLY when copied
 * EXACTLY from those excerpts, and always with a chapter/section attribution. Anything not
 * present in the excerpts must be paraphrased + cited, never dressed up as a direct quote.
 */
export const QUOTE_GROUNDING_RULE_WITH_SOURCE: string = `QUOTE GROUNDING RULE (mandatory):
Verbatim quotation is allowed ONLY when copied EXACTLY (word-for-word) from the "VERIFIED SOURCE EXCERPTS" provided in this prompt, and ONLY with a chapter/section attribution. You must NEVER quote anything that does not appear in those excerpts — do not quote from memory, and do not present invented or paraphrased text inside quotation marks as a direct quote. For any point not covered by the excerpts, paraphrase and cite the chapter/section instead of quoting. When in doubt, paraphrase.`;

/**
 * For OPEN TEXTBOOK sources (OpenStax, etc.): the excerpts ground the FACTS, but the model must
 * teach in its own words — GROUND-don't-echo. No verbatim reproduction of textbook prose (copying a
 * textbook is pedagogically wrong, and we generate our own material). The caller runs the verify
 * pass WITHOUT an allowedQuoteSource, so any verbatim quote is stripped.
 */
export const QUOTE_GROUNDING_RULE_TEXTBOOK: string = `QUOTE GROUNDING RULE (mandatory):
The "VERIFIED SOURCE EXCERPTS" below are from an OPEN TEXTBOOK and are provided for FACTUAL GROUNDING ONLY. Use them so every fact, definition, and explanation is accurate, but TEACH THE CONTENT IN YOUR OWN WORDS — do NOT reproduce the textbook's sentences verbatim, and do NOT present copied or invented text inside quotation marks as a direct quote. Paraphrase and explain throughout; never echo the textbook's wording.`;

/**
 * Compactly render an unknown table-of-contents value (string, array, or object)
 * into a short human-readable string. Returns "" if there is nothing useful.
 */
function renderTableOfContents(toc: unknown): string {
    if (toc == null) return "";
    if (typeof toc === "string") return toc.trim();
    try {
        if (Array.isArray(toc)) {
            const parts = toc
                .map((entry) => {
                    if (entry == null) return "";
                    if (typeof entry === "string" || typeof entry === "number") return String(entry);
                    if (typeof entry === "object") {
                        const e = entry as Record<string, unknown>;
                        const title = e.title ?? e.name ?? e.label ?? e.heading ?? e.chapter;
                        if (title != null) return String(title);
                    }
                    return "";
                })
                .map((s) => s.trim())
                .filter(Boolean);
            if (parts.length === 0) return "";
            return parts.map((p) => `- ${p}`).join("\n");
        }
        if (typeof toc === "object") {
            // Fall back to a compact JSON rendering, trimmed so it cannot blow up the prompt.
            const json = JSON.stringify(toc);
            return json.length > 2000 ? `${json.slice(0, 2000)}…` : json;
        }
        return String(toc);
    } catch {
        return "";
    }
}

/**
 * Build a clearly-delimited "CANONICAL FACTS" block from whatever source fields are
 * present. Returns "" when there is essentially nothing to ground against (no title,
 * summary, table of contents, or extra context).
 */
export function buildCanonicalFactsBlock(facts: {
    sourceKind: string;
    title?: string | null;
    authors?: string[] | null;
    summary?: string | null;
    tableOfContents?: unknown;
    themes?: string[] | null;
    readingLevel?: string | null;
    extra?: string | null;
}): string {
    const title = facts.title?.trim() || "";
    const summary = facts.summary?.trim() || "";
    const extra = facts.extra?.trim() || "";
    const toc = renderTableOfContents(facts.tableOfContents);
    const authors = (facts.authors || []).map((a) => (a ?? "").toString().trim()).filter(Boolean);
    const themes = (facts.themes || []).map((t) => (t ?? "").toString().trim()).filter(Boolean);
    const readingLevel = facts.readingLevel?.trim() || "";

    // Nothing meaningful to ground against → no block.
    if (!title && !summary && !toc && !extra) return "";

    const lines: string[] = [];
    lines.push("CANONICAL FACTS (authoritative source material — treat as ground truth; do NOT contradict):");
    if (facts.sourceKind) lines.push(`- Source type: ${facts.sourceKind}`);
    if (title) lines.push(`- Title: ${title}`);
    if (authors.length > 0) lines.push(`- Author(s): ${authors.join(", ")}`);
    if (readingLevel) lines.push(`- Reading level: ${readingLevel}`);
    if (themes.length > 0) lines.push(`- Themes: ${themes.join(", ")}`);
    if (toc) lines.push(`- Table of contents:\n${toc}`);
    if (summary) lines.push(`- Summary: ${summary}`);
    if (extra) lines.push(`- Additional context:\n${extra}`);

    return lines.join("\n");
}

/**
 * Best-effort verify/revise of generated MARKDOWN. Runs ONE generateText call that
 * gives the model the canonical facts + the draft and asks for ONLY the corrected
 * markdown (same structure/headings/formatting/pedagogical intent). NEVER throws —
 * returns the original `draft` unchanged on any error (or empty model output).
 */
export async function verifyAndReviseMarkdown(
    draft: string,
    factsBlock: string,
    model: unknown,
    allowedQuoteSource?: string,
    antiEchoSource?: string,
): Promise<string> {
    if (!draft || !draft.trim()) return draft;
    try {
        // GROUND-DON'T-ECHO backstop (open textbooks): catch verbatim source prose reproduced
        // WITHOUT quotation marks (the quote rule only handles quoted text).
        const antiEcho = antiEchoSource?.trim() || "";
        const antiEchoRule = antiEcho
            ? `\n(d) GROUND-DON'T-ECHO: the draft was written using the SOURCE PROSE below for facts. Rewrite in your OWN WORDS any sentence or passage that reproduces the SOURCE PROSE's wording — even when it is NOT inside quotation marks. The result must teach the concepts without copying the source's sentences.

=== SOURCE PROSE (must NOT be reproduced verbatim) ===
${antiEcho}
=== END SOURCE PROSE ===`
            : "";
        const factsSection = factsBlock?.trim()
            ? `${factsBlock}\n`
            : "(No canonical facts were supplied — still apply the contradiction, quote, and garbled-text checks.)\n";

        // When verified source excerpts are supplied (Phase 3 RAG), KEEP verbatim quotes that
        // appear in them and only flag/replace quotes NOT found there — instead of blanket-removing
        // every quote (the no-source behavior below).
        const allowed = allowedQuoteSource?.trim() || "";
        const quoteRule = allowed
            ? `(b) Verbatim quotations: a block of VERIFIED SOURCE EXCERPTS is provided below. KEEP any direct quote whose text appears EXACTLY (word-for-word) within those excerpts — ensure it has a chapter/section attribution. For any quotation whose text is NOT found verbatim in the excerpts, replace it with a brief paraphrase OR a placeholder like "[Parent: insert a quote from <chapter/section> about <topic>]". Never leave invented or paraphrased text presented as a direct quote inside quotation marks.

=== VERIFIED SOURCE EXCERPTS (the ONLY text that may be quoted verbatim) ===
${allowed}
=== END VERIFIED SOURCE EXCERPTS ===`
            : `(b) Verbatim quotations: the source text is NOT available, so any quotation cannot be verified. Replace each direct quote with a brief paraphrase OR a placeholder like "[Parent: insert a quote from <chapter/section> about <topic>]". Never leave invented or paraphrased text presented as a direct quote inside quotation marks.`;

        const prompt = `You are a careful editor verifying AI-generated educational material BEFORE it is shown to a parent for review.

${factsSection}
=== DRAFT (markdown) ===
${draft}
=== END DRAFT ===

Return ONLY the corrected markdown — preserve the same structure, headings, formatting, and pedagogical intent. Fix the following:
(a) Internal contradictions, and any claim that disagrees with the CANONICAL FACTS above. The canonical facts are ground truth; correct the draft to agree with them.
${quoteRule}
(c) Garbled, malformed, or nonsensical questions or sentences: rewrite them clearly so they make sense.${antiEchoRule}

Do not add commentary, preamble, or explanations. Output ONLY the corrected markdown content.`;

        const { text } = await generateText({ model: model as any, prompt });
        const out = (text || "").trim();
        return out ? out : draft;
    } catch (err) {
        console.error("[generation-guards] verifyAndReviseMarkdown failed — keeping original draft.", err);
        return draft;
    }
}

/**
 * Best-effort verify/revise of a generated STRUCTURED object (quiz / worksheet).
 * Runs ONE generateObject call constrained by the same schema, asking the model to
 * return a corrected object that fixes contradictions, ungrounded quotes, and
 * garbled questions. NEVER throws — returns the original `draft` on any error.
 */
export async function verifyAndReviseObject<T>(
    draft: T,
    schema: import("zod").ZodType<T>,
    factsBlock: string,
    model: unknown,
    allowedQuoteSource?: string,
    antiEchoSource?: string,
): Promise<T> {
    if (draft == null) return draft;
    try {
        // GROUND-DON'T-ECHO backstop (open textbooks): catch verbatim source prose reproduced
        // without quotation marks.
        const antiEcho = antiEchoSource?.trim() || "";
        const antiEchoRule = antiEcho
            ? `\n(d) GROUND-DON'T-ECHO: rewrite in your OWN WORDS any text that reproduces the SOURCE PROSE's wording (even without quotation marks). Teach the concepts without copying the source's sentences.

=== SOURCE PROSE (must NOT be reproduced verbatim) ===
${antiEcho}
=== END SOURCE PROSE ===`
            : "";
        const factsSection = factsBlock?.trim()
            ? `${factsBlock}\n`
            : "(No canonical facts were supplied — still apply the contradiction, quote, and garbled-text checks.)\n";

        const serialized = JSON.stringify(draft, null, 2);

        // When verified source excerpts are supplied (Phase 3 RAG), KEEP verbatim quotes that
        // appear in them and only flag/replace quotes NOT found there — instead of blanket-removing
        // every quote (the no-source behavior below).
        const allowed = allowedQuoteSource?.trim() || "";
        const quoteRule = allowed
            ? `(b) Verbatim quotations: a block of VERIFIED SOURCE EXCERPTS is provided below. KEEP any direct quote whose text appears EXACTLY (word-for-word) within those excerpts — ensure it carries a chapter/section attribution. For any quotation whose text is NOT found verbatim in the excerpts, replace it with a brief paraphrase OR a placeholder like "[Parent: insert a quote from <chapter/section> about <topic>]". Never present invented or paraphrased text as a direct quote.

=== VERIFIED SOURCE EXCERPTS (the ONLY text that may be quoted verbatim) ===
${allowed}
=== END VERIFIED SOURCE EXCERPTS ===`
            : `(b) Verbatim quotations: the source text is NOT available, so any quotation cannot be verified. Replace each direct quote with a brief paraphrase OR a placeholder like "[Parent: insert a quote from <chapter/section> about <topic>]". Never present invented or paraphrased text as a direct quote.`;

        const prompt = `You are a careful editor verifying AI-generated structured educational content (e.g. a quiz or worksheet) BEFORE it is shown to a parent for review.

${factsSection}
=== DRAFT (JSON) ===
${serialized}
=== END DRAFT ===

Return a corrected version of this content that conforms to the required schema. Fix the following:
(a) Internal contradictions, and any claim/question/answer that disagrees with the CANONICAL FACTS above. The canonical facts are ground truth; correct the content to agree with them.
${quoteRule}
(c) Garbled, malformed, or nonsensical questions, answers, options, or sentences: rewrite them clearly so they make sense and remain internally consistent (e.g. the correct answer must still be among the options).${antiEchoRule}

Preserve the overall structure, intent, and number of items where possible. Do not add commentary — return only the corrected structured content.`;

        const { object } = await generateObject({ model: model as any, schema: schema as any, prompt });
        return object as T;
    } catch (err) {
        console.error("[generation-guards] verifyAndReviseObject failed — keeping original draft.", err);
        return draft;
    }
}
