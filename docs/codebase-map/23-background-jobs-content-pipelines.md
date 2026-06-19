# 23 — Background Jobs (Inngest) & Static Content Pipelines
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|------|------|
| `src/inngest/client.ts` | Inngest client singleton (`id: "quillnext"`, typed schemas). |
| `src/inngest/types.ts` | Event-name → payload typing (`EventSchemas.fromRecord<Events>`); 11 event types. |
| `src/app/api/inngest/route.ts` | The webhook `serve()` handler (GET/POST/PUT); registers all 11 functions; `maxDuration = 60`. |
| `src/inngest/functions/compile-curriculum.ts` | `curriculum/compile` worker — generates TG/SP/Slides/RA/CO + verification gate + finalize. |
| `src/inngest/functions/process-document.ts` | `resource/process.document` — download PDF/text from Firebase, extract text, persist. |
| `src/inngest/functions/safety-scan.ts` | `chat/message.sent` — assess chat safety, escalate, store flag, alert. |
| `src/inngest/functions/extract-book.ts` | `book/extract.requested` — web-grounded book extraction (TOC/summary), copy-down, embed, fan-out fulltext+sections. |
| `src/inngest/functions/extract-video.ts` | `video/extract.requested` — YouTube metadata+transcript → AI summary, copy-down, embed chunks. |
| `src/inngest/functions/ingest-book-fulltext.ts` | `book/fulltext.requested` — locate open full text, fetch, chunk, embed into global RAG catalog. |
| `src/inngest/functions/ingest-book-sections.ts` | `book/sections.requested` — per-section facts-sheet from ingested full text + spine cross-walk. |
| `src/inngest/functions/ingest-textbooks.ts` | 4 functions: corpus fan-out, per-book ingest, crosswalk refresh fan-out, per-doc recrosswalk. |
| `src/lib/ai/book-extraction.ts` | AI producers: groundBook / structureBookResearch / section-facts / objective classification. |
| `src/lib/ai/video-extraction.ts` | AI producers: summarizeVideoTranscript (path 1) + watchVideoFallback (path 2). |
| `src/lib/ai/video-processing.ts` | `extractVideoContent` (Gemini-watch) + YouTube URL helpers (`isYouTubeUrl`, `extractYouTubeVideoId`). |

Static corpora (assets, documented shape + consumers only — see §6):
- `src/server/data/Matthew-Henry-Commentary-Volumes/` — 1262 `.HTM` files (~82MB).
- `src/server/data/counties_list.json` — 1,094,403 lines (~29MB).
- `src/server/data/mission-stats.json` — 5,265 lines (~175KB).
- `src/data/catechisms/{wsc,wlc,baptist,heidelberg,puritan,young_children,matthew_henry}.ts` — TS datasets.
- `src/data/heidelberg.json` — 2,480 lines, **orphaned** (see Q-23-006).

## 2. Purpose / intent
This chapter is the asynchronous spine of quillnext: heavy/slow work that must not block a request — AI generation, web-grounded extraction, PDF parsing, full-text RAG ingestion, chat-safety scanning — is dispatched as Inngest events and processed by step-decomposed background functions. The architecture is shaped hard by **Vercel Hobby's 60s per-invocation ceiling** (`route.ts:17-23`): each Inngest step is a fresh Vercel function call, so every step is designed to do at most ONE bounded unit of work (one AI call or one embed batch), and long work is fanned out across memoized steps. The static corpora are read-only reference content (Reformed catechisms, Matthew Henry commentary, US counties, mission stats) consumed by Prisma seeds (chapter 03) and the discipleship/missions features (chapter 19/20).

## 3. Architecture & key files

**Client + typing.** `client.ts:5` constructs one `Inngest({ id: "quillnext", schemas: schema })`. `types.ts` declares 11 event payload types and binds them via `EventSchemas().fromRecord<Events>()` (`types.ts:111`). Every payload that touches an org-scoped table carries `organizationId` (+ often `userId`) because **AsyncLocalStorage does NOT reach Prisma in the Inngest runtime** — the tenant must be threaded explicitly (see comments at `types.ts:8`, `compile-curriculum.ts:58`).

**Webhook.** `route.ts:25-40` exports `{ GET, POST, PUT }` from `serve()` registering all 11 functions. `maxDuration = 60` (Hobby clamp). This is the only inbound surface; Inngest cloud calls it.

**Tenant discipline.** Two patterns recur:
- GLOBAL/context-free tables (`bookExtraction`, `videoExtraction`, `book_text_chunks`, `textbook_*`) → plain `db` (RLS policy `USING(true)`).
- Org-scoped tables (`book`, `videoResource`, `documentResource`, `curriculumBundle`, `resource`, `safetyFlag`) → `withTenant(fn, undefined, { organizationId, userId })` with the tenant stamped on the connection. `setRlsContext` is used by `compile-curriculum.ts:71` and `safety-scan.ts:15` for code paths that read ALS (e.g. `generateResourceCore`).

**The fan-out chain (books).** `extract-book` is the entry; after it persists the GLOBAL extraction row it fires two decoupled events: `book/fulltext.requested` (→ `ingestBookFullText`) and `book/sections.requested` (→ `ingestBookSections`). Decoupling is deliberate: those are web-grounded/AI steps that can time out on Hobby, and isolating them means a timeout flips only that feature's own status (`fullTextStatus` / `sectionsStatus`), never the book's `extraction_status` (`extract-book.ts:170-184`).

**The fan-out chain (textbooks).** `textbook/corpus.ingest` → `ingestTextbookCorpus` upserts a `TextbookDocument` per book and fans out one `textbook/ingest.requested` per book → `ingestTextbook` (stage→embed→mark→cross-walk). Separately `textbook/crosswalk.refresh` → `refreshTextbookCrosswalk` fans out `textbook/crosswalk.requested` per ingested doc → `recrosswalkTextbook`.

**AI producers** (`lib/ai/*`) are pure, DB-free. `book-extraction.ts` runs a two-step pipeline because `google_search` grounding can't combine with `generateObject`: GROUND (`generateText` + `google.tools.googleSearch`, throws on content-filtered empty) then STRUCTURE (`generateObject`, never throws — degrades). `video-extraction.ts` mirrors it (transcript-first, throws; watch-fallback, degrades). All use `models.flash`/`models.pro`/`models.pro3` from `lib/ai/config` (see chapter 08).

## 4. Data flow (concrete traces)

**Curriculum compile** — `compile-curriculum-action.ts:43` `inngest.send("curriculum/compile", {specId, bundleId, organizationId, userId})` → `compile-curriculum.ts:68`. Steps: `fetch-context` (`:94`, withTenant read of spec+bundle, `NonRetriableError` if missing) → `generate-teacher-guide` (`:109`, calls `generateResourceCore`, links resource to bundle) → `generate-student-packet` (`:147`) → `generate-slides` (`:181`, skipped if no kind) → `generate-reading-anthology` (`:214`) → `generate-organizers` (`:250`) → `run-verification-gate` (`:288`: SHA-256 every artifact, `generateObject(models.pro3)` QA verdict (fault-tolerant — failure marks QA unavailable, non-blocking `:360`), structural check `MIN_CHARS=200` `:330`, persists `release_manifest` resource) → `finalize-bundle` (`:415`, COMPLETED or FAILED per gate). `onFailure` (`:50`) stamps bundle FAILED via `withTenant`.

**Document processing** — `resource-library-actions.ts:295` sends `resource/process.document` → `process-document.ts:34`. `download-file` (`:42`: fetch if `http`, else Firebase Admin `bucket.file(fileUrl).download()`) → `extract-text` (`:76`: `pdf2json` for PDF else utf-8) → `update-db` (`:87`: one `withTenant` tx finds doc org, writes `extractedText`, then `revalidateTag('library-'+org)`).

**Safety scan** — `chat/route.ts:75` sends `chat/message.sent` → `safety-scan.ts:12`. `assessMessageSafety` (`:22`) → `decideSafetyResolution` (`:25`) → pattern-escalation over last-10-day `safetyFlag`s (`:44`, hard-stops when caregiver implicated or disclosureRisk HIGH `:36-37`; ≥2 same-category prior or evidence escalation upgrades resolution `:69`) → store flag with snippet-only message (`:85`) → `sendSafetyAlert(flag.id)` only for `PARENT_SUMMARY_*` (`:104`). See chapter 12/20.

**Book extract** — `books/[id]/extract/route.ts:180` sends `book/extract.requested` → `extract-book.ts:78`. `load-metadata` (`:86`, plain-db extraction + withTenant book) → `extract-ground` (`:141`, `groundBook`, catches exhaustion → degrade) → `extract-structure` (`:146`, `structureBookResearch` or `degradedBookResult`) → `persist-global` (`:153`, plain db) → `sendEvent` kickoff-fulltext + kickoff-sections (`:177-184`) → `copy-down` (`:188`, withTenant book update + revalidate) → `embed` (`:211`, best-effort). `retries: 4`, `concurrency 2`. `onFailure` (`:20`) leaves the run alone if status already EXTRACTED (`:43`), else marks both rows FAILED.

**Book full-text** — `ingest-book-fulltext.ts:46`. `discover` (`:51`, `discoverAllFullText`) → `fetch` (`:81`, `fetchFirstAvailable` budget 40s, parks `fullTextRaw` in DB) → `stage` (`:116`, `segmentIntoChapters` aligned to stored sections + `chunkText`, cap `MAX_FULL_TEXT_CHUNKS=2000`, `stageBookTextChunks`, clears raw) → loop `embed-{i}` (`:187`, batches of 200, `embedPendingBookTextChunks`) → `mark` (`:198`, raw COUNT of null embeddings → INGESTED vs INGESTING). Best-effort throughout; `onFailure` (`:35`) marks `fullTextStatus: UNAVAILABLE`.

**Book sections** — `ingest-book-sections.ts:40`. `load` (`:44`) → if no ingested full text or empty TOC → `mark-unavailable` (`:74`) and return. Else `clear-sections` (`:89`) → loop `facts-{b}` (`:102`, `FACTS_BATCH=2`, `retrieveBookChunks` per section + `structureSectionsFromText`, `factsSource: "TEXT"`) → if nothing written `mark-unavailable` → `cross-walk` (`:152`, withTenant book.subjectId, `classifySectionsToObjectives`, conf≥0.6 → `bookSectionObjective.createMany`, else `spineGap.create`) → `mark` EXTRACTED (`:225`). Web grounding is NOT used (exceeds 60s on Hobby — comment `:13-22`).

**Video extract** — `videos/[id]/extract/route.ts:153` sends `video/extract.requested` → `extract-video.ts:69`. `load` (`:77`) → `metadata` (`:101`, `fetchVideoMetadata`, never throws) → `transcript` (`:106`, `fetchYouTubeTranscript`) → `analyze-transcript` (`:119`, `summarizeVideoTranscript`, on throw → null) → `analyze-watch` (`:131`, `watchVideoFallback` only if no result) → `persist-global` (`:137`) → `copy-down` (`:161`, withTenant + revalidate) → `embed-chunks` (`:190`, best-effort, `chunkTranscript` + `embedVideoChunks`). `retries: 2`.

**Textbook corpus** — event `textbook/corpus.ingest` → `ingest-textbooks.ts:23`. Per source `discover-{key}` (`:30`, `listBooks` + upsert `TextbookDocument`) → `fan-out` `textbook/ingest.requested` (`:65`). `ingestTextbook` (`:98`): `load-doc` → `stage` (`:114`, `assembleSections` + `chunkText`, cap `MAX_TEXTBOOK_CHUNKS=1500`) → `embed-{i}` (`:159`, 200/batch) → `mark` (`:171`, reconciles chunkCount) → `cross-walk` (`:199`, `crossWalkTextbookTopics`). `refreshTextbookCrosswalk` (`:217`) fans out `textbook/crosswalk.requested` → `recrosswalkTextbook` (`:241`).

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `inngest` client | DONE | `client.ts:5`; imported by every function + route. |
| event schema (`types.ts`) | DONE | `types.ts:111`; all 11 events bound, 9 have producers. |
| `route.ts` serve handler | DONE | `route.ts:25-40`; 11 functions registered (`route.ts:28-38`). |
| `compileCurriculum` | DONE | wired `route.ts:30`; producer `compile-curriculum-action.ts:43,83`. |
| `processDocument` | DONE | wired `route.ts:28`; producer `resource-library-actions.ts:295`. |
| `scanMessage` (id `scan-chat-message`) | DONE | wired `route.ts:29`; producer `chat/route.ts:75`. |
| `extractBook` | DONE | wired `route.ts:31`; producer `library/books/[id]/extract/route.ts:180`. |
| `extractVideo` | DONE | wired `route.ts:34`; producer `library/videos/[id]/extract/route.ts:153`. |
| `ingestBookFullText` | DONE | wired `route.ts:32`; producer `extract-book.ts:177`. |
| `ingestBookSections` | DONE | wired `route.ts:33`; producer `extract-book.ts:181`. |
| `ingestTextbookCorpus` | PARTIAL | wired `route.ts:35`; **no in-app producer** for `textbook/corpus.ingest` (Q-23-001). |
| `ingestTextbook` | DONE | wired `route.ts:36`; producer = corpus fan-out `ingest-textbooks.ts:65`. |
| `refreshTextbookCrosswalk` | PARTIAL | wired `route.ts:37`; **no in-app producer** for `textbook/crosswalk.refresh` (Q-23-001). |
| `recrosswalkTextbook` | DONE | wired `route.ts:38`; producer = refresh fan-out `ingest-textbooks.ts:222`. |
| `groundBook` / `structureBookResearch` / `degradedBookResult` | DONE | `book-extraction.ts:219,247,291`; used `extract-book.ts:4,141,146`. |
| `groundBookSections` | DEAD | `book-extraction.ts:393`; ZERO importers (see Q-23-002). |
| `structureBookSections` | DEAD | `book-extraction.ts:429`; ZERO importers (Q-23-002). |
| `structureSectionsFromText` / `classifySectionsToObjectives` | DONE | `book-extraction.ts:478,542`; used `ingest-book-sections.ts:3`. |
| `summarizeVideoTranscript` / `watchVideoFallback` | DONE | `video-extraction.ts:68,113`; used `extract-video.ts:6`. |
| `extractVideoContent` | DONE | `video-processing.ts:28`; used `video-extraction.ts:4,115`. |
| `isYouTubeUrl` | DONE | `video-processing.ts:45`; used `videos/route.ts:7,49`. |
| `extractYouTubeVideoId` | DONE | `video-processing.ts:53`; used `videos/route.ts:7`. |
| static corpora (commentary/counties/mission/catechisms) | DONE | consumed by seeds + missions/catechism actions (§6). |
| `src/data/heidelberg.json` | DEAD | only `catechisms/heidelberg.ts` is imported by seed (Q-23-006). |

## 6. Integration points

**Imports in (libs/services):**
- `@/server/db` (`db`, `withTenant`), `@/server/rls-context` (`setRlsContext`).
- `@/app/actions/generate-resource-core` (compile-curriculum), `@/lib/firebase-admin` (`getStorageBucket`, process-document), `pdf2json` (process-document).
- `@/lib/safety/{guard,policy,types}`, `@/lib/notifications/safety-alert` (safety-scan).
- `@/lib/sources/{registry,corpus-registry,text-processing}`, `@/lib/utils/vector` (`generateBookEmbedding`, `stageBookTextChunks`, `embedPendingBookTextChunks`, `retrieveBookChunks`, `stageTextbookChunks`, `embedPendingTextbookChunks`, `embedVideoChunks`), `@/lib/textbook-coverage` (`crossWalkTextbookTopics`).
- `@/lib/api/youtube` (`fetchVideoMetadata`), `@/lib/youtube/transcript` (`fetchYouTubeTranscript`, `chunkTranscript`).
- `@/lib/ai/config` (`models`), `@ai-sdk/google`, `ai` (`generateText`, `generateObject`), `zod`.
- `next/cache` (`revalidateTag` — process-document, extract-book, extract-video).

**Importers out (event producers):** `compile-curriculum-action.ts`, `resource-library-actions.ts`, `chat/route.ts`, `books/[id]/extract/route.ts`, `videos/[id]/extract/route.ts`, and intra-graph fan-outs in `extract-book.ts` + `ingest-textbooks.ts`. The webhook route itself imports every function.

**Env vars (indirect):** Google/Gemini + OpenAI keys via `lib/ai/config`; Firebase Admin creds via `lib/firebase-admin`; YouTube Data API key via `lib/api/youtube`; Resend via `safety-alert`. No env read directly in this chapter's files.

**External APIs:** Google Search grounding (Gemini), Gemini video understanding, YouTube Data API + captions, Firebase Storage, open full-text sources (Gutenberg/Standard Ebooks/Wikisource/Internet Archive via `lib/sources/registry`), open-textbook corpora (openstax/siyavula via `corpus-registry`).

**Prisma models written/read:** `CurriculumSpec`, `CurriculumBundle`, `Resource`, `ResourceKind`, `DocumentResource`, `SafetyFlag`, `Book`, `BookExtraction`, `BookExtractionSection`, `BookSectionObjective`, `SpineGap`, `Objective`, `VideoResource`, `VideoExtraction`, `TextbookDocument`, `textbook_chunks` (raw), `book_text_chunks` (raw). See chapter 02 for model defs.

**Inngest jobs:** 11 functions registered (§5). Events: `curriculum/compile`, `resource/process.document`, `chat/message.sent`, `book/extract.requested`, `book/fulltext.requested`, `book/sections.requested`, `video/extract.requested`, `textbook/corpus.ingest`, `textbook/ingest.requested`, `textbook/crosswalk.refresh`, `textbook/crosswalk.requested`.

**Static corpora consumers:**
- `Matthew-Henry-Commentary-Volumes/` (1262 `.HTM`) → read by `prisma/seed-commentary.ts:8`, `scripts/parse-commentary-prototype.ts:15`, `scripts/verse-anchor-prototype.ts:10`. Seeds `commentary_chapters`/`commentary_sections` (chapter 03/19).
- `counties_list.json` (~29MB) → read ONLY by `prisma/seed-counties.ts:36` to seed the `counties` table; runtime reads now go through `db.county` (`missions/actions.ts:58`, comment `:55`). See chapter 19.
- `mission-stats.json` (~175KB) → read at request time by `getOperationWorldStats` (`missions/actions.ts:43`). Chapter 19.
- `src/data/catechisms/*.ts` → imported by `prisma/seed-catechisms.ts:7-13`, seeds `catechisms`/`catechism_questions` (chapter 03); surfaced by catechism pages (`family-discipleship/catechism/page.tsx`). Chapter 19.
- `src/data/heidelberg.json` → no importer (the seed uses `catechisms/heidelberg.ts`). Q-23-006.

## 7. Findings

Q-23-001  [LOW]  Two registered Inngest functions have no in-app trigger — operational/manual-only  — `ingest-textbooks.ts:22,216`
  Evidence: Grep for `textbook/corpus.ingest` and `textbook/crosswalk.refresh` finds NO `inngest.send` outside `types.ts`/`route.ts`; the only producers are the intra-graph fan-outs (`ingest.requested`, `crosswalk.requested`). `ingestTextbookCorpus`/`refreshTextbookCrosswalk` are reachable only by manually firing the event (Inngest dashboard/CLI).
  Impact: The open-textbook corpus pipeline is operator-triggered, not user/route-triggered — no UI or script kicks it off in-repo. Easy to mistake for fully wired; documented as PARTIAL.
  Status: documented (not fixed)

Q-23-002  [MED]  Dead web-grounded section producers (`groundBookSections`, `structureBookSections`)  — `book-extraction.ts:393,429`
  Evidence: Both exported, but Grep shows ZERO importers repo-wide. `ingest-book-sections.ts` uses only `structureSectionsFromText` + `classifySectionsToObjectives`. The functions' own doc-comments confirm the grounded path "exceeds 60s on Hobby ... degrades to UNAVAILABLE no matter what" (`book-extraction.ts:419-421`), so it was deliberately replaced by the full-text path.
  Impact: ~80 lines of dead AI code (plus `runBookGrounding`'s `abortMs`/`SectionGroundMeta`/`describeTableOfContents` machinery that exists only to serve them). Misleads readers into thinking web-grounded sections are live. Carries cost only if a future caller resurrects it.
  Status: documented (not fixed)

Q-23-003  [LOW]  (re-graded INFO→LOW 2026-06-19, owner) ⏳ DEFERRED — owner deferred the DocumentResource.extractionStatus enum to a batched migration (see CHANGELOG.md). process-document has no `onFailure` and no per-step retry tuning  — `process-document.ts:31-32`
  Evidence: `createFunction({ id: "process-document" }, ...)` — no `retries`, `concurrency`, or `onFailure`. On exhausted default retries the `DocumentResource` is left with empty `extractedText` and no FAILED marker (unlike extract-book/extract-video which mark FAILED).
  Impact: A document that fails extraction silently stays blank with no status signal to the UI; user cannot tell processing failed vs. is pending. Minor — the row still exists.
  Status: documented (not fixed)

Q-23-004  [LOW]  Curriculum verification gate is AI-soft and can pass low-quality bundles  — `compile-curriculum.ts:330-369`
  Evidence: Structural gate only requires TG+SP ≥ `MIN_CHARS=200` (`:330`). Qualitative QA is non-blocking when the model call fails (`qa = { unavailable: true }`, `:360-362`) and only blocks on an explicit `releaseRecommended === false`. A 201-char TG with a failed QA call → gate PASS → bundle COMPLETED.
  Impact: "Verification gate" can rubber-stamp thin or unreviewed artifacts; the manifest records it, but the bundle is marked COMPLETED. Quality risk, not security.
  Status: documented (not fixed)

Q-23-006  [LOW]  Orphaned 2,480-line `src/data/heidelberg.json` (drift vs `catechisms/heidelberg.ts`)  — `src/data/heidelberg.json`
  Evidence: Grep for `heidelberg` shows the ONLY importer is `prisma/seed-catechisms.ts:10` importing `../src/data/catechisms/heidelberg` (the `.ts`, a self-contained `export default` array). `src/data/heidelberg.json` has zero importers.
  Impact: A second, divergent copy of the Heidelberg Catechism that nothing reads — drift/confusion risk; if someone edits the json expecting it to seed, nothing changes.
  Status: documented (not fixed)

Q-23-007  [INFO]  ✅ RESOLVED 2026-06-19 — added required `, {}` to the 3 worker revalidateTag calls; removed the @ts-ignore lines (see CHANGELOG.md). `@ts-ignore` on every `revalidateTag` call in workers  — `process-document.ts:115`, `extract-book.ts:205`, `extract-video.ts:184`
  Evidence: Each `revalidateTag(\`library-${org}\`)` is preceded by `// @ts-ignore`. Calling `revalidateTag` from an Inngest worker (no request scope) is outside its documented Next.js usage; the suppression hides a real type/runtime mismatch.
  Impact: Cache invalidation from a background worker may be a no-op or throw at runtime depending on Next internals; the library list may not refresh promptly after extraction. Low — UI also refetches on poll.
  Status: documented (not fixed)

Q-23-008  [INFO]  ✅ RESOLVED 2026-06-19 — removed the dead fileUrl.startsWith('http') branch + REFACTOR comments in process-document (see CHANGELOG.md). process-document `download-file` step is heavily commented-but-uncertain  — `process-document.ts:42-73`
  Evidence: The step body has multiple "let's assume" / "REFACTOR" comments and two divergent paths (HTTP fetch vs Firebase Admin `bucket.file(fileUrl)`) keyed only on `fileUrl.startsWith("http")`. The expected shape of `fileUrl` (signed URL vs storage path) is explicitly unresolved in comments.
  Impact: Fragile contract between producer (`resource-library-actions.ts`) and worker; a path-vs-URL mismatch would fail downloads. Functional today but under-specified.
  Status: documented (not fixed)
