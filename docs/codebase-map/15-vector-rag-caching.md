# 15 — Vector Search, RAG & Caching
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Lines | Role |
|------|-------|------|
| `src/lib/utils/vector.ts` | 563 | All pgvector ops via RAW SQL — embed + cosine search over books, video chunks, book-text chunks, textbook chunks. The only place Prisma's `Unsupported("vector")` columns are touched. |
| `src/lib/textbook-coverage.ts` | 127 | Textbook↔spine-Topic cross-walk (semantic coverage math) + coverage lookups. Reuses the chunk embeddings staged by vector.ts. |
| `src/lib/utils/prisma-cache.ts` | 49 | `cacheQuery` (thin `unstable_cache` wrapper) + `CacheTTL` presets. Vestigial Prisma-Accelerate caching scaffold (mostly DEAD). |
| `src/lib/cache.ts` | 45 | `withCache` + `CACHE_TAGS`/`CACHE_REVALIDATE` constants. Entirely DEAD (zero importers). |

Cross-references: vector columns + chunk tables are in **02-data-model.md**; RLS/`withTenant`/`getCurrentUserOrg` machinery in **04-security-auth-tenancy.md**; RAG consumers (resource generation grounding) in **10-resource-generation-creation-station.md** and book/textbook ingestion Inngest jobs in **09-** territory.

## 2. Purpose / intent

This area is QuillNext's semantic-retrieval substrate. Two product capabilities sit on it:

1. **Library semantic search** — find books/videos in an org's Living Library by meaning, not keyword (`searchBooks`, `findSimilarBooks` are wired; the parallel video-search path `searchVideos`/`generateVideoEmbedding` is built but DEAD — see Q-15-002/003).
2. **Grounded generation (RAG)** — when generating a resource, retrieve the most relevant *full-text* chunks from a book (`retrieveBookChunks`) or from the GLOBAL open-textbook corpus by subject (`retrieveTextbookChunks`), and feed them as grounding so the model paraphrases real source material ("ground-don't-echo"). Coverage cross-walk (`textbook-coverage.ts`) answers "which textbooks teach spine topic X" and surfaces spine gaps.

The caching files are a separate, much smaller concern: `cacheQuery` memoizes two read-heavy page queries (students, courses). The rest of the caching scaffolding is dead.

Because Prisma cannot read/write pgvector columns, every embedding/search operation is hand-written `$queryRaw`/`$executeRaw(Unsafe)` SQL with explicit `::vector` casts.

## 3. Architecture & key files

### vector.ts — embed model + the org vs global split
- Embedding model + task-type options come from `@/lib/ai/config` (`embeddingModel`, `embeddingProviderOptions("RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT")`) — asymmetric query/document task types (`:21`, `:58`). Gemini `gemini-embedding-2` per the comments (`:270`).
- **Two table classes drive two DB-access modes** (the file's central design rule, header comment `:6-12`):
  - **ORG-SCOPED** tables `books`, `video_resources` (have `account_id`): raw SQL runs inside `withTenant(...)` so the RLS GUCs are stamped on the same connection (the per-query Prisma extension wraps only model ops, not `$queryRaw`). Functions: `searchBooks`, `generateBookEmbedding`, `findSimilarBooks`, `searchVideos`, `generateVideoEmbedding`.
  - **GLOBAL / CONTEXT_FREE** tables `book_text_chunks`, `video_extraction_chunks`, `video_extractions`, `textbook_chunks` (no `account_id`; `USING(true)/WITH CHECK(true)` RLS): raw SQL runs on the PLAIN `db` (no `withTenant`) — mirroring the Inngest worker writing the global catalog. Functions: `embedVideoChunks`, `stageBookTextChunks`, `embedPendingBookTextChunks`, `retrieveBookChunks`, `stageTextbookChunks`, `embedPendingTextbookChunks`, `retrieveTextbookChunks`.
- **`ctx` escape hatch** (`generateBookEmbedding :50-53`, `generateVideoEmbedding :395-398`): off-request callers (Inngest workers, where AsyncLocalStorage doesn't reach Prisma) pass `{ organizationId, userId }` explicitly to `withTenant` so RLS GUCs are stamped from an EXPLICIT context rather than session resolution.
- **Stage → drain → embed pattern** for full-text RAG (`book_text_chunks`, `textbook_chunks`): `stage*` inserts content-only rows (embedding NULL) via Prisma `createMany` (which omits the Unsupported vector column → NULL); `embedPending*` drains `embedding IS NULL` rows in `chunk_index` order, embeds in ≤100 batches, writes vectors back via `$executeRawUnsafe(... $1::vector ...)`. The `IS NULL` predicate makes Inngest retries idempotent with no offset bookkeeping (`:281-324`, `:469-510`).
- **Error-handling split is deliberate and inconsistent by design**: search/retrieve/stage-video helpers SWALLOW (return `[]`/`0`, log) because retrieval is an enhancement; `embedPending*` THROW so the Inngest step retries rather than marking a book INGESTED with missing vectors (`:279`, `:466-467`). `stageTextbookChunks` also throws (no try/catch) (`:434`).
- **Optional-filter raw SQL** uses positional-param building (`retrieveBookChunks :356-378` optional `section_number`; `retrieveTextbookChunks :534-557` optional subject `ILIKE`), since templated `$queryRaw` can't conditionally drop a clause.

### textbook-coverage.ts
- `crossWalkTextbookTopics(documentId)` (`:24-100`): resolve spine `Subject`(s) fuzzily from the textbook's `category`/`subject` (`contains` on whole hint + first word, `:35-46`); pull up to `MAX_TOPICS=250` Topics under those subjects with up to 8 subtopic names for context (`:51-55`); embed each topic-text as RETRIEVAL_QUERY in ≤100 batches (`:62-71`); for each topic compute `max(1 - (embedding <=> $topicVec))` over that document's chunks via raw SQL (`:77-83`); record topics scoring ≥ `COVERAGE_THRESHOLD=0.5` (`:85-87`); idempotent delete-then-`createMany` into `textbook_topic_coverage` (`:91-94`). NEVER throws.
- `getTextbooksForTopic(topicId)` (`:106-126`): plain Prisma `findMany` on `textbookTopicCoverage` ordered by similarity, joined to `document` for title/subject. NEVER throws.
- **Perf shape**: one cosine query *per topic* (`:77`) — up to 250 sequential round-trips per book ingested. Bounded but N+1-ish (see Finding Q-15-005).

### prisma-cache.ts / cache.ts
- `cacheQuery(fn, keyParts, {revalidate, tags})` (`prisma-cache.ts :40-46`): direct `unstable_cache` passthrough. Used by `students/page.tsx` and `courses/page.tsx`.
- `CacheTTL` presets (`:10-15`), `withCache` (`cache.ts :30-44`), `CACHE_TAGS`/`CACHE_REVALIDATE` (`cache.ts :6-20`): defined, not consumed.

## 4. Data flow

**Library search (request path):** `GET /api/library/search` (`src/app/api/library/search/route.ts:9`) → auth + `getCurrentUserOrg()` (`:10-18`) → `searchBooks(query, 20)` (`:29`) embeds query (`vector.ts:18`) and runs cosine `$queryRaw` under `withTenant` over `books` (`vector.ts:25-37`) → route re-filters returned ids with `db.book.findMany({ where: { id: { in }, organizationId } })` (`route.ts:33-42`) → on any error, falls back to `ILIKE` text search (`route.ts:53-66`).

**Similar-books (server component):** `living-library/[id]/page.tsx:121` → `findSimilarBooks(book.id, organizationId, 5)` cross-joins `books` with explicit `b1.account_id = b2.account_id = organizationId` predicates (`vector.ts:89-95`), `.catch(() => [])`.

**Video search:** `searchVideos(query, organizationId, limit)` (`vector.ts:176`) — cosine over GLOBAL `video_extraction_chunks`, JOINed via `video_extractions` → org's `video_resources` with `vr.account_id = organizationId` (`vector.ts:197-203`), `MAX()` per video, runs under `withTenant`. (No live importer found — see Q-15-002.)

**Book ingestion (Inngest):** `extract-book.ts:213` → `generateBookEmbedding(bookId, text, {organizationId, userId})` (whole-book summary vector). `ingest-book-fulltext.ts:156` → `stageBookTextChunks`; `:188` loop → `embedPendingBookTextChunks(.., EMBED_BATCH)` until drained. `ingest-book-sections.ts:106` → `retrieveBookChunks(extractionId, "${title} ${section}", {...})` to ground per-section generation.

**Textbook ingestion (Inngest):** `ingest-textbooks.ts:133` → `stageTextbookChunks`; `:160` loop → `embedPendingTextbookChunks`; `:200`/`:244` → `crossWalkTextbookTopics(doc.id)` after embedding.

**Video ingestion (Inngest):** `extract-video.ts:193` → `embedVideoChunks(videoExtractionId, chunkTranscript(transcript.raw))` (best-effort). `generateVideoEmbedding` defined but no caller found (see Q-15-003).

**RAG in generation (server action):** `generate-resource-core.ts` imports `retrieveBookChunks`/`retrieveTextbookChunks` (`:20`); `:460` book full-text RAG (gated on `fullTextStatus === "INGESTED"`), `:574`/`:611` textbook-corpus grounding by subject.

**Coverage lookup (server action):** `spine-actions.ts:96` `getTopicTextbookCoverage` → `getTextbooksForTopic(topicId)`.

**Caching:** `students/page.tsx:11` and `courses/page.tsx:60` wrap their org-scoped fetchers in `cacheQuery(...)`.

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `searchBooks` | DONE | `route.ts:29` live consumer; `vector.ts:17-38` |
| `generateBookEmbedding` | DONE | `extract-book.ts:213`, `api/library/books/route.ts:112`, `.../extract/route.ts:109`; `vector.ts:50-74` |
| `findSimilarBooks` | DONE | `living-library/[id]/page.tsx:121`; `vector.ts:80-100` |
| `embedVideoChunks` | DONE | `extract-video.ts:193`; `vector.ts:116-159` |
| `searchVideos` | DEAD | no importer repo-wide (grep §below); `vector.ts:176-208` |
| `generateVideoEmbedding` | DEAD | no caller found (grep returns only its own def); `vector.ts:395-419` |
| `stageBookTextChunks` | DONE | `ingest-book-fulltext.ts:156`; `vector.ts:228-264` |
| `embedPendingBookTextChunks` | DONE | `ingest-book-fulltext.ts:188`; `vector.ts:281-324` |
| `retrieveBookChunks` | DONE | `ingest-book-sections.ts:106`, `generate-resource-core.ts:460`; `vector.ts:338-385` |
| `stageTextbookChunks` | DONE | `ingest-textbooks.ts:133`; `vector.ts:434-461` |
| `embedPendingTextbookChunks` | DONE | `ingest-textbooks.ts:160`; `vector.ts:469-510` |
| `retrieveTextbookChunks` | DONE | `generate-resource-core.ts:574,611`; `vector.ts:518-563` |
| `crossWalkTextbookTopics` | DONE | `ingest-textbooks.ts:200,244`; `textbook-coverage.ts:24-100` |
| `getTextbooksForTopic` | DONE | `spine-actions.ts:96`; `textbook-coverage.ts:106-126` |
| `cacheQuery` | DONE | `students/page.tsx:11`, `courses/page.tsx:60`; `prisma-cache.ts:40-46` |
| `CacheTTL` | REMOVED ✅ | unused; deleted 2026-06-19 (Q-15-006, see CHANGELOG.md). Was: DEAD, no external importer; `prisma-cache.ts:10-15` |
| `withCache` (cache.ts) | DEAD | zero importers repo-wide; `cache.ts:30-44` |
| `CACHE_TAGS` / `CACHE_REVALIDATE` | DEAD | zero importers repo-wide; `cache.ts:6-20` |

## 6. Integration points

- **Imports in:** `@/server/db` (`db`, `withTenant`), `node:crypto` (`randomUUID`), `ai` (`embed`, `embedMany`), `@/lib/ai/config` (`embeddingModel`, `embeddingProviderOptions`), `next/cache` (`unstable_cache`).
- **Importers out (vector.ts):** `inngest/functions/{extract-book,extract-video,ingest-book-fulltext,ingest-book-sections,ingest-textbooks}.ts`; `app/actions/generate-resource-core.ts`; `app/api/library/{search/route,books/route,books/[id]/extract/route}.ts`; `app/living-library/[id]/page.tsx`.
- **Importers out (textbook-coverage.ts):** `inngest/functions/ingest-textbooks.ts`, `app/actions/spine-actions.ts`.
- **Importers out (prisma-cache.ts):** `app/students/page.tsx`, `app/courses/page.tsx`. **(cache.ts: none.)**
- **Prisma models used:** `bookTextChunk`, `textbookChunk` (`createMany`); `textbookDocument`, `subject`, `topic`, `textbookTopicCoverage` (`textbook-coverage.ts`). Raw-SQL tables: `books`, `video_resources`, `video_extractions`, `video_extraction_chunks`, `book_text_chunks`, `textbook_chunks`.
- **External APIs:** Gemini embeddings via Vercel AI SDK (`embeddingModel`).
- **Inngest jobs (consumers):** extract-book, extract-video, ingest-book-fulltext, ingest-book-sections, ingest-textbooks.
- **Env vars:** none directly here (embedding provider config lives in `@/lib/ai/config`).

## 7. Findings

Q-15-001  [MED]  `searchBooks` raw SQL has NO `account_id` predicate — relies on inert RLS  — `src/lib/utils/vector.ts:25-37`
  Evidence: The cosine query selects from `books` WHERE `embedding IS NOT NULL` and similarity > 0.5 only — no `account_id`/`organizationId` filter. It runs under `withTenant`, but RLS_ENABLED is OFF (`src/server/db.ts:9`), so the GUCs do nothing. Cross-org book ids are returned. The lone consumer (`api/library/search/route.ts:33-42`) re-filters by `organizationId` before responding, so no leak in the current call path.
  Impact: The function alone is not tenant-safe; safety depends entirely on every caller re-filtering. A future caller that trusts `searchBooks` output directly (or uses `r.title`/`r.summary` from the raw rows, which the route does NOT) would leak other orgs' titles/summaries. Contrast with `findSimilarBooks` (`:89-91`) and `searchVideos` (`:201`), which DO carry explicit `account_id` predicates ("defense in depth alongside RLS" per their own comments).
  Status: documented (not fixed)

Q-15-002  [LOW]  `searchVideos` is DEAD code  — `src/lib/utils/vector.ts:176-208`
  Evidence: Grep for `searchVideos` across the repo (excluding its own definition and doc files) returns no importer. Fully implemented (org-scoped, explicit `account_id`) but unwired.
  Impact: Dead surface area; video semantic search is built but unreachable. May indicate a planned-but-unshipped feature, or a UI path was removed. No correctness risk; maintenance/clarity cost.
  Status: documented (not fixed)

Q-15-003  [LOW]  `generateVideoEmbedding` is DEAD code  — `src/lib/utils/vector.ts:395-419`
  Evidence: Grep finds no caller (only the definition). `extract-video.ts` embeds transcript CHUNKS via `embedVideoChunks` (`:193`) but never calls `generateVideoEmbedding` to populate the `video_resources.embedding` summary column.
  Impact: The `video_resources.embedding` column is likely never populated, which also means the (dead) `searchVideos`'s sibling summary-vector approach has no data path. Confirms Q-15-002: the whole video-summary-vector pathway is inert.
  Status: documented (not fixed)

Q-15-004  [LOW]  `src/lib/cache.ts` is entirely DEAD  — `src/lib/cache.ts:6-44`
  Evidence: `withCache`, `CACHE_TAGS`, `CACHE_REVALIDATE` have zero importers repo-wide (grep excluding the file itself returns only its own definitions).
  Impact: Duplicate/competing caching abstraction alongside `cacheQuery` (which IS used). Drift risk and dead weight; the tag-based invalidation system (`CACHE_TAGS.student`, etc.) is never invoked, so any code assuming tag invalidation exists would be wrong.
  Status: documented (not fixed)

Q-15-005  [LOW]  `crossWalkTextbookTopics` issues one cosine query per topic (up to 250 sequential round-trips)  — `src/lib/textbook-coverage.ts:75-88`
  Evidence: `for (i in topics)` loop, each iteration `await db.$queryRawUnsafe(... max(1 - (embedding <=> $1::vector)) ... WHERE document_id = $2)`. With `MAX_TOPICS=250` that is up to 250 serial DB queries per textbook ingested.
  Impact: N+1-style per-book cost during ingestion. Bounded (≤250) and runs in a best-effort Inngest step, so it won't fail ingestion, but it is slow and could be a single set-based query (e.g. cross join topics-vector array vs chunks). Performance only.
  Status: documented (not fixed)

Q-15-006  [INFO]  ✅ RESOLVED 2026-06-19 — deleted stale JSDoc example + unused CacheTTL from prisma-cache.ts (see CHANGELOG.md). Stale doc-comment references nonexistent `academicSpineCacheStrategy`  — `src/lib/utils/prisma-cache.ts:17-34`
  Evidence: Comment says "Cache strategies removed as part of migration to Supabase" yet the example block still imports/uses `academicSpineCacheStrategy` and a `cacheStrategy` Prisma option (Prisma-Accelerate feature) that no longer exist in this codebase. `CacheTTL` presets are also unused (Q-noted in status table).
  Impact: Misleading documentation; a developer copying the example would import a missing symbol. Doc↔code drift only.
  Status: documented (not fixed)

Q-15-007  [INFO]  ✅ RESOLVED 2026-06-19 — searchBooks now caps the embed query to 1000 chars and returns [] on empty (see CHANGELOG.md). `searchBooks` similarity threshold/limit hardcoded; no input validation on embedded query  — `src/lib/utils/vector.ts:33`, `:17`
  Evidence: `> 0.5` cosine cutoff and the LIMIT are interpolated; the `query` string is sent straight to the embedding API with no length cap. Same hardcoded `0.5` threshold recurs across `findSimilarBooks` (`:95`), `searchVideos` (`:202`), `retrieveTextbookChunks` (`:553`), `COVERAGE_THRESHOLD` (`textbook-coverage.ts:16`).
  Impact: Magic-number duplication (drift risk if the corpus model changes); an unbounded query string could inflate embedding cost. Low severity — embedding values are bound as params (no SQL injection); the threshold is a tuning constant.
  Status: documented (not fixed)
