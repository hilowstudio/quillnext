# 19 — Family Discipleship B: Bible Memory, Prayer, Church, Heart‑Check, Missions, Neighbor

> Code‑truth reference. Verified against source on 2026‑06‑15. The repo's prose/markdown docs are known stale — everything here is cited to `file:line` against actual code. Trust the code, not this doc's prose if they ever diverge.

This document covers the "second half" of the Family Discipleship suite. The catechism, devotionals, and bible‑study sub‑routes live under the same `src/app/family-discipleship/` folder but are **out of scope** here (separate subsystem); they appear only as cross‑links.

---

## Purpose & role in the app

The Family Discipleship suite is a faith‑formation toolkit hung off `/family-discipleship`. This subsystem owns six features:

- **Bible Memory** (`/bible-memory`) — student‑scoped memory verses with an 8‑step practice flow, folders, drag‑and‑drop, ESV text/audio fetch, speech recognition, and a curated 50‑verse library.
- **Prayer Journal** (`/prayer`) — user‑scoped rich‑text prayer entries (TipTap), categories, tags, privacy flag, answered tracking.
- **Local Church** (`/church`) — user‑scoped sermon/worship notes (one per date) with structured fields (main points, songs, serving, generosity, "the one thing").
- **Heart Check** (`/heart-check`) — a fully **static, client‑only** gospel‑centered emotions guide (8 emotions). No DB, no server actions.
- **Missions** (`/missions`) — "Unreached People Group of the Day" (Joshua Project API) + an Operation World country explorer (Leaflet map + list) sourced from a bundled JSON file.
- **Neighbor Love** (`/neighbor`) — county‑level social/spiritual indicators lookup for all ~3,143 US counties, sourced from a `County` Postgres table, with "get involved" guidance.

There is also a shared landing dashboard and two server‑action files (`actions.ts` and `@/server/actions/prayer-journal.ts`) split between two divergent eras of the code (see Risks).

---

## File‑by‑file reference

### Landing / shared

#### `src/app/family-discipleship/page.tsx`
- **Role:** Route entry for `/family-discipleship`. Server component; renders `<DiscipleshipDashboard />` inside a container. No auth, no data fetch.
- **Notes:** Delegates everything to `@/components/family-discipleship/DiscipleshipDashboard` (NOT one of the files I own, but the only real content of this route).

#### `src/components/family-discipleship/DiscipleshipDashboard.tsx` (cross‑link, renders the landing)
- **Role:** Static client‑friendly grid of 9 feature cards (Devotionals, Prayer, Catechism, Scripture Memory, Local Church, Missions, Neighbor Love, Heart Check, Bible Study). Pure `<Link>` navigation.
- **Notes:** Accepts optional `studentId` and appends `?studentId=…` to every href (`DiscipleshipDashboard.tsx:22`). Bible‑memory **ignores** that param (it `findFirst()`s a student instead — see below), so the student suffix is decorative for this subsystem.

#### `src/app/family-discipleship/actions.ts` ("legacy" server actions)
- **Role:** `'use server'`. The **older / simpler** generation of discipleship actions. Exports: `createPrayerRequest`, `togglePrayerAnswered`, `deletePrayerRequest`, `addMemoryVerse`, `deleteMemoryVerse`, `addChurchNote`, `deleteChurchNote`.
- **Auth/tenancy:** Uses `auth()` directly and scopes by **`session.user.id`** (user‑level), NOT org. Each mutation re‑fetches the row and checks `entry.userId === session.user.id` before write (`actions.ts:42, 65, 110, 180`).
- **Prisma models:** `prayerJournalEntry`, `bibleMemory`, `localChurchNotes`.
- **Notes / drift:**
  - `addMemoryVerse`/`deleteMemoryVerse` write `bibleMemory` rows keyed by **`userId`** (`actions.ts:89–95`). The live Bible Memory UI instead uses the **student‑scoped** `bible-memory/actions.ts`. These two code paths are largely disjoint; `addMemoryVerse` is **not called by any current UI** in this subsystem (the dashboard uses `addVerseToUser`). Treat `addMemoryVerse`/`deleteMemoryVerse`/`createPrayerRequest`/`deletePrayerRequest`/this `togglePrayerAnswered` as **legacy/likely‑dead** for the shipped flows.
  - `addChurchNote` (`actions.ts:121–168`) and `deleteChurchNote` (`actions.ts:170–189`) **ARE live** — used by `ChurchNotesClient`. `addChurchNote` parses `mainPoints`/`songs` from JSON strings in the FormData and writes the rich `LocalChurchNotes` row.
  - No Zod validation here; raw `formData.get(...)` + `JSON.parse` (church note JSON parse is unguarded — malformed JSON throws, see Risks).

### Bible Memory (`/bible-memory`)

#### `src/app/family-discipleship/bible-memory/page.tsx`
- **Role:** Server component. Fetches the **first student in the DB** via `db.student.findFirst()` (`page.tsx:9`) — *no org scoping, no auth gate on the page itself*. If no student, renders a "No Student Found" message. Then `Promise.all` of `getUserVerses(studentId)`, `getLibraryVerses()`, `getStudentFolders(studentId)` and renders `<BibleMemoryDashboard>`.
- **Notes / BUG:** `db.student.findFirst()` returns an **arbitrary student from any organization** (`page.tsx:9`). In a multi‑tenant app this is a tenancy leak at the page level — the wrong family's student/verses can be surfaced. The *actions* it calls are org‑guarded (so writes are safe), but the page picks a global‑first student to seed the UI. "For demo purposes" comment confirms it's unfinished.

#### `src/app/family-discipleship/bible-memory/actions.ts` (current Bible Memory actions)
- **Role:** `'use server'`. The **newer, org‑scoped** Bible Memory action set. This is the one the dashboard actually calls.
- **Auth/tenancy:** Strong. `requireCaller()` calls `getCurrentUserOrg()` (throws if unauthenticated) and requires `organizationId` (`actions.ts:28–32`). Helper guards:
  - `assertStudentInOrg(studentId, org)` — student must belong to caller's org (`actions.ts:34`).
  - `assertVerseAccess(verseId, org, userId)` — verse passes if its student's org matches OR it is the caller's own user verse (`actions.ts:40–48`).
  - `assertFolderInOrg(folderId, org)` (`actions.ts:50–56`).
- **Exports:** `getLibraryVerses`, `getUserVerses`, `addVerseToUser`, `updateVerseProgress`, `deleteUserVerse`, `updateVerseText`, `getStudentFolders`, `createFolder`, `deleteFolder`, `renameFolder`, `moveVerseToFolder`, `copyFolderToStudent`, `refreshVerse`, `resetVerseMastery`.
- **Library seeding:** `PRELOADED_VERSES` is a 50‑reference curated list (`actions.ts:10–22`). `ensureLibrarySeeded()` lazily inserts any missing `isDefault: true` rows **with empty `text`** (text is fetched later on demand) and short‑circuits if `count > 5` (`actions.ts:64–89`).
- **Mastery model:** `currentStep` 0..8. `updateVerseProgress` sets `masteredAt` when `stepCompleted >= 8` (`actions.ts:155–157`). `resetVerseMastery` clears mastery and resets to step 0.
- **BUG (verse text never auto‑fetched here):** `addVerseToUser` calls `getBibleText(data.reference)` passing a **bare string** (`actions.ts:121`), but `getBibleText(rawData)` parses with `getBiblePassageSchema = z.object({ reference: z.string().min(3) })` (`src/server/actions/bible-study.ts:127, 250–251`). A bare string fails the Zod parse, the surrounding `try/catch` swallows it, and `text` falls back to `""` (`actions.ts:119–125`). Net effect: verses are created with empty text from this path; the text is later fetched **client‑side** by `PracticeMode` (which calls it correctly with `{ reference }`) and persisted via `updateVerseText`. So the feature still works, but the server‑side prefetch is dead. Contrast with the **correct** call shape in `PracticeMode.tsx:117`.
- **Other notes:** Heavy use of `: any` and broad `try/catch` returning `{ success:false, error }`. `copyFolderToStudent` deep‑copies a folder + its verses to another student in the same org (`actions.ts:265–301`).

#### `src/app/family-discipleship/bible-memory/BibleMemoryDashboard.tsx`
- **Role:** `'use client'`. Main interactive dashboard. Default export (note: imported as a default in `page.tsx:4`).
- **Features:** Learning vs Mastered tabs; folder cards; **drag‑and‑drop** verses into folders or onto a floating "Drop to Delete" zone; add‑verse dialog (Library tab with search + Custom tab); folder CRUD via dropdown/prompt/confirm.
- **State:** Local optimistic state mirrors server (`verses`, `folders`). Calls actions: `addVerseToUser`, `createFolder`, `deleteFolder`, `renameFolder`, `moveVerseToFolder`, `deleteUserVerse` (`BibleMemoryDashboard.tsx:12`).
- **Derived classification:** Learning = `currentStep < 8`, Mastered = `currentStep >= 8` (`BibleMemoryDashboard.tsx:45–46`).
- **Notes:** Uses native `confirm()`/`prompt()` for folder rename/delete and verse delete (`:151, :165, :196`). Props typed as `any[]` throughout. On practice complete it optimistically forces `currentStep: 8` / `masteredAt` (`:239`).

#### `src/app/family-discipleship/bible-memory/PracticeMode.tsx`
- **Role:** `'use client'`. The 8‑step memorization flow. Steps array (`PracticeMode.tsx:33–42`): Read Silently → Listen Aloud → Read Aloud → Type → Speak(first‑letter) → Type(first‑letter) → Speak(hidden) → Type(hidden).
- **External/browser APIs:** Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, `:138`) for spoken steps; ESV audio via `getBibleAudio({ reference })` (`:165`); ESV text via `getBibleText({ reference })` (`:117`).
- **Matching:** Custom Levenshtein distance + similarity; **85% accuracy** threshold passes a step (`:46–84, :196`). Punctuation/case stripped via `cleanText`.
- **Persistence:** On each "Next" (non‑refresh) calls `updateVerseProgress(verse.id, step.id)` (`:213`). In refresh mode, on finish calls `refreshVerse` (`:223`). "I need practice" calls `resetVerseMastery` (`:250`). Lazy text fetch persists back via `updateVerseText` (`:121`).
- **Notes:** Manual‑override buttons let users self‑certify a step without passing the accuracy check (`:417–421, :442–446`). `getBibleText`/`getBibleAudio` calls here are the **correct** object‑shaped calls (unlike `actions.ts`).

#### `src/app/family-discipleship/bible-memory/BibleAudioPlayer.tsx`
- **Role:** `'use client'`. Self‑contained `<audio>` player (play/pause, seek, volume, time format). Renders nothing if no `audioUrl` and not loading (`BibleAudioPlayer.tsx:97`). No data/auth. Imports a couple of unused icons (`SpeakerLow`).

### Prayer Journal (`/prayer`)

#### `src/app/family-discipleship/prayer/page.tsx`
- **Role:** Server component. `auth()`; if no user, **`redirect("/auth/login")`** (`page.tsx:11`). Fetches `getPrayerEntries()` + `getPrayerCategories()` in parallel, renders `<PrayerJournalClient>` in a Suspense boundary.
- **BUG (dead redirect):** `/auth/login` route **does not exist** (only `src/app/login/page.tsx` exists). An unauthenticated visitor to `/prayer` is redirected to a 404. Church & Heart‑Check correctly use `/login`. (Verified: no `src/app/auth/login` directory.)

#### `src/server/actions/prayer-journal.ts`
- **Role:** `'use server'`. The real Prayer Journal data layer. Exports types `PrayerEntryInput`, `PrayerEntry` and actions `getPrayerEntries`, `createPrayerEntry`, `updatePrayerEntry`, `deletePrayerEntry`, `togglePrayerAnswered`, `getPrayerCategories`.
- **Auth/tenancy:** User‑scoped via `auth()` + `session.user.id` (NOT org). `getPrayerEntries` returns `[]` if no session (`prayer-journal.ts:47`). `update`/`delete`/`toggle` re‑fetch row and verify `existing.userId === session.user.id` (`:119, :156, :175`).
- **Prisma models:** `prayerJournalEntry` (incl. `student` relation select), `prayerCategory`.
- **Validation:** `createPrayerEntry` uses `createPrayerJournalSchema` (from `@/lib/schemas/actions`). `updatePrayerEntry`/`deletePrayerEntry` use local schemas keyed by `z.string().uuid()` (`:97, :138`) — correct, since `PrayerJournalEntry.id` is `@default(uuid())`.
- **BUG (category dropped on create):** `createPrayerEntry` maps `category: data.prayerType` (`:86`), but `createPrayerJournalSchema` only has `prayerType` as an optional enum `PRAISE|CONFESSION|THANKSGIVING|SUPPLICATION` (`schemas/actions.ts:205–210`). The client (`PrayerJournalEditor`) sends a free‑text **`category`** field (e.g. "Missions", "none") and **no `prayerType`** (`PrayerJournalClient.tsx:83–88` → `PrayerEntryInput`). Zod **strips** the unknown `category`, so `data.prayerType` is `undefined`, and every newly created prayer is saved with `category: null`. Categories typed in the editor are silently lost on **create** (they survive on **update**, which writes `title/content/answerNotes/answeredAt` but actually never persists category either — see `:123–132`). Net: prayer **category is effectively never persisted** through the live UI.
- **BUG (date ignored on create):** `createPrayerEntry` hard‑codes `date: new Date()` and `tags: []`, `isPrivate: false` (`:83–85`), ignoring the editor's date/tags/privacy. So the date picker, tags, and the private toggle in the editor do nothing on create.
- **`getPrayerCategories`:** reads the `PrayerCategory` table (may be empty unless seeded) (`:192–199`).

#### `src/app/family-discipleship/prayer/PrayerJournalClient.tsx`
- **Role:** `'use client'`. Orchestrates sidebar + editor. Dynamically imports `PrayerJournalEditor` (`ssr:false`) to keep TipTap out of the initial bundle (`PrayerJournalClient.tsx:15`).
- **Deep‑linking:** Reads `?title=` / `?category=` search params to pre‑open a new entry (`:34–41`). This is how "Pray Now" links from Missions land here (`UnreachedOfTheDay.tsx:109`).
- **Save flow / smell:** `handleSave` awaits `create`/`update` then does a **full `window.location.reload()`** (`:93`) for "instant feedback" — combined with the editor's debounced auto‑save this can reload the page mid‑typing (see Risks).
- **Categories source:** merges `initialCategories` (from DB) with any categories already present on entries (`:51–55`).

#### `src/app/family-discipleship/prayer/PrayerJournalEditor.tsx`
- **Role:** `'use client'`. TipTap (`StarterKit`) rich‑text editor with title, date picker, category `Select`, private `Switch`, tags. View vs edit modes.
- **Auto‑save:** Debounced 1.5s auto‑save calls `onSave` whenever editing (`:84–101, :104–119`). Because `onSave` → `window.location.reload()`, auto‑save effectively reloads the page.
- **Category `Select` "none" footgun:** the "No Category" item has value `"none"` (`:257`); if chosen, `category` becomes the literal string `"none"` rather than empty. (Moot for create given the category bug above, but relevant for view/filtering.)
- **Notes:** Only `category || null` is forwarded; tags/date/private are collected here but dropped by `createPrayerEntry` server‑side.

#### `src/app/family-discipleship/prayer/PrayerJournalSidebar.tsx`
- **Role:** `'use client'`. Entry list with search (title/content), client‑side filtering by date/category/tags, per‑entry delete on hover. Embeds `<PrayerJournalFilters>`. Pure presentational + local filter logic (`PrayerJournalSidebar.tsx:52–76`).

#### `src/app/family-discipleship/prayer/PrayerJournalFilters.tsx`
- **Role:** `'use client'`. Collapsible filter panel (date popover calendar, category select with sentinel value `"all"`, tag toggles). Controlled entirely by parent state. No data/auth.

### Local Church (`/church`)

#### `src/app/family-discipleship/church/page.tsx`
- **Role:** Server component. `auth()`; if no user **`redirect("/login")`** (correct route). Fetches `db.localChurchNotes.findMany({ where: { userId }, orderBy: { date: 'desc' } })` (`church/page.tsx:14–21`) and renders `<ChurchNotesClient>`.
- **Tenancy:** User‑scoped (`userId`). Fine.
- **Notes:** Casts notes `as any` to satisfy the client's `ChurchNote` type (`:29`).

#### `src/app/family-discipleship/church/ChurchNotesClient.tsx`
- **Role:** `'use client'`. Sermon‑note list + a large "Add Sermon Note" dialog form. Submits via the shared server action `addChurchNote` (from `../actions`); deletes via `deleteChurchNote` (`ChurchNotesClient.tsx:12, 63, 257`).
- **Form:** Native `<form action={handleSubmit}>`. `mainPoints` (3 inputs) and `songs` ([{title,theme}]) are serialized to JSON and appended to the FormData before calling `addChurchNote` (`:59–61`).
- **Notes:** `LocalChurchNotes` has `@@unique([userId, date])` (`schema.prisma:1202`) — creating a second note for the **same date** will throw a uniqueness error that is **not caught** in `handleSubmit` (silent failure / unhandled rejection). List rendering prefers main points + "one thing"; falls back to `applications`.

### Heart Check (`/heart-check`)

#### `src/app/family-discipleship/heart-check/page.tsx`
- **Role:** Server component. `auth()`; if no user **`redirect("/login?callbackUrl=…")`** (correct route, with callback). Renders `<HeartCheckClient>`. No data fetch.

#### `src/app/family-discipleship/heart-check/HeartCheckClient.tsx`
- **Role:** `'use client'`. **Entirely static content**: an in‑file `emotions` array of 8 emotions (Sadness, Anger, Fear, Hurt, Loneliness, Shame, Guilt, Gladness), each with description, God's design, the need, the warning (impairment/sin), the gospel answer, introspection questions, prayer prompts, relational steps (`HeartCheckClient.tsx:54–434`).
- **Rendering:** Grid of `EmotionCard`s → detail view; content rendered with `react-markdown` + `remark-gfm`/`remark-breaks`. Icons from `@emotion-icons/boxicons-regular`.
- **Auth/DB:** **None.** No server action, no Prisma, no persistence. The `HeartCheckClientProps` interface is empty (dead).
- **Drift:** `createHeartCheckSchema` exists in `@/lib/schemas/actions.ts:199–203` but **nothing here uses it** — there is no heart‑check persistence at all. The schema is aspirational/dead for this feature.

### Missions (`/missions`)

#### `src/app/family-discipleship/missions/page.tsx`
- **Role:** Server component. **No auth gate.** Awaits `getUnreachedOfTheDayAction()` and `getOperationWorldStats()` (sequentially), renders `<UnreachedOfTheDay>` + `<MissionsClient>`.

#### `src/app/family-discipleship/missions/actions.ts`
- **Role:** `'use server'`. Exports `getUnreachedOfTheDayAction`, `getOperationWorldStats`, `getCountiesForState`, `getAllStates`. (The county helpers live here but power the **Neighbor** feature — see cross‑links.)
- **Auth/tenancy:** **None on any of these.** All four are public reads (no `auth()` call). Data is non‑PII global content, so this is low‑risk, but note there is zero gating.
- **`getUnreachedOfTheDayAction`** — thin wrapper over `fetchUnreachedOfTheDay()` (Joshua Project).
- **`getOperationWorldStats`** — reads `src/server/data/mission-stats.json` (~175KB) from disk on each call, JSON‑parses, returns `OperationWorldStats | null` (`actions.ts:41–51`). No caching.
- **`getCountiesForState(stateName)`** — `db.county.findMany({ where:{ state }, orderBy:{ county:'asc' }, select:{ data:true } })`, returns the raw `data` JSON blobs (`actions.ts:58–71`). Comment notes this replaced parsing a 29MB file per request.
- **`getAllStates()`** — `db.county.findMany({ distinct:['state'] })` → string[] (`actions.ts:76–88`).

#### `src/lib/joshua-project.ts`
- **Role:** Joshua Project API client. Exports interface `UnreachedPeopleGroup` and `fetchUnreachedOfTheDay()`, `fetchUnreachedByCountry(countryCode)`.
- **External service:** `https://api.joshuaproject.net/v1/...` with `process.env.JOSHUA_PROJECT_API_KEY` in the query string (`joshua-project.ts:2, 44, 99`).
- **`fetchUnreachedOfTheDay`** — `/people_groups/daily_unreached.json?...&month=MM&day=DD`. Maps the API's PascalCase fields (e.g. `PeopNameInCountry`, `PercentEvangelical`, `LeastReached==='Y'`) into the typed interface (`:59–89`). Returns `null` on error/empty (try/catch).
- **`fetchUnreachedByCountry`** — `/people_groups.json?...&ROG3={code}&LeastReached=Y`. Returns `[]` on error. **Not referenced by any current UI** in this subsystem (dead/unused export — see Risks).
- **Notes:** If `JOSHUA_PROJECT_API_KEY` is unset, the request 4xx/5xxs and the page degrades gracefully to "Unable to load…".

#### `src/app/family-discipleship/missions/MissionsClient.tsx`
- **Role:** `'use client'`. Operation World explorer. Map vs List toggle; country search; dynamically imports `WorldMap` (`ssr:false`) to avoid Leaflet SSR (`MissionsClient.tsx:14`). Selecting a country opens `<CountryInfoCard>`.
- **Notes:** Reads `stats.metadata.scrapedAt` for the "Data Source" footer (`:121`). List cards read `c.data.population`, `c.data._evangelical`, `c.data.persecution_ranking`.

#### `src/app/family-discipleship/missions/WorldMap.tsx`
- **Role:** `'use client'`. React‑Leaflet `MapContainer` + CARTO tiles + a GeoJSON layer.
- **External fetch (runtime, client‑side):** Fetches world borders from a **GitHub raw URL** at runtime (`raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`, `WorldMap.tsx:40`). On click, resolves the GeoJSON feature to an Operation World country via `findOperationWorldData` and calls `onCountrySelect` (`:66–85`).
- **Risk:** Hard dependency on a third‑party GitHub raw file at runtime — if that repo moves/rate‑limits, the map silently fails (catch logs only). See Risks.

#### `src/app/family-discipleship/missions/CountryInfoCard.tsx`
- **Role:** Client component (uses `createPortal` to `document.body`). Modal showing country basics, demographics, language/education, religion, people groups, rankings, and an external Operation World link. Pure presentational over the `data` blob. No "use client" directive present but it uses `react-dom`/portal/hooks‑free DOM APIs — it is rendered only from a client tree (`MissionsClient`).

#### `src/app/family-discipleship/missions/UnreachedOfTheDay.tsx`
- **Role:** `'use client'`. Card for the daily unreached people group. `<img>` with `onError` fallback to placehold.co and `referrerPolicy="no-referrer"` (`UnreachedOfTheDay.tsx:34–42`).
- **Cross‑link out:** "Pray Now" links to `/family-discipleship/prayer?title=Pray for {name} ({country})&category=Missions` (`:109`) — drives the Prayer deep‑link. (Because of the category‑create bug, the `category=Missions` is captured in the editor but not persisted on save.)
- "View Full Profile" → `data.profileUrl` (Joshua Project) in a new tab.

#### `src/app/family-discipleship/missions/utils/countryMapping.ts`
- **Role:** Pure utility mapping GeoJSON country identifiers (ISO3 codes, long names, alternates, fuzzy keys) → Operation World country names. Exports `mapCountryToOperationWorld`, `createOperationWorldLookup`, `findOperationWorldData`.
- **Data:** `COUNTRY_MAPPING` (~195 ISO3→name entries), `ALTERNATIVE_NAMES`, and inline `fuzzyMatches`. Used only by `WorldMap` (`:6`).

### Neighbor Love (`/neighbor`)

#### `src/app/family-discipleship/neighbor/page.tsx`
- **Role:** Server component. **No auth gate.** Awaits `getAllStates()` (imported from `../missions/actions`) and renders `<CountyIssuesLookup initialStates={states} />`.

#### `src/app/family-discipleship/neighbor/CountyIssuesLookup.tsx`
- **Role:** `'use client'`. The full Neighbor Love UI. State select → loads counties via `getCountiesForState` (`CountyIssuesLookup.tsx:6, 277`); county select → shows "Key Concerns" + 6 tabbed indicator groups (Church, Environment, Food, Income, Mental Health, Children) + a "Get Involved" modal.
- **Big in‑file content:** `indicatorIcons`, `indicatorDescriptions` (per‑indicator title/description/Christian response), and `getInvolvedContent` (pray/serve/support/engage) are all hard‑coded maps (`:291–534`).
- **Data shape:** Reads deeply nested fields off each county `data` blob: `issues.concerns[]`, `issues.indicators{}`, `issues.scores{}`, `population.total`, `ids.fips`, `abortion_data{}`, `context{}` (`:19–43`).
- **Notes / minor bugs:**
  - `hasGetInvolvedContent` always returns `true` (`:550–553`) so every indicator shows a "Get involved →" link, and the modal falls back to the food‑insecurity content if no specific mapping exists (`:698`). So unrelated indicators can show food‑bank guidance.
  - `useTransition`'s `startTransition` is imported/declared (`:265`) but **never used** — county loading uses a plain `useEffect` + `loadingCounties` flag (dead state).
  - County select keys/value use `ids.fips`; counties lacking a fips would collide on empty value.

### Schemas

#### `src/lib/schemas/bible-memory.ts`
- **Role:** Zod schemas for verse/folder actions: `addVerseSchema`, `createFolderSchema`, `renameFolderSchema`, `moveVerseSchema`, `verseIdSchema`, `folderIdSchema`, `studentIdSchema`, `copyFolderSchema`.
- **DEAD CODE + would‑be‑BUG:** Grep confirms this file is imported **nowhere** (only self‑references). `bible-memory/actions.ts` does its own manual checks and never imports these. Moreover every id validator uses **`.cuid()`** (`bible-memory.ts:5, 11, 16, …`), but all the relevant models (`Student`, `BibleMemory`, `BibleMemoryFolder`) use `@id @default(uuid())`. If these schemas were ever wired in, they would **reject every real (uuid) id**. Pure trap; safe only because unused.

---

## Data models & tenancy

All ids are **uuid** (`@default(uuid())`), not cuid. Postgres via Prisma 7 (driver adapter).

| Model | Table | Scope key | Touched by | Notes |
|---|---|---|---|---|
| `BibleMemory` | `bible_memory` | `studentId?` and/or `userId?` (both nullable) | `bible-memory/actions.ts`, legacy `actions.ts` | `currentStep` 0–8, `masteredAt`, `lastPracticedAt`, `lastRefreshedAt`, `isDefault` (library), `folderId?`. `schema.prisma:1249`. |
| `BibleMemoryFolder` | `bible_memory_folder` | `studentId` (required) | `bible-memory/actions.ts` | `verses` relation; delete cascades verses' `folderId` to null (SetNull). `schema.prisma:1280`. |
| `PrayerJournalEntry` | `prayer_entries` | `userId` (req), `studentId?` | `prayer-journal.ts`, legacy `actions.ts` | `category`, `tags[]`, `isPrivate`, `type`(default "entry"), `status`(default "ongoing"), `answeredAt`, `answerNotes`. `schema.prisma:1208`. |
| `PrayerCategory` | `prayer_categories` | global | `prayer-journal.ts` (`getPrayerCategories`) | name `@unique`; likely empty unless seeded. `schema.prisma:1235`. |
| `LocalChurchNotes` | `local_church_notes` | `userId` | legacy `actions.ts`, `church/page.tsx` | `@@unique([userId, date])` — one note per user per date. Rich fields + `songs` Json. `schema.prisma:1184`. |
| `County` | `counties` | global (no tenancy) | `missions/actions.ts` (`getCountiesForState`, `getAllStates`) | `state`, `county`, `fips?`, `data` Json (full record). `@@unique([state, county])`, `@@index([state])`. ~3,143 rows. `schema.prisma:17`. Seeded by `prisma/seed-counties.ts` from `counties_list.json`. |
| `Student` | (other subsystem) | `organizationId` | `bible-memory` page/actions | Used for org checks + folder/verse ownership. |

**Heart Check has no model.** **Missions has no model** (Joshua Project API + bundled JSON file).

### Tenancy posture summary (IMPORTANT — it is inconsistent)
- **Org‑scoped (strongest):** `bible-memory/actions.ts` (via `getCurrentUserOrg` + per‑entity org assertions).
- **User‑scoped:** `prayer-journal.ts`, legacy `actions.ts` (prayer/church), `church/page.tsx`.
- **No scoping / no auth:** `missions/page.tsx`, `neighbor/page.tsx`, all four `missions/actions.ts` functions, `bible-memory/page.tsx` (uses `db.student.findFirst()` across ALL orgs — tenancy leak at the page level).

---

## Entry points & end‑to‑end flows

### A. Add + memorize a verse (Bible Memory)
1. User opens `/bible-memory` → `page.tsx` does `db.student.findFirst()` (⚠ global), then `getUserVerses`/`getLibraryVerses`/`getStudentFolders` (org‑guarded).
2. User clicks "Add Verse" → Custom tab → `addVerseToUser({studentId, reference})`. Server: `requireCaller` → `assertStudentInOrg` → tries `getBibleText(reference)` (⚠ wrong shape → text `""`) → creates `BibleMemory` row → `revalidatePath`.
3. User clicks "Continue Practice" → `<PracticeMode>`. If text empty, it fetches `getBibleText({reference})` client‑side and `updateVerseText` persists it.
4. Each step "Next" → `updateVerseProgress(verseId, stepId)`; reaching step 8 sets `masteredAt`. Mastered verses can be "Refresh"ed (`refreshVerse`) or reset (`resetVerseMastery`).

### B. Write a prayer (Prayer Journal)
1. `/prayer` → `auth()` (⚠ redirects to dead `/auth/login` if unauth) → `getPrayerEntries()` + `getPrayerCategories()` → `<PrayerJournalClient>`.
2. "New Prayer Entry" or deep‑link (`?title=&category=`) opens `<PrayerJournalEditor>` (TipTap, lazy).
3. Save (manual or 1.5s auto‑save) → `createPrayerEntry(data)`. Server validates with `createPrayerJournalSchema`, then writes — but ⚠ **drops category/date/tags/privacy** (hard‑codes date/tags/privacy; reads non‑existent `prayerType`). Then `window.location.reload()`.
4. Toggle answered → `togglePrayerAnswered(id)` flips `answeredAt` + `status`.

### C. Capture a sermon note (Local Church)
1. `/church` → `auth()` → `findMany` user notes → `<ChurchNotesClient>`.
2. "New Entry" form → `handleSubmit` appends JSON for `mainPoints`/`songs` → `addChurchNote(formData)` → creates `LocalChurchNotes` (⚠ throws unhandled if a note for that date already exists, due to `@@unique([userId, date])`).

### D. Explore missions
1. `/missions` (no auth) → `getUnreachedOfTheDayAction()` (Joshua Project) + `getOperationWorldStats()` (reads `mission-stats.json`).
2. `<UnreachedOfTheDay>` renders the daily group; "Pray Now" deep‑links into the Prayer editor.
3. `<MissionsClient>` → `<WorldMap>` fetches `world.geojson` from GitHub at runtime; clicking a country resolves Operation World data via `countryMapping` → `<CountryInfoCard>` modal.

### E. Neighbor county lookup
1. `/neighbor` (no auth) → `getAllStates()` → `<CountyIssuesLookup>`.
2. Pick state → `getCountiesForState(state)` (DB) → pick county → renders concerns + tabbed indicators + "Get Involved" modal.

---

## External dependencies & services

- **Joshua Project API** (`api.joshuaproject.net`) — daily unreached people group + per‑country least‑reached. Key: `JOSHUA_PROJECT_API_KEY` (query‑string). `src/lib/joshua-project.ts`.
- **ESV / Bible API** (via `@/server/actions/bible-study`) — `getBibleText` / `getBibleAudio`. Key: `BIBLE_API_KEY` (`bible-study.ts:68`). Used by Bible Memory (text + audio) and indirectly by `addVerseToUser` (broken call).
- **Operation World data** — bundled static `src/server/data/mission-stats.json` (~175KB, 234 countries; `scrapedAt` 2025‑10‑12), read from disk per request.
- **US Counties** — `County` Postgres table (~3,143 rows) seeded from `src/server/data/counties_list.json` (29MB, still on disk) via `prisma/seed-counties.ts`.
- **Leaflet / react‑leaflet** + **CARTO** tiles + **GitHub‑raw world GeoJSON** (`raw.githubusercontent.com/holtzy/...`) — runtime client fetch.
- **TipTap** (`@tiptap/react`, `starter-kit`) — prayer rich text. **react-markdown** + remark plugins — heart‑check rendering. **sonner** — toasts. **@phosphor-icons/react** + **@emotion-icons/boxicons-regular** — icons. **Web Speech API** — practice‑mode speech recognition (browser‑only).
- **placehold.co** — image fallback in UnreachedOfTheDay.

---

## Auth / security posture

- **Server actions consistently re‑check ownership before writes** in the user‑scoped files (`prayer-journal.ts`, legacy `actions.ts`) and org‑scoped file (`bible-memory/actions.ts`). No IDOR in the *mutations* I reviewed.
- **Page‑level auth is inconsistent:** Prayer/Church/Heart‑Check gate via `auth()`+redirect; **Bible‑Memory/Missions/Neighbor pages have no auth gate** at the page level (Missions/Neighbor are non‑PII global content; Bible‑Memory leaks a global‑first student into the UI — see below).
- **Tenancy leak (Bible Memory page):** `db.student.findFirst()` (`bible-memory/page.tsx:9`) picks an arbitrary student from **any** organization to seed the dashboard. Reads via the actions are then org‑guarded, but the *page* exposes a cross‑tenant student id/name to whoever loads it. This is the most material security/correctness gap in the subsystem.
- **No CSRF/extra rate‑limiting** beyond Next's server‑action defaults; the public missions/neighbor actions are unauthenticated reads.
- **External image** (`UnreachedOfTheDay`) uses `referrerPolicy="no-referrer"` and an `onError` fallback — reasonable.
- **No injection vectors** found in this subsystem (no raw SQL; county/mission data is read‑only JSON; prayer content is TipTap HTML rendered through the editor, not `dangerouslySetInnerHTML` here).

---

## Risks, drift, dead‑code & half‑built

1. **Prayer category never persisted (live UI):** `createPrayerEntry` reads `data.prayerType` (`prayer-journal.ts:86`) which the schema strips; the editor sends free‑text `category` instead. New prayers always save `category: null`. (Update path also never writes category.) High‑impact functional bug.
2. **Prayer create drops date/tags/privacy:** hard‑coded `date: new Date()`, `tags: []`, `isPrivate: false` (`prayer-journal.ts:83–85`). The editor's date picker, tags, and private toggle are no‑ops on create.
3. **Dead redirect to `/auth/login`** in `prayer/page.tsx:11` — that route doesn't exist (only `/login`). Unauth users hit a 404.
4. **`addVerseToUser` server‑side text prefetch is broken:** `getBibleText(reference)` passes a bare string into an object‑schema parser (`bible-memory/actions.ts:121`); always falls back to empty text. Works only because PracticeMode re‑fetches client‑side.
5. **Bible‑Memory page tenancy leak:** `db.student.findFirst()` returns a cross‑org student (`bible-memory/page.tsx:9`). Half‑built ("for demo purposes").
6. **`src/lib/schemas/bible-memory.ts` is dead** and additionally uses `.cuid()` validators that contradict the uuid id scheme — a latent trap if ever wired in.
7. **Two divergent prayer/church/verse action layers:** legacy user‑scoped `family-discipleship/actions.ts` vs newer org‑scoped `bible-memory/actions.ts` + user‑scoped `prayer-journal.ts`. `createPrayerRequest`, `deletePrayerRequest`, `togglePrayerAnswered`, `addMemoryVerse`, `deleteMemoryVerse` in the legacy file appear **unused by current UI** (likely dead). Only `addChurchNote`/`deleteChurchNote` are live from that file.
8. **`window.location.reload()` on every prayer save** (`PrayerJournalClient.tsx:93`), combined with a 1.5s **auto‑save** (`PrayerJournalEditor.tsx:87`), can reload the page while the user is mid‑edit and create surprising churn / lost focus.
9. **Church note unique‑date collision unhandled:** second note for the same date throws an uncaught error in `ChurchNotesClient.handleSubmit`.
10. **WorldMap runtime dependency on a third‑party GitHub raw GeoJSON** (`WorldMap.tsx:40`) — fragile; silent failure on outage/rename.
11. **`fetchUnreachedByCountry` (joshua-project.ts:96)** is exported but unused — dead code.
12. **Neighbor minor dead code/footguns:** `startTransition` unused (`CountyIssuesLookup.tsx:265`); `hasGetInvolvedContent` always `true` (so "Get involved" shows for indicators with no mapping and falls back to food‑bank content).
13. **`createHeartCheckSchema` (schemas/actions.ts:199)** is orphaned — Heart Check persists nothing; the schema implies a planned (never‑built) persistence feature.
14. **No caching on per‑request disk reads:** `getOperationWorldStats` reads + parses `mission-stats.json` on every missions page load (minor perf).
15. **29MB `counties_list.json` still in the repo/deploy** even though runtime now uses the `County` table — only the seed script needs it; it's dead weight at runtime.
16. **Pervasive `any` typing** across Bible‑Memory client + Missions client (`stats: any`, `verse: any`, `: any[]`) reduces type safety.

---

## Cross‑links to other subsystems

- **Auth / tenancy:** `@/auth` (`auth()`), `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/server/db` (`db`). The whole subsystem rides on these.
- **Bible Study subsystem:** `@/server/actions/bible-study` (`getBibleText`, `getBibleAudio`, `getBiblePassageSchema`) — consumed by Bible Memory. (Bible Study route itself is a sibling, not owned here.)
- **Schemas:** `@/lib/schemas/actions` (`createPrayerJournalSchema`, plus the orphaned `createHeartCheckSchema`/`createBibleStudySchema`).
- **Landing dashboard:** `@/components/family-discipleship/DiscipleshipDashboard` links out to Devotionals, Catechism, Bible Study (other subsystem routes).
- **Student profile:** `@/components/family-discipleship/StudentDiscipleshipCard` links into `/family-discipleship/bible-memory` and `/family-discipleship/prayer` (and `/students/{id}/family-discipleship/catechism`) — so these features are also reachable from the student profile area.
- **Prayer deep‑link target:** `UnreachedOfTheDay` (Missions) → `/family-discipleship/prayer?title=…&category=Missions`.
- **Seed scripts / data pipeline:** `prisma/seed-counties.ts` (County table), and the bundled `src/server/data/*.json` data files.
- **Prisma schema:** `prisma/schema.prisma` (models `BibleMemory`, `BibleMemoryFolder`, `PrayerJournalEntry`, `PrayerCategory`, `LocalChurchNotes`, `County`, `Student`).

---

## Open questions

1. Is the legacy `family-discipleship/actions.ts` prayer/verse code (`createPrayerRequest`, `addMemoryVerse`, etc.) intended to be deleted, or is there a non‑obvious caller (e.g. an older route or a server form) I should preserve? It's user‑scoped while the live UI is org‑/student‑scoped.
2. Is the intended prayer tenancy **user** or **org**? Prayer is `userId`‑scoped while Bible Memory is `organizationId`/`studentId`‑scoped — was prayer meant to be student/org‑aware (it has a `studentId?` column and `getPrayerEntries(studentId?)` accepts a filter, but no UI passes it)?
3. Should `bible-memory/page.tsx` derive the student from the authenticated user/org (and respect the `?studentId=` param the dashboard already passes) instead of `findFirst()`?
4. Is `PrayerCategory` meant to be seeded with defaults (PRAISE/CONFESSION/…)? Today `getPrayerCategories` likely returns `[]`, and the create path can't store a category anyway.
5. Is Heart Check intended to persist responses (per `createHeartCheckSchema`) for journaling/longitudinal tracking, or stay a static guide?
6. Should the Operation World map's GeoJSON be vendored locally rather than fetched from a third‑party GitHub raw URL at runtime?
