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
| `family-discipleship/actions.ts` prayer/memory exports | REMOVED | ✅ removed 2026-06-22 (Q-20-004) — 5 dead legacy exports (`createPrayerRequest`/`deletePrayerRequest`/`addMemoryVerse`/`deleteMemoryVerse`/`togglePrayerAnswered`); only `addChurchNote`/`deleteChurchNote` remain |
| `bible-memory/page.tsx` | DONE | org-scoped resolution; page.tsx:22-44 |
| `bible-memory/actions.ts` | DONE | tenant-guarded CRUD + Zod input validation on the 4 mutating actions (Q-20-006); dead `copyFolderToStudent` removed; consumed by dashboard/practice |
| `BibleMemoryDashboard.tsx` | DONE | wired to actions; full UI |
| `PracticeMode.tsx` | DONE | 8-step flow; STEPS at PracticeMode.tsx:33 |
| `bible-memory/BibleAudioPlayer.tsx` | DONE | used PracticeMode.tsx:372 |
| `lib/schemas/bible-memory.ts` | DONE | ✅ fixed (.cuid()→.uuid()) + WIRED into the 4 bible-memory actions 2026-06-22 (Q-20-006); trimmed to the 4 wired schemas; +`bible-memory.test.ts` |
| `bible-study/page.tsx` | DONE | auth gate; page.tsx:7-11 |
| `BibleStudyClient.tsx` | DONE | full passage/commentary/summary flow |
| `bible-study/BibleAudioPlayer.tsx` | DONE | used BibleStudyClient.tsx:186 |
| `server/actions/bible-study.ts` `getBiblePassage`/`getCommentary`/`getBibleAudio`/`getBibleText`/`summarizeCommentary` | DONE | imported by client + memory |
| `server/actions/bible-study.ts` `searchBible` | REMOVED | ✅ removed 2026-06-22 (Q-20-005) — dead, + its orphaned `searchBibleSchema`/`ESVSearchResponse`/`ESVSearchResult`/`MAX_SEARCH_RESULTS` tail |
| `catechism/page.tsx` | DONE | proxy-gated (PUBLIC_ROUTES excludes the subtree); its action is now session-gated (Q-20-001 ✅); page.tsx:5 |
| `catechism/actions.ts` | DONE | global reads, now session-gated (Q-20-001 ✅ — `requireSession()`); actions.ts |
| `catechism/types.ts` | DONE | CatechismSummary used |
| `CatechismManager.tsx` | DONE | carousel + lazy load |
| `InteractiveCatechism.tsx` | DONE | full drill; progress only when studentId+catechismId |
| `app/actions/student-catechism.ts` `get/update/markQuestionAsMastered` | DONE | org-guarded; used InteractiveCatechism.tsx:8 |
| `app/actions/student-catechism.ts` `toggleQuestionMastery` | REMOVED | ✅ removed 2026-06-22 (Q-20-005) — dead + a redundant twin of the live `markQuestionAsMastered` |
| `church/page.tsx` | DONE | per-user withTenant read; page.tsx:15 |
| `ChurchNotesClient.tsx` | DONE | wired to addChurchNote/deleteChurchNote |
| `devotionals/page.tsx` | DONE | proxy-gated (Q-20-001 ✅); global `Devotional` query; page.tsx:12 |
| `DevotionalDisplay.tsx` | DONE | AM/PM tabs + heuristic parse |
| `heart-check/page.tsx` | DONE | auth gate; page.tsx:9 |
| `HeartCheckClient.tsx` | DONE | static content, no persistence |
| `missions/page.tsx` | DONE | proxy-gated; its actions now session-gated (Q-20-001 ✅); page.tsx:10 |
| `missions/actions.ts` | DONE | server actions now session-gated (Q-20-001 ✅ — `requireSession()`); actions.ts |
| `MissionsClient.tsx` | DONE | map/list toggle, dynamic Leaflet |
| `CountryInfoCard.tsx` | DONE | portal modal; used MissionsClient.tsx:114 |
| `UnreachedOfTheDay.tsx` | DONE | JP card + prayer deep link |
| `WorldMap.tsx` | DONE | Leaflet + self-hosted GeoJSON (✅ 2026-06-19: now fetches /world.geojson) |
| `missions/utils/countryMapping.ts` | DONE | used by WorldMap |
| `lib/joshua-project.ts` `fetchUnreachedOfTheDay` | DONE | used missions/actions.ts:34 |
| `lib/joshua-project.ts` `fetchUnreachedByCountry` | REMOVED | ✅ removed 2026-06-22 (Q-20-005) — dead, zero importers |
| `neighbor/page.tsx` | DONE | proxy-gated; its actions now session-gated (Q-20-001 ✅); page.tsx:6 |
| `CountyIssuesLookup.tsx` | DONE | full indicator UI |
| `prayer/page.tsx` | DONE | auth gate; page.tsx:9 |
| `server/actions/prayer-journal.ts` `getPrayerEntries`/`create`/`update`/`delete`/`togglePrayerAnswered` | DONE | per-user ownership checks |
| `server/actions/prayer-journal.ts` `getPrayerCategories` | DONE | global `PrayerCategory` read, now session-gated (Q-20-001 ✅); prayer-journal.ts:234 |
| `PrayerJournalClient.tsx` | DONE | wired; the `deletePrayerEntry({id})` string-vs-object delete bug fixed (Q-20-002 ✅) |
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
  Status: ✅ RESOLVED (2026-06-22, consolidated pass / ch.20-HIGH) — 🔻 over-graded (really LOW defense-in-depth): the adversarial pass proved the `/family-discipleship` PAGES are already fail-closed by the central proxy (`src/proxy.ts` — PUBLIC_ROUTES excludes the whole subtree; git-verified the guard predates the doc SHA), and the server actions POST to those same proxy-matched page routes, so the "unauthenticated surface / anonymous quota vector" the HIGH rested on does not exist for normal invocation; the data is global non-tenant content. **Fixed anyway** (defense-in-depth — per the proxy's own "backstop NOT a replacement" comment, converging the older content actions onto the gated-sibling posture + closing the obscure public-route-POST bypass): added an `auth()` session check to the 7 content actions (`getUnreachedOfTheDayAction`/`getOperationWorldStats`/`getCountiesForState`/`getAllStates`, `getCatechisms`/`getCatechismQuestions`, `getPrayerCategories`). No org filter (global data); pages stay proxy-gated (no page change). Fix-and-close → re-grade moot (over-grade recorded). CI green. (see CHANGELOG.md)

Q-20-002  [HIGH]  `deletePrayerEntry` called with a string but validates an object → runtime throw on delete  — src/app/family-discipleship/prayer/PrayerJournalClient.tsx:138, src/server/actions/prayer-journal.ts:169-170
  Evidence: client calls `await deletePrayerEntry(entry.id)` (string); action does `deletePrayerSchema.parse(rawData)` where `deletePrayerSchema = z.object({ id: z.string().uuid() })`. Parsing a bare string throws a ZodError; caught only by the client's try/catch → toast "Failed to delete entry".
  Impact: Deleting prayer entries from the sidebar is broken; entries cannot be removed via the UI.
  Status: ✅ RESOLVED (2026-06-22, consolidated pass / ch.20-HIGH) — fixed the call to match the contract: `deletePrayerEntry(entry.id)` → `deletePrayerEntry({ id: entry.id })` (PrayerJournalClient.tsx:138), matching `createPrayerEntry`/`updatePrayerEntry` (object args) + the house `deleteStudent({id})` convention. 🔻 over-graded HIGH (a broken FEATURE, not a vuln — the action is fully auth/org/ownership-guarded; the Zod throw merely rejected malformed input pre-write) → fix-and-close, re-grade moot. **Sibling bug fixed:** the identical string-vs-object pattern broke course delete (`CourseList.tsx:65` `deleteCourse(course.id)` vs `deleteCourseSchema` object) → minted-and-resolved **Q-14-009** (ch.14). CI green. (see CHANGELOG.md)

Q-20-003  [MED]  `addVerseToUser` calls `getBibleText` with a bare string; signature expects `{reference}` → text always empty on add  — src/app/family-discipleship/bible-memory/actions.ts:143, src/server/actions/bible-study.ts:250-251
  Evidence: actions.ts passes `getBibleText(data.reference)` (string); `getBibleText` does `getBiblePassageSchema.parse(rawData)` expecting `{ reference }`. The bare string throws zod, caught at actions.ts:144-146 → `text=""`. (PracticeMode.tsx:117 calls the correct object form and lazy-backfills text.)
  Impact: Newly added verses are persisted with empty text until first practice; the dead-path try/catch hides the bug. Drift between two call sites of the same action.
  Status: ✅ RESOLVED (2026-06-22, consolidated pass / ch.20-MED) — fixed the arg shape: `getBibleText(data.reference)` → `getBibleText({ reference: data.reference })` (bible-memory/actions.ts), so a newly-added verse fetches its text immediately. KEPT the surrounding try/catch→`text=""` (resilience for an ESV outage / bad reference — PracticeMode still lazy-backfills on first practice; removing it would regress to a failed add). CI green. (see CHANGELOG.md)

Q-20-004  [MED]  Entire legacy `family-discipleship/actions.ts` is dead except church-note actions; duplicates dedicated server actions  — src/app/family-discipleship/actions.ts:8,31,54,76,100
  Evidence: `createPrayerRequest`, `togglePrayerAnswered`, `deletePrayerRequest`, `addMemoryVerse`, `deleteMemoryVerse` have zero importers (grep). They use raw `db` (no `withTenant`) and write `userId`-scoped `PrayerJournalEntry`/`BibleMemory` rows that overlap the live `prayer-journal.ts` / bible-memory `actions.ts` paths. PrayerJournalClient even imports a same-named `togglePrayerAnswered` from the *other* module.
  Impact: Dead code + naming collision risk; the legacy `addMemoryVerse` writes verses with no `withTenant` org context, inconsistent with the live path.
  Status: ✅ REMOVED (2026-06-22, consolidated pass / ch.20-MED) — deleted the 5 dead legacy exports (`createPrayerRequest`/`togglePrayerAnswered`/`deletePrayerRequest`/`addMemoryVerse`/`deleteMemoryVerse`) from `family-discipleship/actions.ts`; kept the wired `addChurchNote`/`deleteChurchNote` (ChurchNotesClient). Confirmed zero importers + that PrayerJournalClient's `togglePrayerAnswered` comes from the LIVE `prayer-journal.ts` (resolving the naming collision). The shared `auth`/`db`/`revalidatePath` imports stay live via the church-note actions. CI green. (see CHANGELOG.md)

Q-20-005  [LOW]  Dead exports: `bible-memory.ts` schemas, `searchBible`, `fetchUnreachedByCountry`, `toggleQuestionMastery`  — src/lib/schemas/bible-memory.ts (whole file), src/server/actions/bible-study.ts:134, src/lib/joshua-project.ts:96, src/app/actions/student-catechism.ts:83
  Evidence: each has zero importers repo-wide (grep). Notably `bible-memory.ts` Zod schemas use `.cuid()` while the actual `BibleMemory.id`/`studentId` are uuid (schema.prisma:1518) — so even if wired they would reject valid IDs.
  Impact: Dead code; the bible-memory `actions.ts` performs NO input validation at all because its intended schemas are unused.
  Status: ✅ RESOLVED (2026-06-22, consolidated pass / ch.20-LOW) — SPLIT: ✅ REMOVED the 3 truly-dead symbols `searchBible` (bible-study.ts, + its orphaned `searchBibleSchema`/`ESVSearchResponse`/`ESVSearchResult`/`MAX_SEARCH_RESULTS` tail), `fetchUnreachedByCountry` (joshua-project.ts), and `toggleQuestionMastery` (student-catechism.ts — a redundant twin of the live `markQuestionAsMastered`). `lib/schemas/bible-memory.ts` is NOT dead-to-delete — it is the intended (drifted) validation for the bible-memory actions and is FIXED (.cuid()→.uuid()) + WIRED by Q-20-006 (ch.20-MED), so its deadness resolves by wiring. CI green. (see CHANGELOG.md)

Q-20-006  [MED]  bible-memory `actions.ts` server actions accept fully untrusted input with no schema validation  — src/app/family-discipleship/bible-memory/actions.ts:135,252,287,304,323
  Evidence: `addVerseToUser`, `createFolder`, `renameFolder`, `moveVerseToFolder`, `copyFolderToStudent` take raw `string`/object args; they enforce org ownership via `assertStudentInOrg`/`assertVerseAccess`/`assertFolderInOrg` but never validate shape/length (the `bible-memory.ts` schemas are unused — see Q-20-005).
  Impact: No length/format bounds on `reference`/`name`/`text`; relies entirely on ownership asserts. Lower severity because authz IS enforced, but input validation is absent.
  Status: ✅ RESOLVED (2026-06-22, consolidated pass / ch.20-MED) — fixed `lib/schemas/bible-memory.ts` (.cuid()→.uuid() to match the real uuid ids + bounded `text`) and WIRED the 4 LIVE actions (`addVerseToUser`/`createFolder`/`renameFolder`/`moveVerseToFolder`) to `parse` their schemas inside the existing try/catch (a ZodError degrades to `{success:false}`, not a crash). The 5th listed action `copyFolderToStudent` was DEAD (zero callers) → removed (a consequential Q-20-005-class cleanup) with its `copyFolderSchema`. This also completes Q-20-005's `bible-memory.ts` part (the dead schema is now live). +`bible-memory.test.ts` (8 cases). CI green. (see CHANGELOG.md)

Q-20-007  [LOW]  Student-scoped suite pages do not gate on session/org before rendering  — src/app/students/[id]/family-discipleship/page.tsx:9-15, src/app/students/[id]/family-discipleship/catechism/page.tsx:10-19
  Evidence: both pages read `id` from params and render `DiscipleshipDashboard`/`CatechismManager studentId={id}` with no `auth()` or `getCurrentUserOrg` check. The downstream progress actions (`student-catechism.ts`) DO assert the student belongs to the caller's org, so writes are protected; but the page renders for any caller and leaks the studentId into client props.
  Impact: Defense-in-depth gap only. *(Corrected 2026-06-22: the "renders for UNAUTHENTICATED callers" claim is FALSE — `src/proxy.ts` fail-closed redirects any sessionless request for `/students/*` to `/login`, and `profile-access.ts` gates by profile type. The real residual is inert: a logged-in caller could load a shell carrying a cross-tenant `studentId` in client props, but no cross-tenant data is read/written — `DiscipleshipDashboard` uses `studentId` only for href suffixes, and `InteractiveCatechism`'s `studentId` calls all hit `assertStudentInOrg` which throws.)*
  Status: ✅ ACCEPTED — correct-by-design / defense-in-depth note (2026-06-22, consolidated pass / ch.20-LOW). The proxy is the live gate; the residual is inert (no data leak). Mirroring `bible-memory/page.tsx`'s ~30-line org-scoped resolution would be disproportionate (these pages load NO per-student data server-side — only global catechism metadata). Kept as a defense-in-depth note: a future server-side per-student read here must add an org check. No code change. (see CHANGELOG.md)

Q-20-008  [LOW]  `getPrayerEntries` returns `isPrivate` entries to the owner only, but `isPrivate` is never enforced anywhere  — src/server/actions/prayer-journal.ts:46-74, src/app/family-discipleship/prayer/PrayerJournalEditor.tsx:286
  Evidence: *(Corrected 2026-06-22: the field is NOT persisted from the toggle — `createPrayerEntry` hardcodes `isPrivate:false` (prayer-journal.ts:93), `createPrayerJournalSchema`/`updatePrayerSchema` omit it, and the only other writer is dead (Q-20-004). So NO wired path ever stores `isPrivate:true`. There ARE cosmetic consumers — a Lock icon (PrayerJournalSidebar.tsx:141) + a "Private" badge (PrayerJournalEditor.tsx:292-296) — that therefore never trigger in normal use.)* `getPrayerEntries` filters only by `userId`; there is no sharing path for `isPrivate` to gate.
  Impact: A half-built/disconnected Public/Private toggle (control + Lock/badge present; persistence severed). No data leak — every prayer query is already per-user, so there is nothing for `isPrivate` to gate.
  Status: ✅ ACCEPTED — won't-fix this pass (2026-06-22, consolidated pass / ch.20-LOW). Security is settled (no leak). Whether to WIRE a real privacy/sharing model or REMOVE the misleading toggle + Lock/badge is a **product/UI decision** deferred to the owner (roadmap, ch.24 §5) — not a code fix for an adversarial pass. No schema change (the `isPrivate` column can stay unused). (see CHANGELOG.md)

Q-20-009  [INFO]  ✅ RESOLVED 2026-06-19 — self-hosted world.geojson at public/world.geojson; WorldMap now fetches /world.geojson (see CHANGELOG.md). WorldMap fetches GeoJSON from an arbitrary third-party GitHub raw URL at runtime  — src/app/family-discipleship/missions/WorldMap.tsx:40
  Evidence: `fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')` on mount; map silently fails if the URL/repo changes or is unreachable.
  Impact: Reliability/supply-chain dependency on an external personal repo for a core feature; no integrity check or fallback bundle.
  Status: documented (not fixed)

Q-20-010  [LOW]  (re-graded INFO→LOW 2026-06-19, owner) `mission-stats.json` (~172KB) is read from disk on every Missions/Neighbor request  — src/app/family-discipleship/missions/actions.ts:41-51
  Evidence: `getOperationWorldStats` does `fs.readFile(...)` + `JSON.parse` each call with no memoization. *(Corrected 2026-06-22: only the Missions page calls it — once per render; Neighbor calls `getAllStates` and never touches the JSON. The same 175KB is already RSC-serialized to the client via the `MissionsClient stats` prop, so the server parse is the MINOR cost.)*
  Impact: Minor per-request CPU/IO on a low-traffic authenticated page; the file is a static snapshot (no growth pipeline).
  Status: ✅ ACCEPTED — correct-by-design / won't-fix (2026-06-22, consolidated pass / ch.20-LOW). A cold-path micro-optimization; the dominant cost (175KB client payload) is untouched by memoizing the parse, and React `cache()` would be a no-op (request-scoped — the call already happens once per render). Only a module-level / `unstable_cache` memo helps cross-request — disproportionate for a static file on a low-traffic page. No code change. (see CHANGELOG.md)
