# 01 — Build, Config, Tooling & Infra

> Code-truth reference for how QuillNext ("Quill & Compass") is built, type-checked,
> linted, configured, and deployed. Every claim here was verified against source on
> branch `main` (HEAD `38fec0d`). Where the repo's prose/markdown docs disagree with
> the code, the **code wins** and the disagreement is logged under "Risks, drift".

---

## Purpose & role in the app

This subsystem is the **toolchain spine**: the npm scripts that build/dev/lint/seed
the app, the TypeScript compiler config, the Next.js 16 build config, the ESLint 9
flat config, the Prisma 7 CLI config, the MCP server wiring for the AI editor, the
single CI workflow, the environment-variable surface, and the (unreliable) prose docs.

Stack confirmed from code: **Next.js 16 (App Router) + React 19 + TypeScript 5.9 +
Prisma 7 (Postgres via the `@prisma/adapter-pg` driver adapter, NOT Accelerate) +
Tailwind CSS v4 + Auth.js/NextAuth v5 + Vercel AI SDK (Google Gemini) + Inngest**.
There is **no test framework** wired anywhere (no Jest/Vitest/Playwright dep, no
`test` script). "CI" is lint + typecheck only.

---

## File-by-file reference

### `package.json`
Role: dependency manifest + the entire script surface. `"type": "module"` (ESM-first),
`"private": true`, `engines.node ">=24.0.0"`.

Key scripts (`package.json:6-22`):
- `dev` → `next dev` — **plain webpack/default dev, NOT `--turbopack`** despite README claiming Turbopack (`README.md:58`).
- `build` (`package.json:9`) → `prisma generate && npm run postgenerate && next build --webpack` — explicitly opts **out** of Turbopack at build with `--webpack`. Prisma client is generated as part of build (required because `src/generated/**` is git-ignored).
- `postgenerate` (`package.json:8`) → an inline `node -e` shim that, **if** `src/generated/client/index.ts` is missing, writes a one-line re-export `export * from "./client"`. Compensates for the new `prisma-client` generator's output shape so `@/generated/client` resolves.
- `start` → `next start`; `lint` → `eslint .` (flat config; the legacy `next lint` is gone in Next 16).
- `db:generate|push|migrate|studio` → Prisma CLI passthroughs.
- `db:seed` → `tsx prisma/seed.ts`; plus 5 specialized seeders (`db:seed:generators|discipleship|counties|catechisms|commentary`), each `tsx prisma/seed-*.ts`.

Notable deps: `next ^16.1.1` (installed **16.2.9**), `react/react-dom ^19.2.1`,
`@prisma/client ^7.8.0` + `@prisma/adapter-pg ^7.8.0` + `pg ^8`, `prisma ^7.2.0`,
`next-auth ^5.0.0-beta.30` + `@auth/prisma-adapter`, AI SDK (`ai`, `@ai-sdk/google`,
`@ai-sdk/openai`, `@ai-sdk/react`, `@ai-sdk/rsc`), `inngest`, `resend`,
`firebase-admin`, `@supabase/supabase-js`, `tailwindcss ^4.1.17`, Tiptap, Leaflet,
dnd-kit, `zod ^4`. `overrides` pins `react`/`react-dom` to the root versions to dedupe.
**No `@sentry/*` and no Stripe SDK** are present despite env vars for both (see drift).

### `tsconfig.json`
Role: TypeScript config. `strict: true`, `noEmit: true` (type-check only; Next/SWC
transpiles), `target ES2020`, `module esnext`, `moduleResolution bundler`,
`isolatedModules`, `jsx react-jsx`, `incremental` (emits `tsconfig.tsbuildinfo`,
which is tracked/dirty in git — see drift), `allowJs`. Path alias `@/* -> ./src/*`
(`tsconfig.json:25-29`) — the alias the whole codebase imports through.
`exclude` (`tsconfig.json:38-44`): `node_modules`, `prisma/seed*.ts`,
`family-discipleship-export`, `debug-connect.ts`, `verify-seed.ts` — i.e. the seed
scripts and the two root debug scripts are deliberately **not type-checked** (and not
type-checked in CI). `scripts/*.ts` are NOT excluded, so they ARE type-checked.

### `next.config.js`
Role: Next.js config (ESM, computes `__dirname` via `fileURLToPath` but never uses it —
dead lines `next.config.js:1-5`). Settings: `experimental.serverActions.bodySizeLimit
= '2mb'` (`:10-12`); `serverExternalPackages: []` (empty); `images.remotePatterns`
allows **any** https host (`hostname: '**'`, `:15-22`) — permissive, loads images from
anywhere. No Turbopack config, no redirects/rewrites/headers, no Sentry wrapper.

### `eslint.config.mjs`
Role: ESLint 9 **flat config** (added in HEAD commit `38fec0d`). Imports
`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` and **spreads
them directly** (the comment at `:4-6` warns that `FlatCompat` double-wraps and throws).
`ignores` (`:9-15`): `src/generated/**`, `.next/**`, `node_modules/**`,
`prisma/migrations/**`, `next-env.d.ts`. A final override block (`:24-34`) **downgrades
to `warn`** a set of rules that are "pervasively violated": `@typescript-eslint/
no-explicit-any`, `ban-ts-comment`, `no-wrapper-object-types`, `no-require-imports`,
`no-empty-object-type`, `react/no-unescaped-entities`, `react-hooks/error-boundaries`,
`react-hooks/set-state-in-effect`, `prefer-const`. Intent (per the comment): adopt lint
in CI now without a mass refactor; new violations of *other* error-level rules still
fail CI.

### `postcss.config.mjs`
Role: PostCSS config; single plugin `@tailwindcss/postcss` (`:1-5`). This is the
Tailwind **v4** integration (no `tailwind.config.js` file in the repo — v4 is
CSS-first; tokens live in `src/app/globals.css`, referenced by `components.json`).

### `components.json`
Role: shadcn/ui generator config. `style: "new-york"`, `rsc: true`, `tsx: true`,
`tailwind.config: ""` (empty — v4), `tailwind.css: "src/app/globals.css"`,
`baseColor: "neutral"`, `iconLibrary: "lucide"`. Aliases: `@/components`, `@/lib/utils`,
`@/components/ui`, `@/lib`, `@/hooks`. (Note: `iconLibrary` is `lucide` here, but
README claims Phosphor as "Icons" — both deps are installed.)

### `prisma.config.ts` (active)
Role: Prisma 7 CLI config (`@prisma/config` `defineConfig`). Loads `dotenv/config`
first. `schema: 'prisma/schema.prisma'`; `migrations.path: 'prisma/migrations'`;
`migrations.seed: 'tsx prisma/seed.ts'`. Datasource `url` =
`process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL` (`:15`) — prefers the
**direct** TCP URL for migrations/studio, falls back to pooled. The comment (`:11-14`)
explains it uses raw `process.env` (not `@prisma/config`'s `env()`) specifically so
`prisma generate` still succeeds on Vercel where `DIRECT_DATABASE_URL` is unset. Uses
the **default (library) engine** — no `engineType` set.

### `prisma.config.ts.bak` (stale backup, not used)
Role: previous version of the above. Differs by setting `engineType: "binary"` and a
`datasource.provider: "postgresql"` (with a `@ts-expect-error`). Dead file — keep as
history only; the schema generator already sets `binaryTargets = ["native"]` while the
live config uses the library engine, so this `.bak` is inconsistent with current state.

### `.mcp.json`
Role: project-level MCP servers for AI editors. One server `supabase` (HTTP) pointing at
`mcp.supabase.com` with `project_ref=liflosyuonigkiyhwsny` and a feature query string
(storage, branching, functions, development, debugging, database, docs, account).
**Conflicts** with `.claude/settings.json` which configures the *same* server name with
a **different** `project_ref=zykjofwwdephbiyydumc` (see drift).

### `next-env.d.ts`
Role: Next-generated ambient types (do-not-edit). References `next`, `next/image-types`,
and `./.next/dev/types/routes.d.ts` (typed-routes). Git-ignored (`.gitignore:36`) yet
present on disk.

### `skills-lock.json`
Role: lockfile for an external "skills" mechanism (Claude/agent skills). Pins one skill
`supabase-postgres-best-practices` from GitHub source `supabase/agent-skills` with a
content hash. Mirrors `.agents/skills/` and `.claude/skills/`. Not part of the app build.

### `.nvmrc`
Role: Node version pin → `24`. Matches `engines.node ">=24"` and the CI `node-version: 24`.

### `debug-connect.ts` (root, excluded from tsc)
Role: standalone DB connectivity smoke test. Builds a `pg.Pool` from `DATABASE_URL` with
`ssl.rejectUnauthorized:false`, wraps in `PrismaPg`, constructs `PrismaClient` from
`./src/generated/client`, `$connect()`s, attempts `user.count()`. Run via `tsx`.
Git-ignored (`.gitignore:42`) but committed anyway. Excluded from typecheck.

### `verify-seed.ts` (root, excluded from tsc)
Role: one-off verifier — counts `resourceKind` rows and rows with `requiresVision:true`,
prints 5 examples. Imports `PrismaClient` from `./src/generated/client` with **no driver
adapter** (relies on `DATABASE_URL` via the generated client default). Excluded from tsc.

### `.github/workflows/ci.yml`
Role: the **only** CI workflow. Name `CI`; triggers on `push` to `main` and on any
`pull_request`. Single job `check` (`Lint & Typecheck`) on `ubuntu-latest`:
`checkout@v4` → `setup-node@v4` (node 24, npm cache) → `npm ci` → `npx prisma generate`
→ `npm run postgenerate` → `npx tsc --noEmit` → `npm run lint`. No DB/secrets needed
(the header comment notes prisma generate doesn't connect and the config tolerates an
undefined datasource URL). **No build, no deploy, no tests** in CI.

### `scripts/` (not "owned" but part of tooling; run via `tsx`/`node`)
- `test-db.ts` — traces `PRISMA_CLIENT_ENGINE_TYPE`/`VERCEL`/`NODE_ENV`, `require`s
  `../src/server/db`, connects and reads one user. CommonJS `require` in an ESM repo.
- `check-course-integrity.js`, `debug-student-assignments.ts`, `verify-gemini.ts`,
  `parse-commentary-prototype.ts`, `verse-anchor-prototype.ts` — ad-hoc data/AI probes.
  These `.ts` files are **inside** the tsc `include` (only root debug + `prisma/seed*`
  are excluded), so they are type-checked in CI.

### `src/app/api/health/route.ts` (owned; the health endpoint)
Role: liveness/readiness check. `export const dynamic = "force-dynamic"`. `GET` runs
`await db.$queryRaw\`SELECT 1\``, times it, returns `{status, latency_ms, provider,
timestamp}` 200 (`degraded` if >1000ms latency, else `healthy`); on throw returns
`unhealthy` 503. **Server route, no auth, no tenancy** (intentional for a probe).
Bug/drift: hard-codes `provider: "accelerate"` (`:25`) but `src/server/db.ts` uses the
**pg driver adapter**, not Accelerate — stale label.

### Env files (names only — values never copied)
`.env` declares (~47 names): `BIBLE_API_KEY`, `COLLEGE_SCORECARD_API_KEY`,
`ENCRYPTION_KEY`, `FIREBASE_*` (API_KEY, APP_ID, AUTH_DOMAIN, CLIENT_EMAIL, CLIENT_ID,
MESSAGING_SENDER_ID, PRIVATE_KEY, PRIVATE_KEY_ID, PROJECT_ID, STORAGE_BUCKET),
`GEMINI_API_KEY`, `JOSHUA_PROJECT_API_KEY`, `STRIPE_API_KEY`/`STRIPE_RESTRICTED_KEY`/
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/
`SENTRY_PROJECT`/`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`,
`NEXT_PUBLIC_REACT_APP_STRIPE_PUBLISHABLE_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`YOUTUBE_DATA_API`/`YOUTUBE_OAUTH_CLIENT_ID`/`YOUTUBE_OAUTH_CLIENT_SECRET`/
`YOUTUBE_OAUTH_REDIRECT_URI`, `NODE_ENV`, `PORT`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`,
`AUTH_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `DIRECT_DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`,
`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `RESEND_API_KEY`, `SAFETY_ALERT_FROM`.
`.env.local` declares: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`DATABASE_URL`, `DIRECT_DATABASE_URL`. Both files are git-ignored (`.gitignore:28-29`).
**Apparent purposes**: `DATABASE_URL`=pooled Postgres (used by `src/server/db.ts` and
the app at runtime); `DIRECT_DATABASE_URL`=direct TCP for migrations/studio (prisma.config);
`AUTH_*`/`NEXTAUTH_*`+`GOOGLE_CLIENT_*`=Auth.js Google OAuth; `GEMINI_API_KEY`=Gemini via
AI SDK; `INNGEST_*`=background jobs; `FIREBASE_*`=firebase-admin storage; `RESEND_API_KEY`
+`SAFETY_ALERT_FROM`=safety-alert email; `BIBLE_API_KEY`/`JOSHUA_PROJECT_API_KEY`/
`COLLEGE_SCORECARD_API_KEY`/Google Books/YouTube=external content APIs; Supabase keys=
storage/db; Stripe & Sentry vars=**declared but unused in code** (see drift).

### Other tooling files (cataloged)
- `gitignore` (no leading dot) — an **orphan** second ignore file; the active one is
  `.gitignore`. The two differ (e.g. orphan ignores `prisma/migrations`, `.vscode/`,
  `.idea/`; active does not). Dead/confusing.
- `.gitignore` (active) ignores `node_modules`, `.next/`, `.env*`, `*.tsbuildinfo`,
  `next-env.d.ts`, `src/generated`, `debug-connect.ts`, `railway_backup.sql`,
  `build_troubleshooting/`. (It does NOT ignore `prisma/migrations`, so migrations are
  tracked — good.)
- `.vscode/settings.json` — single setting `css.lint.unknownAtRules: "ignore"` (silences
  editor errors on Tailwind v4 `@`-rules).
- `.claude/settings.json` + `.claude/settings.local.json` — MCP server config (supabase,
  different project_ref than `.mcp.json`) and `enabledMcpjsonServers: ["supabase"]`.
- `.agents/skills/`, `.claude/skills/` — agent-skill material (supabase-postgres-best-practices).
- `railway_backup.sql` (~8MB) — a Railway DB dump committed to the repo root then
  git-ignored after the fact; suggests a past migration from Railway → Supabase/Postgres.

---

## Data models & tenancy

This subsystem touches the DB only through **`src/server/db.ts`** (the shared Prisma
singleton) and the Prisma CLI/config; it defines no models of its own.

- `src/server/db.ts`: constructs `PrismaClient` from `@/generated/client` with a
  `PrismaPg` driver adapter built from a **`PoolConfig`** (`connectionString:
  DATABASE_URL`, `ssl.rejectUnauthorized:false`) — the comment (`db.ts:5-7`) explains it
  passes a config (not a prebuilt `pg.Pool`) to avoid a dual `@types/pg` version
  conflict. Caches the client on `globalThis` in non-production to survive HMR. Logs
  `["error","warn"]` in dev, `["error"]` otherwise. **This is the only Prisma client the
  app should use at runtime** (`debug-connect.ts`/`verify-seed.ts` make their own).
- Prisma schema generator (`prisma/schema.prisma:1-6`): `provider = "prisma-client"`
  (the **new** TS generator), `output = ../src/generated/client`, `binaryTargets =
  ["native"]`, `previewFeatures` (postgresqlExtensions) **commented out**. Datasource
  `provider = "postgresql"` with NO `url` in the schema — the URL comes from
  `prisma.config.ts` (CLI) and from `db.ts` (runtime).
- **Tenancy posture of this subsystem: none.** The health route and DB client are not
  org-scoped and do not call `getCurrentUserOrg`/auth. Tenancy is enforced elsewhere
  (server actions / data layer) — out of scope here.

---

## Entry points & end-to-end flows

**Build/deploy flow (the canonical path):**
1. `npm run build` → `prisma generate` writes the TS client to `src/generated/client`
   (git-ignored, so it MUST regenerate on every clean build / on Vercel).
2. `npm run postgenerate` writes the `index.ts` re-export shim if absent.
3. `next build --webpack` compiles the App Router app (webpack, not Turbopack).
4. Runtime: `next start` (or Vercel serverless). The app talks to Postgres via the
   `db` singleton (pooled `DATABASE_URL`); migrations/studio use `DIRECT_DATABASE_URL`.

**Deployment target:** strong but **circumstantial** evidence of **Vercel** —
prisma.config comments reference "Vercel where DIRECT_DATABASE_URL is not set at build
time" (`prisma.config.ts:12-14`); `test-db.ts` probes `process.env.VERCEL`; README
status line claims "Direct Deployment Verified"; `.gitignore` ignores `.vercel`.
**But there is NO `vercel.json` and NO `.vercel/` dir in the repo**, so deployment
settings (build command, env, regions) live in the Vercel dashboard, not in code.

**CI flow:** push/PR → install → prisma generate → postgenerate → `tsc --noEmit` →
`eslint .`. Green CI ≠ a successful production build (CI never runs `next build`).

**Health-check flow:** `GET /api/health` → `db.$queryRaw\`SELECT 1\`` → `{status,
latency_ms,...}`. Used by uptime/monitoring; no auth.

**Local dev flow:** `npm run dev` (`next dev`, webpack) on `PORT` (env). Seeders:
`npm run db:seed` and the `db:seed:*` variants via `tsx`.

---

## External dependencies & services

Build/infra-relevant external services (verified by `process.env.*` usage in `src`):
- **Postgres** (Supabase-hosted, per `.mcp.json` project_ref + `NEXT_PUBLIC_SUPABASE_*`)
  via `pg` + `@prisma/adapter-pg`. SSL with `rejectUnauthorized:false`.
- **Supabase** JS SDK — `src/lib/supabase/{server,client}.ts` (storage/db helpers).
- **Google Gemini** via Vercel AI SDK (`@ai-sdk/google`); key shim in `src/lib/ai/config.ts`
  maps `GEMINI_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Auth.js / NextAuth v5** + Google OAuth (`src/auth.ts`).
- **Inngest** — background functions served at `/api/inngest` (processDocument,
  scanMessage, compileCurriculum); needs `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`.
- **Resend** — transactional/safety-alert email (`src/lib/notifications/safety-alert.ts`).
- **Firebase Admin** — storage (`src/lib/firebase-admin.ts`).
- **Content APIs** — Bible (`BIBLE_API_KEY`), Joshua Project, Google Books, YouTube,
  College Scorecard.
- **MCP (dev-time only)** — Supabase MCP server for the AI editor; not a runtime dep.

Build tooling deps: `prisma`/`@prisma/config`, `eslint`+`eslint-config-next`,
`typescript`, `tsx` (seed/script runner), `@tailwindcss/postcss`, `tw-animate-css`,
`js-yaml`/`@types/js-yaml` (used by some data script).

---

## Auth / security posture

- This subsystem itself is **mostly unauthenticated by design**: `/api/health` is a
  public probe; the DB client and configs carry no auth.
- **Secrets handling:** `.env`/`.env.local` are git-ignored; CI runs without secrets.
  Good. However `railway_backup.sql` (a full DB dump) was committed before being
  git-ignored — it remains in history.
- **TLS:** both `db.ts` and `debug-connect.ts` set `ssl.rejectUnauthorized:false`,
  which **disables cert verification** on the Postgres connection (accepts any cert).
  Common for Supabase/managed PG but technically MITM-weakening; note for review.
- **Image loader:** `next.config.js` allows `https://**` (any host) — an SSRF/abuse
  surface for the Next image optimizer; tighten to known hosts if feasible.
- **Server Action body limit** raised to 2mb (`next.config.js`).
- **ESLint** downgrades `no-explicit-any` and `ban-ts-comment` to warnings, so `any`
  and `@ts-ignore` won't fail CI — weakens the "No `any`" rule that CURSOR_RULES claims.

---

## Risks, drift, dead-code & half-built

**Doc drift (prose vs code) — the docs are stale, per project memory:**
- README says Turbopack (`README.md:58`) but `dev`/`build` use **webpack** (`build`
  even passes `--webpack` explicitly). README also says "Connection: Prisma" and lists
  Phosphor icons while `components.json` uses lucide.
- README references `cp .env.example .env` but **there is no `.env.example`** in the repo.
- Health route advertises `provider: "accelerate"` but the runtime uses the **pg driver
  adapter** (no Accelerate dependency anywhere).
- `.cursor/CURSOR_RULES.md` claims Next "16.0.7 ... requires Node 20.9+" and a tRPC
  data layer (`src/server/api/routers/*`); actual Next is **16.2.9**, the repo requires
  **Node ≥24**, and there is **no tRPC** (deps absent; data layer is Server Actions +
  route handlers). Treat CURSOR_RULES as aspirational, not factual.
- `.cursor/` (CURRICULUM_INTEGRATION_GUIDE, FEATURES_OVERVIEW, GEMINI_STRATEGY, CURSOR_RULES,
  ~Dec 2025–Mar 2026) and the QSF artifacts (`QSF-REMEDIATION-PLAN.md`,
  `qsf-scorecard-quillnext.md` dated 2026-03-30, `qsf-audit-kit/`) are **planning/audit
  docs, not current-state docs** — useful for intent, unreliable for "what exists now".
  The QSF scorecard itself reports "Not Certified" with GOV at 0%.

**Env-var drift (declared-but-unused / used-but-undeclared):**
- **Declared but unused in code:** all `STRIPE_*` and `NEXT_PUBLIC_REACT_APP_STRIPE_PUBLISHABLE_KEY`
  (no Stripe SDK, no usage), and all `SENTRY_*` / `NEXT_PUBLIC_SENTRY_DSN` (no `@sentry/*`
  dep, no `instrumentation.ts`/sentry config files). These are vestigial.
- **Used in code but NOT in `.env`:** `SUPABASE_SERVICE_ROLE_KEY` (`src/lib/supabase/server.ts`),
  `GOOGLE_BOOKS_API_KEY` (`youtube-actions.ts`, `library-lookup-actions.ts` — note `.env`
  only has the `NEXT_PUBLIC_` variant), `GOOGLE_GENERATIVE_AI_API_KEY` (set at runtime by
  the shim), `HILOW_INGEST_URL`/`HILOW_INGEST_KEY` (`api/library/books/route.ts`).
- **Name mismatch:** `.env` defines `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` but code
  (`src/lib/supabase/client.ts`, `server.ts`) and `.env.local` read
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `.env`'s value would not be picked up.

**Config conflicts / dead code:**
- **Two different Supabase MCP project_refs**: `.mcp.json` → `liflosyuonigkiyhwsny`;
  `.claude/settings.json` → `zykjofwwdephbiyydumc`. At least one is stale.
- `prisma.config.ts.bak` (library vs binary engine, `provider` hack) — dead backup that
  contradicts the live config; remove or reconcile.
- Orphan `gitignore` (no dot) alongside `.gitignore` — only `.gitignore` is honored.
- `next.config.js:1-5` computes `__dirname` but never uses it — dead lines.
- `tsconfig.tsbuildinfo` is tracked in git and shows as dirty (`M` at session start)
  even though `.gitignore` lists `*.tsbuildinfo` — it was committed before being ignored,
  so it keeps reappearing as a diff. Should be `git rm --cached`.
- `railway_backup.sql` (~8MB) left in the working tree (git-ignored now).

**Half-built / gaps:**
- **No automated tests anywhere** and **no `next build` in CI** — the exact failure
  class CI was meant to catch (build/prisma/type breakage that "slipped to Vercel", per
  the ci.yml header) is only partially covered: CI runs `prisma generate` + `tsc` +
  lint, but not the actual `next build --webpack`, so a webpack-only build break could
  still reach Vercel.
- ESLint mass-downgrade means a large backlog of `any`/`ts-comment`/hooks violations is
  knowingly deferred ("burn down over time").

---

## Cross-links to other subsystems

- **Data layer / Prisma models:** `prisma/schema.prisma`, `prisma/seed*.ts`, and the
  generated `src/generated/client` — documented by the DB/schema subsystem. This doc
  only covers how they're generated/configured.
- **Runtime DB client `src/server/db.ts`** is consumed by virtually every server
  action / route handler (auth, courses, students, curriculum, grading, library) — those
  are the DB-access subsystem.
- **Auth `src/auth.ts`** (NextAuth v5 + Google) — auth/tenancy subsystem; relies on the
  `AUTH_*`/`GOOGLE_CLIENT_*` env vars cataloged here.
- **AI config `src/lib/ai/config.ts`** + Gemini key shim — AI subsystem.
- **Inngest `src/inngest/*` + `/api/inngest/route.ts`** — background-jobs subsystem.
- **Supabase/Firebase storage** (`src/lib/supabase/*`, `src/lib/firebase-admin.ts`) —
  storage subsystem; consumes Supabase/Firebase env vars cataloged here.
- **Notifications** (`src/lib/notifications/safety-alert.ts`, Resend) — uses `RESEND_API_KEY`.

## Open questions

1. **Deployment**: is Vercel the actual target, and where is its build command/env set?
   (No `vercel.json` in repo.) Does Vercel run `npm run build` (webpack) as-is?
2. **Engine choice**: schema sets `binaryTargets=["native"]` but live `prisma.config.ts`
   uses the **library** engine (the `.bak` wanted `binary`). Which is intended for prod?
3. **MCP project_ref mismatch** — which Supabase project is canonical
   (`liflosyuonigkiyhwsny` vs `zykjofwwdephbiyydumc`)?
4. **Stripe & Sentry** — planned-but-unbuilt, or removed-but-env-left-behind? Should the
   vestigial env vars be deleted?
5. **Supabase key name mismatch** (`*_PUBLISHABLE_DEFAULT_KEY` in `.env` vs
   `*_PUBLISHABLE_KEY` in code) — is the client silently falling back to `.env.local`?
6. Should CI add a real `next build` step (and any tests) to fully cover the breakage
   class its own header describes?
