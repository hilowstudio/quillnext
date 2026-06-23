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
| `src/app/api/library/books/route.ts` | `POST` create book (+ embedding, Hi-Low ingest, catalog cache-bust) |
| `src/app/api/library/books/[id]/extract/route.ts` | `POST` idempotent book deep-extraction trigger/poll (Inngest `book/extract.requested`) |
| `src/app/api/library/scan/vision/route.ts` | `POST` book-cover image → Gemini vision extraction of metadata |
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
**Catalog render:** `living-library/page.tsx:13` `auth()` → `:20` load `user.organizationId` via plain `prisma` (no withTenant) → `:33` `getLibraryResources(organizationId)` → `:35` students via `withTenant` (excludes parent-as-learner rows — Q-05-006) → `:55` generated `resource.findMany` via `withTenant` with `where` built from raw `searchParams` (`:47-52`) → `LibraryClient` (`:119`).

**Add book (cover scan):** `BookScanner.handleCoverScan` `:168` → `processImageForOcr(file)` (`image-processing.ts:5`, canvas grayscale/contrast) → strip `data:` prefix → `POST /api/library/scan/vision` (`scan/vision/route.ts:19`) → `generateObject` with `models.pro3` + `BookExtractionSchema` (`:36`) → returns metadata → `handleSave` `:202` `POST /api/library/books` → `books/route.ts:19` `assertParentProfile()` (Q-14-006) → `:60` `withTenant(book.create)` → `revalidateTag(`library-${org}`)` busts the catalog cache (`:92`) → best-effort `generateBookEmbedding` (`:104`) → optional Hi-Low ingest (`:114-149`) → redirect to `/living-library/{book.id}`.

**Book deep extraction:** `ExtractBookButton.handleClick` `:43` → `POST /api/library/books/[id]/extract` → `books/[id]/extract/route.ts:47` `assertParentProfile()` (Q-14-006) → `:59` load book via `withTenant` → `:86` `computeDedupKey` → `:93` global `bookExtraction.findUnique` via plain `db` → Case1 EXTRACTED: copy down via `withTenant(book.update)` (`:97`) + re-embed + `revalidateTag`/`revalidatePath("/living-library")` → return `{status:"EXTRACTED",reused:true}`. Case3: `db.bookExtraction.upsert` to EXTRACTING (`:154`) → link book → `inngest.send({name:"book/extract.requested",...})` (`:188`). Client polls every 4s up to 30× (`ExtractBookButton.tsx:65`).

**Add video:** `VideosClient.handleAddVideo` `:77` → `POST /api/library/videos` → `videos/route.ts:43` `assertParentProfile()` (Q-14-006) → `:63` `extractYouTubeVideoId` → `:71` per-org dedupe via `withTenant(findUnique organizationId_youtubeVideoId)` → `:117` create → `revalidateTag(`library-${org}`)` busts the catalog (`:141`) → returns row → `handleExtract` `:143` polls `POST /api/library/videos/[id]/extract` (`videos/[id]/extract/route.ts:46` `assertParentProfile()`), same global-catalog trigger/poll shape via `video/extract.requested`.

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
| `api/library/books` POST | DONE | consumed by `BookScanner.tsx:209`; `assertParentProfile()` gate `:19` (Q-14-006); dead `GET` handler removed (Q-14-007, see CHANGELOG.md) |
| `api/library/books/[id]/extract` POST | DONE | consumed by `ExtractBookButton.tsx:34`; `assertParentProfile()` gate `:47` (Q-14-006); Inngest bound (`extract-book.ts`) |
| `api/library/scan/route.ts` POST | REMOVED | dead route deleted 2026-06-21 (Q-14-002, see CHANGELOG.md); ISBN lookup uses `lookupBook` action |
| `api/library/scan/vision` POST | DONE | consumed by `BookScanner.tsx:178` |
| `api/library/search` GET | REMOVED | dead route deleted 2026-06-21 (Q-14-001, see CHANGELOG.md); its sole consumer `searchBooks` also removed (ch.15 Q-15-001) |
| `api/library/videos` GET/POST | DONE | POST consumed by `VideosClient.tsx:85`, `AddVideoDialog.tsx:55` (POST `assertParentProfile()` gate `:43`, Q-14-006); GET by `VideosClient.tsx:135` |
| `api/library/videos/[id]/extract` POST | DONE | consumed by `VideosClient.tsx:124`, `AddVideoDialog.tsx:39`, `ExtractBookButton`-style poll; `assertParentProfile()` gate `:46` (Q-14-006); Inngest bound |
| `getLibraryResources` | DONE | called from `page.tsx:33` |
| `addArticle` | DONE | called from `ArticleList.tsx:43`; derives org via `getCurrentUserOrg()` + `assertParentProfile()` gate (Q-14-005) |
| `addDocuments` | DONE | called from `DocumentList.tsx:54`; derives org via `getCurrentUserOrg()` + `assertParentProfile()` gate (Q-14-005); dispatches `resource/process.document` |
| delete* actions | DONE | wired to list cards; `assertParentProfile()` gate `:393` |
| `lookupBook` | DONE | `BookScanner.tsx:106,130` |
| `getPlaylistDetails` (youtube-actions) | DONE | imported by `YouTubeImport.tsx`/`generate-resource-core.ts` (creation-station, 10-) — outside library tabs |
| `course-resource-actions.ts` | DONE | consumed by `CourseBuilder.tsx` |
| `AddVideoDialog` | DONE | used by `VideoList.tsx:35` |
| `BarcodeScanner` | DONE | used by `BookScanner.tsx:381` |
| `BookList/VideoList/ArticleList/DocumentList/CourseList/ResourceList` | DONE | mounted in `LibraryClient.tsx:65-87`; `CourseList` delete fixed 2026-06-22 (Q-14-009 ✅ — `deleteCourse({id})`) |
| `AssignResourceDialog` | DONE | used by `ParentDashboard.tsx` (not library tabs) |
| `getLibraryVideos/getLibrarySubjects` | DONE | `videos/page.tsx:3` |
| `processImageForOcr` | DONE | `BookScanner.tsx:174` |
| `generateNanoBananaImage` | DONE | consumed by `generate-resource-core.ts` (10-), not by library files |

## 6. Integration points
- **Imports in:** `@/server/db` (`db`, `withTenant`), `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/auth`, `@/lib/utils/vector` (`findSimilarBooks`, `generateBookEmbedding`), `@/lib/utils/book-dedup` (`computeDedupKey`), `@/lib/ai/config` (`models`), `@/lib/ai/video-processing`, `@/lib/api/google-books`, `@/lib/api/open-library`, `@/lib/api/youtube`, `@/lib/firebase-admin` (`getStorageBucket`), `@/inngest/client`, `cheerio`, `html5-qrcode`, `ai` (`generateObject`/`generateText`).
- **Importers out:** Creation Station / generators (`generate-resource-core.ts`, `YouTubeImport.tsx`, `GeneratorsClient.tsx`) consume `getPlaylistDetails` + `generateNanoBananaImage`; `CourseBuilder.tsx` consumes `course-resource-actions`; `ParentDashboard.tsx` consumes `AssignResourceDialog`.
- **Env vars:** `GOOGLE_BOOKS_API_KEY` / `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` (lookup + playlist), `HILOW_INGEST_URL` / `HILOW_INGEST_KEY` (book ingest).
- **External APIs:** Google Books (`library-lookup-actions.ts` `lookupBook`, `scan/vision`), OpenLibrary, YouTube Data, Gemini (vision + image gen), Firebase Storage, Hi-Low Studio ingest.
- **Prisma models:** `Book`, `BookExtraction`, `VideoResource`, `VideoExtraction`, `Article`, `DocumentResource`, `Course`, `CourseBlock`, `Resource`, `ResourceKind`, `CurriculumBundle`, `Learner`, `Subject`, `Strand`, `User` (see 02-).
- **Inngest jobs:** `book/extract.requested`, `video/extract.requested`, `resource/process.document` (chapter 23).

## 7. Findings

Q-14-001  [HIGH]  ✅ RESOLVED 2026-06-21 (Session 29) — `git rm src/app/api/library/search/route.ts`. The route was DEAD (zero callers, exhaustive grep over every `/api/library/*` fetch in `src/`) AND a cross-org abuse surface: reachable by ANY authenticated user, each call ran an unscoped pgvector scan over all orgs' books + a per-request embedding call. Deleting eliminated both. Its orphaned sole consumer `searchBooks` (vector.ts) was also removed → closes the sibling **ch.15 Q-15-001** ("searchBooks raw SQL has no account_id predicate") resolved-by-removal. Owner deleted the wrong-scoped per-org book-search; the **community semantic-search + cross-edition-dedup** vision is captured fresh in the ch.24 §5 roadmap + new **Q-13-009** [LOW]. A 2-finding adversarial Workflow confirmed reproduces ✓ / deletion tsc-safe (nothing imports the route file) / HIGH defensible. See CHANGELOG.md round 32. — was Dead route `GET /api/library/search` does a cross-org vector scan before filtering — `src/app/api/library/search/route.ts`
  Evidence (historical): Grep for `library/search` finds zero callers repo-wide (DEAD). `searchBooks(query, 20)` (`:29`) is wrapped in `withTenant` internally (`vector.ts:25`) but is called with NO explicit ctx AND its raw SQL `SELECT ... FROM "books"` (`vector.ts:29-35`) has NO `organizationId` predicate. RLS is OFF (04-, db.ts:9) so the GUC stamping is inert — the vector query therefore scans ALL orgs' books, returns the top 20 ids, which the route then post-filters by `organizationId` in `db.book.findMany` (`:33-42`, using plain `db` not withTenant). The fallback text search (`:53`) is org-scoped (`organizationId` in WHERE).
  Impact: Live HTTP surface that does a global vector scan over ALL orgs' books before filtering; the embedding model is invoked per request. Reachable by any authenticated user. Maintenance + cross-tenant timing/cost surface. No functional consumer, so unreachable from the UI but remains routable.
  Status: ✅ RESOLVED 2026-06-21 (Session 29) — route removed (+ orphaned `searchBooks` removed; closes ch.15 Q-15-001)

Q-14-002  [MED]  ✅ REMOVED 2026-06-21 (Session 28) — `git rm src/app/api/library/scan/route.ts` (dead route: zero callers across all reference forms — only `/api/library/scan/vision` is used, by `BookScanner.tsx:178`; ISBN lookup goes through the `lookupBook` server action, which additionally has an OpenLibrary fallback the dead route lacked). Orphaned nothing; the sibling `scan/vision/route.ts` + `living-library/scan/page.tsx` are unrelated and untouched. Same class as Q-14-007 (dead GET handler, S27) / Q-03-001 (dead seed). See CHANGELOG.md round 31. — was Dead route `POST /api/library/scan` (ISBN→Google Books) has no caller — `src/app/api/library/scan/route.ts`
  Evidence (historical): Grep for `/api/library/scan"` returns no matches; `BookScanner.tsx` only POSTs to `/api/library/scan/vision` (`:178`) and uses the `lookupBook` server action for ISBN (`:106`). The route destructured `organizationId: _orgId` and never used it (`:14`).
  Impact: Duplicate of `lookupBook` logic; dead HTTP surface and drift risk if Google Books shape changes.
  Status: ✅ removed (route deleted)

Q-14-003  [MED]  ✅ RESOLVED 2026-06-21 (Session 28) — `ResourceList.tsx:41` now pushes to `/living-library?…` (verified: `?tab=resources` + the **uncached** searchParams-driven `resource.findMany` in `page.tsx:48-105` render the filtered Resources tab — the page is dynamic, no stale Data Cache masks it), and the 2 dead `revalidatePath("/library")` lines were DELETED from the extract routes (each already has `revalidateTag` + `revalidatePath("/living-library")` directly above → no real invalidation lost; consistent with the Q-14-008 precedent that `/library` is a dead no-op). The adversarial pass also surfaced a sibling dead no-op `revalidatePath("/resources")` in `deleteResource` (no `/resources` route) → DELETED in the same pass (owner-approved; consequential cleanup, not a new finding). See CHANGELOG.md round 31. — was Broken navigation to removed `/library` route — `src/components/library/ResourceList.tsx:41`
  Evidence (historical): `router.push(\`/library?${params.toString()}\`)` but there was no `src/app/library/` route (canonical is `/living-library`). The extract routes also `revalidatePath("/library")` (`books/[id]/extract/route.ts:119`, `videos/[id]/extract/route.ts:100`).
  Impact: Applying resource filters navigated to a 404 instead of re-rendering the Resources tab; the stale `revalidatePath("/library")` calls were no-ops.
  Status: ✅ resolved (nav fixed + dead no-ops removed)

Q-14-004  [HIGH]  ✅ RESOLVED 2026-06-21 (Session 29) — typed the `where` as `Prisma.ResourceWhereInput` + coerced all 4 `searchParams` (`studentId`/`courseId`/`bookId`/`toolType`) to a single string via `Array.isArray(v)?v[0]:v` (page.tsx:48-64), so a crafted `?studentId=a&studentId=b` array can no longer flow into a scalar Prisma field (which would throw a validation error → 500 the page). The `organizationId` predicate was ALWAYS unconditionally present → no cross-tenant leak; the adversarial Workflow confirmed **HIGH was over-graded** (really MED/LOW input-validation — no leak, no injection: Prisma parameterizes, `toolType` is a value-equality, cross-org `courseId`/`bookId` just AND to zero rows) but the cheap fix CLOSES it → re-grade **moot** (recorded for honesty in CHANGELOG). Verifier sharpening: with the typed `where`, coercion is MANDATORY not optional — `string[]` won't assign to the scalar field types (type + coerce are coupled). See CHANGELOG.md round 32. — was Generated-resources catalog query uses an untyped `where: any` built directly from raw searchParams — `src/app/living-library/page.tsx:47-52`
  Evidence (historical): `const where: any = { organizationId }; if (searchParams.studentId) where.generatedForStudentId = searchParams.studentId; ...` — `studentId`/`courseId`/`bookId`/`toolType` flow into the Prisma filter with no validation that the referenced IDs belong to the caller's org.
  Impact: organizationId is present so rows can't leak (RLS off — 04-, but the explicit predicate holds). However `searchParams.studentId` can be a `string[]` (Next typing) which would produce an unexpected Prisma filter shape; and a courseId/bookId from another org silently yields an empty list rather than an error. Input-validation gap, not a confirmed leak.
  Status: ✅ RESOLVED 2026-06-21 (Session 29) — typed `where` (`Prisma.ResourceWhereInput`) + single-string param coercion; over-graded HIGH (really MED/LOW), fix-and-close → re-grade moot

Q-14-005  [MED]  ✅ RESOLVED 2026-06-21 (Session 28) — both actions now DERIVE `{organizationId,userId}` server-side via `getCurrentUserOrg()` (+ a null-org guard) instead of trusting client args; the client-passed `organizationId`/`userId` params were DROPPED from the signatures and the call sites + props cleaned up (`ArticleList`/`DocumentList`/`LibraryClient` — `userId` removed end-to-end incl. `page.tsx`; `BookList`'s own `organizationId` prop unaffected). Also added `auth()` + `assertParentProfile()` (owner-approved, uniform with the 4 API routes Q-14-006 + `deleteResource`) so a STUDENT profile on the shared family login can't add articles/documents either; `withTenant` still stamps `{organizationId, userId:null}`, `addedByUserId` uses the derived `userId`. **Severity note:** the adversarial pass graded this a true HIGH (authenticated cross-tenant WRITE IDOR — also injected into another tenant's Firebase `documents/{org}/` namespace + Inngest job); since it is fix-and-CLOSED this session the re-grade is moot (MED count decrements). See CHANGELOG.md round 31. — was `addArticle`/`addDocuments` server actions trust caller-supplied `organizationId`/`userId` arguments instead of deriving them — `src/app/actions/resource-library-actions.ts:125,266`
  Evidence (historical): Both actions accepted `organizationId`/`userId` as plain client-passed args (`ArticleList.tsx:43`, `DocumentList.tsx:54`) and wrote with `withTenant(..., { organizationId, userId: null })` using those args. No `getCurrentUserOrg()` cross-check (unlike `deleteResource`, which derives it server-side).
  Impact: A crafted server-action invocation could create an Article/DocumentResource (+ a Firebase upload under `documents/{organizationId}/...` + an Inngest job carrying that org) for an arbitrary organizationId. RLS is OFF (04-), so the app layer is the only boundary and here it accepted client-provided tenancy. Write-path cross-tenant risk.
  Status: ✅ resolved (server-derived org + parent gate)

Q-14-006  [MED]  ✅ RESOLVED 2026-06-21 (Session 28) — added `assertParentProfile()` (wrapped in try/catch → a clean **403**, since the POST bodies have no outer try/catch and a bare throw would 500) right after the auth+org check in all 4 routes: `books/route.ts:19`, `videos/route.ts:43`, `books/[id]/extract/route.ts:47`, `videos/[id]/extract/route.ts:46`. Verified regression-free: no student-learning flow calls them (`profile-access.test.ts` asserts STUDENT is blocked from `/living-library` + `/videos`; the only student-reachable library page is the read-only `resource/[id]`), the guard works in route handlers (precedent `blocks/[blockId]/route.ts:216`), and the book-detail self-heal updates the DB directly in the RSC (`[id]/page.tsx:83-104`), NOT via the extract route. The sibling `addArticle`/`addDocuments` server actions got the same gate as part of Q-14-005. See CHANGELOG.md round 31. — was Create/extract API routes are not gated by `assertParentProfile()` — `src/app/api/library/books/route.ts`, `videos/route.ts`, both `[id]/extract` routes
  Evidence (historical): Only `deleteResource` (`resource-library-actions.ts:361`) called `assertParentProfile()`. The book/video create + extract POST routes checked only `session?.user` + org, so a student profile session (see 13-) could add books/videos and trigger paid AI extraction.
  Impact: A non-parent (student) profile could mutate the org catalog and spend AI/Inngest budget. Authorization-granularity gap.
  Status: ✅ resolved (assertParentProfile added to all 4 routes)

Q-14-007  [LOW]  ✅ RESOLVED 2026-06-21 (Session 27) — deleted the dead `GET /api/library/books` handler. Exhaustive grep (incl. template-string / base+path URL forms, tests) found zero callers: the only root-path caller is `BookScanner.tsx:209` (method POST), the catalog reads books via the `getLibraryResources` server action, and `ExtractBookButton.tsx:34` hits the separate `/[id]/extract` route. Deleting the handler also removed the unused GET-scoped `userId`. The live `POST` is untouched and no import was orphaned (`db` is still used by POST's subject/strand lookups). See CHANGELOG.md round 30. — was Drift: `GET /api/library/books` dead + unused `userId` destructured — `src/app/api/library/books/route.ts:14`
  Evidence (historical): Both GET and POST destructured `{ organizationId, userId }`; GET never used `userId`. Grep showed no client fetch of `GET /api/library/books` (catalog uses `getLibraryResources`). The GET handler duplicated the books portion of `getLibraryResources`.
  Impact: Dead read endpoint + duplicate query logic; minor drift surface.
  Status: ✅ resolved (handler removed)

Q-14-008  [LOW]  ✅ RESOLVED 2026-06-21 (Session 27) — the book + video CREATE routes (`books/route.ts:83`, `videos/route.ts:132`) now call `revalidateTag(\`library-${organizationId}\`, {})` immediately after the create, matching `addArticle`/`addDocuments`/delete* and the extract routes; the cached `/living-library` catalog busts on add instead of staying stale to the 1h TTL. revalidateTag-only (not revalidatePath — addArticle/addDocuments use only revalidateTag, and Q-14-003 flags `revalidatePath("/library")` as a dead no-op). See CHANGELOG.md round 30. — was Catalog reads via `getLibraryResources` use `unstable_cache` keyed on `organizationId` with inconsistent invalidation — `src/app/actions/resource-library-actions.ts:13`
  Evidence (historical): The query is cached under tag `library-${organizationId}` (1h TTL). `addArticle` (:233)/`addDocuments` (:316)/delete* (:405) AND both extract routes (books :117, videos :98) called `revalidateTag`; the book/video CREATE routes did NOT.
  Impact: After adding a book/video, the cached `/living-library` catalog could show stale data up to 1h. (The original finding's hedge that `router.refresh()` "happens to bypass the cache" was FALSE — `router.refresh()` clears the client Router Cache and re-runs the RSC, but `getLibraryResources` returns the still-memoized `unstable_cache` Data Cache value until the tag is revalidated or the TTL expires, so `revalidateTag` was the ONLY real fix.) Adversarial-pass nuance: the BOOK path was the clear beneficiary (`BookScanner` redirects to the detail page, no extract); the VIDEO path was partly masked because an EXTRACTED extract already revalidated — the create-route call closes the stuck-`EXTRACTING` gap. The standalone `/living-library/videos` page reads uncached `getLibraryVideos`, so only the catalog Videos tab was affected.
  Status: ✅ resolved (revalidateTag added to both CREATE routes)

Q-14-009  [MED]  ✅ RESOLVED (born-resolved) 2026-06-22 (consolidated pass / ch.20-HIGH) — Course delete from the library Courses tab was BROKEN: `CourseList.tsx:65` called `deleteCourse(course.id)` (bare string) but `deleteCourse` (course-actions.ts:175) does `deleteCourseSchema.parse(rawData)` where `deleteCourseSchema = z.object({ id: z.string().uuid() })` (lib/schemas/actions.ts:29) — parsing a string against an object schema throws a ZodError, caught by the client try/catch → "An error occurred" toast; the course is never deleted. Surfaced by the ch.20 Q-20-002 adversarial pass (identical string-vs-object pattern). **Fixed:** `deleteCourse({ id: course.id })`. Broken-feature bug, not a vuln (the action is fully auth/org-guarded). CI green. (see CHANGELOG.md)
  Evidence: `CourseList.tsx:65` `await deleteCourse(course.id)`; `course-actions.ts:175-176` `deleteCourseSchema.parse(rawData)` over `z.object({id})`.
  Impact: Deleting a course from the library Courses tab silently failed (toast error, row remained).
  Status: ✅ resolved (client now passes `{ id }`)

Q-14-010  [INFO]  ◑ PARTIALLY RESOLVED 2026-06-19 — typed the dynamic-delete switch (removed both @ts-ignore + withTenant<any>, kept the runtime org check); the list-prop any[]→typed sweep is DEFERRED (see CHANGELOG.md). Pervasive `any` typing + `@ts-ignore` across library list components and dynamic delete — `BookList.tsx:24`, `DocumentList.tsx`, `resource-library-actions.ts:366-385`
  Evidence: All `*List` props type their arrays as `any[]`; `deleteResource` uses `tx[model]` with `@ts-ignore` and `withTenant<any>`. `LibraryClient` props are all `any[]`.
  Impact: No compile-time guarantees on the resource shapes flowing client-side; refactors won't be caught by the type checker. Maintainability.
  Status: documented (not fixed)
