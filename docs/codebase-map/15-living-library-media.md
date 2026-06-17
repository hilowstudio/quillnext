# 15 — Living Library: Books / Videos / Articles / Documents, Media Processing & Vector Search

> Code-truth reference. Verified against source on 2026-06-15. Where this doc and
> in-repo prose/comments disagree, **the code wins** (several stale comments are
> flagged below). Paths are repo-relative to `c:/Users/adam/quillnext`.

---

## Purpose & role in the app

The **Living Library** is QuillNext's per-organization content repository. It holds
five first-class resource types plus generated artifacts:

- **Books** (`Book`) — added via ISBN lookup, title/author search, or AI vision on a
  cover photo. Embedded into pgvector for semantic search & "similar books".
- **Video resources** (`VideoResource`) — YouTube URLs whose content is "watched" by
  Gemini to produce a summary + key points, then embedded.
- **Articles** (`Article`) — web URLs scraped server-side with Cheerio.
- **Documents** (`DocumentResource`) — uploaded PDF/TXT/MD files stored in Firebase
  Storage and text-extracted asynchronously via an Inngest worker.
- **Generated resources** (`Resource`) — quizzes/worksheets/etc. produced by the
  Creation Station, surfaced here under the "Resources" tab and via a viewer route.
- **Courses** (`Course`) — listed here for convenience (owned by the Courses subsystem).

It also exposes the **media→AI→vector** pipeline: ISBN/vision book intake, YouTube
transcript/summary extraction, PDF text extraction, Firebase Storage uploads,
Gemini image generation (gemini-3-pro-image; only loosely owned here), and **pgvector** cosine-similarity
search/related-content. The hub page is `/living-library`; supporting routes are
`/living-library/scan`, `/living-library/videos`, `/living-library/[id]` (book detail),
and `/living-library/resource/[id]` (generated-resource viewer).

---

## File-by-file reference

### Pages & client components (`src/app/living-library/**`)

#### `src/app/living-library/page.tsx` — Library hub (server component)
- **Role:** Server entry for `/living-library`. Auths via `auth()`, redirects to
  `/auth/login` if no session (note: a **different** login path than every other page
  in this subsystem, which use `/login` — see Risks).
- **Tenancy:** Resolves `organizationId` from `user.findUnique` directly (not via
  `getCurrentUserOrg`); returns a bare `<div>Organization not found</div>` if missing.
- **Data:** Calls `getLibraryResources(organizationId)` (cached DAL) for
  books/videos/articles/documents/courses, then **separately** queries `Student` and a
  filtered `Resource` list (filters: `studentId`, `courseId`, `bookId`, `toolType`,
  `page.tsx:42-94`). The `where` clause is typed `any` (`page.tsx:42`).
- **Notes:** `toolType` filter maps to `resourceKind.code` (`page.tsx:47`). Passes a
  flat `initialData` blob to `LibraryClient`. The generated-`Resource` query here is
  redundant with the one inside `getLibraryResources` but selects richer fields.

#### `src/app/living-library/LibraryClient.tsx` — Tab shell (`"use client"`)
- **Role:** Tabbed UI (Books/Videos/Articles/Documents/Courses/Resources). Tab is
  driven by the `?tab=` query param (`LibraryClient.tsx:38-44`).
- **Notes:** Holds `useState` for each list but several setters are inert:
  `BookList` is handed `refreshBooks={() => {}}` (`:66`); the Resources tab reads
  `initialData.resources` directly, bypassing state. Lots of `any[]` props.

#### `src/app/living-library/[id]/page.tsx` — Book detail (server component)
- **Role:** Book detail view for `/living-library/{bookId}`. Auths, redirects to
  `/login` if unauthenticated; uses `getCurrentUserOrg()` for org.
- **Tenancy:** `db.book.findUnique({where:{id}})` then **manual org check**
  `book.organizationId !== organizationId → redirect("/living-library")` (`:52`). Good.
- **Data:** Includes `subject`, `strand`, and up to 5 `generatedMaterials`
  (`BookGeneratedMaterial` → resource + resourceKind). Calls
  `findSimilarBooks(book.id, 5).catch(()=>[])` for the sidebar (`:58`).
- **⚠ Cross-org leak:** `findSimilarBooks` runs raw SQL **without an org filter**
  (see `vector.ts` below). The returned titles/summaries are rendered with links to
  `/living-library/{id}` (`:222-237`) — so a book's "Similar Books" sidebar can show
  and link to **other organizations'** books. Clicking the link then hits the
  org-checked detail page and redirects away, but the title/summary text already
  leaked.
- **Notes:** Renders `extractionStatus` badge and `book.summary` ("Inkling-Generated
  Summary"), though no code in this subsystem ever populates `Book.summary` or
  `Book.extractionStatus = EXTRACTED` (books are created `NOT_EXTRACTED` and never
  advanced — see Risks). `coverUrl` rendered via raw `<img>`.

#### `src/app/living-library/resource/[id]/page.tsx` — Generated-resource viewer (server)
- **Role:** Read-only viewer for a generated `Resource`. Target of "View Resource"
  links app-wide and Curriculum Compiler bundle chips (per its own header comment).
- **Tenancy:** `auth()` → `/login` redirect; `getCurrentUserOrg()`; loads resource and
  treats `resource.organizationId !== organizationId` as **not found** (`:31`) rather
  than redirecting — renders a "Resource not found" card. Correct org isolation.
- **Rendering:** If `storageType === "MARKDOWN"` and `content.markdown` is a string,
  renders `<MarkdownContent>`; otherwise dumps `JSON.stringify(content)` in a `<pre>`
  (`:55-68`). Non-null-asserts (`resource!`) after the `notFound` guard.

#### `src/app/living-library/scan/page.tsx` — Book scan page (server)
- **Role:** `/living-library/scan`. Auths (`/login` redirect), `getCurrentUserOrg()`,
  redirects to `/onboarding` if no org. Renders `<BookScanner organizationId=...>`.

#### `src/app/living-library/videos/page.tsx` — Videos page (server)
- **Role:** `/living-library/videos`. Auths (`/login`). Parallel-fetches
  `getLibraryVideos(org)` + `getLibrarySubjects()` (DAL), passes to `VideosClient`.
  Casts both to `any` at the server/client boundary (`:27-28`).

#### `src/app/living-library/videos/VideosClient.tsx` — Videos manager (`"use client"`)
- **Role:** Add-by-URL form (subject/strand optional) + grid of video cards with an
  **Extract** action. This is a **parallel, REST-based** video flow distinct from the
  `AddVideoDialog` server-action flow used on the main hub (see flows).
- **Behavior:** `POST /api/library/videos` to add (`:74`); auto-calls `handleExtract`
  if a subject was chosen (`:95-97`); `POST /api/library/videos/{id}/extract` then
  re-`GET`s the full list to refresh (`:111-134`). Strands lazy-loaded from
  `/api/curriculum/strands?subjectId=` (`:57`).
- **Notes:** Uses `alert()` for errors. Long inline comments admit the refresh logic
  is provisional ("ideally this is a Server Action", `:129`).

### API routes (`src/app/api/library/**`) — all `export const dynamic = "force-dynamic"`

#### `src/app/api/library/books/route.ts` — Book list & create
- **GET:** Auth + `getCurrentUserOrg`; `db.book.findMany({where:{organizationId}})`
  incl. subject/strand. Org-scoped.
- **POST:** Auth + org. Requires `subjectId` (400 if missing); validates subject &
  optional strand belong together; `db.book.create` with `extractionStatus:"NOT_EXTRACTED"`,
  `externalSource` defaulting to `"MANUAL"`.
- **Embedding (best-effort):** If `title`/`description` present, dynamically imports
  `generateBookEmbedding` and embeds `title + description + authors` (`:99-111`).
  Failure is caught and **loudly logged** (book id in the message) but does not fail
  creation — a null-embedding book is silently invisible to semantic search. Returns
  `{ book, embedded }`.
- **Hi-Low ingest:** If `HILOW_INGEST_URL` + `HILOW_INGEST_KEY` env vars set, POSTs a
  book "insight" to the external Hi-Low Studio content engine with a Bearer token
  (`:114-148`). Best-effort, failures logged. (Cross-subsystem external integration.)

#### `src/app/api/library/videos/route.ts` — Video list & create
- **GET:** Auth + org; `videoResource.findMany({where:{organizationId}})` incl. subject/strand.
- **POST:** Auth + org. Validates URL via `isYouTubeUrl` and extracts id via
  `extractYouTubeVideoId` (both from `@/lib/ai/video-processing`). **Global** dedup on
  `youtubeVideoId` (`findUnique` — the column is `@unique`, so two orgs cannot both add
  the same video; see Risks). Creates record `NOT_EXTRACTED`. Does **not** trigger
  extraction or fetch YouTube metadata (title/thumbnail/channel stay null until an
  extract call, and even then title/thumbnail aren't populated by the extract route).

#### `src/app/api/library/videos/[id]/extract/route.ts` — Synchronous video extraction
- **POST:** Auth + org; loads video, org-checks (`:26`). Sets status `EXTRACTING`,
  calls `extractVideoContent(youtubeUrl)` (Gemini, see config), writes
  `extractedSummary` + `extractedKeyPoints`, status `EXTRACTED`, then best-effort
  `generateVideoEmbedding` (`:55-60`). On error sets status `FAILED` and returns 500.
- **Notes:** Runs inline in the request (can be slow — Gemini "watches" the video).
  Does **not** set `title`, `thumbnailUrl`, `channelName`, `extractedTranscript`, or
  `durationSeconds` (transcript explicitly deferred, `:48-49`).

#### `src/app/api/library/scan/route.ts` — ISBN scan (Google Books)
- **POST:** Auth; org is fetched but **discarded** (`organizationId: _orgId`, `:14`).
  Takes `{ isbn }`, calls Google Books `volumes?q=isbn:` **with no API key**, maps the
  first volume to a book-shaped object, returns `{ book: bookData }`. Does **not**
  persist. Largely superseded by the `lookupBook` server action (BookScanner uses the
  action, not this route — see Risks: likely dead route).

#### `src/app/api/library/scan/vision/route.ts` — Cover OCR (Gemini vision)
- **POST:** Auth only (**no org check**). Takes base64 `{ image }`, builds a
  `data:image/jpeg;base64,...` URL, calls `generateObject({ model: models.pro3 })` with
  `BookExtractionSchema` (zod: title required; isbn/authors/publisher/date/desc/pages
  optional). Returns `{ book: object }`. Stateless extraction; persistence happens
  later via `POST /api/library/books`. This is the **only** caller of `models.pro3`
  vision in this subsystem and the only consumer of `BookScanner`'s processed image.

#### `src/app/api/library/search/route.ts` — Semantic book search
- **GET `?q=`:** Auth + org. `searchBooks(query, 20)` (pgvector) → collects ids →
  `book.findMany({ id:{in}, organizationId })` (**org filter applied here**) →
  re-sorts by the vector ranking. On any error, falls back to a Prisma
  `contains`/insensitive text search over title+description (`:52-69`).
- **⚠ Dead surface:** No UI in `src/app` or `src/components` calls `/api/library/search`.
  It is functional but unreferenced (semantic search is advertised in the changelog but
  not wired to any input). `searchVideos` in `vector.ts` has **no callers at all**.

### Server actions (`src/app/actions/**`)

#### `src/app/actions/library-lookup-actions.ts` — `lookupBook` (`"use server"`)
- Validates with `searchLibrarySchema` (`query`, optional `type` BOOK/VIDEO/RESOURCE).
  Maps `type==="BOOK"` → ISBN lookup, else → title/author search.
- **ISBN path:** strips to `[0-9X]`, tries `lookupGoogleBookByIsbn` then falls back to
  `lookupOpenLibraryByIsbn`. **Title path:** `searchGoogleBooks`, returns first result.
- Uses `process.env.GOOGLE_BOOKS_API_KEY`. Returns `{success, data?, error?}`. This is
  the lookup used by `BookScanner` (ISBN & Search tabs).

#### `src/app/actions/youtube-actions.ts` — `getPlaylistDetails` (`"use server"`)
- Validates `fetchPlaylistSchema` (`url`). **Reuses `GOOGLE_BOOKS_API_KEY`** for the
  YouTube Data API (comments admit there is no dedicated `YOUTUBE_API_KEY`, `:10-14`).
  Calls `fetchPlaylistData`. Consumed by `YouTubeImport` and by
  `generate-resource-core.ts` (Creation Station playlist→curriculum flow).

#### `src/app/actions/process-video.ts` — `processVideoResource` (`"use server"`)
- Auth + `getCurrentUserOrg`. Delegates to `VideoProcessor.processYouTubeVideo`, then
  `revalidatePath("/living-library")`. Returns the processor result, or
  `{success:false, error}` on throw. This is the **hub** video flow (via `AddVideoDialog`).

#### `src/app/actions/resource-library-actions.ts` — Library DAL + mutations (`"use server"`)
- **`getLibraryResources(orgId)`** — `unstable_cache`d (key/tag `library-{orgId}`,
  `revalidate: 3600`). One `Promise.all` fetching books, videoResources, articles,
  documentResources, courses, generated resources, **and** curriculumBundles (`:19-106`),
  each `take`-bounded. Returns `{success:true, ...}`. (Note: returns `bundles` too, but
  the page only destructures 5 keys.)
- **`addArticle(url, orgId, userId)`** — server-side `fetch` + Cheerio scrape; extracts
  title/description/og:image + concatenated `<p>` text; creates `Article`
  (`extractionStatus:"EXTRACTED"`). **No SSRF guard** on the URL (see Risks). No embedding.
- **`addDocuments(formData, orgId, userId)`** — for each file: buffer → upload to
  Firebase Storage at `documents/{orgId}/{ts-filename}` (`getStorageBucket`), create
  `DocumentResource` with empty `extractedText`, then `inngest.send("resource/process.document",
  { resourceId, fileUrl: storagePath, fileType })` (`:201-208`). Background extraction.
- **`deleteBook/Video/Article/Document/GeneratedResource`** — each validates a
  `{id: uuid}` and calls the shared **`deleteResource(id, model)`** which auths,
  org-checks `resource.organizationId !== organizationId` (throws if mismatch, `:278`),
  deletes, and revalidates `library-{orgId}` + `/living-library` + `/resources`.
  Uses dynamic `prisma[model]` with `@ts-ignore`.

### Server queries & services (`src/server/**`)

#### `src/server/queries/library.ts` (`"server-only"`)
- **`getLibraryVideos(orgId)`** — org-scoped `videoResource.findMany` with an explicit
  `select` (id/url/videoId/title/desc/thumb/duration/channel/status/summary + subject &
  strand names), `take:100`. Shape matches `VideosClient`'s `Video` interface.
- **`getLibrarySubjects()`** — **all** subjects (id/name/code), not org-scoped (subjects
  are global taxonomy).

#### `src/server/services/video-processor.ts` (`"server-only"`)
- **`VideoProcessor.processYouTubeVideo(url, orgId, userId)`** — the hub video pipeline:
  validate URL/id → idempotency check (skip if existing & `EXTRACTED`) → **upsert** on
  `youtubeVideoId` to `EXTRACTING` (title `"Processing..."`) → `extractVideoContent`
  (Gemini) → update with summary/keyPoints/`EXTRACTED` (title set to literal
  `"Video: {videoId}"`, `:60`) → `generateVideoEmbedding`. On error, `updateMany` by
  `youtubeVideoId` → `FAILED`, rethrows.
- **⚠ Cross-org upsert:** the upsert keys solely on `youtubeVideoId` (`:40`) with no org
  scoping, so it can silently flip another org's video record to `EXTRACTING`/`FAILED`
  (the `@unique` constraint means the same video can only belong to one org anyway).

### Inngest worker (`src/inngest/functions/**`)

#### `src/inngest/functions/process-document.ts`
- **`processDocument`** — Inngest function (`id: "process-document"`, event
  `resource/process.document`). Registered in `src/app/api/inngest/route.ts`.
- **Steps:** (1) `download-file` — if `fileUrl` starts with `http`, `fetch` it; else
  treat it as a Storage path and `bucket.file(fileUrl).download()` (the action passes a
  **path**, so the Admin-SDK branch is the live one). Returns base64. (2) `extract-text`
  — PDFs parsed via `pdf2json` (`parsePdfBuffer`, text-only mode); other types decoded
  as UTF-8. (3) `update-db` — writes `extractedText`, then `revalidateTag(library-{orgId})`.
- **Notes:** `pdf2json` imported with `@ts-ignore` (`:6`). Lots of stale "REFACTOR"/
  "Scale 3" comments describing indecision about path vs URL — the path branch is what
  actually runs. No status field on `DocumentResource` (it has none in schema), so
  failures only surface in logs.

### External API clients (`src/lib/api/**`)

#### `src/lib/api/google-books.ts`
- `searchGoogleBooks(query, apiKey?)` — `volumes?q=&maxResults=5`, maps volumeInfo to
  `BookMetadata`; prefers ISBN_13 then ISBN_10; upgrades cover `http:`→`https:`.
  Returns `[]` on error. `lookupGoogleBookByIsbn` = `searchGoogleBooks("isbn:"+isbn)[0]`.
- Exports the `BookMetadata` interface used across the lookup flow.

#### `src/lib/api/open-library.ts`
- `lookupOpenLibraryByIsbn(isbn)` — Open Library `/api/books?bibkeys=ISBN:…&jscmd=data`,
  maps to `BookMetadata`. Description falls back to a literal "No description available
  via OpenLibrary." string. Returns `null` on miss. Fallback for Google Books.

#### `src/lib/api/youtube.ts`
- `fetchPlaylistData(urlOrId, apiKey?)` — YouTube Data v3: playlist details +
  `playlistItems` (`maxResults=50`), filters out "Private video"/"Deleted video".
  Returns `YouTubePlaylist` (with `videos: YouTubeVideo[]`) or `null`. Requires an API
  key (none → logs + null). Note `itemCount` is set to the **filtered** length, not the
  API's `contentDetails.itemCount`.

### Libs & services (`src/lib/**`)

#### `src/lib/firebase-admin.ts` (`"server-only"`)
- `getFirebaseAdmin()` — lazy `admin.initializeApp` (singleton via `admin.apps.length`)
  from `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY/STORAGE_BUCKET` env; `\n`-unescapes
  the private key. Throws if core config missing. `getStorageBucket()` →
  `app.storage().bucket()`. Used by document upload + the Inngest worker.

#### `src/lib/image-processing.ts` (browser-only; no directive but DOM-dependent)
- `processImageForOcr(file)` — client-side canvas pipeline (grayscale + contrast factor
  50; binarization line is commented out). Returns a JPEG data URL. Used by
  `BookScanner` before POSTing to the vision route. **Must run in the browser** (uses
  `Image`, `document`, `URL.createObjectURL`).

#### `src/lib/services/image-generation.ts`
- `generateNanoBananaImage(prompt, aspectRatio="1:1")` — `generateText` with
  `models.imageGen` (**`gemini-3-pro-image`** / "Nano Banana Pro"),
  `providerOptions.google.responseModalities:["IMAGE"]` + `imageConfig.aspectRatio`; image is
  pulled from `result.files` (mediaType `image/*`). Returns base64 or `null`. **Not consumed within
  this subsystem** — only caller is `src/app/actions/generate-resource-core.ts` (Creation Station).
  No upload-to-storage (returns raw base64). _(Updated 2026-06-16 from a broken `experimental_generateImage({ model: models.imagen as any })` call.)_

#### `src/lib/utils/vector.ts` — pgvector helpers (the embedding engine)
- `searchBooks(query, limit=5)` — `embed(embeddingModel, query)` → raw SQL cosine
  (`1 - (embedding <=> $vec::vector)`), `WHERE embedding IS NOT NULL AND similarity > 0.5
  ORDER BY similarity DESC LIMIT`. **No org filter** (caller must re-scope).
- `generateBookEmbedding(bookId, text)` — `embed` → `UPDATE books SET embedding = …::vector`.
- `findSimilarBooks(bookId, limit=5)` — self-join cosine over `books`, threshold 0.5.
  **No org filter** (see book-detail leak above).
- `searchVideos(query, limit=5)` — analogous over `video_resources`. **Zero callers.**
- `generateVideoEmbedding(videoId, text)` — `UPDATE video_resources SET embedding`.
- All build the vector literal by string-joining the embedding array into Prisma raw SQL
  template tags (parameterized for `bookId`/limit, but the vector itself is interpolated
  as a JS-built string).

### Library UI components (`src/components/library/**`, all `"use client"`)

- **`BookScanner.tsx`** — three-tab intake (ISBN / Search / Scan Cover). ISBN & Search
  call the `lookupBook` action; Scan pre-processes via `processImageForOcr` then POSTs to
  `/api/library/scan/vision`. On confirm, requires a `subjectId`, POSTs to
  `/api/library/books`, and routes to `/living-library/{book.id}`. Loads subjects from
  `/api/curriculum/subjects`, strands from `/api/curriculum/strands`. Hardcodes
  `externalSource:"GOOGLE_BOOKS"` on save with a TODO admitting it can't tell if
  OpenLibrary was used (`:178`). A "Deep Extraction (Alpha)" promo box advertises ToC
  image upload that **does not exist** anywhere in code.
- **`BookList.tsx`** — grid of `BookCard`s; "Add Book" → `/living-library/scan`. Each card
  links View→`/living-library/{id}`, Use→`/creation-station?sourceType=BOOK&sourceId=`,
  delete→`deleteBook({id})`. `refreshBooks` prop is ignored. Renders `extractionStatus`
  badge (always `NOT_EXTRACTED` in practice).
- **`VideoList.tsx`** — grid of `VideoCard`s; header renders `<AddVideoDialog>` (hub
  server-action flow). Use→`/creation-station?sourceType=VIDEO&sourceId=`,
  delete→`deleteVideo({id})`. Thumbnails use `referrerPolicy="no-referrer"`.
- **`ArticleList.tsx`** — dialog to add by URL → `addArticle(url, org, userId)` action.
  Cards link out to the source URL and Use→`/creation-station?sourceType=URL&sourceId=&url=`.
  **Bug:** `deleteArticle(article.id)` passes a bare string, but `deleteArticle` expects
  `{id}` and parses with `z.object({id})` — this throws every time (delete is broken).
- **`DocumentList.tsx`** — multi-file upload (`.pdf,.txt,.md`) → `addDocuments(formData,…)`.
  Cards show fileType/size, Use→`/creation-station?sourceType=FILE&sourceId=`,
  delete→`deleteDocument({id})` (correct shape).
- **`CourseList.tsx`** — lists courses; "Create Course"→`/courses/new`,
  View→`/courses/{id}`, Use→`/creation-station?sourceType=COURSE&sourceId=`,
  delete→`deleteCourse(course.id)` (Courses subsystem action — bare string here).
- **`ResourceList.tsx`** — filter form (student/course/book/toolType) over generated
  `Resource`s rendered via `GeneratedResourceCard`. **Bug:** on submit it
  `router.push("/library?…")` (`:41`) — `/library` route **does not exist**; the real
  route is `/living-library`. Filters silently 404. Tool-type options are hardcoded
  (`quiz/worksheet/lesson-plan/rubric`).
- **`AddVideoDialog.tsx`** — hub "Add Video" dialog → `processVideoResource(url)` action
  (the full Gemini watch+embed pipeline). Dialog copy says "use Gemini 3 Pro" (the model
  is actually `gemini-2.5-pro` — see config drift).

### Creation cross-component

- **`src/components/creation/YouTubeImport.tsx`** — playlist preview UI used by the
  **Creation Station** (`GeneratorsClient.tsx:316`), not by the Living Library pages.
  Calls `getPlaylistDetails(url)`; on "Generate Curriculum" invokes the parent
  `onImport(playlist)` callback. Listed here because it shares `youtube-actions` +
  `lib/api/youtube`.

---

## Data models & tenancy

All content tables map `organizationId` → DB column `account_id` and cascade-delete with
`Organization`. Taxonomy (`Subject`/`Strand`) is global.

| Model | Table | Key fields (subsystem-relevant) | Embedding |
|---|---|---|---|
| `Book` | `books` | `externalSource` (enum), `isbn`, `authors` (Json), `coverUrl`, `subjectId` (required), `strandId?`, `extractionStatus`, `summary`, `tableOfContents` (Json, unused), `embedding vector?` | yes |
| `VideoResource` | `video_resources` | `youtubeUrl`, `youtubeVideoId` **@unique (global)**, `title?`, `thumbnailUrl?`, `durationSeconds?`, `channelName?`, `extractionStatus`, `extractedTranscript?` (never written), `extractedSummary?`, `extractedKeyPoints` (Json), `embedding vector?` | yes |
| `Article` | `articles` | `url`, `title`, `content` (String markdown), `imageUrl?`, `extractionStatus` | no |
| `DocumentResource` | `document_resources` | `fileName`, `fileType`, `fileSize`, `extractedText?` (**no status field**) | no |
| `Resource` | `resources` | `resourceKindId`, `storageType` (enum), `content` (Json), `generatedFrom{Book,Video,Article,Document}Id`, `curriculumBundleId?` | no |
| `BookGeneratedMaterial` | `book_generated_materials` | join Book↔Resource↔ResourceKind | n/a |
| `ResourceKind` | `resource_kinds` | `code` (@unique), `label`, `contentType`, `requiresVision` | n/a |

**Enums:** `ExtractionStatus` = NOT_EXTRACTED | EXTRACTING | EXTRACTED | FAILED;
`ExternalSource` = GOOGLE_BOOKS | OPEN_LIBRARY | MANUAL;
`ResourceStorageType` = TEXT | MARKDOWN | HTML | JSON | PDF_URL | DOCX_URL.

**pgvector:** `Book.embedding` and `VideoResource.embedding` are
`Unsupported("vector")?`. In the init migration the SQL column is plain `vector`
(**no dimension, no ivfflat/hnsw index**) → similarity queries are sequential scans and
accept any-dimension vectors. The active embedding model is
`google.textEmbeddingModel("gemini-embedding-2")` stored at **1536 dims** (via
`embeddingProviderOptions` → `outputDimensionality`, with RETRIEVAL_DOCUMENT/RETRIEVAL_QUERY
`taskType`; set 2026-06-16, was `text-embedding-004`/768). The dimension is enforced only in
app code (`EMBEDDING_DIMENSIONS`), since the column is dimensionless. The old "1536 doc-drift" is resolved.

**Tenancy posture summary:** REST routes and server actions consistently auth + org-scope
and verify ownership before mutate/delete. The **gaps** are (1) the raw-SQL vector helpers
(`searchBooks`/`findSimilarBooks`/`searchVideos`) have no org filter — the search API
re-scopes but the book-detail "Similar Books" sidebar does **not**; (2) the vision route
is auth-only (acceptable — stateless); (3) `VideoProcessor` upsert/`updateMany` key on the
global `youtubeVideoId` without org scoping.

---

## Entry points & end-to-end flows

**1. Add a book by ISBN/search.** `/living-library/scan` → `BookScanner` →
`lookupBook` action → Google Books (→ Open Library fallback) → preview → user picks
subject → `POST /api/library/books` → `book.create` (`NOT_EXTRACTED`) →
`generateBookEmbedding` (best-effort) → optional Hi-Low ingest → redirect to
`/living-library/{id}`.

**2. Add a book by cover photo.** `BookScanner` Scan tab → `processImageForOcr`
(client canvas) → `POST /api/library/scan/vision` → `generateObject(models.pro3 vision)`
→ same save path as flow 1.

**3. Add & process a YouTube video (hub flow).** `VideoList` → `AddVideoDialog` →
`processVideoResource(url)` action → `VideoProcessor.processYouTubeVideo`: upsert
`EXTRACTING` → `extractVideoContent` (Gemini `pro3`) → save summary/keyPoints/`EXTRACTED`
→ `generateVideoEmbedding` → `revalidatePath("/living-library")`.

**3b. Add then extract (videos page, REST flow).** `/living-library/videos` →
`VideosClient` → `POST /api/library/videos` (create, no extract) → optional
`POST /api/library/videos/{id}/extract` → Gemini extract + embed → list re-fetch.

**4. Add a web article.** `ArticleList` dialog → `addArticle` action → server `fetch` +
Cheerio scrape → `Article.create(EXTRACTED)` → cache revalidate.

**5. Add documents (PDF/TXT/MD).** `DocumentList` → `addDocuments` action → upload each
to Firebase Storage → `DocumentResource.create(extractedText:"")` →
`inngest.send("resource/process.document")` → **`processDocument` worker** downloads via
Admin SDK → `pdf2json`/UTF-8 extract → `update extractedText` → `revalidateTag`.

**6. Semantic search (built but unwired).** `GET /api/library/search?q=` → `searchBooks`
(embed query → pgvector cosine) → org-scoped `book.findMany` re-sort. **No UI invokes it.**

**7. Related books.** `/living-library/{id}` → `findSimilarBooks(book.id)` →
self-join cosine over `books` (⚠ not org-scoped) → sidebar links.

**8. Downstream use.** Every card's "Use" links to
`/creation-station?sourceType=…&sourceId=…` (Creation Station / generators subsystem),
which is where these resources actually feed AI generation.

---

## External dependencies & services

- **Google Books API** — `lib/api/google-books.ts`, `/api/library/scan/route.ts`
  (raw fetch). Key: `GOOGLE_BOOKS_API_KEY` (optional for Google Books; the scan route
  sends none).
- **Open Library API** — `lib/api/open-library.ts` (no key).
- **YouTube Data API v3** — `lib/api/youtube.ts`; **reuses `GOOGLE_BOOKS_API_KEY`**
  (no dedicated `YOUTUBE_API_KEY`).
- **Google Gemini (via Vercel AI SDK `@ai-sdk/google`)** — `lib/ai/config.ts`:
  `models.pro3`/`pro` = `gemini-2.5-pro` (stable),
  `flash` = `gemini-3.5-flash`, `flashLite` = `gemini-3.1-flash-lite`,
  `imageGen` = `gemini-3-pro-image` (all set 2026-06-16). Embeddings: `gemini-embedding-2` @ 1536. Key shim:
  `GEMINI_API_KEY`→`GOOGLE_GENERATIVE_AI_API_KEY`.
- **Firebase Admin / Cloud Storage** — `lib/firebase-admin.ts`; doc uploads + worker
  downloads. Env: `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY/STORAGE_BUCKET`.
- **Inngest** — `process-document` worker; client `@/inngest/client`, route
  `/api/inngest`.
- **Cheerio** — article HTML scraping. **pdf2json** — PDF text extraction.
- **pgvector (Postgres)** — `Book`/`VideoResource.embedding` columns + raw cosine SQL.
- **Hi-Low Studio content engine** — optional outbound book ingest
  (`HILOW_INGEST_URL`/`HILOW_INGEST_KEY`).

---

## Auth / security posture

- **Authentication:** Every page, REST route, and server action calls `auth()` and
  rejects/redirects on no session. Hub page redirects to `/auth/login`; all others to
  `/login` (inconsistent — see Risks).
- **Tenancy:** Reads/writes are org-scoped via `getCurrentUserOrg()` (or direct
  `user.findUnique` on the hub). Mutations verify `organizationId` ownership before
  acting. **Exceptions:** the un-scoped vector SQL helpers (book-detail sidebar leaks
  cross-org titles/summaries), and `VideoProcessor`'s global-`youtubeVideoId` upsert.
- **Input validation:** Server actions that take raw data validate with zod
  (`searchLibrarySchema`, `fetchPlaylistSchema`, `deleteResourceSchema`). REST routes
  validate ad-hoc.
- **SSRF:** `addArticle` and `process-document`'s `http` branch `fetch` arbitrary
  user-supplied URLs server-side with **no allow-list / no private-IP guard** — SSRF
  exposure (the worker path branch is the live one for docs, but `addArticle` is
  user-driven).
- **Secrets:** Hi-Low ingest uses a Bearer token from env; Firebase key from env. No
  secrets in code.
- **Raw SQL:** vector helpers interpolate the JS-built embedding string into Prisma
  `$queryRaw` templates; ids/limits are parameterized. The vector string is
  model-generated numbers (low injection risk) but is not a bound parameter.

---

## Risks, drift, dead-code & half-built

1. **Dead route in resource filters.** `ResourceList.tsx:41` pushes `/library?…`; no
   `/library` route exists. Generated-resource filtering is broken (404s).
2. **`deleteArticle` always throws.** `ArticleList.tsx:130` calls `deleteArticle(article.id)`
   (string), but the action does `z.object({id}).parse` → ZodError on every delete.
   (`CourseList` similarly passes a bare string to `deleteCourse` — verify that action's
   shape; same smell.)
3. **Cross-org data leak via vector helpers.** `findSimilarBooks`/`searchBooks`/
   `searchVideos` run un-org-scoped raw SQL. The book-detail "Similar Books" sidebar
   renders cross-org titles/summaries. Search API happens to re-scope; book detail does
   not.
4. **Books never reach `EXTRACTED`.** Books are created `NOT_EXTRACTED` and nothing in
   this subsystem ever sets `summary`, `tableOfContents`, or advances
   `extractionStatus`. The book-detail "Inkling-Generated Summary", "Extraction Status",
   and the "Deep Extraction (Alpha)" ToC-upload promo are all UI for a pipeline that
   isn't built.
5. **Semantic search is unwired.** `/api/library/search` and `searchVideos` exist and
   work but have **no UI**. Changelog advertises "semantic search" as shipped.
6. **Embedding dimension (resolved 2026-06-16).** Now `gemini-embedding-2` @ **1536 dims**
   (pinned in app code via `EMBEDDING_DIMENSIONS`/`outputDimensionality`); the column is still
   dimensionless `vector`, so the 1536 is code-enforced only. No ANN index (ivfflat/hnsw) yet →
   cosine queries are full scans (fine at current scale; 1536 ≤2000 keeps indexing possible later).
7. **Model-name drift.** `AddVideoDialog`, `extract` route comments, and `config.ts`
   enums all say "Gemini 3 Pro"; the actual model is `gemini-2.5-pro` (3-pro retired).
   Comments insisting "only Gemini 3 Pro can process YouTube" are stale.
8. **Two divergent video flows.** Hub uses the `VideoProcessor` server action (auto
   extract+embed); the `/living-library/videos` page uses REST create + manual extract.
   They diverge in titles (`"Video: {id}"` vs null), metadata, and embedding timing.
9. **No real video/document metadata.** Neither flow fetches YouTube title/thumbnail/
   channel/duration; `extractedTranscript` is never populated. `DocumentResource` has no
   status field, so worker failures are invisible in the UI.
10. **Likely-dead `/api/library/scan` route.** Superseded by the `lookupBook` action;
    BookScanner does not call it. Fetches Google Books without an API key.
11. **`getLibraryResources` over-fetches.** Returns `curriculumBundles` the hub ignores;
    1-hour cache means newly added items can lag the UI despite tag revalidation in some
    paths.
12. **SSRF** in `addArticle` / document `http` branch (no URL allow-list).
13. **Pervasive `any` + `@ts-ignore`** across list components and `deleteResource`'s
    dynamic model access weaken type safety at the server/client boundary.
14. **Inconsistent login redirect** (`/auth/login` on hub vs `/login` elsewhere) —
    one is likely wrong depending on the actual auth route.

---

## Cross-links to other subsystems

- **Creation Station / Generators** — all "Use" links target
  `/creation-station?sourceType=…&sourceId=…`; `YouTubeImport` + `getPlaylistDetails`
  feed `generate-resource-core.ts`; `generateNanoBananaImage` is consumed there. See
  `08-generators-inkling-toolkit.md`.
- **AI Core** — `lib/ai/config.ts` (models, embeddingModel) and
  `lib/ai/video-processing.ts` (`extractVideoContent`, URL helpers). See `05-ai-core.md`.
- **Data model** — Book/VideoResource/Article/DocumentResource/Resource definitions and
  the embedding pipeline. See `02-data-model.md`.
- **Courses** — `CourseList` + `deleteCourse` (`actions/course-actions`); books/videos
  link to `/courses/new?bookId=` and the Course Builder.
- **Resources viewer** — generated `Resource` rendering shared with `MarkdownContent` /
  `GeneratedResourceCard` (resources subsystem).
- **Curriculum Compiler** — `CurriculumBundle`/`CurriculumSpec` surfaced via
  `getLibraryResources`; the resource viewer is also targeted by bundle chips.
- **Auth/tenancy** — `auth()`, `getCurrentUserOrg` (`lib/auth-helpers.ts`).
- **Inngest infra** — `@/inngest/client`, `/api/inngest` registration.

---

## Open questions

1. Should the vector helpers take `organizationId` and filter in-SQL? At minimum
   `findSimilarBooks` must, to close the book-detail cross-org leak.
2. Is `/api/library/scan` (ISBN) intended to be removed now that `lookupBook` exists?
3. Was a dedicated `YOUTUBE_API_KEY` ever provisioned, or is reusing
   `GOOGLE_BOOKS_API_KEY` the permanent design?
4. Should the pgvector column be made fixed-dimension (1536) with an ANN index (HNSW/IVFFlat)?
   Embeddings are now `gemini-embedding-2` @ 1536 (≤2000, so indexable); current dimensionless +
   no-index setup is fine at small scale but won't scale to large libraries.
5. Is the "Deep Extraction"/book-summary pipeline planned, or should the dead UI be
   removed? Nothing populates `Book.summary`/`extractionStatus`.
6. Which login path is canonical — `/auth/login` or `/login`?
7. Should the two video-add flows be unified on `VideoProcessor`?
8. Is semantic search meant to be exposed in the UI (route exists, no caller)?
