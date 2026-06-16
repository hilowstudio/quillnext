# 03 — DB Layer, Seeds & Operational Scripts

> Code-truth reference. Verified against source on 2026-06-15. The repo's prose/markdown
> docs are known stale — everything below is grounded in the actual files with `file:line`
> citations. If this doc and a comment disagree, trust the code and re-verify.

## Purpose & role in the app

This subsystem is the **foundation every other subsystem sits on**: the single Prisma client
that all server code shares, the (currently unused) Supabase client layer, a thin Next.js cache
helper, and the family of standalone seed/operational scripts that turn an empty Postgres
database into a working one. None of it is user-facing; it is the plumbing that produces and
maintains the data.

Concretely it owns:

- **The Prisma singleton** (`src/server/db.ts`) — imported by ~85 files across the app as `db`.
  It is the only sanctioned relational data path.
- **A Supabase client layer** (`src/lib/supabase/*`) added alongside Prisma for Supabase-native
  features (Storage/Realtime). **It is wired up but has zero importers** — dead-but-ready code.
- **A cache helper** (`src/lib/utils/prisma-cache.ts`) wrapping Next.js `unstable_cache`.
- **Six seed scripts** + their `db:seed:*` npm wrappers, loading reference/content data from
  bundled JSON/YAML/TS into specific tables.
- **Five operational/debug scripts** (`scripts/*`) — DB connectivity, query repro, integrity
  check, Gemini smoke test, and two non-DB commentary-parsing prototypes.
- **One test-only HTTP seed route** (`src/app/api/test/seed/route.ts`).
- **Migrations** (`prisma/migrations/*`) — the canonical way a DB is built from scratch.

---

## File-by-file reference

### Core DB layer

#### `src/server/db.ts` — the Prisma singleton (THE central data access point)

- **Role:** Builds one `PrismaClient` per process and memoizes it on `globalThis` to survive
  Next.js dev hot-reload. Exported as `db`.
- **Key export:** `db` (the client). ~85 importers app-wide (server components, route handlers,
  server actions, Inngest functions, auth, queries, library/curriculum/discipleship features).
- **Server/client:** Server-only (no directive, but it instantiates `pg` — must never reach the
  browser).
- **Prisma 7 mechanics (`db.ts:8-16`):** Prisma 7 requires a **driver adapter** — the old bare
  `datasources` option no longer connects. It uses `PrismaPg` from `@prisma/adapter-pg`, passing a
  **`PoolConfig`** (`{ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }`)
  rather than a pre-built `pg.Pool`. The comment (`db.ts:5-7`) explains why: passing a config lets the
  adapter create its own pool and dodges a dual `@types/pg` version conflict between the root types and
  the copy nested under `@prisma/adapter-pg`.
- **Connection string:** `DATABASE_URL` (the pooled URL). `ssl.rejectUnauthorized: false` — accepts
  Supabase's cert without validation (fine for Supabase, but it does disable cert verification).
- **Logging (`db.ts:15`):** `["error","warn"]` in development, `["error"]` otherwise.
- **Singleton pattern (`db.ts:21-27`):** `globalForPrisma.prisma ?? createPrismaClient()`, and the
  global is only set when `NODE_ENV !== "production"` (so prod gets a fresh client, dev reuses one).
- **Auth/tenancy:** None at this layer. `db` is a raw client; org-scoping/tenancy is enforced by
  callers (e.g. `getCurrentUserOrg` in higher subsystems), **not here**.
- **Note:** Comment at `db.ts:18` says "Extensions can be added here if needed" — none are. No
  `$extends`, no Accelerate, no query caching extension. (Accelerate was removed; see drift below.)

#### `src/lib/supabase/client.ts` — browser Supabase client (DEAD CODE)

- **Role:** Factory `createClient()` returning a browser Supabase client using the **publishable
  key** (`client.ts:13-17`).
- **Server/client:** Browser-intended (no directive). Reads `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Auth/tenancy:** Explicitly NOT Supabase Auth — auth is NextAuth/Google. The docblock
  (`client.ts:3-12`) warns that all access is governed by Postgres RLS, **and that RLS is not yet
  configured**, so "anything reachable via PostgREST is effectively public." Do not use for sensitive
  reads/writes until RLS exists.
- **Status:** **Zero importers** anywhere in `src/` (grep-verified). Provisioned-but-unused.

#### `src/lib/supabase/server.ts` — server Supabase client (DEAD CODE)

- **Role:** Factory `createServerSupabaseClient()` (`server.ts:13-18`) for Supabase-native features
  (Storage/Realtime) from server code.
- **Key/auth (`server.ts:16-17`):** Prefers `SUPABASE_SERVICE_ROLE_KEY` (full access, **bypasses
  RLS**) when present, else falls back to the publishable key. Disables `persistSession` and
  `autoRefreshToken` because NextAuth owns sessions.
- **Security note:** Docblock (`server.ts:11`) warns the service-role key must never ship to the
  browser; the file has no `"use client"` and the key is read from a non-`NEXT_PUBLIC_` env var, so
  it stays server-side.
- **Status:** **Zero importers.** Same dead-but-ready posture as the browser client. Prisma remains
  the only live data path; the Supabase clients are scaffolding for future Storage/Realtime use.

#### `src/lib/utils/prisma-cache.ts` — Next.js cache wrapper

- **Role:** Despite the "Prisma Query Caching" name, this no longer caches at the Prisma layer. The
  comment (`prisma-cache.ts:17-18`) states cache strategies were **removed as part of migration to
  Supabase** (i.e. away from Prisma Accelerate's `cacheStrategy`). Now it just wraps Next.js
  `unstable_cache`.
- **Key exports:**
  - `cacheQuery<T, Args>(fn, keyParts, options)` (`prisma-cache.ts:40-46`) — thin `unstable_cache`
    wrapper. **Live**: used by `src/app/students/page.tsx:5,11` and `src/app/courses/page.tsx:10,60`.
  - `CacheTTL` (`prisma-cache.ts:10-15`) — `{ SHORT:30, MEDIUM:60, LONG:300, VERY_LONG:3600 }`
    seconds. **Exported but only referenced inside this file** (grep: 1 occurrence). Effectively dead.
- **Server/client:** Server (uses `next/cache`).
- **Drift:** The JSDoc example (`prisma-cache.ts:23-34`) references a non-existent
  `academicSpineCacheStrategy` import / `cacheStrategy` option — stale leftover from the Accelerate era.

---

### Seed scripts (`prisma/`)

All seeds share a pattern: instantiate a **dedicated** Prisma client (they do NOT import
`src/server/db.ts`), prefer `DIRECT_DATABASE_URL` over `DATABASE_URL` (direct TCP, not the
pooler — pooled connections were dropping mid-run on large loads), `ssl.rejectUnauthorized:false`,
`import "dotenv/config"` for env, run `main()`, and `$disconnect()` in `finally`. They are run via
`tsx` (see npm scripts). None of them perform auth or org-scoping — they write **global reference
data** (except the two book seeders, which need a real org — see below).

| npm script | file | loads from | into table(s) |
| --- | --- | --- | --- |
| `db:seed` | `prisma/seed.ts` | `quill-standards/academic_standards_master.json` + `_sequenced.json` | `subjects`, `strands`, `topics`, `subtopics`, `objectives` |
| `db:seed:generators` | `prisma/seed-generator-content-types.ts` | `prisma/data/GENERATOR_CONTENT_TYPES.YAML` | `resource_kinds` |
| `db:seed:discipleship` | `prisma/seed-discipleship.ts` | `prisma/data/devotionals.json` | `devotionals` (NOT discipleship — see drift) |
| `db:seed:counties` | `prisma/seed-counties.ts` | `src/server/data/counties_list.json` | `counties` |
| `db:seed:catechisms` | `prisma/seed-catechisms.ts` | `src/data/catechisms/*.ts` (bundled TS) | `catechisms`, `catechism_questions` |
| `db:seed:commentary` | `prisma/seed-commentary.ts` | `src/server/data/Matthew-Henry-Commentary-Volumes/*.HTM` | `commentary_chapters`, `commentary_sections` |
| *(none — orphan)* | `prisma/seed-book.ts` | hardcoded "The Hobbit" | `books` (one row) |

`prisma.config.ts` also declares `seed: 'tsx prisma/seed.ts'` (`prisma.config.ts:8`), so
`prisma db seed` / `prisma migrate ... --seed` runs `seed.ts` only.

#### `prisma/seed.ts` — Academic Spine (the big one)

- **What it does:** Two phases.
  1. **Master load** (`seed.ts:39-232`): reads `academic_standards_master.json`, walks
     `subjects → sub_subjects → topics → sub_topics → objectives`, and `upsert`s into
     `Subject/Strand/Topic/Subtopic/Objective`. Note the **JSON→schema rename**: JSON `sub_subjects`
     map to schema **`Strand`** (`seed.ts:122-124`); JSON `id` is used as the DB `code` when present,
     else `code` (`seed.ts:102`, repeated per level). **Idempotency guard:** if
     `objective.count() > 0` it skips the whole spine reload (`seed.ts:96-98`).
  2. **Sequenced load** (`seed.ts:234-310`): reads `academic_standards_sequenced.json`
     (`curriculum_sequence.grade_levels[*].subjects[*].objectives[*]`) and back-fills
     `Objective.gradeLevel` + `Objective.complexity`. This is done with **chunked raw SQL bulk
     UPDATEs** (`UPDATE objectives ... FROM (VALUES ...)`, `CHUNK=2000`, `seed.ts:286-302`) — the
     comment (`seed.ts:263-266`) explains this replaced a ~26k-round-trip `updateMany` loop that was
     slow and dropped the pooled Supabase connection.
- **Path resolution:** tries both `<cwd>/quill-standards/...` and `<cwd>/prisma/data/quill-standards/...`
  (`seed.ts:42-45`, `seed.ts:236-239`); warns + skips if neither exists.
- **ResourceKinds are intentionally NOT seeded here** (`seed.ts:312-315`) — that's `db:seed:generators`'
  job, to avoid re-introducing old hyphen-coded duplicate kinds.
- **Risk:** raw SQL builds VALUES by string-concatenation; it escapes single quotes in the code
  (`u.code.replace(/'/g, "''")`, `seed.ts:292`) and casts grade/complexity to `::int`. Input is
  trusted bundled data, so injection risk is low, but it is hand-rolled SQL.

#### `prisma/seed-generator-content-types.ts` — ResourceKinds from YAML

- **What it does:** Clears all `resource_kinds` (`deleteMany`, line 42), loads
  `GENERATOR_CONTENT_TYPES.YAML` (a `Subject → Strand → [generator names]` tree), and upserts one
  `ResourceKind` per generator name.
- **Smart resolution:** pre-fetches all Subjects/Strands into Maps (lines 64-81), then per YAML entry
  resolves subject (exact, then fuzzy "name includes first word", lines 99-106) and strand (variant
  matching: full key, before `:`, before `(`; then fuzzy `includes`, lines 122-142). The special key
  `"Universal Tools & Templates"` → `isUniversal` (no subject/strand link, lines 95-97).
- **Per kind:** `code = slugify(name)` (lowercase, non-alnum→`_`, trimmed, ≤100 chars, lines 219-225);
  `contentType` inferred by keyword (`inferContentType`, lines 227-236 → WORKSHEET/TEMPLATE/PROMPT/
  GUIDE/QUIZ/RUBRIC/OTHER); `requiresVision` = name contains a visual keyword (`needsVision`,
  lines 238-245); `isSpecialized = !!(strandId || subjectId)`.
- **Execution:** builds an array of upsert thunks, runs them in batches of `BATCH_SIZE=10`
  (`Promise.all` per batch, lines 201-204). Pool tuned with 20s connect/idle timeouts (lines 22-25).
- **Idempotency:** clear-then-rebuild, safe only while no `Resource`/`BookGeneratedMaterial` rows
  reference the kinds (comment lines 40-41) — it's a **provisioning** seeder, not for a populated DB.
- **Unused constant:** `TIMEOUT_MS = 60000` (line 12) is declared but never used.

#### `prisma/seed-catechisms.ts` — catechisms from bundled TS

- **What it does:** Imports 7 catechism datasets directly from `src/data/catechisms/*`
  (wsc, wlc, baptist, heidelberg, puritan, young_children, matthew_henry — lines 7-13), `upsert`s a
  `Catechism` row per dataset, then **deletes & recreates** all its `CatechismQuestion` rows
  (idempotent re-seed, lines 62-76, `CHUNK=500`).
- **Critical contract:** `code` slugs (`wsc`, `wlc`, `baptist-1695`, `heidelberg`, `puritan`,
  `young-children`, `matthew-henry`, lines 42-48) MUST match the ids used by `CatechismManager`,
  because that `code` is stored as `catechismId` in `StudentCatechismProgress` (comment lines 32-34).
  Changing a slug orphans student progress.
- **Storage shape:** each question stored as `{ number, sortOrder, data: <full original object> }`
  (lines 65-70) — `data` is the raw question JSON so the client renders it identically.

#### `prisma/seed-commentary.ts` — Matthew Henry commentary from HTM

- **What it does:** Walks `src/server/data/Matthew-Henry-Commentary-Volumes/{MHC-V1..V6}` for files
  matching `MHC{bb}{ccc}.HTM` (lines 27-32). Decodes book (`bb`, 1-66) and chapter (`ccc`) from the
  filename (lines 36-40). Parses each via the **shared pure parser** `parseChapterHtml` from
  `src/lib/commentary-parser.ts` (line 6, line 42) — same module the prototypes use, so seeder and
  prototype agree. Upserts `CommentaryChapter` on `(source, book, chapter)`, then deletes & recreates
  its `CommentarySection` rows (lines 45-60).
- **Source constant:** `SOURCE = "matthew-henry"` (line 10).
- **Cross-dependency:** relies on `src/lib/commentary-parser.ts` (NOT owned here; see cross-links).

#### `prisma/seed-counties.ts` — US counties

- **What it does:** Reads `src/server/data/counties_list.json` (~29MB), de-dupes on `(State, County)`
  to satisfy the `@@unique([state, county])` constraint (lines 45-66), `deleteMany({})` then bulk
  `createMany` in chunks of 500 with `skipDuplicates` (lines 68-79). Structured columns: `state`,
  `county`, `fips`, `populationTotal`; full record kept in `data` Json.
- **Why:** so the "Neighbor Love"/missions feature queries the DB instead of parsing a 29MB file per
  request (comment lines 28-31; confirmed by
  `src/app/family-discipleship/missions/actions.ts:55`).

#### `prisma/seed-discipleship.ts` — Devotionals (MISNAMED)

- **What it does:** **Despite the filename/script name, it seeds DEVOTIONALS, not discipleship
  plans.** Reads `prisma/data/devotionals.json` (732 entries = 366 days × am/pm) and `upsert`s into
  `Devotional` on the `month_day_time` composite unique (lines 47-67), in chunks of 50 via
  `Promise.all`.
- **Drift:** the npm alias `db:seed:discipleship` and the file name imply discipleship-plan seeding;
  the actual target table is `devotionals`. A future engineer looking for a "discipleship seeder" will
  be misled.

#### `prisma/seed-book.ts` — orphan test-book seeder (BROKEN under Prisma 7)

- **What it does:** Finds the first user/org and first subject, then creates one "The Hobbit" `Book`
  (lines 18-47).
- **NOT wired into any npm script** (no `db:seed:book`) — orphan.
- **BUG:** It builds `new PrismaClient()` with **no driver adapter** (lines 3-16). Prisma 7 requires
  an adapter (every other seed and `db.ts` pass `PrismaPg`), so this script will throw at client
  construction / first query. Superseded in practice by the test seed route below.

---

### Operational / debug scripts (`scripts/`)

None are wired into npm scripts — they are run ad hoc (`tsx scripts/<x>.ts` / `node ...`).

#### `scripts/test-db.ts`

- Smoke test: `require("../src/server/db")`, `$connect()`, `findFirst` a user, log it (lines 7-17).
  Prints engine/Vercel/NODE_ENV env (lines 4-6) — leftover from debugging the Prisma engine type.
  Uses CommonJS `require` (the rest of the repo is ESM).

#### `scripts/debug-student-assignments.ts`

- Repro for a "column does not exist" error on `ResourceAssignment`. Loads env via `@next/env`
  `loadEnvConfig` (lines 2-4), imports the **app singleton** `db`, fetches any `student`, then runs a
  deep `resourceAssignment.findMany` select (resource→resourceKind, course, activity, assessment —
  lines 27-72) and logs success/failure. Diagnostic only; no writes (comment lines 17-21).

#### `scripts/check-course-integrity.js`

- Plain JS (CommonJS). Builds a bare `new PrismaClient()` from the generated client (line 2), iterates
  all `Course`s, and verifies each `subjectId` (required) and `strandId` (optional) actually resolves
  (lines 8-31). Prints ERROR lines for dangling FKs.
- **BUG (same as seed-book):** bare `PrismaClient()` with no adapter → will fail under Prisma 7.

#### `scripts/verify-gemini.ts`

- Not a DB script. Smoke-tests Gemini via Vercel AI SDK (`@ai-sdk/google`, `streamText`). Loads
  `.env` then `.env.local` (lines 5-6), maps `GEMINI_API_KEY → GOOGLE_GENERATIVE_AI_API_KEY` if needed
  (lines 8-10), and streams "Hi" through a list of model ids until one succeeds (lines 12-42). Useful
  for diagnosing which Gemini model/key works.

#### `scripts/parse-commentary-prototype.ts` (PROTOTYPE — no DB)

- Pure analysis. Independently re-implements anchor parsing with `cheerio` to validate that MH `.HTM`
  files reliably split into `{ intro, sections:[{verseStart,verseEnd,title,html}] }` via `Sec{n}` and
  `{Book}{Chap}_{Verse}` anchors. Prints corpus reliability stats + detailed dumps for a named sample
  (Genesis 1/3, Psalm 23/119, Isaiah 53, John 3, 1 Cor 13, Philemon, Jude, Rev 22 — lines 182-193).
  Does NOT use `parseChapterHtml`; it's the exploration that preceded it.

#### `scripts/verse-anchor-prototype.ts` (PROTOTYPE — no DB)

- Pure analysis. Calls the **real** `parseChapterHtml` (line 8) and measures per-verse anchor coverage
  across the corpus (full/partial/zero), printing stats + sample breakdowns. This is the validation
  harness for the parser the seeder actually uses.

---

### Test seed HTTP route

#### `src/app/api/test/seed/route.ts` — guarded dev-only seeder

- **Role:** `GET` handler that seeds a minimal demo set (a "Literature" Subject, "The Hobbit" Book,
  a `worksheet_basic` ResourceKind) for the **authenticated** caller's org (lines 32-67).
- **Server/runtime:** `runtime = "nodejs"`, `dynamic = "force-dynamic"` (lines 5-6). Imports app `db`
  and `auth` from `@/auth`.
- **Auth/tenancy (the important part):**
  - Returns 404 if `NODE_ENV === "production"` (lines 12-14) — never reachable in prod.
  - Returns 401 if no session (lines 16-19); 400 if the user has no org (lines 27-29).
  - Book is created org-scoped (`organizationId`, `addedByUserId` from the session); Subject &
    ResourceKind are global reference data (comment line 31).
- **Security history:** the header comment (lines 8-10) records that a **previous version created a
  "Test Org" + test@example.com user with NO auth at all** — a public DB-write hole that this version
  closes. Good context: this file is a fixed vuln, not a latent one.

---

## Data models & tenancy

Models this subsystem reads/writes (all in `prisma/schema.prisma`; `@@map` to snake_case tables):

**Academic Spine** (global reference, no org):
- `Subject` (`subjects`, schema:366) — unique `code`, optional unique `uuid`.
- `Strand` (`strands`, schema:386) — `@@unique([subjectId, code])`; JSON's `sub_subjects`.
- `Topic` (`topics`, schema:410) — `@@unique([strandId, code])`.
- `Subtopic` (`subtopics`, schema:429) — `@@unique([topicId, code])`.
- `Objective` (`objectives`, schema:448) — unique `code`; `gradeLevel`/`complexity` filled by the
  sequenced phase.

**Generators / content kinds** (global):
- `ResourceKind` (`resource_kinds`, schema:630) — unique `code`; optional `strandId`/`subjectId`;
  `contentType` enum (`ResourceContentType`), `requiresVision`, `isSpecialized`.

**Family-discipleship content** (global, no org):
- `Catechism` (`catechisms`, schema:37) + `CatechismQuestion` (`catechism_questions`, schema:55,
  `@@unique([catechismId, sortOrder])`). `code` = stable slug = `catechismId` in
  `StudentCatechismProgress`.
- `CommentaryChapter` (`commentary_chapters`, schema:72, `@@unique([source,book,chapter])`) +
  `CommentarySection` (`commentary_sections`, schema:87, `@@unique([chapterId, sectionIndex])`).
- `Devotional` (`devotionals`, schema:1138, `@@unique([month,day,time])`).
- `County` (`counties`, schema:17, `@@unique([state,county])`).

**Org-scoped (only touched by the two book seeders):**
- `Book` (`books`, schema:650) — `organizationId` (`@map("account_id")`), `addedByUserId`. The seed
  route and `seed-book.ts` both require a real org/user.

**Tenancy posture:** The DB layer and seeds are deliberately tenancy-agnostic. `db.ts` exposes a raw
client; nearly all seeded data is **global reference data** with no `organizationId`. The only
org-scoped writes are the demo `Book` (test route, which derives the org from the authenticated
session; `seed-book.ts`, which grabs the first org in the DB). Real per-request org scoping lives in
higher subsystems (auth helpers / query modules), not here.

---

## Entry points & end-to-end flows

### Flow A — building a working DB from scratch (the canonical path)

The DB is reproducible via **migrations**, not `db push`:

1. `prisma/migrations/00000000000000_extensions_rls/migration.sql` runs first — it:
   - `CREATE EXTENSION IF NOT EXISTS "vector"` (pgvector, required by `books.embedding` /
     `video_resources.embedding`, modeled as `Unsupported("vector")`).
   - Defines `public.rls_auto_enable()` + an `ensure_rls` event trigger that auto-enables Row Level
     Security on every future `public` table. Both the trigger creation and the per-table enable are
     wrapped in exception guards so a restricted role degrades gracefully instead of failing.
2. `prisma/migrations/00000000000001_init/migration.sql` (1,516 lines) creates the full datamodel.
   Because the RLS trigger already exists, every table it creates gets RLS enabled.
3. `prisma migrate deploy` applies both. `prisma.config.ts` points `schema`/`migrations` and sets the
   datasource URL to `DIRECT_DATABASE_URL ?? DATABASE_URL` (direct TCP preferred for migrations).
4. Seed in order: `db:seed` (spine) → `db:seed:generators` (needs subjects/strands to link) →
   `db:seed:catechisms`, `db:seed:commentary`, `db:seed:discipleship` (devotionals), `db:seed:counties`
   (independent of the spine).

> `db:push` (`prisma db push`) exists in `package.json` and pushes the schema **without migrations** —
> but it would NOT create the pgvector extension or RLS trigger (those live only in the extensions
> migration). So `migrate deploy` is the correct "from scratch" path; `db push` is for quick dev
> schema sync on an already-prepared DB.

### Flow B — runtime data access (every request)

App code imports `{ db } from "@/server/db"`, runs Prisma queries → `PrismaPg` adapter → `pg` pool →
Postgres (Supabase, pooled `DATABASE_URL`). Reference content seeded above is read back by feature
subsystems (curriculum/spine, family-discipleship devotionals/catechism/commentary/missions,
library). Hot pages wrap reads in `cacheQuery(...)` (Next.js `unstable_cache`). `db.$queryRaw\`SELECT 1\``
backs the `/api/health` ping.

### Flow C — order dependency between seeds

`db:seed:generators` pre-fetches Subjects/Strands and links ResourceKinds to them by fuzzy name match,
so **`db:seed` must run first** or every kind logs "Subj/Strand Not Found" and lands unlinked.
`seed-book.ts` / the test seed route require a user+org to already exist.

---

## External dependencies & services

- **`@prisma/client` v7 + generated client** at `src/generated/client` (custom `output`,
  `provider = "prisma-client"`, `binaryTargets = ["native"]`, schema:1-6). `postgenerate` npm hook
  shims a missing `index.ts` re-export.
- **`@prisma/adapter-pg` v7 + `pg` v8** — the mandatory Prisma 7 driver adapter + Postgres pool.
- **`@prisma/config` v7** — `prisma.config.ts` (replaces datasource block in `schema.prisma`, which
  only declares `provider = "postgresql"`).
- **`@supabase/supabase-js` v2** — the (unused) Supabase client layer. Underlying DB is Supabase
  Postgres with **pgvector**.
- **`dotenv` / `@next/env`** — env loading in seeds/scripts.
- **`js-yaml`** — parses `GENERATOR_CONTENT_TYPES.YAML`.
- **`cheerio`** — HTML parsing in `seed-commentary` (via parser) and the prototypes.
- **`tsx`** — runs every TS seed/script.
- **`@ai-sdk/google` + `ai`** — only in `verify-gemini.ts` (not DB).
- **`next/cache` (`unstable_cache`)** — in `prisma-cache.ts`.

**Env vars:** `DATABASE_URL` (pooled, runtime), `DIRECT_DATABASE_URL` (direct TCP, seeds/migrations),
`NODE_ENV`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, plus `GEMINI_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` (gemini script).
`.env` and `.env.local` exist in-repo (untracked).

---

## Auth / security posture

- **DB layer (`db.ts`):** no auth/tenancy — a raw shared client. Callers enforce scoping.
- **Test seed route:** properly gated — 404 in prod, 401 without session, 400 without org; all writes
  are session-derived. Documents a previously-fixed public-write vuln.
- **Supabase clients (unused):** browser client uses publishable key under RLS — **but the codebase's
  own comment says RLS is not yet configured**, so any PostgREST-reachable table is effectively public
  if/when this client starts being used. Server client can use the service-role key (RLS bypass) and is
  server-only. Neither is currently imported, so the risk is latent, not active — but it's a footgun the
  moment someone wires them in.
- **TLS:** every connection uses `ssl: { rejectUnauthorized: false }` — certificate verification is
  disabled (db.ts, all seeds). Acceptable for Supabase but worth noting.
- **Raw SQL:** `seed.ts` hand-builds bulk `UPDATE ... FROM (VALUES ...)` via string concat with quote
  escaping; input is trusted bundled JSON.

---

## Risks, drift, dead-code & half-built

1. **`prisma/seed-book.ts` is broken under Prisma 7** — `new PrismaClient()` with no adapter
   (seed-book.ts:3-16) will throw. Orphan (no npm script). Effectively superseded by the test route.
2. **`scripts/check-course-integrity.js` is broken under Prisma 7** — same bare `PrismaClient()`
   issue (line 2). Will fail at first query.
3. **Naming drift: `seed-discipleship.ts` / `db:seed:discipleship` seeds `devotionals`**, not any
   "discipleship" model. Misleading for anyone searching.
4. **Supabase client layer is 100% dead code** — `src/lib/supabase/{client,server}.ts` have zero
   importers. Provisioned for Storage/Realtime that isn't built yet. They also encode a known RLS gap.
5. **`/api/health` reports `provider: "accelerate"`** (`src/app/api/health/route.ts`) — stale. The app
   migrated OFF Prisma Accelerate to the `pg` adapter; this label lies. Cross-subsystem but rooted in
   this DB migration.
6. **`prisma-cache.ts` is largely vestigial** — `cacheStrategy`/Accelerate caching was removed
   (comment lines 17-18). Only `cacheQuery` is live; `CacheTTL` is exported-but-unused; the JSDoc
   references a nonexistent `academicSpineCacheStrategy`.
7. **Large unused data shadow** — `prisma/data/quill-standards/subjects/` (2,089 sharded JSON files),
   `academic_standards_sequenced_by_subject.json` (~19MB), and the two `.md` docs in that dir are
   **never read by any code**. Only the monolithic `academic_standards_master.json` +
   `academic_standards_sequenced.json` are consumed by `seed.ts`. Big repo weight, easy to mistake for
   live inputs.
8. **`seed.ts` spine guard can mask partial loads** — it skips the entire reload if
   `objective.count() > 0` (seed.ts:96-98). A half-seeded spine (any objectives present) won't be
   completed by a re-run; you'd have to truncate first.
9. **`prisma.config.ts.bak`** sits next to the live config (declares `engineType: "binary"` + an
   inline datasource provider via `@ts-expect-error`). Dead file; potential confusion about which
   engine/config is authoritative.
10. **Unused constant** `TIMEOUT_MS` in `seed-generator-content-types.ts:12`.
11. **`scripts/test-db.ts` uses CommonJS `require`** in an ESM (`"type":"module"`) repo and logs
    `PRISMA_CLIENT_ENGINE_TYPE`/`VERCEL` — debug cruft from the engine-type investigation.
12. **Two `createMany` calls cast to `any`** (`seed-catechisms.ts:75`, `seed-counties.ts:76`) with
    `eslint-disable` — Json-column typing workaround; low risk but unchecked.

---

## Cross-links to other subsystems

- **`src/lib/commentary-parser.ts`** (NOT owned here) — pure parser shared by `seed-commentary.ts`
  and both commentary prototypes. The bible-study UI reads `commentary_chapters`/`commentary_sections`.
- **`src/auth.ts` / `@/auth`** — provides `auth()` used by the test seed route; also an importer of `db`.
- **`src/data/catechisms/*`** (bundled TS) — source data for `seed-catechisms.ts`; also consumed by
  `CatechismManager` (the `code`↔`catechismId` contract binds them).
- **Family-discipleship feature** — `missions/actions.ts` (counties), devotionals page, catechism
  actions/`student-catechism` all read tables this subsystem seeds.
- **Curriculum/spine subsystem** — `src/server/queries/curriculum.ts`, `spine-actions.ts`,
  `/api/curriculum/*` routes read the Subject→Objective spine seeded by `seed.ts`.
- **Generators/Living Library** — `ResourceKind` (seeded by `db:seed:generators`) drives
  generator-actions / resource generation.
- **Cache consumers** — `src/app/students/page.tsx`, `src/app/courses/page.tsx` use `cacheQuery`.
- **~85 files import `db`** — this singleton is the backbone of essentially every server feature.

---

## Open questions

1. Is the Supabase client layer planned for imminent use (Storage/Realtime), or should it be deleted?
   Either way, **RLS must be configured before the publishable-key browser client is used**.
2. Should the giant unused `quill-standards/subjects/` shard tree + `..._by_subject.json` be removed
   from the repo, or is there a (currently dead) pipeline meant to consume them?
3. Should `seed-book.ts` and `check-course-integrity.js` be fixed to use the pg adapter, or deleted as
   superseded debug artifacts?
4. Is there meant to be a real discipleship-plan seeder, or should `seed-discipleship.ts` be renamed to
   `seed-devotionals.ts` to match what it does?
5. `/api/health`'s `provider: "accelerate"` — confirm Accelerate is fully gone and correct the label.
6. Confirm the intended production bootstrap is `prisma migrate deploy` (it must be — only the
   extensions migration creates pgvector + the RLS trigger; `db push` would skip both).
