/**
 * siyavula.ts — the Siyavula adapter for OPEN TEXTBOOKS (South-African CAPS maths & sciences).
 *
 * Siyavula (https://www.siyavula.com) publishes CC BY / CC BY-ND textbooks through a server-rendered
 * reader at /read/za/{subject}/grade-{n}. Unlike OpenStax there is NO JSON content API and no
 * title-search endpoint: the catalog is a small FIXED set of (subject, grade) books, and each book is
 * ASSEMBLED by walking its reader pages:
 *   - reader root:  /read/za/{subject}/grade-{n}            → server-renders the FULL nested TOC, i.e.
 *                                                             every section href /…/{NN}-{chapter}-{MM}
 *   - section page: /read/za/{subject}/grade-{n}/{chapter}/{NN}-{chapter}-{MM}
 *                                                           → server-renders that section's prose
 *
 * This module feeds both textbook paths, mirroring openstax.ts:
 *   - BY-SUBJECT (listSiyavulaBooks/assembleSiyavulaSections): the corpus registry's Siyavula source.
 *   - BY-TITLE   (findOnSiyavula/fetchSiyavulaText): a parent who adds a specific Siyavula book.
 *
 * MATH: Siyavula renders MathJax but keeps the SOURCE LaTeX in <script type="math/tex">. We convert
 * those back to \(…\)/\[…\] and drop the rendered glyph spans — otherwise .text() yields glyph soup
 * and the science/maths sections lose their actual content.
 *
 * Everything NEVER throws — a miss/blip degrades to null/[] so the registry/worker falls through.
 */

import { load } from "cheerio";
import { BROWSER_UA, normalize, scoreTitleAuthor } from "./matching";

const BASE = "https://www.siyavula.com";

// Assembly bounds. Siyavula is an APPLICATION origin (not a static CDN like OpenStax), so keep
// concurrency low and rely on the deadline + cap to stay under the Vercel step ceiling. A partial
// book is fine — grounding degrades gracefully and the downstream chunk cap bounds embedding cost.
const FETCH_CONCURRENCY = 4;
const MAX_SECTIONS = 220;
const ASSEMBLE_DEADLINE_MS = 45_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One assembled section. */
export interface SiyavulaSection {
  title: string | null;
  text: string;
}

/**
 * The FIXED Siyavula open-textbook catalog (za locale). Computer Applications Technology and
 * Information Technology are excluded — they are ePub-only / closed (MTN) copyright, not openly
 * licensed. `externalId` is the reader path after /read/ (stored opaquely as TextbookDocument
 * .externalId). `category` drives the spine cross-walk (→ "Mathematics" / "Science & Nature"); the
 * finer `subject` drives the subject-filtered cosine in retrieveTextbookChunks.
 */
const SIYAVULA_BOOKS: ReadonlyArray<{
  externalId: string;
  title: string;
  subject: string;
  category: string;
}> = [
  ...[7, 8, 9, 10, 11, 12].map((g) => ({
    externalId: `za/mathematics/grade-${g}`,
    title: `Mathematics Grade ${g}`,
    subject: "Mathematics",
    category: "Mathematics",
  })),
  {
    externalId: "za/mathematical-literacy/grade-10",
    title: "Mathematical Literacy Grade 10",
    subject: "Mathematical Literacy",
    category: "Mathematics",
  },
  ...[10, 11, 12].map((g) => ({
    externalId: `za/physical-sciences/grade-${g}`,
    title: `Physical Sciences Grade ${g}`,
    subject: "Physical Sciences",
    category: "Science",
  })),
  ...[7, 8, 9].map((g) => ({
    externalId: `za/natural-sciences/grade-${g}`,
    title: `Natural Sciences Grade ${g}`,
    subject: "Natural Sciences",
    category: "Science",
  })),
  {
    externalId: "za/life-sciences/grade-10",
    title: "Life Sciences Grade 10",
    subject: "Life Sciences",
    category: "Science",
  },
];

/** The corpus catalog (subject/category typed nullable to match the CorpusSource contract). NEVER throws. */
export async function listSiyavulaBooks(): Promise<
  Array<{ externalId: string; title: string; subject: string | null; category: string | null }>
> {
  return SIYAVULA_BOOKS.map((b) => ({ ...b }));
}

/** Resilient HTML GET with light retry + a real browser UA (Siyavula is an app origin). NEVER throws. */
async function fetchHtml(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return await res.text();
    } catch {
      // transient — retry
    }
    if (attempt < 3) await sleep(300 * attempt);
  }
  return null;
}

/**
 * Strip one Siyavula section page to prose. Preserves source LaTeX (the <script type="math/tex">
 * bodies → \(…\)/\[…\]) and drops the rendered MathJax glyph spans, navigation/app chrome, and the
 * interactive practice widgets. The lesson lives in top-level <section class="section"> blocks.
 */
function cleanSiyavulaSection(html: string): SiyavulaSection | null {
  const $ = load(html);

  // 1. Restore source LaTeX from the hidden math/tex scripts BEFORE removing the rendered glyphs.
  $('script[type^="math/tex"]').each((_, el) => {
    const tex = $(el).text().trim();
    const display = ($(el).attr("type") || "").includes("mode=display");
    $(el).replaceWith(tex ? (display ? ` \\[${tex}\\] ` : ` \\(${tex}\\) `) : " ");
  });

  // 2. Drop the rendered MathJax (glyph soup), then non-content: scripts/styles, nav/app chrome,
  //    interactive exercises, figures, and the "(ESXX)" shortcode tags.
  $(".MathJax, .MathJax_Preview, .MathJax_Display, .MathJax_SVG, mjx-container, nobr").remove();
  $(
    "script, style, noscript, nav, .exercises, .interactive_questions, [data-section-exercise-id], figure, img, .shortcode",
  ).remove();

  // 3. The lesson is in <section class="section">; take the OUTERMOST ones (nested subsections come
  //    along in their text) so prose isn't double-counted.
  const tops = $("section.section").filter((_, el) => $(el).parents("section.section").length === 0);
  const container = tops.length > 0 ? tops : $("section.section");
  if (container.length === 0) return null;

  const title =
    $("h1.title, h2.title, h3.title").first().text().replace(/\s+/g, " ").trim() || null;
  const text = container
    .map((_, el) => $(el).text())
    .get()
    .join("\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length > 0 ? { title, text } : null;
}

/**
 * Assemble a Siyavula book's content sections (title + cleaned prose each). Fetches the reader root
 * once to enumerate every section URL (the root server-renders the full TOC), then fetches each
 * section, bounded by a wall-clock deadline, a section cap, and a low concurrency gate. FAIL-SAFE:
 * returns [] if the root can't be loaded or no section yields usable prose. NEVER throws.
 */
export async function assembleSiyavulaSections(externalId: string): Promise<SiyavulaSection[]> {
  try {
    if (!externalId) return [];
    const rootHtml = await fetchHtml(`${BASE}/read/${externalId}`);
    if (!rootHtml) return [];

    // Every section href in the reader root, in document (reading) order, deduped. Skip the
    // image-attributions back-matter chapter (credits, not lesson content).
    const re = new RegExp(`/read/${escapeRegExp(externalId)}/[a-z0-9-]+/[0-9]{2}-[a-z0-9-]+`, "g");
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const m of rootHtml.matchAll(re)) {
      const p = m[0];
      if (seen.has(p) || /\/image-attributions\//.test(p)) continue;
      seen.add(p);
      paths.push(p);
    }
    if (paths.length === 0) return [];

    const capped = paths.slice(0, MAX_SECTIONS);
    const deadline = Date.now() + ASSEMBLE_DEADLINE_MS;

    // Inline concurrency gate (keeps in-flight fetches ≤ max).
    let active = 0;
    const queue: Array<() => void> = [];
    const gate = async <T>(fn: () => Promise<T>): Promise<T> => {
      if (active >= FETCH_CONCURRENCY) await new Promise<void>((res) => queue.push(res));
      active++;
      try {
        return await fn();
      } finally {
        active--;
        queue.shift()?.();
      }
    };

    const results = await Promise.all(
      capped.map((path) =>
        gate(async (): Promise<SiyavulaSection | null> => {
          if (Date.now() > deadline) return null;
          const html = await fetchHtml(`${BASE}${path}`);
          if (!html) return null;
          const sec = cleanSiyavulaSection(html);
          return sec && sec.text.length >= 200 ? sec : null;
        }),
      ),
    );

    return results.filter((s): s is SiyavulaSection => s !== null);
  } catch (error) {
    console.error("[siyavula] assembleSiyavulaSections failed", error);
    return [];
  }
}

// ============================================================================
// BY-TITLE registry adapter (findOnSiyavula / fetchSiyavulaText).
// ============================================================================

/**
 * Discover a Siyavula book matching the metadata, by fuzzy title match against the fixed catalog
 * (e.g. "Physical Sciences Grade 10"). Returns the book slug as sourceId and a textUrl carrying it.
 * Returns null for anything not in the catalog (so the registry falls through). NEVER throws.
 */
export async function findOnSiyavula(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<{ sourceId: string; textUrl: string } | null> {
  try {
    const want = normalize(meta?.title ?? "");
    if (!want) return null;
    let best: { slug: string; score: number } | null = null;
    for (const b of SIYAVULA_BOOKS) {
      const score = scoreTitleAuthor(b.title, [], want, null);
      if (score !== null && (!best || score > best.score)) best = { slug: b.externalId, score };
    }
    if (!best) return null;
    return { sourceId: best.slug, textUrl: `${BASE}/read/${best.slug}#sv=${best.slug}` };
  } catch (error) {
    console.error("[siyavula] findOnSiyavula failed", error);
    return null;
  }
}

/**
 * Fetch + assemble the full text of a Siyavula book from a textUrl carrying its slug (#sv=…).
 * Concatenates the cleaned sections (each prefixed with its title). Returns null on a missing slug,
 * an empty assembly, or any error. NEVER throws.
 */
export async function fetchSiyavulaText(textUrl: string): Promise<string | null> {
  try {
    if (!textUrl || typeof textUrl !== "string") return null;
    const m = textUrl.match(/#sv=(.+)$/);
    if (!m) return null;
    const sections = await assembleSiyavulaSections(m[1]);
    if (sections.length === 0) return null;
    const text = sections
      .map((s) => (s.title ? `${s.title}\n\n${s.text}` : s.text))
      .join("\n\n")
      .trim();
    return text.length > 200 ? text : null;
  } catch (error) {
    console.error("[siyavula] fetchSiyavulaText failed", error);
    return null;
  }
}
