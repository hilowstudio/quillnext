# 14 — Living Library (resource catalog UI)
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `src/app/living-library/page.tsx` | Server entry for `/living-library`; resolves org, fetches all 5 catalogs + generated resources, renders `LibraryClient` |
| `src/app/living-library/LibraryClient.tsx` | Client tab shell (Books/Videos/Articles/Documents/Courses/Resources); URL-param tab state |
| `src/app/living-library/[id]/page.tsx` | Book detail page; deep-extraction display, similar-books sidebar, self-heal of stuck EXTRACTING |
| `src/app/living-library/resource/[id]/page.tsx` | Generated-resource detail view (markdown/JSON), org-scoped |
| `src/app/living-library/scan/page.tsx` | "Scan Book" page wrapper; renders `BookScanner` |
| `src/app/living-library/videos/page.tsx` | Standalone videos page; fetches videos + subjects, renders `VideosClient` |
| `src/app/living-library/videos/VideosClient.tsx` | Client videos page: add-by-URL, extract trigger/poll loop |
| `src/app/api/library/books/route.ts` | `GET` list books / `POST` create book (+ embedding, Hi-Low ingest) |
| `src/app/api/library/books/[id]/extract/route.ts` | `POST` idempotent book deep-extraction trigger/poll (Inngest `book/extract.requested`) |
| `src/app/api/library/scan/route.ts` | `POST` ISBN → Google Books lookup (returns metadata, no DB write) — **DEAD (no caller)** |
| `src/app/api/library/scan/vision/route.ts` | `POST` book-cover image → Gemini vision extraction of metadata |
| `src/app/api/library/search/route.ts` | `GET` semantic book search w/ text fallback — **DEAD (no caller)** |
| `src/app/api/library/videos/route.ts` | `GET` list videos / `POST` create video (per-org dedupe) |
| `src/app/api/library/videos/[id]/extract/route.ts` | `POST` idempotent video extraction trigger/poll (Inngest `video/extract.requested`) |
| `src/app/actions/resource-library-actions.ts` | Server actions: `getLibraryResources` (dashboard query), `addArticle`, `addDocuments`, delete-* |
| `src/app/actions/library-lookup-actions.ts` | `lookupBook` (Google Books → OpenLibrary ISBN/title lookup) |
| `src/app/actions/youtube-actions.ts` | `getPlaylistDetails` (YouTube playlist metadata) |
| `src/app/actions/course-resource-actions.ts` | Attach/detach library resources to a CourseBlock (org-guarded) |
| `src/components/library/AddVideoDialog.tsx` | Dialog: add YouTube URL + extract trigger/poll |
| `src/components/library/ArticleList.tsx` | Article tab list + add-by-URL dialog + delete |
| `src/components/library/BarcodeScanner.tsx` | ISBN barcode camera scan (native `BarcodeDetector` + html5-qrcode fallback) |
| `src/components/library/BookList.tsx` | Book tab list + delete |
| `src/components/library/BookScanner.tsx` | Add-book UI: search/barcode/cover-scan tabs → preview form → save |
| `src/components/library/CourseList.tsx` | Course tab list + delete |
| `src/components/library/DocumentList.tsx` | Document tab list + upload dialog + delete |
| `src/components/library/ExtractBookButton.tsx` | Book detail extract button + trigger/poll |
| `src/components/library/ResourceList.tsx` | Generated-resources tab: filters + cards |
| `src/components/library/VideoList.tsx` | Video tab list (uses `AddVideoDialog`) + delete |
| `src/components/assignments/AssignResourceDialog.tsx` | Assign a resource/course to a student (consumed by ParentDashboard, not library tabs) |
| `src/server/queries/library.ts` | `getLibraryVideos`, `getLibrarySubjects` DAL for videos page |
| `src/lib/image-processing.ts` | Client-side canvas grayscale/contrast pre-processing for OCR |
| `src/lib/services/image-generation.ts` | `generateNanoBananaImage` (Gemini image-output) — consumed by generators (10-), not library |

## 2. Purpose / intent
The Living Library is the per-organization catalog of teaching source material: physical/ISBN **books**, YouTube **videos**, web **articles**, uploaded **documents** (PDF/txt/md), **courses**, and AI-**generated resources**. Educators add books by searching Google Books/OpenLibrary, scanning a barcode, or photographing a cover; videos by pasting a YouTube URL; articles by URL scrape; documents by file upload. Books and videos can run a **deep extraction** that does heavy AI work once per real-world item in a global, cross-org dedup catalog (`BookExtraction`/`VideoExtraction`) and copies the result down to each org's row. Catalog items feed the Creation Station generators (`/creation-station?sourceType=...&sourceId=...`) and the Course Builder.

## 3. Architecture & key files
- **Two entry routes:** `/living-library` (tabbed catalog, `page.tsx` → `LibraryClient.tsx`) and `/living-library/videos` (standalone videos manager, `videos/page.tsx` → `VideosClient.tsx`). The videos page duplicates much of the Videos tab.
- **Dashboard query:** `getLibraryResources(organizationId)` (`resource-library-actions.ts:13`) wraps all 7 org-scoped reads in one `withTenant` tx, cached via `unstable_cache` tag `library-${organizationId}` (1h). Bundles are fetched but not surfaced by `LibraryClient` (passes only books/videos/articles/documents/courses/resources/students).
- **Add flows:**
  - Book: `BookScanner.tsx` → `lookupBook` action (`library-lookup-actions.ts`) for search/ISBN, or `/api/library/scan/vision` for cover OCR (after `processImageForOcr` in `image-processing.ts`), then `POST /api/library/books` to persist.
  - Barcode: `BarcodeScanner.tsx` decodes EAN-13/UPC-A → `runIsbnLookup` → `lookupBook`.
  - Video: `AddVideoDialog`/`VideosClient` → `POST /api/library/videos` then poll `POST /api/library/videos/[id]/extract`.
  - Article: `ArticleList` → `addArticle` action (cheerio scrape).
  - Document: `DocumentList` → `addDocuments` action (Firebase upload + `resource/process.document` Inngest job).
- **Extraction:** book/video `[id]/extract` routes are idempotent trigger+poll endpoints over the global CONTEXT_FREE extraction catalogs; they enqueue Inngest jobs (chapter 23) and the client polls until EXTRACTED/FAILED.
- **Detail views:** `[id]/page.tsx` (book; self-heals stuck EXTRACTING at :83-104) and `resource/[id]/page.tsx` (generated resource).

## 4. Data flow (concrete traces)
**Catalog render:** `living-library/page.tsx:13` `auth()` → `:20` load `user.organizationId` via plain `prisma` (no withTenant) → `:32` `getLibraryResources(organizationId)` → `:35` students via `withTenant` → `:55` generated `resource.findMany` via `withTenant` with `where` built from raw `searchParams` (`:47-52`) → `LibraryClient` (`:119`).

**Add book (cover scan):** `BookScanner.handleCoverScan` `:168` → `processImageForOcr(file)` (`image-processing.ts:5`, canvas grayscale/contrast) → strip `data:` prefix → `POST /api/library/scan/vision` (`scan/vision/route.ts:19`) → `generateObject` with `models.pro3` + `BookExtractionSchema` (`:36`) → returns metadata → `handleSave` `:202` `POST /api/library/books` → `books/route.ts:73` `withTenant(book.create)` → best-effort `generateBookEmbedding` (`:112`) → optional Hi-Low ingest (`:123-157`) → redirect to `/living-library/{book.id}`.

**Book deep extraction:** `ExtractBookButton.handleClick` `:43` → `POST /api/library/books/[id]/extract` → `books/[id]/extract/route.ts:50` load book via `withTenant` → `:77` `computeDedupKey` → `:84` global `bookExtraction.findUnique` via plain `db` → Case1 EXTRACTED: copy down via `withTenant(book.update)` (`:88`) + re-embed + `revalidateTag`/`revalidatePath` → return `{status:"EXTRACTED",reused:true}`. Case3: `db.bookExtraction.upsert` to EXTRACTING (`:145`) → link book → `inngest.send({name:"book/extract.requested",...})` (`:180`). Client polls every 4s up to 30× (`ExtractBookButton.tsx:65`).

**Add video:** `VideosClient.handleAddVideo` `:77` → `POST /api/library/videos` → `videos/route.ts:53` `extractYouTubeVideoId` → `:61` per-org dedupe via `withTenant(findUnique organizationId_youtubeVideoId)` → `:107` create → returns row → `handleExtract` `:143` polls `POST /api/library/videos/[id]/extract` (`videos/[id]/extract/route.ts`), same global-catalog trigger/poll shape via `video/extract.requested`.

**Attach to course block:** `course-resource-actions.ts:57` `attachBookToBlock` → `requireOrg()` → `assertBlockInOrg` (`:49`, checks `block.course.organizationId`) → verify resource org → `courseBlock.update` → `revalidatePath(/courses/{id}/builder)`. Consumed by `CourseBuilder.tsx`.

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| `living-library/page.tsx` (catalog) | DONE | renders for `/living-library`, fetches + passes data `:32`,`:119` |
| `LibraryClient.tsx` | DONE | tab shell wired to all 6 lists `:65-87` |
| `living-library/[id]/page.tsx` (book detail) | DONE | linked from `BookList.tsx:122` ("View"); self-heal `:83` |
| `resource/[id]/page.tsx` | DONE | targeted by GeneratedResourceCard/BundleView per file header `:10-14` |
| `scan/page.tsx` | DONE | `/living-library/scan` linked from `BookList.tsx:34` |
| `videos/page.tsx` + `VideosClient.tsx` | DONE | standalone `/living-library/videos`; add/extract loop `:77-174` |
| `api/library/books` GET/POST | DONE | POST consumed by `BookScanner.tsx:209`; GET (see Q-14-007) |
| `api/library/books/[id]/extract` POST | DONE | consumed by `ExtractBookButton.tsx:34`; Inngest bound (`extract-book.ts`) |
| `api/library/scan/route.ts` POST | DEAD | zero callers; `BookScanner` uses `lookupBook` action instead (Grep: only `/scan/vision` referenced) |
| `api/library/scan/vision` POST | DONE | consumed by `BookScanner.tsx:178` |
| `api/library/search` GET | DEAD | zero callers repo-wide (Grep "library/search" → none) |
| `api/library/videos` GET/POST | DONE | POST consumed by `VideosClient.tsx:85`, `AddVideoDialog.tsx:55`; GET by `VideosClient.tsx:135` |
| `api/library/videos/[id]/extract` POST | DONE | consumed by `VideosClient.tsx:124`, `AddVideoDialog.tsx:39`, `ExtractBookButton`-style poll; Inngest bound |
| `getLibraryResources` | DONE | called from `page.tsx:32` |
| `addArticle` | DONE | called from `ArticleList.tsx:43` |
| `addDocuments` | DONE | called from `DocumentList.tsx:54`; dispatches `resource/process.document` |
| delete* actions | DONE | wired to list cards; `assertParentProfile()` gate `:361` |
| `lookupBook` | DONE | `BookScanner.tsx:106,130` |
| `getPlaylistDetails` (youtube-actions) | DONE | imported by `YouTubeImport.tsx`/`generate-resource-core.ts` (creation-station, 10-) — outside library tabs |
| `course-resource-actions.ts` | DONE | consumed by `CourseBuilder.tsx` |
| `AddVideoDialog` | DONE | used by `VideoList.tsx:35` |
| `BarcodeScanner` | DONE | used by `BookScanner.tsx:381` |
| `BookList/VideoList/ArticleList/DocumentList/CourseList/ResourceList` | DONE | mounted in `LibraryClient.tsx:65-87` |
| `AssignResourceDialog` | DONE | used by `ParentDashboard.tsx` (not library tabs) |
| `getLibraryVideos/getLibrarySubjects` | DONE | `videos/page.tsx:3` |
| `processImageForOcr` | DONE | `BookScanner.tsx:174` |
| `generateNanoBananaImage` | DONE | consumed by `generate-resource-core.ts` (10-), not by library files |

## 6. Integration points
- **Imports in:** `@/server/db` (`db`, `withTenant`), `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/auth`, `@/lib/utils/vector` (`searchBooks`, `findSimilarBooks`, `generateBookEmbedding`), `@/lib/utils/book-dedup` (`computeDedupKey`), `@/lib/ai/config` (`models`), `@/lib/ai/video-processing`, `@/lib/api/google-books`, `@/lib/api/open-library`, `@/lib/api/youtube`, `@/lib/firebase-admin` (`getStorageBucket`), `@/inngest/client`, `cheerio`, `html5-qrcode`, `ai` (`generateObject`/`generateText`).
- **Importers out:** Creation Station / generators (`generate-resource-core.ts`, `YouTubeImport.tsx`, `GeneratorsClient.tsx`) consume `getPlaylistDetails` + `generateNanoBananaImage`; `CourseBuilder.tsx` consumes `course-resource-actions`; `ParentDashboard.tsx` consumes `AssignResourceDialog`.
- **Env vars:** `GOOGLE_BOOKS_API_KEY` / `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` (lookup + playlist), `HILOW_INGEST_URL` / `HILOW_INGEST_KEY` (book ingest).
- **External APIs:** Google Books (`scan/route.ts:23`, lookup), OpenLibrary, YouTube Data, Gemini (vision + image gen), Firebase Storage, Hi-Low Studio ingest.
- **Prisma models:** `Book`, `BookExtraction`, `VideoResource`, `VideoExtraction`, `Article`, `DocumentResource`, `Course`, `CourseBlock`, `Resource`, `ResourceKind`, `CurriculumBundle`, `Learner`, `Subject`, `Strand`, `User` (see 02-).
- **Inngest jobs:** `book/extract.requested`, `video/extract.requested`, `resource/process.document` (chapter 23).

## 7. Findings

Q-14-001  [HIGH]  Dead route `GET /api/library/search` does a cross-org vector scan before filtering — `src/app/api/library/search/route.ts`
  Evidence: Grep for `library/search` finds zero callers repo-wide (DEAD). `searchBooks(query, 20)` (`:29`) is wrapped in `withTenant` internally (`vector.ts:25`) but is called with NO explicit ctx AND its raw SQL `SELECT ... FROM "books"` (`vector.ts:29-35`) has NO `organizationId` predicate. RLS is OFF (04-, db.ts:9) so the GUC stamping is inert — the vector query therefore scans ALL orgs' books, returns the top 20 ids, which the route then post-filters by `organizationId` in `db.book.findMany` (`:33-42`, using plain `db` not withTenant). The fallback text search (`:53`) is org-scoped (`organizationId` in WHERE).
  Impact: Live HTTP surface that does a global vector scan over ALL orgs' books before filtering; the embedding model is invoked per request. Reachable by any authenticated user. Maintenance + cross-tenant timing/cost surface. No functional consumer, so unreachable from the UI but remains routable.
  Status: documented (not fixed)

Q-14-002  [MED]  Dead route `POST /api/library/scan` (ISBN→Google Books) has no caller — `src/app/api/library/scan/route.ts`
  Evidence: Grep for `/api/library/scan"` returns no matches; `BookScanner.tsx` only POSTs to `/api/library/scan/vision` (`:178`) and uses the `lookupBook` server action for ISBN (`:106`). The route destructures `organizationId: _orgId` and never uses it (`:14`).
  Impact: Duplicate of `lookupBook` logic; dead HTTP surface and drift risk if Google Books shape changes.
  Status: documented (not fixed)

Q-14-003  [MED]  Broken navigation to removed `/library` route — `src/components/library/ResourceList.tsx:41`
  Evidence: `router.push(\`/library?${params.toString()}\`)` but there is no `src/app/library/` route (Glob `src/app/library/**` → none; canonical is `/living-library`). The extract routes also `revalidatePath("/library")` (`books/[id]/extract/route.ts:119`, `videos/[id]/extract/route.ts:100`).
  Impact: Applying resource filters navigates to a 404 instead of re-rendering the Resources tab; the stale `revalidatePath("/library")` calls are no-ops.
  Status: documented (not fixed)

Q-14-004  [HIGH]  Generated-resources catalog query uses an untyped `where: any` built directly from raw searchParams — `src/app/living-library/page.tsx:47-52`
  Evidence: `const where: any = { organizationId }; if (searchParams.studentId) where.generatedForStudentId = searchParams.studentId; ...` — `studentId`/`courseId`/`bookId`/`toolType` flow into the Prisma filter with no validation that the referenced IDs belong to the caller's org.
  Impact: organizationId is present so rows can't leak (RLS off — 04-, but the explicit predicate holds). However `searchParams.studentId` can be a `string[]` (Next typing) which would produce an unexpected Prisma filter shape; and a courseId/bookId from another org silently yields an empty list rather than an error. Input-validation gap, not a confirmed leak.
  Status: documented (not fixed)

Q-14-005  [MED]  `addArticle`/`addDocuments` server actions trust caller-supplied `organizationId`/`userId` arguments instead of deriving them — `src/app/actions/resource-library-actions.ts:125,250`
  Evidence: Both actions accept `organizationId` and `userId` as plain function args (passed from the client component, `ArticleList.tsx:43`, `DocumentList.tsx:54`) and write with `withTenant(..., { organizationId, userId: null })` using those args. There is no `getCurrentUserOrg()` cross-check that the caller actually belongs to the passed org (unlike `deleteResource` `:363`, which derives it server-side).
  Impact: A crafted server-action invocation could create an Article/DocumentResource (and a Firebase upload under `documents/{organizationId}/...` and an Inngest job carrying that org) for an arbitrary organizationId. RLS is OFF (04-), so the app layer is the only boundary and here it accepts client-provided tenancy. Write-path cross-tenant risk.
  Status: documented (not fixed)

Q-14-006  [MED]  Create/extract API routes are not gated by `assertParentProfile()` — `src/app/api/library/books/route.ts:31`, `videos/route.ts:32`, both `[id]/extract` routes
  Evidence: Only `deleteResource` (`resource-library-actions.ts:361`) calls `assertParentProfile()`. The book/video create + extract POST routes check only `session?.user` + org, so a student profile session (see 13-) could add books/videos and trigger paid AI extraction.
  Impact: A non-parent (student) profile can mutate the org catalog and spend AI/Inngest budget. Authorization-granularity gap.
  Status: documented (not fixed)

Q-14-007  [LOW]  Drift: `GET /api/library/books` is dead and unused `userId` destructured — `src/app/api/library/books/route.ts:14`
  Evidence: Both GET and POST destructure `{ organizationId, userId }`; GET never uses `userId` (`:14`). Grep shows no client fetch of `GET /api/library/books` (catalog uses `getLibraryResources`). The GET handler duplicates the books portion of `getLibraryResources`.
  Impact: Dead read endpoint + duplicate query logic; minor drift surface.
  Status: documented (not fixed)

Q-14-008  [LOW]  Catalog reads via `getLibraryResources` use `unstable_cache` keyed only on `organizationId` but invalidation paths are inconsistent — `src/app/actions/resource-library-actions.ts:13`
  Evidence: The query is cached under tag `library-${organizationId}` with 1h TTL. Writes that should bust it do so unevenly: `addArticle`/`addDocuments`/delete* call `revalidateTag(\`library-${organizationId}\`)`; but the book/video CREATE routes (`books/route.ts`, `videos/route.ts`) do NOT call `revalidateTag` (only the EXTRACT routes do).
  Impact: After adding a book or video, the cached `/living-library` catalog can show stale data for up to 1h unless the user separately triggers an extract (which revalidates) or `router.refresh()` happens to bypass the cache; `BookScanner` redirects to the detail page so the catalog isn't refreshed. UX staleness.
  Status: documented (not fixed)

Q-14-010  [INFO]  ◑ PARTIALLY RESOLVED 2026-06-19 — typed the dynamic-delete switch (removed both @ts-ignore + withTenant<any>, kept the runtime org check); the list-prop any[]→typed sweep is DEFERRED (see CHANGELOG.md). Pervasive `any` typing + `@ts-ignore` across library list components and dynamic delete — `BookList.tsx:24`, `DocumentList.tsx`, `resource-library-actions.ts:366-385`
  Evidence: All `*List` props type their arrays as `any[]`; `deleteResource` uses `tx[model]` with `@ts-ignore` and `withTenant<any>`. `LibraryClient` props are all `any[]`.
  Impact: No compile-time guarantees on the resource shapes flowing client-side; refactors won't be caught by the type checker. Maintainability.
  Status: documented (not fixed)
