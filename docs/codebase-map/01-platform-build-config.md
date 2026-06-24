# 01 — Platform, Build & Config
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `package.json` | Project manifest: name "Quill & Compass", ESM (`"type":"module"`), npm scripts, deps, `engines.node >=24`, react/react-dom version pins via `overrides`. |
| `package-lock.json` | npm lockfile v3, 21527 lines, ~1508 resolved packages. Name "Quill & Compass" v0.1.0. |
| `tsconfig.json` | TS strict, `target ES2020`, `module/moduleResolution esnext/bundler`, `noEmit`, `@/* -> ./src/*`, Next plugin. Excludes seed scripts + `family-discipleship-export` (the two stray root utilities `debug-connect.ts`/`verify-seed.ts` were deleted 2026-06-19 and their excludes removed — Q-01-005). |
| `next.config.js` | Next config: serverActions bodySizeLimit 2mb, `serverExternalPackages: []`, `images.remotePatterns: []` (no remote `next/image` optimization — closes the `/_next/image` proxy; Q-01-002, 2026-06-19). |
| `eslint.config.mjs` | Flat ESLint 9 config; spreads `eslint-config-next` core-web-vitals + typescript; downgrades 9 rules to `warn`. |
| `postcss.config.mjs` | Single plugin `@tailwindcss/postcss` (Tailwind v4 pipeline). |
| `vitest.config.ts` | Vitest: node env, include `src/**/*.test.ts`, `@` alias to `./src`. |
| `prisma.config.ts` | Prisma 7 config: schema path, migrations path+seed, datasource url `DIRECT_DATABASE_URL ?? DATABASE_URL` via raw `process.env`. |
| `components.json` | shadcn/ui config: style "new-york", rsc true, baseColor neutral, css `src/app/globals.css`, icon lib lucide, `@/` aliases. |
| `.nvmrc` | Node `24`. |
| `next-env.d.ts` | Next ambient types + `import "./.next/dev/types/routes.d.ts"` (generated; "should not be edited"). |
| `.mcp.json` | One MCP server: Supabase HTTP MCP (hardcoded `project_ref=liflosyuonigkiyhwsny`). |
| `skills-lock.json` | Lock for one external skill: `supabase-postgres-best-practices` (github supabase/agent-skills). |
| `.github/workflows/ci.yml` | CI "Lint & Typecheck" on push(main)/PR: install, prisma generate, postgenerate, `tsc --noEmit`, lint, test. |
| `design.md` | Live design-system doc (Cursor "always_on" rule). Calm-tech / analog aesthetic principles. |
| `README.md` | Rewritten accurate 2026-06-19 (Q-01-001): getting-started + verified stack (webpack build, lucide, points to `design.md` + `docs/codebase-map/`), references the new `.env.example`. Replaces the stale HEAD copy. |
| `QSF-REMEDIATION-PLAN.md` | **REMOVED** (confirmed Q-01-001, 2026-06-19): stale 2026-03-30 remediation plan (privacy work already landed at `src/app/privacy/page.tsx`); re-runnable via the `qsf-audit` skill. |
| `qsf-scorecard-quillnext.md` | **REMOVED** (confirmed Q-01-001, 2026-06-19): stale 2026-03-30 audit snapshot. |
| `.env.example` | Added 2026-06-19 (Q-01-001): env-var template from the verified §6 key list (placeholders only, no secrets); trackable (`.gitignore` covers `.env`/`.env*.local`, not `.env.example`). |
| `src/app/globals.css` | Tailwind v4 entry: `@import "tailwindcss"`, `@theme` brand tokens, shadcn CSS vars, dark theme, print + reduced-motion media queries. |
| `src/smoke.test.ts` | Trivial Vitest smoke test (`2+2===4`); proves the test runner works in CI. |

## 2. Purpose / intent

This chapter is the build/toolchain spine: how the app is compiled, linted, typechecked, tested, styled, and gated in CI. The product is "Quill & Compass" / QuillNext — an AI homeschool-curriculum platform on Next.js 16 App Router + React 19 + Prisma 7 (Postgres/Supabase) + Tailwind v4. The config layer enforces TS strict, a single ESLint flat config, a Tailwind-v4-only PostCSS pipeline, and a lightweight CI gate (no DB/secrets needed) that catches the prisma-config / typegen / type / lint breakage class that previously slipped to Vercel.

## 3. Architecture & key files

- **Module system**: ESM project (`package.json` `"type":"module"`). Configs use `.mjs`/`.ts`/`.js` accordingly; `next.config.js` is ESM (`import path`).
- **Build pipeline** (`package.json:9`): `build = prisma generate && npm run postgenerate && next build --webpack`. `--webpack` explicitly opts OUT of Turbopack for the production build (the rewritten README states this correctly — Q-01-001). `postgenerate` (`package.json:8`) is a node one-liner that writes a re-export shim `src/generated/client/index.ts` if missing, so imports of `@/generated/client` resolve after `prisma generate`.
- **TS**: `tsconfig.json` strict + `noEmit` (type-check only; Next/webpack do the actual transpile). `paths` `@/* -> ./src/*` mirrored in `vitest.config.ts` and `components.json`. `exclude` carves out `prisma/seed*.ts` and `family-discipleship-export` (the stray root utilities `debug-connect.ts`/`verify-seed.ts` and their excludes were removed 2026-06-19 — Q-01-005).
- **Lint**: `eslint.config.mjs` is flat-config (Next 16 / ESLint 9). It spreads native `eslint-config-next/core-web-vitals` and `/typescript`, then a final block downgrading 9 rules to `warn` (no-explicit-any, ban-ts-comment, no-require-imports, prefer-const, react-hooks/set-state-in-effect, etc.). Comment states intent: adopt lint now without mass refactor; new violations of other error-level rules still fail CI. Ignores `src/generated/**`, `.next/**`, `node_modules`, `prisma/migrations`, `next-env.d.ts`.
- **Styling**: `postcss.config.mjs` runs only `@tailwindcss/postcss`. `src/app/globals.css` is the Tailwind v4 entry: `@import "tailwindcss"`, `@plugin "tailwindcss-animate"`, a `dark` custom variant, `@theme` brand tokens (`--color-qc-*`, fonts Cormorant Garamond / Inter, radii, shadows, animations), then shadcn `@theme inline` mappings, `:root` light theme (mapped to qc tokens) and `.dark` (oklch values), plus base layer, a paper-texture `body::before`, print styles, and reduced-motion. Imported by `src/app/layout.tsx` (verified).
- **Testing**: `vitest.config.ts` node env, glob `src/**/*.test.ts` (12 test files exist repo-wide; `src/smoke.test.ts` is the canary).
- **Prisma config**: `prisma.config.ts` (Prisma 7 `defineConfig`) loads `dotenv/config`, sets schema/migrations/seed, and resolves datasource from `process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL`. Comment is explicit: uses raw `process.env` (not `env()`) so `prisma generate` does not throw on Vercel where `DIRECT_DATABASE_URL` is unset.
- **CI gate**: `.github/workflows/ci.yml` — node 24, `npm ci`, `npx prisma generate`, `npm run postgenerate`, `npx tsc --noEmit`, `npm run lint`, `npm test`. No DB/secrets (prisma generate doesn't connect; datasource falls back to undefined).
- **Tooling integrations**: `.mcp.json` wires the Supabase HTTP MCP server (project ref hardcoded). `skills-lock.json` pins the supabase-postgres-best-practices skill. `components.json` configures shadcn codegen.

## 4. Data flow (build/CI trace, concrete)

CI on push/PR (`.github/workflows/ci.yml:13-27`):
1. `actions/checkout@v4`, `setup-node@v4` node 24 + npm cache (`ci.yml:18-21`).
2. `npm ci` (`ci.yml:22`) installs from `package-lock.json`.
3. `npx prisma generate` (`ci.yml:23`) reads `prisma.config.ts` → datasource `process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL` (`prisma.config.ts:15`); both unset in CI → undefined url, generate still succeeds (no connection).
4. `npm run postgenerate` (`ci.yml:24` → `package.json:8`) writes `src/generated/client/index.ts` re-export shim if absent.
5. `npx tsc --noEmit` (`ci.yml:25`) type-checks under `tsconfig.json` (strict).
6. `npm run lint` (`ci.yml:26` → `package.json:12` `eslint .`) runs flat config (`eslint.config.mjs`).
7. `npm test` (`ci.yml:27` → `package.json:11` `vitest run`) runs `src/**/*.test.ts` per `vitest.config.ts:12` (includes `src/smoke.test.ts`).

Local prod build (`package.json:9`): `prisma generate` → `postgenerate` shim → `next build --webpack`. `next.config.js` then applies serverActions 2mb body limit (`next.config.js:10-12`) and `images.remotePatterns: []` (no remote image optimization; `next.config.js:15-24`). Styling: webpack/PostCSS runs `@tailwindcss/postcss` (`postcss.config.mjs:3`) over `globals.css` imported in `layout.tsx`.

Seed flow (`package.json:13-22`): `db:seed*` scripts invoke `tsx prisma/seed*.ts`; each seed resolves `DIRECT_DATABASE_URL ?? DATABASE_URL` directly (verified across `prisma/seed*.ts`).

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| Build script (`build`) | DONE | `package.json:9`; uses `--webpack` (Turbopack off). |
| `postgenerate` shim | DONE | `package.json:8`; wired into build + CI (`ci.yml:24`). |
| Test script + smoke test | DONE | `package.json:11`, `vitest.config.ts:12`, `src/smoke.test.ts:1-8`; run by CI (`ci.yml:27`). |
| db:seed* scripts | DONE | `package.json:17-22`; seed files exist (`prisma/seed*.ts`). |
| `tsconfig.json` | DONE | strict + Next plugin (`tsconfig.json:11,20-24`); exclude list trimmed 2026-06-19 to `prisma/seed*.ts` + `family-discipleship-export` after the `debug-connect.ts`/`verify-seed.ts` deletions (Q-01-005). |
| `next.config.js` | DONE | `images.remotePatterns: []` — no remote `next/image` usage, optimizer proxy closed (`next.config.js:15-24`; Q-01-002 resolved 2026-06-19). |
| `eslint.config.mjs` | DONE | flat config wired via `lint` script + CI; 9 rules intentionally downgraded to warn (`eslint.config.mjs:24-34`). |
| `postcss.config.mjs` | DONE | single Tailwind v4 plugin (`postcss.config.mjs:3`). |
| `vitest.config.ts` | DONE | node env + `@` alias (`vitest.config.ts:6-13`). |
| `prisma.config.ts` | DONE | Prisma 7 config, datasource fallback (`prisma.config.ts:15`). |
| `components.json` | DONE (support) | shadcn config; consumed by codegen only, not runtime. |
| `.nvmrc` | DONE (support) | `24` matches `engines` + CI node 24. |
| `next-env.d.ts` | DONE (support) | generated; imports `./.next/dev/types/routes.d.ts` (`next-env.d.ts:3`). |
| `.mcp.json` | DONE (support) | Supabase MCP server; dev tooling only. |
| `skills-lock.json` | DONE (support) | one skill pinned; dev tooling only. |
| `ci.yml` | DONE | full gate (`ci.yml:12-27`). |
| `globals.css` | DONE | imported by `src/app/layout.tsx` (verified). |
| `design.md` | DONE (doc/claim) | live Cursor rule `trigger: always_on` (`design.md:1-3`); design principles only, no enforcement. |
| `README.md` | DONE (doc) | rewritten accurate 2026-06-19 (Q-01-001); no stale stack claims, points to `design.md` + `docs/codebase-map/`. |
| `.env.example` | DONE (support) | added 2026-06-19 (Q-01-001); env template, no secrets. |
| `QSF-REMEDIATION-PLAN.md` | REMOVED | deleted (Q-01-001, 2026-06-19); stale planning doc, not code. |
| `qsf-scorecard-quillnext.md` | REMOVED | deleted (Q-01-001, 2026-06-19); stale audit snapshot 2026-03-30. |

## 6. Integration points

- **Importers of `globals.css`**: `src/app/layout.tsx` (the only consumer; verified).
- **Toolchain consumed by**: every TS/TSX file (tsconfig), all source (eslint/vitest), all components (Tailwind/globals.css), Prisma CLI (prisma.config.ts), shadcn CLI (components.json).
- **External services / APIs referenced in code** (per env grep): Google OAuth, Google Gemini (Vercel AI SDK), Supabase (Postgres via Prisma/`DATABASE_URL` + dev-time MCP — the `@supabase/supabase-js` JS SDK was removed 2026-06-19, Q-002), Firebase Admin/Storage, Resend (email), Joshua Project, Bible API, Google Books, YouTube, Inngest, Hi-Low ingest endpoint. *(The previously-listed `@ai-sdk/openai` was uninstalled in Session 2, Q-08-006 — quillnext is Gemini-only.)*
- **Inngest**: jobs wired via `src/app/api/inngest/route.ts` plus producers in `chat` and `library/.../extract` routes (out of this chapter's scope; cross-ref the AI/jobs chapter).
- **Prisma models used**: none directly in this chapter (config only). Data model = see `02-data-model.md`.
- **Tenancy/RLS**: not configured here. `RLS_ENABLED` read in `src/server/db.ts:10` — see `04-security-auth-tenancy.md`.

### Env-var appendix (distinct `process.env.*` keys grepped repo-wide)

Auth/session: `AUTH_SECRET`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
DB: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RLS_ENABLED`, `PRISMA_CLIENT_ENGINE_TYPE`.
AI: `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`.
Firebase: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`.
*(The three `SUPABASE_*` keys were removed 2026-06-19 with the dead Supabase JS clients (Q-002); the Supabase Postgres connection uses `DATABASE_URL`/`DIRECT_DATABASE_URL` above.)*
Email: `RESEND_API_KEY`, `SAFETY_ALERT_FROM`.
3rd-party content: `YOUTUBE_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`, `JOSHUA_PROJECT_API_KEY`, `BIBLE_API_KEY`.
Hi-Low ingest: `HILOW_INGEST_URL`, `HILOW_INGEST_KEY`.
Platform/runtime: `NODE_ENV`, `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`.
(Sources include `src/**`, `prisma/**`, `scripts/**`, and `prisma.config.ts`; the stray `prisma.config.ts.bak` was deleted 2026-06-19 — Q-01-003.) A `.env.example` was added 2026-06-19 (Q-01-001) covering these keys (placeholders only); the rewritten README's `cp .env.example .env` step now resolves.

## 7. Findings

Q-01-001  [MED]  ✅ RESOLVED 2026-06-19 (Session 2, 01-MED) — owner chose "fresh README + .env.example; drop QSF": `README.md` rewritten accurate (webpack build, lucide, no model-name churn, points to `design.md` + `docs/codebase-map/`); `.env.example` created from the verified §6 key list (placeholders only, trackable); the two stale QSF docs confirmed REMOVED (privacy work already shipped at `src/app/privacy/page.tsx`; re-runnable via the qsf-audit skill). The drift points (`quill-standards/` dir, `.cursor/CURSOR_RULES.mdc`) are gone from the new README. See CHANGELOG.md. — README/QSF docs deleted in working tree and stale — root docs
  Evidence: git status showed `D README.md`, `D QSF-REMEDIATION-PLAN.md`, `D qsf-scorecard-quillnext.md`; HEAD README claimed "Turbopack" (`README.md`) while build is `next build --webpack` (`package.json:9`), claimed Gemini "2.0 Flash / 1.5 Pro" and "Phosphor Icons" though components.json sets `iconLibrary: lucide` (`components.json:13`), and referenced `.cursor/CURSOR_RULES.mdc` (wrong extension — the file was `.cursor/CURSOR_RULES.md`, now `D`) and `.env.example` (absent at the time).
  Impact: Onboarding docs were removed from the tree and the committed copies contained build/stack drift; treat as claims, not facts. design.md is the live design doc.
  Status: ✅ RESOLVED (README rewritten + `.env.example` added; QSF docs removed; not pushed)

Q-01-002  [MED]  ✅ RESOLVED 2026-06-19 (Session 2, 01-MED) — set `images.remotePatterns: []`. A multi-modal sweep (verified by hand) confirmed the only `next/image` `<Image>` usages are local `/assets/branding/*` — at the time 3 sites ([Sidebar.tsx:67], `MainNav.tsx:49`, [InklingToolkit.tsx:46]); `MainNav.tsx` was deleted 2026-06-19 (ch.06 Q-06-003), leaving **2** ([Sidebar.tsx:67], [InklingToolkit.tsx:46]) — still zero remote hosts via the optimizer; every remote image (Google-OAuth/DiceBear avatars, YouTube `i.ytimg.com` / Google-Books / OpenLibrary thumbnails, scraped article og:images) renders via plain `<img>`/Radix `AvatarImage`, which bypass `remotePatterns`. Empty allowlist closes the `/_next/image` open-proxy surface with no functional impact (owner-confirmed posture: don't route 3rd-party images through the optimizer; `Article.imageUrl`'s arbitrary host is moot since it's an `<img>`). See CHANGELOG.md. — `images.remotePatterns` allows every https host — next.config.js:18-19
  Evidence: `{ protocol: 'https', hostname: '**' }` permitted Next image optimization to fetch/proxy from ANY https origin.
  Impact: SSRF/abuse surface via `/_next/image` (open image proxy) and no allowlist on remote image sources.
  Status: ✅ RESOLVED (`remotePatterns: []`; not pushed)

Q-01-003  [LOW]  ✅ REMOVED 2026-06-19 (Session 1, 01-LOW) — deleted the stray tracked backup `prisma.config.ts.bak` via `git rm`; see CHANGELOG.md. — Stray tracked backup `prisma.config.ts.bak` — repo root
  Evidence: `git ls-files prisma.config.ts.bak` returned the path; it had drifted from the live `prisma.config.ts` (old `engineType:"binary"` + explicit `provider` with `@ts-expect-error`, and missing the live config's `migrations`/seed block). Zero importers/scripts; `.bak` extension → invisible to `tsc`/`eslint` (outside the CI gate).
  Impact: Committed dead cruft; risk of drift between the live config and the stale backup.
  Status: ✅ REMOVED (file deleted in working tree; not pushed)

Q-01-004  [LOW]  Lint rules downgraded to warnings hide debt — eslint.config.mjs (ratchet block ~:20-40)  ·  Reviewed 2026-06-19 (Session 1): kept OPEN (owner). **Burndown pass 1, 2026-06-23 (later):** corrected the baseline (eslint was double-counting a stale leftover `.claude/worktrees/` Workflow worktree → added it to `ignores`), then (passes 1 + 2) **637 → 518 warnings / 0 errors**, with **11 rules burned to 0 and LOCKED warn→error** — pass 1: ban-ts-comment, no-empty-object-type, no-require-imports, no-wrapper-object-types, prefer-const, react/no-unescaped-entities, jsx-a11y/alt-text, import/no-anonymous-default-export; pass 2 (react-hooks): error-boundaries, set-state-in-effect, exhaustive-deps. It is a deliberate, commented lint-adoption ratchet — new violations of the LOCKED rules now fail CI — not a defect. See CHANGELOG.md (2026-06-23 burndown passes 1 + 2).
  Evidence: still at `"warn"`: no-explicit-any 273, no-unused-vars 234 (Tier C, owner-paused), no-img-element 11 (all remote/data-URL → intentionally left). The react-hooks trio (error-boundaries/set-state-in-effect/exhaustive-deps) was resolved in pass 2 per the owner's React-Compiler-era guidance: real fixes where safe (error.tsx boundaries, effect-as-event→handler, watch() hoist) + reasoned scoped suppressions for genuine reset/sync/footgun cases (6 disables, each with a reason).
  Impact: Pervasive existing violations of the still-warn rules don't fail CI; type-safety regressions can land as warnings. (Intentional per comment; the 11 locked rules are now enforced.)
  Status: documented (not fixed) — OPEN [LOW]; burndown passes 1 + 2 done 2026-06-23 (Tier A/B + react-hooks), Tier C (no-explicit-any, no-unused-vars) pending sign-off

Q-01-005  [LOW]  ✅ RESOLVED 2026-06-19 (Session 1, 01-LOW) — deleted `verify-seed.ts` (git rm) + `debug-connect.ts` (rm; was gitignored local scratch) and removed both `tsconfig.json` excludes; this also resolves ch.03 Q-03-002. See CHANGELOG.md. — Stray one-off DB-debug scripts tracked/present at root — verify-seed.ts, debug-connect.ts
  Evidence: `verify-seed.ts` was tracked (`git ls-files`); `debug-connect.ts` existed at root but was gitignored (`.gitignore:42`). Both were excluded from typecheck (`tsconfig.json:42-43`), so they were NOT type-checked by CI. (Original draft claim that they are "absent / stale excludes" is FALSE — corrected during verification.)
  Impact: Throwaway connection/seed-verification scripts ship in the tree (or sit untracked) outside the typecheck gate; minor cruft, no runtime path.
  Status: ✅ RESOLVED (both files deleted in working tree; not pushed)

Q-01-007  [INFO]  ✅ RESOLVED 2026-06-19 — dropped `account` from .mcp.json features (least-privilege) (see CHANGELOG.md). Hardcoded Supabase project ref in `.mcp.json` — .mcp.json:5
  Evidence: MCP URL embeds `project_ref=liflosyuonigkiyhwsny` with broad features (database, functions, storage, account).
  Impact: Not a secret (project ref is semi-public) but couples dev tooling to one project; account-scoped MCP features are powerful if a token is present.
  Status: documented (not fixed)
