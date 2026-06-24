# Quill & Compass

An AI-assisted homeschool platform: curriculum generation, a living resource library,
planning/scheduling, grading, transcripts, and family discipleship — built for a single
family/organization tenant model.

> **Architecture reference:** the authoritative, verified map of this codebase lives in
> [`docs/codebase-map/`](docs/codebase-map/00-INDEX.md) (24 chapters + a findings register).
> Start there for anything beyond getting the app running. The design system is documented in
> [`design.md`](design.md).

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript 5.9 (strict)
- **Database/ORM:** PostgreSQL (Supabase) via Prisma 7 (`@prisma/adapter-pg`)
- **Auth:** NextAuth (Auth.js) v5 — Google OAuth, JWT sessions
- **AI:** Vercel AI SDK — Google Gemini (primary); OpenAI-compatible models also wired
- **Background jobs:** Inngest
- **Storage:** Firebase Admin (server-side document storage)
- **Styling/UI:** Tailwind CSS v4, Radix UI via shadcn/ui (lucide icons)
- **Editor / content:** Tiptap, react-markdown + KaTeX
- **Validation:** Zod
- **Tests:** Vitest

> Note: the production build uses **webpack** (`next build --webpack`), not Turbopack.

## Prerequisites

- **Node.js ≥ 24** (see [`.nvmrc`](.nvmrc))
- A **PostgreSQL** database (the project targets Supabase Postgres)
- npm

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then fill in the values (see comments in .env.example)

# 3. Generate the Prisma client + re-export shim
npm run db:generate
npm run postgenerate

# 4. Apply the schema (choose one)
npm run db:migrate   # migration history (dev)
# or: npm run db:push   # push schema without migrations

# 5. (Optional) Seed reference/content data
npm run db:seed
#   plus, as needed:
#   npm run db:seed:generators db:seed:discipleship db:seed:counties \
#           db:seed:catechisms db:seed:commentary

# 6. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

## npm scripts

| Script | Purpose |
|---|---|
| `dev` | Start the Next.js dev server |
| `build` | `prisma generate` → `postgenerate` shim → `next build --webpack` |
| `start` | Start the production server |
| `lint` | `eslint .` (flat config; see `eslint.config.mjs`) |
| `test` | `vitest run` |
| `db:generate` | `prisma generate` |
| `db:push` | `prisma db push` |
| `db:migrate` | `prisma migrate dev` |
| `db:studio` | `prisma studio` |
| `db:seed` | Seed base data (`prisma/seed.ts`) |
| `db:seed:generators` | Seed generator content types |
| `db:seed:discipleship` | Seed discipleship content |
| `db:seed:counties` | Seed counties data |
| `db:seed:catechisms` | Seed catechism corpus |
| `db:seed:commentary` | Seed commentary corpus |

## Project layout

- `src/app/` — App Router routes, layouts, and server actions (`src/app/actions/`)
- `src/server/` — server-side data layer (Prisma client, actions, profiles)
- `src/lib/` — utilities, AI/prompt builders, API clients, schemas
- `src/components/` — React components (Server Components by default)
- `src/generated/` — generated Prisma client (do not edit)
- `prisma/` — schema, migrations, and seed scripts
- `docs/codebase-map/` — the verified architecture map (read this first)
- `public/` — static assets (`/assets/branding/*`)

## Configuration & secrets

All runtime configuration is via environment variables — see
[`.env.example`](.env.example) for the full list with grouped comments. Do not commit a
populated `.env`.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on push/PR to `main`:
`npm ci` → `prisma generate` → `postgenerate` → `tsc --noEmit` → `eslint .` → `vitest run`.
No database or secrets are required (Prisma generate does not connect).
