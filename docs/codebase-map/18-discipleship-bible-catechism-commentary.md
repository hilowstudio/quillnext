# 18 — Family Discipleship A: Bible Study, Commentary, Catechism, Devotionals

> Code-truth reference. Verified against source on 2026-06-15. Where this doc and any
> prose/markdown disagree, the code wins. File:line citations are to the state of the
> repo at authoring time.

## Purpose & role in the app

This subsystem is the "read & study scripture" half of the Family Discipleship Suite
(brand "Quill & Compass"). It provides three reader experiences:

1. **Bible Study** — ESV passage lookup + audio (ESV API) paired with verse-anchored
   Matthew Henry commentary served from the database, plus an on-demand AI "plain
   English" summary ("Inkling").
2. **Devotionals** — Spurgeon-style Morning & Evening daily readings, looked up by
   month/day from the `Devotional` table.
3. **Catechism** — 7 historic Reformed/Baptist catechisms (~880 questions) normalized
   into the DB and drilled interactively (speech or typing) with per-student progress
   and mastery tracking.

It exposes two distinct surfaces: a **family/global** surface under
`/family-discipleship/*` (no student context, gated only by login) and a **per-student**
surface under `/students/[id]/family-discipleship/*` (catechism progress is keyed to the
student and org-scoped). The other discipleship tools (prayer, missions, neighbor,
heart-check, bible-memory, church) share the same dashboard but are owned by other
subsystem docs.

## File-by-file reference

### Bible Study

**`src/app/family-discipleship/bible-study/page.tsx`** — Server component (no
directive; async). Calls `auth()` and `redirect("/login?callbackUrl=…")` if no session
(page.tsx:7-11). Renders header + `<BibleStudyClient/>`. No org scoping; any logged-in
user may read scripture/commentary.

**`src/app/family-discipleship/bible-study/BibleStudyClient.tsx`** — `'use client'`.
The whole reader UI. Key behavior:
- State seeded from `?q=` search param, default `"John 3:16"` (BibleStudyClient.tsx:25,47).
- `fetchData` runs three server actions in sequence: `getBiblePassage`, `getCommentary`,
  then `getBibleAudio` (audio failure is caught and non-fatal) (BibleStudyClient.tsx:88-101).
- Search submit / prev-next nav mutate the `?q=` param via `router.replace(..., {scroll:false})`;
  a `useEffect` keyed on `searchParams.get('q')` re-fetches (BibleStudyClient.tsx:45-51,115-127).
- Two tabs: Scripture (renders `passageData.html` via `dangerouslySetInnerHTML`,
  BibleStudyClient.tsx:192) and Commentary.
- Commentary renders `commentaryData.sections`; the section covering the looked-up verse
  (`targetSectionIndex`) is highlighted/`ref`'d, and an effect scrolls to the verse anchor
  (`.mh-vref[data-verse]` then `#v{n}`) and flashes a gold background
  (BibleStudyClient.tsx:39-81,234-238,253-266). `activeSectionIndex` falls back to first
  section when no verse (BibleStudyClient.tsx:40-42).
- "Plain English, please" button → `summarizeCommentary(section.html)` → renders the AI
  markdown via `react-markdown`+`remark-gfm`/`remark-breaks` inside the active section
  only (BibleStudyClient.tsx:129-145,276-300).
- Chapter overview (`intro`) is a collapsible `<details>` (BibleStudyClient.tsx:241-249).
- All HTML inserted via `dangerouslySetInnerHTML` is server-trusted (ESV API output and
  DB-seeded MH HTML); no user content is injected here. See security section.

**`src/app/family-discipleship/bible-study/BibleAudioPlayer.tsx`** — `'use client'`.
Minimal play/pause + volume audio element bound to `audioUrl` (the ESV-returned MP3).
Renders nothing if `!audioUrl`; shows a pulse skeleton while `isLoading`
(BibleAudioPlayer.tsx:88-94). Note: there is a second, unrelated
`bible-memory/BibleAudioPlayer.tsx` — different component, different subsystem.

### Bible Study server action

**`src/server/actions/bible-study.ts`** — `'use server'`. The data layer for the whole
Bible/commentary surface. Exports:
- `searchBible(rawData)` — ESV `/search`. Zod-validated, auth-gated. **Dead code: no
  callers anywhere** (only definition matched on grep). (bible-study.ts:134-153)
- `getBiblePassage({reference})` — ESV `/html`. Auth-gated; returns `{html, reference
  (canonical), meta}`. Used by `BibleStudyClient`. (bible-study.ts:158-191)
- `getBibleAudio({reference})` — ESV `/audio` with `redirect:'manual'`; returns the 301/302
  `Location` MP3 URL. Auth-gated. Used by `BibleStudyClient` and `bible-memory/PracticeMode`.
  (bible-study.ts:197-244)
- `getBibleText({reference})` — ESV `/text` (plain text). Auth-gated. Used by
  `bible-memory` (PracticeMode + actions). (bible-study.ts:250-280)
- `getCommentary(reference)` — **DB-backed**, not ESV. Parses the reference, looks up
  `CommentaryChapter` (`source="matthew-henry"`) by `(source,book,chapter)` with its
  ordered `sections`, computes `targetSectionIndex` (the section whose
  `verseStart..verseEnd` contains the verse), and resolves prev/next chapter refs
  (within book, falling back across book boundaries to chapters that actually exist).
  Returns `CommentaryData` or `null`. **Does NOT call `auth()`** — see security section.
  (bible-study.ts:392-460)
- `summarizeCommentary(commentaryHtml)` — auth-gated. Strips HTML, truncates to 15k chars,
  calls `generateText({model: models.flash, …})` with the "Inkling" tutor system prompt.
  Returns `{summary}`. (bible-study.ts:465-494)
- Internal helpers: `fetchFromESV` (Token auth, `next.revalidate:3600`), `isValidReference`
  (length>2), `BIBLE_BOOK_MAP` (name/abbrev → 1-66), `getMHCVolume` (book→volume; used only
  by the seeder conceptually — **unused in this file**, dead), `parseBibleReference`
  (regex `^((?:\d\s+)?[a-zA-Z]+)\s+(\d+)(?::(\d+))?`).
- ESV API key read from `process.env.BIBLE_API_KEY` (bible-study.ts:68).
- **Dead imports**: `createSuccessResponse`, `revalidatePath`, `path`, `fs`, `cheerio`
  are all imported but unused in this file (bible-study.ts:4-9). `getMHCVolume`
  (353-361) is also dead here.

### Commentary parser

**`src/lib/commentary-parser.ts`** — Pure, side-effect-free parser for Matthew Henry
`.HTM` chapter files. Shared by the seeder (`prisma/seed-commentary.ts`). Exports
`cleanHtml`, `enrichSection`, `parseChapterHtml`, and types `ParsedSection`/`ParsedChapter`.
- **Anchors** in source HTML: `<A NAME="Sec{n}">` = section (verse-group) boundaries;
  `<A NAME="{Book}{Ch}_{Verse}">` = per-verse link targets grouped before each section
  (commentary-parser.ts:99-110).
- **Section verse range**: `verseStart` = min verse anchor between the previous Sec anchor
  and this Sec anchor; `verseEnd` = (next section's start − 1), last section → max verse
  anchor (commentary-parser.ts:118-131). Missing starts default to 1 (first) or the prior
  start (carry-forward).
- `cleanHtml` modernizes 1990s markup (`<font>`→`<span>`, `<b>`→`<strong>`, `<i>`→`<em>`,
  strips `bgcolor/align/background`) (commentary-parser.ts:35-44).
- `enrichSection` injects two kinds of hooks into section HTML: (1) `<span class="mh-verse"
  id="v{n}" data-verse="{n}">` immediately before each *sequential* scripture verse number
  (walks verses in order, only accepting the next expected integer token), and (2) wraps
  MH's inline `v.{n}`/`ver.{n}` references in `<span class="mh-vref" data-verse="{n}">`.
  These data attributes are exactly what `BibleStudyClient` scrolls to.
  (commentary-parser.ts:59-91)
- Intro/overview = text between `</CENTER>` and the first anchor, kept only if >20 chars
  (commentary-parser.ts:112-116).
- Section title = first `<i>` text (cleaned, ≤140 chars, must not start with a digit),
  else `"{Book} {ch}:{start}-{end}"` (commentary-parser.ts:136-141).

**`src/lib/bible-books.ts`** — `BOOK_NAMES` (1-66 → display name) + `bookName(n)` helper
(falls back to `"Book {n}"`). Used by the parser and `getCommentary`.

### Devotionals

**`src/app/family-discipleship/devotionals/page.tsx`** — Server component (async).
**No auth check.** Computes today's `month`/`day` and queries
`db.devotional.findMany({where:{month,day}})` (page.tsx:8-17). Passes rows
(`as any`) and a formatted date to the client component. Header credits "C.H. Spurgeon".

**`src/app/family-discipleship/devotionals/DevotionalDisplay.tsx`** — `'use client'`.
Splits the day's rows into `am`/`pm` by `entry.time`, defaults the tab to evening after
17:00 local (DevotionalDisplay.tsx:25-30). `DevotionalCard` does heavy client-side text
munging:
- `formatKeyVerse` splits the key verse on em-dash (or hyphen fallback if it contains a
  digit) to separate verse text from reference (DevotionalDisplay.tsx:68-97).
- `cleanBodyText` is a heuristic header-stripper that removes leading date / "Morning
  Reading" / "Evening Reading" / reference / quoted-verse lines from the body
  (DevotionalDisplay.tsx:101-171). This is brittle parsing of pre-formatted seed text —
  see risks.
- Body rendered as plain text with `whitespace-pre-line` (no HTML injection here).
- The `DevotionalEntry` type uses boxed `String` (capital S) for all fields — a
  type-smell (DevotionalDisplay.tsx:12-17).

### Catechism

**`src/app/family-discipleship/catechism/page.tsx`** — Server component (async). **No
auth check.** Calls `getCatechisms()` (server action) and renders `<CatechismManager>`
WITHOUT a `studentId` → progress is not tracked on this surface (page.tsx:5-14).

**`src/app/family-discipleship/catechism/types.ts`** — `CatechismSummary` interface.
The `id` field doc-comments that it is the catechism `code`/slug and **must match the
seeded `code`** because it becomes the `catechismId` in `StudentCatechismProgress`.

**`src/app/family-discipleship/catechism/actions.ts`** — `'use server'`. Two actions,
**neither is auth-gated**:
- `getCatechisms()` → `db.catechism.findMany` ordered by `sortOrder`, maps `code`→`id`.
  Returns lightweight metadata for the carousel. (actions.ts:7-19)
- `getCatechismQuestions(code)` → resolves `code`→catechism id, returns the ordered
  `data` JSON blobs from `CatechismQuestion` (the original bundled question shape:
  question/answer/proofTexts/subQuestions). `[]` if code unknown. (actions.ts:27-38)

**`src/app/family-discipleship/catechism/CatechismManager.tsx`** — `'use client'`.
Renders the colored catechism carousel; on select calls `getCatechismQuestions(id)` and
mounts `<InteractiveCatechism>` with `title`, `studentId` (optional), `catechismId`
(= the slug). Accepts `studentId?` prop so the same component serves both surfaces.
(CatechismManager.tsx:33-43,93-99)

**`src/app/family-discipleship/catechism/InteractiveCatechism.tsx`** — React component
using hooks (`useState`/`useEffect`/`useRef`) and browser APIs. **It has NO `'use client'`
directive of its own** (InteractiveCatechism.tsx:1). It works only because its sole
importer, `CatechismManager`, is a client component — so it is pulled into the client
bundle transitively. This is fragile (importing it from a server component would break).
Behavior:
- `flattenCatechismData` expands Matthew Henry-style `subQuestions` into sibling entries
  with `isSubQuestion`/`parentQuestion`/`number` (e.g. "1a") (InteractiveCatechism.tsx:107-136).
- On mount (only when `studentId && catechismId`): `getStudentCatechismProgress` →
  restores `currentQuestionIndex` and rehydrates mastered questions by matching each
  flattened question's `number` (string) against the stored `masteredQuestions` array
  (InteractiveCatechism.tsx:148-181).
- Speech recognition (`webkitSpeechRecognition`/`SpeechRecognition`) and speech synthesis
  (`speechSynthesis`) are wired for "speech" mode; "typing" mode uses a textarea
  (InteractiveCatechism.tsx:184-262,534-573).
- `compareAnswers` grades client-side: normalize → exact match (1.0), else Levenshtein
  similarity ≥0.8, else ≥0.6 + a theological key-phrase hit
  (InteractiveCatechism.tsx:265-359). All grading is heuristic and entirely client-side.
- On a correct answer **while "Show Answer" was not active**, persists mastery via
  `markQuestionAsMastered(studentId, catechismId, qNum)` (InteractiveCatechism.tsx:383-388).
  **Bug:** the guard reads the `showAnswer` state value which `checkAnswer` itself sets to
  `true` one line earlier via `setShowAnswer(true)` — but `showAnswer` is a stale closure,
  so the check uses the *previous* render's value. In practice this means the "Show Answer
  must be off" rule is effectively "Show Answer must have been off on the prior render,"
  which is loose; combined with `setShowAnswer(true)` on every check it is easy to mark
  things mastered. (See risks.)
- Prev/Next call `updateServerProgress(newIndex)` which only persists when both
  `studentId` and `catechismId` are present (InteractiveCatechism.tsx:141-145,391-413).
- A `useEffect` keyed on `title` resets UI + **wipes local `progress` to `{}`**
  (InteractiveCatechism.tsx:225-231) — this runs after the load-progress effect on first
  mount; ordering means the mastered-rehydrate can be clobbered on title changes.

### Per-student surfaces

**`src/app/students/[id]/family-discipleship/page.tsx`** — Server component (async).
Awaits `params`, renders `<DiscipleshipDashboard studentId={id}/>`. **No auth/org check
in the page itself** — relies on middleware/layout (not verified here). (page.tsx:4-16)

**`src/app/students/[id]/family-discipleship/catechism/page.tsx`** — Server component.
`getCatechisms()` + `<CatechismManager studentId={id} …/>` so progress IS tracked here.
**No auth/org check in the page itself.** (page.tsx:5-22)

### Per-student catechism progress action

**`src/app/actions/student-catechism.ts`** — `'use server'`. The **only** org-scoped
piece of this subsystem. `assertStudentInOrg(studentId)` calls `getCurrentUserOrg()`
(throws if unauthenticated) and verifies `student.organizationId === caller org`, else
`throw "Unauthorized"` (student-catechism.ts:9-13). Exports:
- `getStudentCatechismProgress(studentId, catechismId)` — find unique on
  `(studentId, catechismId)`. (15-28)
- `updateStudentCatechismProgress(studentId, catechismId, questionIndex)` — upsert
  `currentQuestionIndex`+`lastStudiedAt`; `revalidatePath`. (30-53)
- `markQuestionAsMastered(studentId, catechismId, questionIdentifier)` — appends to the
  `masteredQuestions` JSON array (idempotent on the identifier). (55-81)
- `toggleQuestionMastery(...)` — toggles membership. **Exported but has NO caller in the
  app** (grep shows definition only) — dead/unused UI affordance. (83-110)

### Shared dashboard components

**`src/components/family-discipleship/DiscipleshipDashboard.tsx`** — Server component
(SSR phosphor icons). Renders the 9-tile suite grid. Each `href` is
`{baseRoute}{...}{querySuffix}` where `querySuffix = studentId ? "?studentId=…" : ""`
(DiscipleshipDashboard.tsx:20-22). **Note:** for the per-student view it links to the
GLOBAL `/family-discipleship/*` routes with `?studentId=` appended, NOT to
`/students/[id]/family-discipleship/*`. Most child pages (devotionals, catechism,
bible-study) DO NOT read `?studentId`, so from this dashboard the per-student context is
effectively lost (catechism opened from here won't track progress). The only true
per-student route wired anywhere is via `StudentDiscipleshipCard` (below). See risks.

**`src/components/family-discipleship/StudentDiscipleshipCard.tsx`** — Server/shared
component used on the student profile page. Links to
`/students/{id}/family-discipleship` (suite) and
`/students/{id}/family-discipleship/catechism` (tracked), plus three GLOBAL links
(memory/prayer/devotionals) that are NOT student-scoped (StudentDiscipleshipCard.tsx:29-44).

### Seed-source data (SAMPLE structure only — not read fully)

**`src/data/catechisms/*.ts` + `src/data/heidelberg.json`** — Large bundled datasets,
seed-source only (consumed by `prisma/seed-catechisms.ts`, not imported by runtime app
code). Line counts: `wsc.ts` 109, `wlc.ts` 6310, `baptist.ts` 1720, `heidelberg.ts`
2627, `puritan.ts` 1206, `young_children.ts` 871, `matthew_henry.ts` 14520;
`heidelberg.json` 2480. Each `.ts` `export default` an array of question objects:
`{number, question, answer, proofTexts?: Record<string,string[]>, subQuestions?: [...]}`.
- `wsc.ts` sampled: 107 Q with `proofTexts` keyed by citation number → array of
  references (wsc.ts:1-108).
- `matthew_henry.ts` sampled: questions carry nested `subQuestions` (e.g. "1a","2a") with
  their own Q/A — exactly the shape `InteractiveCatechism.flattenCatechismData` expands
  (matthew_henry.ts:1-55).
- `young_children.ts` sampled: simplified Q/A, empty `proofTexts` (young_children.ts:1-60).
- `heidelberg.json` is a richer source object (`Metadata` + `Data` with `Proofs`); the
  runtime path uses `heidelberg.ts` (the array form) per the seeder import map.

## Data models & tenancy

Prisma models touched (from `prisma/schema.prisma`):

- **`Catechism`** (37-50): `id`, unique `code` (slug), `title`, `description?`,
  `difficulty?`, `questionCount`, `sortOrder`, → `questions`. `code` is the public slug
  surfaced as `CatechismSummary.id`. **No org/tenant column — global content.**
- **`CatechismQuestion`** (55-66): `catechismId`, `number?`, `sortOrder`, `data Json`
  (full original question object). Unique `(catechismId, sortOrder)`. **No tenant column.**
- **`CommentaryChapter`** (72-85): `source` (default `"matthew-henry"`), `book` (Int 1-66),
  `chapter`, `title?`, `intro?` (overview HTML), → `sections`. Unique `(source, book,
  chapter)`; index `(source, book)`. **Global content, no tenant.**
- **`CommentarySection`** (87-99): `chapterId`, `sectionIndex`, `verseStart`, `verseEnd`,
  `title?`, `html` (enriched, anchor-injected). Unique `(chapterId, sectionIndex)`.
- **`Devotional`** (1138-1149): `month`, `day`, `time` ("am"/"pm"), `keyverse`, `body
  @db.Text`. Unique `(month, day, time)`; index `(month, day)`. **Global content.**
- **`StudentCatechismProgress`** (1373-1387): `studentId`, `catechismId` (**= the
  catechism `code`/slug, NOT a FK to `Catechism.id`** — it is a free string keyed to the
  slug; see below), `currentQuestionIndex`, `lastStudiedAt`, `masteredQuestions Json?`
  (array of question-`number` strings), unique `(studentId, catechismId)`. FK to
  `Student` with `onDelete: Cascade`. **This is the only tenant-scoped table** — scoping
  is enforced in `student-catechism.ts` via `assertStudentInOrg`, NOT by the schema.

**Key identity fact:** `catechismId` in `StudentCatechismProgress` stores the slug
(`"wsc"`, `"matthew-henry"`, etc.), matched everywhere: `CatechismSummary.id = code`
(actions.ts:16), passed as `catechismId` to `InteractiveCatechism`
(CatechismManager.tsx:97), persisted unchanged. The seeder explicitly documents this
contract (seed-catechisms.ts:32-49). `masteredQuestions` stores question `number`
strings (e.g. `"1"`, `"1a"`), matched against the flattened question's `number`
(InteractiveCatechism.tsx:162-164,386).

**Tenancy summary:** Bible Study, commentary, devotionals, and catechism *content* are
all **global / org-agnostic**. Only **per-student catechism progress** is tenant-scoped,
and only because the `student-catechism.ts` action enforces it. Content reads are gated
(at most) by `auth()` login, not by org.

## Entry points & end-to-end flows

### A. Bible Study lookup (family surface)
1. User hits `/family-discipleship/bible-study` → `page.tsx` runs `auth()`, redirects if
   logged out, renders `BibleStudyClient`.
2. Client reads `?q=` (default "John 3:16"), calls `getBiblePassage` → ESV `/html`
   (server action, auth-gated, 1h fetch cache).
3. Then `getCommentary(ref)`: `parseBibleReference` → book# + chapter + verse →
   `db.commentaryChapter.findUnique` (+sections) → compute `targetSectionIndex` +
   prev/next refs → return `CommentaryData`.
4. Then `getBibleAudio` → ESV `/audio` 302 `Location` MP3 (best-effort).
5. UI renders Scripture (ESV HTML) and Commentary tabs. Selecting Commentary scrolls to
   the verse anchor injected at seed time (`#v{n}` / `.mh-vref`).
6. Optional: "Plain English" → `summarizeCommentary(section.html)` → Gemini Flash → markdown.

### B. Commentary seeding (offline)
`prisma/seed-commentary.ts` walks `src/server/data/Matthew-Henry-Commentary-Volumes/MHC-V1..V6`,
parses each `MHC{bb}{ccc}.HTM` via `parseChapterHtml`, and upserts `CommentaryChapter` +
replaces `CommentarySection` rows (anchor-enriched HTML). The runtime `getCommentary`
reads exactly these rows.

### C. Devotional (family surface)
`/family-discipleship/devotionals` → `page.tsx` (no auth) computes today's month/day →
`db.devotional.findMany` → `DevotionalDisplay` splits am/pm, strips header text
client-side, renders the reading.

### D. Catechism drill with progress (per-student surface)
1. `/students/[id]/family-discipleship/catechism` → `page.tsx` →
   `getCatechisms()` → `CatechismManager studentId={id}`.
2. Select catechism → `getCatechismQuestions(slug)` (server) → questions JSON.
3. `InteractiveCatechism` mounts with `studentId`+`catechismId(slug)` →
   `getStudentCatechismProgress` restores index + mastered set (org-checked).
4. User answers (speech/typing) → client `compareAnswers` grades → on correct (+show-answer
   off) → `markQuestionAsMastered` (org-checked, appends to JSON, revalidates).
5. Prev/Next → `updateStudentCatechismProgress(index)` (org-checked).

### E. Catechism drill WITHOUT progress (family surface)
`/family-discipleship/catechism` renders `CatechismManager` with no `studentId`, so all
the progress server calls are skipped (`if (studentId && catechismId)` guards). Pure
practice mode, nothing persisted.

## External dependencies & services

- **ESV API** (`api.esv.org/v3/passage/{html,text,audio,search}`) — Token auth via
  `process.env.BIBLE_API_KEY`. HTML/text/audio/search. 1h `next.revalidate` on the
  cached endpoints. Audio uses `redirect:'manual'` to capture the MP3 `Location`.
- **Google Gemini 2.5 Flash** via Vercel AI SDK (`ai` `generateText`, `models.flash` from
  `src/lib/ai/config.ts`) — for `summarizeCommentary` only (branded "Inkling").
- **cheerio** — used by `src/lib/commentary-parser.ts` (and imported-but-unused in
  `bible-study.ts`).
- **react-markdown / remark-gfm / remark-breaks** — render the AI summary.
- **@phosphor-icons/react** — icons (some `/dist/ssr`, some not).
- **Browser Web Speech APIs** (`SpeechRecognition`/`webkitSpeechRecognition`,
  `speechSynthesis`) — catechism speech mode.
- **sonner** (`toast`) — Bible study error/success toasts.
- **Prisma 7 / Postgres** — `db` from `@/server/db`.
- **NextAuth** — `auth()` from `@/auth`; `getCurrentUserOrg` from `@/lib/auth-helpers`.

## Auth / security posture

| Surface / action | Auth | Org scoping |
|---|---|---|
| `bible-study/page.tsx` | `auth()` redirect if logged out | none |
| `getBiblePassage/getBibleAudio/getBibleText/searchBible/summarizeCommentary` | `auth()` → 401 | none |
| `getCommentary` | **NONE** (no `auth()` call) | none |
| `devotionals/page.tsx` + data query | **NONE** | none |
| `catechism/page.tsx` + `getCatechisms`/`getCatechismQuestions` | **NONE** | none |
| `students/[id]/family-discipleship[/catechism]/page.tsx` | none in page (relies on middleware/layout) | none in page |
| `student-catechism.ts` (all 5 actions) | `getCurrentUserOrg()` (throws if anon) | `assertStudentInOrg` enforces caller org == student org |

Notes / gaps:
- **`getCommentary` is the only Bible-data server action with no `auth()` guard**
  (bible-study.ts:392). It exposes only public-domain Matthew Henry content, so the risk
  is low, but it is inconsistent with its siblings and could be hit by unauthenticated
  callers.
- The catechism content actions (`getCatechisms`, `getCatechismQuestions`) and the
  catechism/devotionals pages have **no auth at all**. Content is public-domain, so the
  exposure is informational only, but again inconsistent with `bible-study`.
- **XSS surface:** `dangerouslySetInnerHTML` is used for ESV passage HTML
  (BibleStudyClient.tsx:192), MH commentary intro/sections (246,304). All of this is
  server-trusted (ESV API responses + DB-seeded, parser-cleaned HTML). The AI summary is
  rendered via `react-markdown` (escaped), NOT raw HTML. No user-supplied HTML reaches
  these sinks, so XSS risk is low *as long as the commentary seed source and ESV remain
  trusted*. `cleanHtml` strips attributes but is not a sanitizer (it does not remove
  `<script>`/`on*` handlers) — fine for the trusted MH corpus, would be unsafe for
  untrusted input.
- Per-student catechism tenancy is enforced in application code only
  (`assertStudentInOrg`), not by RLS/schema. Correct as written, but a new caller that
  forgets the assert would leak/cross-write progress.

## Risks, drift, dead-code & half-built

1. **Cross-subsystem bug (real):** `src/app/family-discipleship/bible-memory/actions.ts:121`
   calls `getBibleText(data.reference)` passing a **raw string**, but `getBibleText`
   Zod-parses `getBiblePassageSchema` which expects `{reference: string}`. The call always
   throws and is swallowed by the surrounding `try/catch`, so auto-fetched verse text is
   always `""`. (The correct shape `{reference}` is used in `PracticeMode.tsx:117,165`.)
2. **Stale-closure mastery guard:** `InteractiveCatechism.checkAnswer` sets
   `setShowAnswer(true)` then checks `!showAnswer` from the same render's stale state
   (InteractiveCatechism.tsx:370,385). The "must not have peeked" mastery rule does not
   behave as the comment claims.
3. **Local `progress` wipe on title change:** the `useEffect([title])` resets `progress`
   to `{}` (InteractiveCatechism.tsx:225-231); on a fresh mount this can run after the
   async progress-load resolves, clobbering rehydrated mastery in the UI (server data is
   untouched). Race-prone.
4. **`InteractiveCatechism` lacks `'use client'`** (InteractiveCatechism.tsx:1). Works only
   because `CatechismManager` is a client component. A direct server-component import would
   crash at build/runtime. Latent footgun.
5. **Per-student context lost from `DiscipleshipDashboard`:** it links per-student tiles to
   GLOBAL `/family-discipleship/*?studentId=…`, but the child pages don't read
   `?studentId` (DiscipleshipDashboard.tsx:20-87). So catechism opened from the student
   dashboard does NOT track progress; only the `StudentDiscipleshipCard` →
   `/students/[id]/family-discipleship/catechism` path does. UX/feature drift.
6. **Dead code:** `searchBible` (no callers), `getMHCVolume` (unused in bible-study.ts),
   `toggleQuestionMastery` (no callers), and dead imports in bible-study.ts
   (`createSuccessResponse`, `revalidatePath`, `path`, `fs`, `cheerio`).
7. **Auth inconsistency:** `getCommentary`, catechism content actions, and the
   devotionals/catechism pages are unauthenticated while their Bible siblings require login.
8. **Devotional text parsing is heuristic/brittle:** `formatKeyVerse` + `cleanBodyText`
   (DevotionalDisplay.tsx:68-171) reverse-engineer structure out of pre-formatted seed
   strings (date lines, "Morning Reading", quoted verse). Any seed whose body doesn't match
   the assumed header layout will render with leftover header junk or have body lines
   wrongly stripped. The `String` (boxed) typing throughout is a smell.
9. **`as any` casts** at the page→component boundaries (devotionals/page.tsx:31,
   catechism actions return `any[]`) — type safety is bypassed; the question shape is only
   enforced implicitly by `InteractiveCatechism`'s local interfaces.
10. **`heidelberg.json` vs `heidelberg.ts`:** the seeder imports the `.ts` array form;
    the `.json` (richer source with `Proofs`) is not on the runtime/seed path per the
    import map — potential stale/duplicate source-of-truth.
11. **`questionCount` accuracy:** seeded from `data.length` (top-level questions only),
    so for Matthew Henry the carousel count understates the *flattened* (sub-question)
    total the user actually drills.

## Cross-links to other subsystems

- **bible-memory** (`src/app/family-discipleship/bible-memory/*`) consumes
  `getBibleText`/`getBibleAudio` from this subsystem's `bible-study.ts` (PracticeMode.tsx,
  actions.ts). Carries the bug in item #1. Owned by another doc.
- **Students profile** (`src/app/students/[id]/page.tsx:7,103`) mounts
  `StudentDiscipleshipCard` — the canonical entry into the per-student catechism flow.
- **Dashboards** (`src/components/dashboard/StudentDashboard.tsx`,
  `ParentDashboard.tsx`) reference the discipleship surface (see doc 14).
- **AI config** (`src/lib/ai/config.ts`) supplies `models.flash` for the summary.
- **Auth helpers** (`src/lib/auth-helpers.ts` `getCurrentUserOrg`) + `@/auth` `auth()`
  provide the (light) security boundary.
- **Error taxonomy** (`src/server/utils/errorTaxonomy.ts`) — `StandardError`/`ERROR_CODES`
  used by `bible-study.ts`.
- **Seeders** (`prisma/seed-catechisms.ts`, `prisma/seed-commentary.ts`) populate every
  content table this subsystem reads (see doc 03).
- The other 5 discipleship tiles (prayer, missions, neighbor, heart-check, church) share
  `DiscipleshipDashboard` but are out of scope here.

## Open questions

1. Is `/students/[id]/family-discipleship/*` actually protected by middleware/layout
   auth+org, or does it rely solely on `student-catechism.ts`'s `assertStudentInOrg`?
   (The page components themselves do no checking.)
2. Is `getCommentary` intentionally unauthenticated, or an oversight relative to its
   siblings?
3. Should the per-student `DiscipleshipDashboard` tiles point at
   `/students/[id]/family-discipleship/*` so progress is tracked from there too? (Current
   behavior loses student context for everything except catechism-via-card.)
4. Is `heidelberg.json` dead/legacy, or is it intended to replace the `.ts` source?
5. Is `toggleQuestionMastery` a planned (unwired) UI feature, or removable dead code?
6. Should `summarizeCommentary` results be cached/persisted (they are recomputed per click,
   no storage)?
