# 20 — Family Discipleship Suite
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `src/app/family-discipleship/page.tsx` | Suite landing page (parent view); renders `DiscipleshipDashboard`. |
| `src/app/family-discipleship/actions.ts` | LEGACY FormData server actions. Only `addChurchNote`/`deleteChurchNote` are wired; rest are dead. |
| `src/components/family-discipleship/DiscipleshipDashboard.tsx` | 9-tile nav grid linking to each sub-feature. |
| `src/components/family-discipleship/StudentDiscipleshipCard.tsx` | Compact discipleship card embedded in student detail page. |
| `src/app/students/[id]/family-discipleship/page.tsx` | Student-scoped suite landing (passes `studentId`). |
| `src/app/students/[id]/family-discipleship/catechism/page.tsx` | Student-scoped catechism wrapper. |
| **bible-memory (8-step practice)** | |
| `src/app/family-discipleship/bible-memory/page.tsx` | RSC entry; resolves org-scoped student, loads verses/library/folders. |
| `src/app/family-discipleship/bible-memory/actions.ts` | Verse + folder CRUD; 8-step progress; tenant-guarded via `withTenant`. |
| `src/app/family-discipleship/bible-memory/BibleMemoryDashboard.tsx` | Client: folders, DnD, library/custom add, learning/mastered tabs. |
| `src/app/family-discipleship/bible-memory/PracticeMode.tsx` | 8-step memorization flow (read/listen/speak/type; fuzzy match). |
| `src/app/family-discipleship/bible-memory/BibleAudioPlayer.tsx` | Full audio player (transport, scrub, volume). |
| `src/lib/schemas/bible-memory.ts` | Zod schemas for verse/folder actions — DEAD (no importers). |
| **bible-study (commentary; see 03-/13-)** | |
| `src/app/family-discipleship/bible-study/page.tsx` | RSC entry; auth gate; renders client. |
| `src/app/family-discipleship/bible-study/BibleStudyClient.tsx` | ESV passage + Matthew Henry commentary tabs + AI summary. |
| `src/app/family-discipleship/bible-study/BibleAudioPlayer.tsx` | Compact play/stop audio button (variant of memory player). |
| `src/server/actions/bible-study.ts` | ESV API (search/passage/text/audio) + MH commentary loader + AI summary. |
| **catechism (interactive)** | |
| `src/app/family-discipleship/catechism/page.tsx` | RSC entry (parent); loads catechism metadata. NO auth gate. |
| `src/app/family-discipleship/catechism/actions.ts` | `getCatechisms` / `getCatechismQuestions` from DB. NO auth gate. |
| `src/app/family-discipleship/catechism/types.ts` | `CatechismSummary` interface. |
| `src/app/family-discipleship/catechism/CatechismManager.tsx` | Carousel selector + lazy question loader. |
| `src/app/family-discipleship/catechism/InteractiveCatechism.tsx` | Q&A drill (speech/typing, Levenshtein scoring, mastery). |
| `src/app/actions/student-catechism.ts` | Student catechism progress CRUD; org-guarded. |
| **church notes** | |
| `src/app/family-discipleship/church/page.tsx` | RSC entry; loads user's church notes (per-user). |
| `src/app/family-discipleship/church/ChurchNotesClient.tsx` | Sermon-note form + list; calls legacy `actions.ts`. |
| **devotionals** | |
| `src/app/family-discipleship/devotionals/page.tsx` | RSC entry; loads today's Spurgeon devotionals. NO auth gate. |
| `src/app/family-discipleship/devotionals/DevotionalDisplay.tsx` | AM/PM tabs; heuristic verse/body parsing. |
| **heart-check (kid-facing emotion guide)** | |
| `src/app/family-discipleship/heart-check/page.tsx` | RSC entry; auth gate. |
| `src/app/family-discipleship/heart-check/HeartCheckClient.tsx` | 8 emotions, gospel framing — fully STATIC content, no DB. |
| **missions (Joshua Project + world map)** | |
| `src/app/family-discipleship/missions/page.tsx` | RSC entry; unreached-of-the-day + Operation World explorer. NO auth gate. |
| `src/app/family-discipleship/missions/actions.ts` | Unreached, OW stats (JSON), counties/states (DB). NO auth gate. |
| `src/app/family-discipleship/missions/MissionsClient.tsx` | Search + map/list view toggle. |
| `src/app/family-discipleship/missions/CountryInfoCard.tsx` | Portal modal of OW country stats. |
| `src/app/family-discipleship/missions/UnreachedOfTheDay.tsx` | Joshua Project people-group card + "Pray Now" deep link. |
| `src/app/family-discipleship/missions/WorldMap.tsx` | Leaflet map; remote GeoJSON; OW lookup on click. |
| `src/app/family-discipleship/missions/utils/countryMapping.ts` | ISO/name → Operation World name mapping. |
| `src/lib/joshua-project.ts` | Joshua Project API client. `fetchUnreachedByCountry` is DEAD. |
| **neighbor-love (county lookup)** | |
| `src/app/family-discipleship/neighbor/page.tsx` | RSC entry; loads state list from DB. NO auth gate. |
| `src/app/family-discipleship/neighbor/CountyIssuesLookup.tsx` | State/county pickers; community indicators + "Get Involved". |
| **prayer journal** | |
| `src/app/family-discipleship/prayer/page.tsx` | RSC entry; auth gate; loads entries + categories. |
| `src/server/actions/prayer-journal.ts` | Prayer entry CRUD; per-user ownership via `withTenant`. |
| `src/app/family-discipleship/prayer/PrayerJournalClient.tsx` | Master/detail + autosave orchestration. |
| `src/app/family-discipleship/prayer/PrayerJournalEditor.tsx` | TipTap rich-text editor + debounced autosave. |
| `src/app/family-discipleship/prayer/PrayerJournalSidebar.tsx` | Entry list + search + filters. |
| `src/app/family-discipleship/prayer/PrayerJournalFilters.tsx` | Date/category/tag filter UI. |

## 2. Purpose / intent
A family-discipleship hub bundling nine devotional/educational tools for homeschool families: Bible memorization with an 8-step mastery flow, ESV Bible study with Matthew Henry commentary, interactive catechism drills, church sermon notes, daily Spurgeon devotionals, a gospel-centered emotions guide (Heart Check), global-missions exploration (Joshua Project + Operation World map), local "neighbor-love" community-needs lookup, and a prayer journal. Some sub-features are content-only/static (heart-check, devotionals, missions, neighbor); others persist per-user or per-student state (prayer, church, bible-memory, catechism progress).

## 3. Architecture & key files
- **Two entry surfaces:** parent view `/family-discipleship/*` and student view `/students/[id]/family-discipleship/*`. Both render the SAME `DiscipleshipDashboard` (DiscipleshipDashboard.tsx:20) and `CatechismManager`, differing only by an optional `studentId` threaded into hrefs/props. `DiscipleshipDashboard` is also embedded in `components/dashboard/StudentDashboard.tsx:185`.
- **Tenancy split:** the *newer* features (bible-memory `actions.ts`, prayer `prayer-journal.ts`, student-catechism `student-catechism.ts`) consistently call `getCurrentUserOrg()` + `withTenant(...)` and assert student/verse/folder org membership. The *older* features (catechism read actions, missions actions, devotionals page, neighbor page, family-discipleship/actions.ts) read **global/shared** tables (`Catechism`, `Devotional`, `County`, `PrayerCategory`, `BibleMemory isDefault`) — those are content tables, but several server actions lack any session check (see findings).
- **External data:**
  - ESV API (`bible-study.ts`, `BIBLE_API_KEY`): search/passage(html)/text/audio. Audio resolves via 302 `Location` header (bible-study.ts:222).
  - Matthew Henry Commentary: `getCommentary` (bible-study.ts:392) reads `CommentaryChapter`/sections from DB (NOT files), 6-volume map (`getMHCVolume`), prev/next chapter nav across book boundaries.
  - Joshua Project API (`joshua-project.ts`, `JOSHUA_PROJECT_API_KEY`): daily unreached people group.
  - Operation World: `mission-stats.json` (~172KB at `src/server/data/mission-stats.json`) read per request (actions.ts:43); world map GeoJSON fetched from a public GitHub raw URL at runtime (WorldMap.tsx:40).
  - County data: `County` table (`getCountiesForState`/`getAllStates`), replacing a prior 29MB JSON read.
- **Bible memory 8-step flow** (PracticeMode.tsx:33): Read silently → Listen (ESV audio) → Read aloud → Type → Speak(first-letter) → Type(first-letter) → Speak(hidden) → Type(hidden). Speech via Web Speech API; correctness via Levenshtein similarity ≥85% (PracticeMode.tsx:196). `currentStep>=8` ⇒ mastered (actions.ts:181). "Refresh" mode replays from step 6 for mastered verses.
- **Catechism:** metadata carousel → lazy `getCatechismQuestions(code)` returns raw JSON `data` blobs; `InteractiveCatechism` flattens main+sub questions, Levenshtein scoring ≥0.8 (InteractiveCatechism.tsx:291), persists `currentQuestionIndex` + `masteredQuestions[]` only when `studentId` && `catechismId` present (i.e., student view only).
- **Prayer journal:** master/detail with TipTap editor; debounced autosave (1.5s) that persists in place without remounting (PrayerJournalEditor.tsx:89). Deep-linkable via `?title=&category=` (used by `UnreachedOfTheDay` "Pray Now", UnreachedOfTheDay.tsx:109).

## 4. Data flow
- **Bible memory load:** `bible-memory/page.tsx:17` auth → `getCurrentUserOrg` → resolve org-scoped student (honoring `?studentId` only if in-org, page.tsx:31-44) → `Promise.all([getUserVerses, getLibraryVerses, getStudentFolders])` → `BibleMemoryDashboard`. Practice writes through `updateVerseProgress` (actions.ts:172) each step.
- **Add custom verse:** `BibleMemoryDashboard.handleAddCustomVerse` → `addVerseToUser({studentId, reference})` (actions.ts:135) → tries `getBibleText(data.reference)` (BUG: bare string, actions.ts:143) → throws zod → caught → `text=""` → row created empty; `PracticeMode` lazy-fetches text via `getBibleText({reference})` (PracticeMode.tsx:117) and persists via `updateVerseText`.
- **Bible study:** `BibleStudyClient.fetchData` (BibleStudyClient.tsx:83) → `getBiblePassage` (ESV html) + `getCommentary` (DB) + `getBibleAudio` → renders; "Plain English" → `summarizeCommentary(section.html)` (bible-study.ts:465, `models.flash`).
- **Catechism progress (student view):** `InteractiveCatechism` load → `getStudentCatechismProgress` (student-catechism.ts:15, asserts student in org) → on correct-without-show-answer → `markQuestionAsMastered` (student-catechism.ts:55); nav → `updateStudentCatechismProgress`.
- **Church notes:** `church/page.tsx:15` per-user `withTenant` read → `ChurchNotesClient` form `action={handleSubmit}` → `addChurchNote(FormData)` (family-discipleship/actions.ts:121) → `LocalChurchNotes.create` (no `withTenant`, uses raw `db`; session-gated + userId set).
- **Prayer create:** `PrayerJournalEditor` autosave/Save → `onSave` → `createPrayerEntry(data)` (prayer-journal.ts:76) → `createPrayerJournalSchema.parse` — editor sends `{title,content,date,tags,isPrivate,category}` (NO `prayerType`/`studentId`); schema allows it (all optional) so `data.prayerType` is `undefined` → `category` set null. Delete: `deletePrayerEntry(entry.id)` passes a STRING (PrayerJournalClient.tsx:138) but action zod-expects `{id}` (prayer-journal.ts:169) ⇒ runtime throw (BUG).
- **Missions:** `missions/page.tsx:11` (no auth) → `getUnreachedOfTheDayAction` (JP API) + `getOperationWorldStats` (JSON) → `UnreachedOfTheDay` + `MissionsClient` (map/list); map click → `findOperationWorldData` → `CountryInfoCard` portal.
- **Neighbor:** `neighbor/page.tsx:6` (no auth) → `getAllStates` → `CountyIssuesLookup`; state select → `getCountiesForState` (actions.ts:58).

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| `family-discipleship/page.tsx` | DONE | renders dashboard; page.tsx:7 |
| `DiscipleshipDashboard.tsx` | DONE | used by 3 pages + StudentDashboard:185 |
| `StudentDiscipleshipCard.tsx` | DONE | imported students/[id]/page.tsx:103 |
| `students/[id]/family-discipleship/page.tsx` | PARTIAL | no auth/org gate on page; page.tsx:9-15 |
| `students/[id]/family-discipleship/catechism/page.tsx` | PARTIAL | no auth/org gate on page; passes raw `id`; page.tsx:10-19 |
| `family-discipleship/actions.ts` `addChurchNote`/`deleteChurchNote` | DONE | imported ChurchNotesClient.tsx:12 |
| `family-discipleship/actions.ts` prayer/memory exports | DEAD | `createPrayerRequest`/`deletePrayerRequest`/`addMemoryVerse`/`deleteMemoryVerse`/`togglePrayerAnswered` zero importers (grep) |
| `bible-memory/page.tsx` | DONE | org-scoped resolution; page.tsx:22-44 |
| `bible-memory/actions.ts` | DONE | tenant-guarded CRUD; consumed by dashboard/practice |
| `BibleMemoryDashboard.tsx` | DONE | wired to actions; full UI |
| `PracticeMode.tsx` | DONE | 8-step flow; STEPS at PracticeMode.tsx:33 |
| `bible-memory/BibleAudioPlayer.tsx` | DONE | used PracticeMode.tsx:372 |
| `lib/schemas/bible-memory.ts` | DEAD | only self-references; actions.ts does no zod validation |
| `bible-study/page.tsx` | DONE | auth gate; page.tsx:7-11 |
| `BibleStudyClient.tsx` | DONE | full passage/commentary/summary flow |
| `bible-study/BibleAudioPlayer.tsx` | DONE | used BibleStudyClient.tsx:186 |
| `server/actions/bible-study.ts` `getBiblePassage`/`getCommentary`/`getBibleAudio`/`getBibleText`/`summarizeCommentary` | DONE | imported by client + memory |
| `server/actions/bible-study.ts` `searchBible` | DEAD | defined bible-study.ts:134, zero importers |
| `catechism/page.tsx` | PARTIAL | renders manager but NO auth gate; page.tsx:5 |
| `catechism/actions.ts` | PARTIAL | global reads, NO session check; actions.ts:7,27 |
| `catechism/types.ts` | DONE | CatechismSummary used |
| `CatechismManager.tsx` | DONE | carousel + lazy load |
| `InteractiveCatechism.tsx` | DONE | full drill; progress only when studentId+catechismId |
| `app/actions/student-catechism.ts` `get/update/markQuestionAsMastered` | DONE | org-guarded; used InteractiveCatechism.tsx:8 |
| `app/actions/student-catechism.ts` `toggleQuestionMastery` | DEAD | defined student-catechism.ts:83, zero importers |
| `church/page.tsx` | DONE | per-user withTenant read; page.tsx:15 |
| `ChurchNotesClient.tsx` | DONE | wired to addChurchNote/deleteChurchNote |
| `devotionals/page.tsx` | PARTIAL | works but NO auth gate; global `Devotional` query; page.tsx:12 |
| `DevotionalDisplay.tsx` | DONE | AM/PM tabs + heuristic parse |
| `heart-check/page.tsx` | DONE | auth gate; page.tsx:9 |
| `HeartCheckClient.tsx` | DONE | static content, no persistence |
| `missions/page.tsx` | PARTIAL | works but NO auth gate; page.tsx:10 |
| `missions/actions.ts` | PARTIAL | server actions with NO session check; actions.ts:33-88 |
| `MissionsClient.tsx` | DONE | map/list toggle, dynamic Leaflet |
| `CountryInfoCard.tsx` | DONE | portal modal; used MissionsClient.tsx:114 |
| `UnreachedOfTheDay.tsx` | DONE | JP card + prayer deep link |
| `WorldMap.tsx` | DONE | Leaflet + self-hosted GeoJSON (✅ 2026-06-19: now fetches /world.geojson) |
| `missions/utils/countryMapping.ts` | DONE | used by WorldMap |
| `lib/joshua-project.ts` `fetchUnreachedOfTheDay` | DONE | used missions/actions.ts:34 |
| `lib/joshua-project.ts` `fetchUnreachedByCountry` | DEAD | defined joshua-project.ts:96, zero importers |
| `neighbor/page.tsx` | PARTIAL | works but NO auth gate; page.tsx:6 |
| `CountyIssuesLookup.tsx` | DONE | full indicator UI |
| `prayer/page.tsx` | DONE | auth gate; page.tsx:9 |
| `server/actions/prayer-journal.ts` `getPrayerEntries`/`create`/`update`/`delete`/`togglePrayerAnswered` | DONE | per-user ownership checks |
| `server/actions/prayer-journal.ts` `getPrayerCategories` | PARTIAL | global `PrayerCategory` read, no session check; prayer-journal.ts:234 |
| `PrayerJournalClient.tsx` | PARTIAL | wired; passes string to `deletePrayerEntry` (bug); unused `togglePrayerAnswered` import |
| `PrayerJournalEditor.tsx` | DONE | TipTap + autosave |
| `PrayerJournalSidebar.tsx` | DONE | list/search/filter |
| `PrayerJournalFilters.tsx` | DONE | used by sidebar |

## 6. Integration points
- **Importers out:** `DiscipleshipDashboard` ← family-discipleship pages + `components/dashboard/StudentDashboard.tsx:185`; `StudentDiscipleshipCard` ← `students/[id]/page.tsx:103`; `CatechismManager` ← parent + student catechism pages; `getBibleText`/`getBibleAudio` ← bible-memory PracticeMode + actions.
- **Env vars:** `BIBLE_API_KEY` (ESV; bible-study.ts:68), `JOSHUA_PROJECT_API_KEY` (joshua-project.ts:2).
- **External APIs:** ESV API (`api.esv.org`), Joshua Project (`api.joshuaproject.net`), CARTO basemap tiles + GitHub-hosted world GeoJSON (WorldMap.tsx:40).
- **Filesystem:** `src/server/data/mission-stats.json` (read per request, actions.ts:43).
- **Prisma models used:** `Learner`, `BibleMemory`, `BibleMemoryFolder`, `Catechism`, `CatechismQuestion`, `StudentCatechismProgress`, `CommentaryChapter`(+sections), `Devotional`, `LocalChurchNotes`, `PrayerJournalEntry`, `PrayerCategory`, `County`. See 02-data-model.md.
- **Tenancy machinery:** `getCurrentUserOrg`, `withTenant` — see 04-security-auth-tenancy.md. RLS is OFF (anchor facts) so the app layer is the only boundary.
- **Inngest jobs:** none in this chapter.
- **AI:** `summarizeCommentary` uses `models.flash` (Vercel AI SDK) — see 05-ai-core.

## 7. Findings

Q-20-001  [HIGH]  Unauthenticated server actions expose global content reads (missions/catechism/neighbor/devotionals)  — src/app/family-discipleship/missions/actions.ts:33-88, src/app/family-discipleship/catechism/actions.ts:7,27, src/server/actions/prayer-journal.ts:234, src/app/family-discipleship/devotionals/page.tsx:12, src/app/family-discipleship/neighbor/page.tsx:6, src/app/family-discipleship/missions/page.tsx:10, src/app/family-discipleship/catechism/page.tsx:5
  Evidence: `getOperationWorldStats`, `getCountiesForState`, `getAllStates`, `getUnreachedOfTheDayAction`, `getCatechisms`, `getCatechismQuestions`, `getPrayerCategories` are `'use server'`/RSC functions with no `auth()`/`getCurrentUserOrg()` call. The missions, neighbor, devotionals, and catechism RSC pages also render without a session gate (unlike bible-study/heart-check/prayer which `redirect` when unauthenticated).
  Impact: Any anonymous caller can invoke these actions / load these pages. Data is non-tenant (shared content + a 3rd-party API burning the JP/ESV quota), so no cross-tenant PII leak, but it is an unauthenticated surface and quota-exhaustion vector. Inconsistent with sibling features that gate.
  Status: documented (not fixed)

Q-20-002  [HIGH]  `deletePrayerEntry` called with a string but validates an object → runtime throw on delete  — src/app/family-discipleship/prayer/PrayerJournalClient.tsx:138, src/server/actions/prayer-journal.ts:169-170
  Evidence: client calls `await deletePrayerEntry(entry.id)` (string); action does `deletePrayerSchema.parse(rawData)` where `deletePrayerSchema = z.object({ id: z.string().uuid() })`. Parsing a bare string throws a ZodError; caught only by the client's try/catch → toast "Failed to delete entry".
  Impact: Deleting prayer entries from the sidebar is broken; entries cannot be removed via the UI.
  Status: documented (not fixed)

Q-20-003  [MED]  `addVerseToUser` calls `getBibleText` with a bare string; signature expects `{reference}` → text always empty on add  — src/app/family-discipleship/bible-memory/actions.ts:143, src/server/actions/bible-study.ts:250-251
  Evidence: actions.ts passes `getBibleText(data.reference)` (string); `getBibleText` does `getBiblePassageSchema.parse(rawData)` expecting `{ reference }`. The bare string throws zod, caught at actions.ts:144-146 → `text=""`. (PracticeMode.tsx:117 calls the correct object form and lazy-backfills text.)
  Impact: Newly added verses are persisted with empty text until first practice; the dead-path try/catch hides the bug. Drift between two call sites of the same action.
  Status: documented (not fixed)

Q-20-004  [MED]  Entire legacy `family-discipleship/actions.ts` is dead except church-note actions; duplicates dedicated server actions  — src/app/family-discipleship/actions.ts:8,31,54,76,100
  Evidence: `createPrayerRequest`, `togglePrayerAnswered`, `deletePrayerRequest`, `addMemoryVerse`, `deleteMemoryVerse` have zero importers (grep). They use raw `db` (no `withTenant`) and write `userId`-scoped `PrayerJournalEntry`/`BibleMemory` rows that overlap the live `prayer-journal.ts` / bible-memory `actions.ts` paths. PrayerJournalClient even imports a same-named `togglePrayerAnswered` from the *other* module.
  Impact: Dead code + naming collision risk; the legacy `addMemoryVerse` writes verses with no `withTenant` org context, inconsistent with the live path.
  Status: documented (not fixed)

Q-20-005  [LOW]  Dead exports: `bible-memory.ts` schemas, `searchBible`, `fetchUnreachedByCountry`, `toggleQuestionMastery`  — src/lib/schemas/bible-memory.ts (whole file), src/server/actions/bible-study.ts:134, src/lib/joshua-project.ts:96, src/app/actions/student-catechism.ts:83
  Evidence: each has zero importers repo-wide (grep). Notably `bible-memory.ts` Zod schemas use `.cuid()` while the actual `BibleMemory.id`/`studentId` are uuid (schema.prisma:1518) — so even if wired they would reject valid IDs.
  Impact: Dead code; the bible-memory `actions.ts` performs NO input validation at all because its intended schemas are unused.
  Status: documented (not fixed)

Q-20-006  [MED]  bible-memory `actions.ts` server actions accept fully untrusted input with no schema validation  — src/app/family-discipleship/bible-memory/actions.ts:135,252,287,304,323
  Evidence: `addVerseToUser`, `createFolder`, `renameFolder`, `moveVerseToFolder`, `copyFolderToStudent` take raw `string`/object args; they enforce org ownership via `assertStudentInOrg`/`assertVerseAccess`/`assertFolderInOrg` but never validate shape/length (the `bible-memory.ts` schemas are unused — see Q-20-005).
  Impact: No length/format bounds on `reference`/`name`/`text`; relies entirely on ownership asserts. Lower severity because authz IS enforced, but input validation is absent.
  Status: documented (not fixed)

Q-20-007  [LOW]  Student-scoped suite pages do not gate on session/org before rendering  — src/app/students/[id]/family-discipleship/page.tsx:9-15, src/app/students/[id]/family-discipleship/catechism/page.tsx:10-19
  Evidence: both pages read `id` from params and render `DiscipleshipDashboard`/`CatechismManager studentId={id}` with no `auth()` or `getCurrentUserOrg` check. The downstream progress actions (`student-catechism.ts`) DO assert the student belongs to the caller's org, so writes are protected; but the page renders for any caller and leaks the studentId into client props.
  Impact: Defense-in-depth gap; UI shells render for unauthenticated/cross-tenant callers even though mutating actions are guarded.
  Status: documented (not fixed)

Q-20-008  [LOW]  `getPrayerEntries` returns `isPrivate` entries to the owner only, but `isPrivate` is never enforced anywhere  — src/server/actions/prayer-journal.ts:46-74, src/app/family-discipleship/prayer/PrayerJournalEditor.tsx:286
  Evidence: prayer entries have an `isPrivate` toggle (editor) and the field is persisted, but `getPrayerEntries` filters only by `userId`; there is no consumer that treats private entries differently (no parent/child sharing path exists). The toggle is effectively cosmetic.
  Impact: Feature appears to promise privacy semantics it does not implement; minor UX/expectation mismatch (no data leak since all queries are already per-user).
  Status: documented (not fixed)

Q-20-009  [INFO]  ✅ RESOLVED 2026-06-19 — self-hosted world.geojson at public/world.geojson; WorldMap now fetches /world.geojson (see CHANGELOG.md). WorldMap fetches GeoJSON from an arbitrary third-party GitHub raw URL at runtime  — src/app/family-discipleship/missions/WorldMap.tsx:40
  Evidence: `fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')` on mount; map silently fails if the URL/repo changes or is unreachable.
  Impact: Reliability/supply-chain dependency on an external personal repo for a core feature; no integrity check or fallback bundle.
  Status: documented (not fixed)

Q-20-010  [LOW]  (re-graded INFO→LOW 2026-06-19, owner) `mission-stats.json` (~172KB) is read from disk on every Missions/Neighbor request  — src/app/family-discipleship/missions/actions.ts:41-51
  Evidence: `getOperationWorldStats` does `fs.readFile(...)` + `JSON.parse` each call with no caching/memoization. Neighbor + Missions both hit county/state queries; OW stats reload per render.
  Impact: Minor per-request CPU/IO; acceptable at current size but unbounded if file grows.
  Status: documented (not fixed)
