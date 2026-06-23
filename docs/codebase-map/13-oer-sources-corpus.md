# 13 — OER Source Adapters & External APIs
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role (one line) |
|------|-----------------|
| `src/lib/sources/registry.ts` | BY-TITLE full-text source registry (6 adapters, best-first); discover/fetch split for Inngest steps. |
| `src/lib/sources/corpus-registry.ts` | BY-SUBJECT open-textbook corpus registry (3 adapters); `listBooks`/`assembleSections`. |
| `src/lib/sources/openstax.ts` | OpenStax adapter + shared content core; feeds BOTH by-title and by-subject paths. |
| `src/lib/sources/libretexts.ts` | LibreTexts (MindTouch deki API) corpus adapter; corpus path only (no by-title). |
| `src/lib/sources/siyavula.ts` | Siyavula SA CAPS maths/science adapter; fixed catalog; both paths. |
| `src/lib/sources/gutenberg.ts` | Project Gutenberg by-title adapter via Gutendex JSON API. |
| `src/lib/sources/standard-ebooks.ts` | Standard Ebooks by-title adapter (scrapes search page + single-page reader). |
| `src/lib/sources/internet-archive.ts` | Internet Archive by-title adapter (advancedsearch.php → `_djvu.txt` OCR). |
| `src/lib/sources/wikisource.ts` | Wikisource by-title adapter; assembles a work from its MediaWiki page tree. |
| `src/lib/sources/matching.ts` | Shared pure fuzzy title/author matching helpers + `BROWSER_UA`. |
| `src/lib/sources/text-processing.ts` | Pure text utils: Gutenberg de-boilerplate, chunkText, chapter segmentation. |
| `src/lib/api/google-books.ts` | Google Books volumes API metadata search + ISBN lookup. |
| `src/lib/api/open-library.ts` | OpenLibrary ISBN metadata fallback. |
| `src/lib/api/youtube.ts` | YouTube Data API v3: playlist enumeration + single-video metadata + ISO-8601 duration parse. |
| `src/lib/youtube/transcript.ts` | YouTube caption-track fetch (`youtube-transcript` pkg) + transcript chunker. |
| `src/lib/utils/book-dedup.ts` | Pure cross-org book dedup key (ISBN-13 normalize/convert, else title|author slug). |
| `src/lib/commentary-parser.ts` | Pure Matthew Henry `.HTM` chapter parser → sections + per-verse anchors. |
| `src/lib/bible-books.ts` | Canonical 66-book Protestant book-number → name map + `bookName()`. |

## 2. Purpose / intent

This is the **ingestion source layer** for grounded ("RAG") generation. Three independent product features feed off it:

1. **Full-text book grounding (by title):** a parent adds a book to the Living Library; an Inngest job locates a public-domain full text from one of six OER sources, de-boilerplates it, chunks + embeds it (`registry.ts` + the six adapters + `text-processing.ts`). Literature is quoted; textbooks (OpenStax/Siyavula) are "grounded-don't-echoed" (see `TEXTBOOK_SOURCES`).
2. **Subject-keyed textbook corpus (by subject):** a system job enumerates whole open-textbook catalogs (OpenStax, Siyavula, LibreTexts) and ingests per-section rows keyed to spine subjects (`corpus-registry.ts`).
3. **Metadata / video features:** book metadata lookup for the Library (Google Books + OpenLibrary), YouTube playlist import + per-video metadata + transcript extraction for the shared video-extraction feature.

Plus two discipleship-adjacent helpers: a Matthew Henry commentary HTML parser (seed-time) and a Bible book-name map.

## 3. Architecture & key files

**Two distinct registries (the chapter's core distinction):**

- `registry.ts` — **BY-TITLE**. Resolves ONE named work to ONE concatenated full text. A `TextSource` (registry.ts:64-68) is `{ key, discover(meta)→{sourceId,textUrl}|null, fetch(textUrl)→string|null }`. `SOURCES` (registry.ts:126-133) is ordered best-first: openstax, siyavula, standard-ebooks, gutenberg, wikisource, internet-archive. Public entry points: `discoverAllFullText` (all hits ranked, registry.ts:142), `fetchFullText` (one fetch, registry.ts:167), `fetchFirstAvailable` (fetch-fallback w/ wall-clock budget, registry.ts:189). *(The single-hit `discoverFullText`/`findFullText` convenience wrappers + the `BookTextResult` interface were removed 2026-06-21, Q-13-001 — superseded by the all-hits + fetch-fallback path.)*
- `corpus-registry.ts` — **BY-SUBJECT**. Enumerates a WHOLE catalog and returns per-section rows for bulk ingestion. A `CorpusSource` (corpus-registry.ts:41-47) is `{ key, listBooks()→CorpusBook[], assembleSections(externalId)→CorpusSection[] }`. `CORPUS_SOURCES` (corpus-registry.ts:83) = openstax, siyavula, libretexts. `getCorpusSource(key)` dispatches per-book assembly by stored `TextbookDocument.source`.

`openstax.ts` and `siyavula.ts` are **shared cores** serving both registries (by-title `findOn*`/`fetch*Text` + by-subject `list*Books`/`assemble*Sections`). `libretexts.ts` is corpus-only (no by-title adapter — deliberate, libretexts.ts:23-24, to avoid loading the 5.5 MB catalog on the hot literature path).

**Matching:** `matching.ts` provides `normalize`, `authorLastName`, `scoreTitleAuthor`, and the shared `BROWSER_UA`, imported by **all six** by-title adapters (gutenberg/standard-ebooks/internet-archive/wikisource/siyavula/libretexts). `gutenberg.ts` was **converged onto these shared helpers 2026-06-21** (Q-13-002 — it previously carried byte-identical private copies + a bespoke `scoreMatch`); its `scoreMatch` now delegates to `scoreTitleAuthor`, with only the Gutendex-specific edition ranking (UTF-8 text + `download_count`) kept local in `findOnGutenberg` (gutenberg.ts:197). Matching is deliberately conservative: a wrong full text is worse than none.

**Text processing:** `text-processing.ts` (pure) — `stripGutenbergBoilerplate` (peels `*** START/END ***` wrapper + license tail), `chunkText` (300-word/50-overlap windows), `segmentIntoChapters` (heading detection + optional TOC alignment). `chunkTranscript` (transcript.ts:127) is an **identical copy** of `chunkText` (acknowledged in both files' comments).

**APIs:** `google-books.ts`/`open-library.ts` (book metadata), `youtube.ts` (Data API v3), `transcript.ts` (caption scraping). `book-dedup.ts` computes the cross-org `BookExtraction` dedup key. `commentary-parser.ts`/`bible-books.ts` are the discipleship-adjacent pair.

## 4. Data flow

**By-title full-text ingestion (`ingest-book-fulltext.ts`):**
1. `discoverAllFullText({ title, authors })` (registry.ts:142) → loops `SOURCES` best-first, calls each `source.discover` (registry.ts:151), collects every `{source, sourceId, textUrl}` hit. Called at ingest-book-fulltext.ts:58.
2. `fetchFirstAvailable(discovered, { budgetMs: 40000 })` (registry.ts:189, called at ingest-book-fulltext.ts:83) → iterates candidates in priority order, calls `fetchFullText` (registry.ts:167 → `src.fetch`), returns first usable text within the wall-clock budget.
3. Text → `segmentIntoChapters(text, toc)` (text-processing.ts:174, called ingest-book-fulltext.ts:137) → `chunkText(chapter.text)` (ingest-book-fulltext.ts:142) → embeddings.

**By-subject corpus ingestion (`ingest-textbooks.ts`):**
1. `ingestTextbookCorpus` enumerates `CORPUS_SOURCES`, each book's `listBooks()` upserted with its `source` key.
2. Per-book `ingestTextbook` → `getCorpusSource(source).assembleSections(externalId)` → `chunkText(section.text)` (ingest-textbooks.ts:127) → embeddings. Inngest functions registered at `src/app/api/inngest/route.ts`.

**OpenStax discover/fetch concretely:** `findOnOpenStax` (openstax.ts:306) → `resolveOpenStaxBook` (openstax.ts:140) → `listOpenStaxBooks` (openstax.ts:101, paginated, 6h memo) → returns `{sourceId: cnxId, textUrl: ".../books/{slug}#cnx={cnxId}"}`. `fetchOpenStaxText` (openstax.ts:329) parses `#cnx=` → `assembleOpenStaxSections(cnxId)` (openstax.ts:259) → `resolveArchive` (openstax.ts:183, rejects `retired`) → walks TOC leaves (openstax.ts:206) → fetches each section (concurrency 8, deadline 40s) → `cleanSectionHtml` (openstax.ts:225, cheerio).

**Wikisource (most complex):** `findOnWikisource` (wikisource.ts:279) searches the main namespace, fetches candidate categories to drop "Versions"/disambiguation pages, picks a conservative title match, then VERIFIES the author surname appears on the page (`authorMatchesOnPage`, wikisource.ts:263, fail-closed). `fetchWikisourceText` (wikisource.ts:392) → `assembleWork` (wikisource.ts:211) recursively walks the page tree (MAX_DEPTH 2, MAX_PAGES 300, deadline 30s) and ABORTS (returns "") on any missing page / TOC ambiguity / cap / deadline — never ships a partial book.

**Video flow (`extract-video.ts`):** `fetchVideoMetadata(videoId)` (youtube.ts:130, called extract-video.ts:102) and `fetchYouTubeTranscript(videoId)` (transcript.ts:62, called extract-video.ts:107) → `chunkTranscript(transcript.raw)` (extract-video.ts:193).

**Metadata flow (`library-lookup-actions.ts`):** `lookupGoogleBookByIsbn` (google-books.ts:60) → falls back to `lookupOpenLibraryByIsbn` (open-library.ts:5); free-text → `searchGoogleBooks` (google-books.ts:18).

**Dedup flow:** `computeDedupKey({isbn,title,authors})` (book-dedup.ts:150) called at `src/app/api/library/books/[id]/extract/route.ts:77`.

**Commentary flow (seed-time):** `parseChapterHtml(html, book, chapter)` (commentary-parser.ts:93) called by `prisma/seed-commentary.ts:42` and the `scripts/verse-anchor-prototype.ts` prototype; uses `bookName` (bible-books.ts:19).

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `discoverAllFullText` / `fetchFirstAvailable` | DONE | registry.ts:142,189; wired ingest-book-fulltext.ts:58,83 |
| `fetchFullText` | DONE | registry.ts:167; called internally by `fetchFirstAvailable` |
| `discoverFullText` / `findFullText` (single-hit wrappers) | REMOVED 2026-06-21 | dead-superseded; deleted with the orphaned `BookTextResult` interface (Q-13-001 — see CHANGELOG.md) |
| `TEXTBOOK_SOURCES` | DONE | registry.ts:38; consumed generate-resource-core.ts:473 |
| `CORPUS_SOURCES` / `getCorpusSource` | DONE | corpus-registry.ts:83,86; used ingest-textbooks.ts |
| openstax by-title (`findOnOpenStax`/`fetchOpenStaxText`) | DONE | openstax.ts:306,329; wired via `SOURCES` (registry.ts:80-84,134) |
| openstax by-subject (`listOpenStaxBooks`/`assembleOpenStaxSections`) | DONE | openstax.ts:101,259; via `CORPUS_SOURCES` (corpus-registry.ts:51-61) |
| siyavula (both paths) | DONE | siyavula.ts:91,161,225,250; registry.ts:88, corpus-registry.ts:65 |
| libretexts (`listLibreTextsBooks`/`assembleLibreTextsSections`) | DONE | libretexts.ts:92,221; via corpus-registry.ts:73 |
| gutenberg (`findOnGutenberg`/`fetchGutenbergText`) | DONE | gutenberg.ts:149,224; registry.ts:102 |
| standard-ebooks (`findOnStandardEbooks`/`fetchStandardEbooksText`) | DONE | standard-ebooks.ts:34,106; registry.ts:95 |
| internet-archive (`findOnInternetArchive`/`fetchInternetArchiveText`) | DONE | internet-archive.ts:52,140; registry.ts:122 |
| wikisource (`findOnWikisource`/`fetchWikisourceText`) | DONE | wikisource.ts:279,392; registry.ts:115 |
| matching helpers | DONE | matching.ts; imported by gutenberg/standard-ebooks/internet-archive/wikisource/siyavula/libretexts (gutenberg converged 2026-06-21, Q-13-002) |
| `text-processing` (`stripGutenbergBoilerplate`,`chunkText`,`segmentIntoChapters`) | DONE | text-processing.ts:40,84,174; consumed gutenberg.ts:237, ingest-book-fulltext.ts:137,142, ingest-textbooks.ts:127 |
| `searchGoogleBooks`/`lookupGoogleBookByIsbn` | DONE | google-books.ts:18,60; library-lookup-actions.ts:25,41 |
| `lookupOpenLibraryByIsbn` | DONE | open-library.ts:5; library-lookup-actions.ts:30 |
| `fetchPlaylistData` | DONE | youtube.ts:24; youtube-actions.ts:19 |
| `fetchVideoMetadata` / `parseIso8601Duration` | DONE | youtube.ts:130,104; extract-video.ts:102 |
| `fetchYouTubeTranscript` / `chunkTranscript` | DONE | transcript.ts:62,127; extract-video.ts:107,193 |
| `computeDedupKey` | DONE | book-dedup.ts:150; extract/route.ts:86 |
| `parseChapterHtml` | DONE (seed/proto) | commentary-parser.ts:93; seed-commentary.ts:42, verse-anchor-prototype.ts:34 |
| `enrichSection` / `cleanHtml` (exports) | DONE (internal) | commentary-parser.ts:35,59; exported but only consumed within `parseChapterHtml` — no external importers (Grep) |
| `bookName` / `BOOK_NAMES` | DONE | bible-books.ts:2,19; `bookName` imported by bible-study.ts:14 + commentary-parser.ts:2; `BOOK_NAMES` exported but only consumed internally by `bookName` (bible-books.ts:20) — no external importer (Grep) |
| `scripts/verse-anchor-prototype.ts` (consumer) | EXPERIMENTAL | verse-anchor-prototype.ts; a `scripts/` prototype, not in prod path |

No STUBs found — every adapter has a real fetch/parse body. The single-hit convenience wrappers `discoverFullText` + `findFullText` (formerly the only DEAD units) were **removed 2026-06-21** (Q-13-001); the worker uses the all-hits variants. No DEAD units remain.

## 6. Integration points

**Importers out (consumers):**
- `src/inngest/functions/ingest-book-fulltext.ts` → `registry` (`discoverAllFullText`,`fetchFirstAvailable`), `text-processing` (`segmentIntoChapters`,`chunkText`).
- `src/inngest/functions/ingest-textbooks.ts` → `corpus-registry`, `text-processing.chunkText`.
- `src/inngest/functions/extract-video.ts` → `api/youtube.fetchVideoMetadata`, `youtube/transcript`.
- `src/app/actions/library-lookup-actions.ts` → `api/google-books`, `api/open-library`.
- `src/app/actions/youtube-actions.ts` → `api/youtube.fetchPlaylistData`.
- `src/app/actions/generate-resource-core.ts` → `registry.TEXTBOOK_SOURCES`.
- `src/app/api/library/books/[id]/extract/route.ts` → `utils/book-dedup.computeDedupKey`.
- `src/server/actions/bible-study.ts` → `bible-books.bookName`.
- `prisma/seed-commentary.ts` + `scripts/verse-anchor-prototype.ts` → `commentary-parser.parseChapterHtml`.
- `src/app/api/inngest/route.ts` registers the corpus/book Inngest functions.

**Imports in:** `cheerio` (openstax, libretexts, siyavula, standard-ebooks, wikisource, commentary-parser); `youtube-transcript` (dynamic import, transcript.ts:72). `book-dedup`, `text-processing`, `matching`, `bible-books`, `google-books`, `open-library` are pure/dependency-free (the stale `@/generated/client` Book import in google-books.ts was removed 2026-06-19, Q-13-006).

**External APIs / endpoints:**
- OpenStax CMS `openstax.org/apps/cms/api/v2/pages` + `rex/release.json` + archive contents API (openstax.ts:24-26).
- LibreTexts commons catalog + per-library MindTouch deki API w/ scraped `X-Deki-Token` (libretexts.ts:32, 124-141).
- Siyavula server-rendered reader `siyavula.com/read/...` (siyavula.ts:27).
- Gutendex `gutendex.com/books` + Gutenberg plain-text mirrors (gutenberg.ts:34).
- Standard Ebooks `/ebooks?query=` search + `/text/single-page` (standard-ebooks.ts:24,89).
- Internet Archive `advancedsearch.php` + `download/.../_djvu.txt` (internet-archive.ts:21,124).
- Wikisource MediaWiki `en.wikisource.org/w/api.php` action=parse/query (wikisource.ts:28).
- Google Books `googleapis.com/books/v1/volumes` (google-books.ts:3).
- OpenLibrary `openlibrary.org/api/books` (open-library.ts:3).
- YouTube Data API v3 `googleapis.com/youtube/v3` (youtube.ts:2).

**Env vars:** `YOUTUBE_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` (youtube.ts:131-134; the `NEXT_PUBLIC_` Google Books key implies a client-exposed key — see finding).

**Prisma models used (indirectly via consumers):** `BookExtraction` (`full_text_source`, `dedupKey`), `TextbookDocument` (`source`, `externalId`/`cnx_id`) — see 02-data-model.md. No file in this chapter performs a DB query directly; they are all pure fetch/parse adapters, so there are no direct tenancy predicates to audit here (tenancy is enforced by the consuming Inngest jobs / routes — see 04-security-auth-tenancy.md).

**Inngest jobs:** `ingest-book-fulltext`, `ingest-textbooks`, `extract-video` (consumers, documented in their own chapters).

## 7. Findings

Q-13-001  [LOW]  ✅ REMOVED 2026-06-21 (Session 26) — deleted `discoverFullText` + `findFullText` (dead-as-superseded, not unfinished) plus the orphaned `BookTextResult` interface (its only consumer was `findFullText`); reworded the file header, the `SOURCES`/`discoverAllFullText`/`fetchFullText` comments, and §3's entry-point list to the live all-hits + fetch-fallback API. Adversarially confirmed zero importers repo-wide (scripts/ + tests clean) + zero regression on the live worker path (see CHANGELOG.md). Dead convenience wrappers `discoverFullText` + `findFullText`  — src/lib/sources/registry.ts:148,244
  Evidence: Grep for `findFullText`/`discoverFullText` shows zero importers outside registry.ts; `findFullText` calls `discoverFullText` (registry.ts:248) but nothing calls `findFullText`. The worker uses `discoverAllFullText`/`fetchFirstAvailable` (ingest-book-fulltext.ts:58,83). Docstring says they exist "for scripts/smoke tests" but no such caller exists.
  Impact: Two exported public functions with no live consumers; maintenance/comprehension overhead and risk of drift from the actually-used all-hits path.
  Status: ✅ REMOVED 2026-06-21 (Session 26)

Q-13-002  [LOW]  ✅ RESOLVED 2026-06-21 (Session 26) — gutenberg.ts now imports `normalize`/`authorLastName`/`BROWSER_UA`/`scoreTitleAuthor` from `./matching`; the private copies are deleted and the bespoke `scoreMatch` is a thin adapter that extracts the Gutendex title/author strings and delegates to `scoreTitleAuthor` (logic byte-for-byte identical, adversarially verified). The Gutendex-specific edition ranking (`hasUtf8Text` + `download_count`) was never in `scoreMatch` — it stays in `findOnGutenberg` (gutenberg.ts:197), untouched. Added the sources layer's FIRST unit test (`matching.test.ts`, 12 cases) shape-locking the shared matcher's invariants; corrected the false matching.ts header that listed gutenberg as a consumer (now accurate, all 6 adapters) (see CHANGELOG.md). Duplicated matching + UA helpers in gutenberg.ts diverge from the shared `matching.ts`  — src/lib/sources/gutenberg.ts:37-139
  Evidence: gutenberg.ts defines its own `normalize` (gutenberg.ts:41), `authorLastName` (gutenberg.ts:55), `BROWSER_UA` (gutenberg.ts:37), and a bespoke `scoreMatch` (gutenberg.ts:102) instead of importing `matching.ts` like the five other adapters. matching.ts's header (matching.ts:3) even lists gutenberg.ts as a consumer, but it is not.
  Impact: Logic drift — gutenberg's `scoreMatch` adds a `hasUtf8Text` popularity rank not present in `scoreTitleAuthor`; a future fix to the shared matcher won't reach Gutenberg, and vice-versa.
  Status: ✅ RESOLVED 2026-06-21 (Session 26)

Q-13-003  [INFO]  ✅ RESOLVED 2026-06-19 — chunkTranscript now re-exports chunkText (single impl) (see CHANGELOG.md). `chunkTranscript` and `chunkText` are byte-identical copies  — src/lib/youtube/transcript.ts:127 vs src/lib/sources/text-processing.ts:84
  Evidence: Both implement the same 300-word window / 50 overlap / step 250 / 50-char-min algorithm; both comments explicitly note they are "IDENTICAL" to the other.
  Impact: Duplication; a tweak to chunk granularity must be made in two places or the book and video pipelines silently diverge.
  Status: documented (not fixed)

Q-13-004  [INFO]  ✅ RESOLVED 2026-06-19 — removed NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY fallback at all 3 sites (server-only keys now). OWNER FOLLOW-UP: set server-only GOOGLE_BOOKS_API_KEY in Vercel + delete the NEXT_PUBLIC var (see CHANGELOG.md). `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` used as a server-side fallback implies a client-exposed API key  — src/lib/api/youtube.ts:134
  Evidence: `fetchVideoMetadata` falls back to `process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`; the `NEXT_PUBLIC_` prefix bundles the value into client JS. The same key family is used for YouTube Data API and Google Books.
  Impact: If the `NEXT_PUBLIC_` key is configured, a Google/YouTube API key is shipped to the browser and can be scraped/abused (quota theft). Mitigated only if that var is left unset and a server-only key is preferred. (Secrets/logging category.)
  Status: documented (not fixed)

Q-13-005  [LOW]  (re-graded INFO→LOW 2026-06-19 — owner: keep as a reminder to add a warn-log + harden the deki-token scrape when we reach that stage) LibreTexts deki token is screen-scraped from page HTML; brittle and silently degrades  — src/lib/sources/libretexts.ts:124-141
  Evidence: `libraryToken` regexes `apiToken":"(xhr_…)` out of each library home page (libretexts.ts:134); a markup change yields null → calls proceed token-less and may 403 → `assembleLibreTextsSections` returns [] and the book is marked UNAVAILABLE with no distinct error.
  Impact: A coverage cliff that fails silently (whole-source loss looks identical to "no content"); hard to diagnose without log inspection. (Error handling / external-API fragility.)
  Resolution (Session 26): added a `console.error` at the actual degradation point — `assembleLibreTextsSections`'s `!tree?.page` early-return — naming the bookID and the token/markup/network cause, so the silent cliff is now diagnosable. The adversarial pass OVERRODE the draft's token-scrape warn: a regex-miss in `libraryToken` is benign for the libraries that serve the deki API anonymously (libretexts.ts:16-17), so warning there false-alarms every cache-TTL AND misses downstream API/expiry failures; the book-level log captures all causes and fires once per failed book. LibreTexts is corpus-only (no registry fallthrough), so this is the consequential silent cliff. "Harden the deki-token scrape" left as a low-value future item (the token is defensive insurance; anonymous calls often succeed).
  Status: ✅ RESOLVED 2026-06-21 (Session 26)

Q-13-006  [INFO]  ✅ RESOLVED 2026-06-19 — removed unused Book import in google-books.ts (see CHANGELOG.md). Unused `Book` type import in google-books.ts  — src/lib/api/google-books.ts:1
  Evidence: `import { Book } from "@/generated/client"` is never referenced in the file (the module defines its own `BookMetadata`).
  Impact: Dead import; couples a pure metadata adapter to the generated Prisma client for no reason and can confuse tree-shaking/readers.
  Status: documented (not fixed)

Q-13-007  [LOW]  Several adapters scrape HTML / non-versioned endpoints with no schema guard beyond fail-safe null  — standard-ebooks.ts:61-69, siyavula.ts:138-153, libretexts.ts:134, wikisource.ts:91-107
  Evidence: Standard Ebooks parses search-result `<a href="/ebooks/...">` (standard-ebooks.ts:61), Siyavula keys on `section.section`/`script[type=math/tex]` (siyavula.ts:123,138), Wikisource on `.mw-parser-output` link structure. All are fail-safe (return null/[]), but all silently break on a markup change.
  Impact: These three sources are the curated/quality tiers; a markup change degrades coverage to OCR-only (Internet Archive) or nothing, invisibly. Acceptable by design (fail-safe) but worth tracking as a fragility cluster. (External-API drift.)
  Resolution (Session 26): ✅ ACCEPTED correct-by-design — the fail-safe null IS the appropriate guard for HTML/DOM scraping (a "schema guard"/Zod does not apply to cheerio parsing; "a wrong full text is worse than none" is the deliberate posture). The adversarial pass checked the JSON endpoints (gutendex, libretexts catalog, openstax CMS, deki tree/contents) and confirmed they parse with conservative `typeof`-guarded extraction + degradation — no unguarded JSON trust-boundary hides here. The three by-title scrapers (standard-ebooks/siyavula/wikisource) also have registry-fallthrough masking their silent failures; the one consequential no-fallback cliff (LibreTexts, corpus-only) is now logged via Q-13-005. Nothing actionable beyond observability remains → closes the finding.
  Status: ✅ ACCEPTED (correct-by-design) 2026-06-21 (Session 26)

Q-13-008  [INFO]  ✅ RESOLVED 2026-06-19 — added title guards to the Google Books + OpenLibrary adapters (skip items with no title so BookMetadata.title is never runtime-undefined) (see CHANGELOG.md). Google Books / OpenLibrary metadata adapters use `any` and no response validation  — src/lib/api/google-books.ts:36-52, src/lib/api/open-library.ts:23-31
  Evidence: `data.items.map((item: any) => ...)` (google-books.ts:36) and `bookData.authors?.map((a: any)=>a.name)` (open-library.ts:24) trust the upstream JSON shape with no Zod/guard; `info.title` can be undefined and flows straight into `BookMetadata.title` (typed `string`).
  Impact: Malformed upstream data yields a `BookMetadata` whose non-optional fields are actually undefined at runtime, propagated to the Library UI; no input validation at the trust boundary. (Input validation.)
  Status: documented (not fixed)

Q-13-009  [LOW]  Cross-org extraction dedup fragments across editions of the same work — `src/lib/utils/book-dedup.ts:150`
  Evidence: `computeDedupKey` prefers ISBN-13 (`dedupKey = "isbn:<isbn13>"`, book-dedup.ts:154); only when no valid ISBN resolves does it fall back to the `title|author` slug. Different printings/editions of the same work carry different ISBN-13s, so each yields a DISTINCT `dedupKey` → a separate global `BookExtraction` row (the extract route matches by key, `api/library/books/[id]/extract/route.ts:93` `bookExtraction.findUnique`). Two orgs holding different editions of the same content (e.g. two printings of *1984*) therefore each run — and pay for — the LLM extraction of identical chapter content.
  Impact: Redundant paid LLM extraction + a fragmented community corpus — defeats the "extract once, everyone benefits" dedup premise (the global `BookExtraction` catalog, 02-data-model.md:120). No correctness/tenancy bug; bounded to cross-edition collisions of books that >1 org holds. The proper fix is a content-fingerprint / fuzzy dedup that collapses editions onto one extraction (a FEATURE — see the community-semantic-search roadmap item, 24-status-roadmap-findings.md §5). Graded LOW (known limitation, system is correct, waste is bounded); revisit if extraction volume/cost grows. Minted 2026-06-21 (Session 29) at the owner's request when the ch.14 HIGH session surfaced the community-catalog vision.
  Status: ✅ ACCEPTED — correct-by-design / roadmapped (2026-06-22, consolidated pass / end-of-pass straggler sweep). Re-verified at `book-dedup.ts:154` (`dedupKey = isbn13 ? "isbn:"+isbn13 : "slug:"+titleAuthorSlug`): ISBN-first is the correct STRONG-identity dedup key; collapsing different editions onto a single extraction needs a content-fingerprint / fuzzy-match layer = a FEATURE (community-semantic-search roadmap, 24 §5). The system is correct and the waste is bounded to cross-edition collisions of books that >1 org holds → ACCEPT (won't-fix-now). No code change. (see CHANGELOG.md)
