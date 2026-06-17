# Spec — Grounded, Source-Driven Curriculum Generation

> Status: design (2026-06-17). Synthesis of the book/video extraction work + the
> generation-quality problems surfaced by the first real "Literary Form Study Guide"
> (misquotes, garbled questions, internal inconsistency). This spec makes generation
> **grounded in stored, source-derived facts** instead of the model's lossy memory.

## 1. The problem

AI generation today writes from the model's training memory in one long single pass,
with no verification and no *text-level* grounding. For a canonical book (*The Hobbit*)
that's ~95% right with a few corruptions — a misquoted line ("escapes and escapes" for
"adventures and escapes"), a garbled comprehension question, "two chests of gold" vs.
"silver and gold" in different sections. For a **niche book the model has never seen,
the same machinery confabulates**: invented characters, fabricated quotes, plausible-but-
wrong plot. The stored extraction gives metadata (TOC, themes, summary) but not the
book's text, so quotes and fine plot detail are exactly where it breaks worst.

## 2. Principles (the invariants)

1. **Ground once, store, reuse.** Do the expensive grounding at *extraction* time and
   store it. Generation **reads** the store; it does not re-search the web per
   generation. Re-searching is non-deterministic (recreates inconsistency), slow, and
   expensive. Live search at generation is a *fallback only* (thin coverage), and it
   writes back to the store.
2. **Hierarchical facts.** Book-level facts + **chapter/section-level** facts. Small
   contexts per extraction pass → the model never loses its way in a giant blob, and
   generation (usually chapter/unit-scoped) reads only the relevant slice.
3. **The book drives; the spine is the floor; the spine enriches on match, never gates.**
   - No book → the academic spine scaffolds the course (existing capability).
   - Book in the Living Library → the book's TOC/sections become the course spine; a
     parent says "we're on Ch. 4" and generation is scoped to **what Ch. 4 covers**.
   - Each section **semantically cross-walks** to spine objectives: a match enriches
     (standards, prerequisites, related objectives, progress tracking); no match still
     generates fully from the book's own facts. The spine never blocks a book.
4. **Quote / expression discipline (enforced at OUTPUT, not corpus).** A quote may only
   appear if traceable to a stored source.
   - **Public-domain literature** → verbatim quotes from the actual text are desirable.
   - **In-copyright textbooks** → *ground the concepts, author original activities.*
     Retrieve to learn what a section covers; generate NEW explanations/problems. Never
     reproduce the source's specific exercises, figures, or long passages verbatim.
   - The model is **never** allowed to assert a quote from memory.
5. **Graceful coverage tiers.** TOC (always) → web-grounded section facts → full-text
   RAG (when an open source has it). Thin coverage → generate less and *say so*; never
   confabulate to fill a template.
6. **Fair-use posture.** We *read/RAG/transform*, we do not redistribute source text, and
   output is supplementary (complements, doesn't substitute for the book). Fair use sits
   on top of license terms (Authors Guild v. Google / HathiTrust), so the corpus needs
   **no license gate**; the only legal guardrail is the output-expression rule (#4),
   enforced by the verification pass.

## 3. Data model

Reuses the global/cross-org-shared + `CONTEXT_FREE_MODELS` + pgvector pattern already
built for `book_extractions` and `video_extraction_chunks` (see migrations 0004/0005).

- **`book_extractions`** (exists) — book-level facts. Add: `workType` enum
  {LITERATURE, TEXTBOOK, OTHER}, `publicDomain` bool, `sourceName`/`sourceId`/
  `textQuality` (provenance), and structured `characters` / `settings` / `keyFacts` Json
  (the canonical "facts sheet" spine).
- **`book_extraction_sections`** (NEW, global) — one row per chapter/section:
  `bookExtractionId`, `sectionNumber`, `title`, `kind` {CHAPTER, UNIT, SECTION},
  `summary`, `keyPoints` Json (events for lit / concepts for textbooks),
  `charactersPresent` Json, `vocabulary` Json, `quotes` Json `[{text, location, source}]`,
  `factsSource` enum {TEXT, WEB, MODEL}.
- **`book_text_chunks`** (NEW, global) — full text for **public-domain / open** works
  only: `bookExtractionId`, `sectionNumber`, `chunkIndex`, `content`, `embedding vector`.
  Mirrors `video_extraction_chunks` exactly (CONTEXT_FREE, USING(true) RLS, raw
  `$N::vector` writes, 300/50 chunker, gemini-embedding-2 @1536).
- **`book_section_objectives`** (NEW join) — section ↔ spine objective cross-walk:
  `sectionId`, `objectiveId`, `confidence`. Sections with NO high-confidence match are
  recorded in **`spine_gaps`** (`bookExtractionId`, `sectionId`, `topicGuess`) — the
  running backlog of what real curricula teach that the spine lacks (the flywheel).
- **`doctrine_chunks`** (NEW, global) — the worldview/doctrinal corpus (Monergism etc.):
  `framework` (e.g. "reformed"), `topic`, `subtopic`, `content`, `sourceUrl`, `author`,
  `embedding vector`. Pre-built per framework, not per-user.

## 4. Source registry

A `SourceRegistry` abstraction (code config, not necessarily a table): each source is
`{ id, track, priority, qualityScore, formats, licenseNote, adapter }`. The adapter
interface: `discover(query) -> candidates[]` and `fetch(id) -> { text, format, quality,
provenance }`. Try best-first; record provenance; dedup by work identity. **No
`commercially_usable` gate** (see Principle #6) — license is informational only.

**Track A — Literature full text (ranked):**
1. **Standard Ebooks** — best quality (hand-proofed EPUB), curated subset.
2. **Project Gutenberg** via **Gutendex** JSON API — largest catalog, clean plain text.
3. **Wikisource** — community transcriptions, chapter-structured, API.
4. **Internet Archive** — huge coverage incl. rare works, but **OCR quality varies** →
   low priority; tag chunks `ocr:true` so the verification pass distrusts their quotes.
5. **HathiTrust / Google Books / Open Library** — primarily *identity/disambiguation*
   (right work/edition), then fetch text from 1–3.

**Track B — Open textbooks (per-book, objective-cross-walked):**
OpenStax, LibreTexts (per-title structure varies), CK-12, Siyavula, plus aggregators
(OER Commons, Open Textbook Library, MERLOT, BCcampus). Per-source adapters; section
facts schema = concepts/objectives/worked-examples. Used as RAG grounding only.

**Track C — Doctrinal / worldview corpus (per-framework):**
- **Monergism** (`monergism.com`) for **Reformed** — two ingestible layers:
  1. **eBook Library author index** (`/1100-free-ebooks-listed-alphabetically-author`) —
     a **bounded ~1,400-book full-text corpus**, listed `Author [Title](book page)`; each
     book page links ePub/Mobi/PDF. Authors are classic Reformed/Puritan theologians
     (Adams, Alexander, Calvin, Owen, the Puritans) → **overwhelmingly public domain**, so
     full text is freely usable. A one-time bounded ingest, not an open crawl. This is the
     primary Track-C seed.
  2. **Topical directory** — hundreds of topics → subtopics with a Format filter; deep
     primary sources (Westminster Assembly: 130 items, the Standards, Schaff). Topic-
     indexed, maps onto worldview themes (providence, covetousness/anthropology, vocation,
     creeds) → use for **topic tagging** of the ebook chunks.
  **403s plain fetchers → respectful scraper (Firecrawl works); respect robots.txt +
  rate-limit; skip audio/video.**
- Extensible: a Catholic blueprint → Catechism/Church Fathers corpus; classical-Christian
  → its own; selected by the family blueprint's theological framework.

## 5. Ingestion pipelines

**Literature / textbook (on book-add, background, idempotent — extends `extract-book`):**
1. Identify the work; web-ground metadata + **TOC** (always — the floor).
2. Try the Track A/B source cascade for full text.
3. **If text:** strip boilerplate → chapter-segment (regex heuristics **aligned to the
   grounded TOC**) → chunk+embed into `book_text_chunks` (tagged by `sectionNumber`) →
   derive `book_extraction_sections` **from the real text**, incl. **verbatim quotes** →
   cross-walk sections to spine objectives → store.
4. **If no text:** derive section facts from web grounding (chapter summaries from
   reputable study sources) → store with `factsSource = WEB`, **no verbatim quotes** for
   in-copyright works.
5. Cross-walk every section → spine; record misses in `spine_gaps`.

**Doctrine corpus (per-framework, one-time bounded ingest, not per-user):** parse the
Monergism eBook Library author index (~1,400 entries) → for each book page fetch the
ePub/PDF full text → chunk+embed into `doctrine_chunks` tagged `{framework:"reformed",
author, title, topic}` (topic from the book's Monergism topic tags). Most are public
domain → full text freely usable. The topical directory is a secondary tagging layer.

## 6. Generation flow (the read path)

1. **Scope:** book present? which section is the child on? (no book → spine scope.)
2. **Load** the section facts sheet + book-level facts from the store.
3. **Enrich:** if the section maps to spine objectives, pull standards / prerequisites /
   related objectives.
4. **Retrieve (RAG):** relevant `book_text_chunks` scoped to the section (for grounded
   detail/quotes), + `doctrine_chunks` scoped to the worldview topic **and the family's
   framework** (so worldview integration is grounded in real primary sources, not the
   model's memory of, e.g., Reformed theology).
5. **Facts-first generation:** establish the canonical facts object, then generate each
   output section *constrained to it* (kills cross-section inconsistency).
6. **Quote/expression rule** applied per `workType` (Principle #4).
7. **Verification pass** (Section 7).
8. **Coverage signaling:** thin facts → less specific output + an honest note.

## 7. The verification pass (the highest-leverage, ships first)

A second model call that audits the draft against `{section facts, retrieved chunks}` and
flags + revises: (a) internal contradictions; (b) every direct quotation as
*unverifiable unless it matches a retrieved source string* (PD: must match the text;
in-copyright: drop or replace with a "[Parent: insert a line about …]" placeholder);
(c) malformed/garbled questions; (d) claims unsupported by the provided context;
(e) for textbooks, any output that reproduces the source's *expression* (its specific
exercises/figures/long passages) rather than original supplementary material. Output:
corrected draft + a QA report.

## 8. Build sequence (independently shippable)

- **Phase 1 — Generator hardening (no schema change; helps EVERY book immediately):**
  verification pass + grounded-only quote rule + facts-first generation structure in
  `generate-resource-core.ts` / the content-type prompts. This alone fixes the misquote,
  garbled-question, and inconsistency classes seen in the Hobbit guide.
- **Phase 2 — Hierarchical facts + book-drives:** `book_extraction_sections` +
  section-level (web-grounded) extraction + chapter-scoped generation + section↔objective
  cross-walk + `spine_gaps` capture.
- **Phase 3 — Source registry + full-text RAG:** ranked literature/textbook source
  cascade + `book_text_chunks` + RAG retrieval. Unlocks **verbatim quotes + real plot/
  concept accuracy** for the public-domain/open majority.
- **Phase 4 — Doctrinal/worldview corpus:** Monergism (Reformed) ingestion +
  worldview-layer grounding keyed to the family blueprint; extensible to other traditions.

Each phase composes on the same chunk/RAG substrate and the shared cross-org catalog.
