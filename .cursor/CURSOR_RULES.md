---
alwaysApply: true
---

## 📂 Project Structure & Conventions

  * **App Router:** `src/app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`.
  * **Internal API:** `src/server/api/routers/*.ts` (tRPC).
  * **Database:** `prisma/schema.prisma` defines models.
  * **Components:** `src/components/*.tsx`. Use PascalCase.
  * **Utils:** `src/lib/*.ts` or `src/utils/*.ts`. Use camelCase.

### File Strategy

  * **Colocation:** Keep feature-specific components near their routes if not reusable.
  * **Server Components First:** Default to RSC. Use `"use client"` only for hooks, event handlers, and browser APIs.
  * **Exports:** Export shared types from `src/types`.

-----

## 💻 Coding Rules

### 1\. General Principles

  * **Type Safety:** No `any`. Use `unknown` + refinement if necessary. Infer types from Zod schemas (`z.infer`).
  * **Composition:** Prefer small, functional components. Avoid classes.
  * **Security First:** Validate all inputs at the boundary. No secrets in client code.

### 2\. Next.js 16 (App Router)

  * **Version:** Next.js 16.0.7 (Active LTS, requires Node.js 20.9+)
  * **Data Fetching:**
      * **Server Components:** Fetch directly via Prisma or tRPC caller.
      * **Client Components:** Use tRPC hooks (`api.router.procedure.useQuery`).
  * **Server Actions:** Use for form mutations. Wrap in `try/catch` and return structured responses.
  * **Layouts:** Use nested layouts for navigation/shells.

### 3\. Database (Prisma 7 + Postgres)

  * **Version:** Prisma 7.2.0 (Rust-free client, ESM-first)
  * **Generator:** Use `provider = "prisma-client"` in `schema.prisma` (Prisma 7 standard).
  * **Schema:** Define models in `prisma/schema.prisma`. Use `PascalCase` for models.
  * **Migrations:** Use `prisma migrate`. Never manually hack the DB.
  * **Access:** Rely on Prisma. Avoid raw SQL unless strictly necessary (and then parameterize).
  * **Efficiency:** Use `include` and `select` to prevent over-fetching.
  * **📖 Academic Spine:** See `.cursor/CURRICULUM_INTEGRATION_GUIDE.mdc` for Academic Spine data structure, seeding strategy, and curriculum integration patterns.

### 4\. tRPC v11 & API

  * **Version:** tRPC 11.7.2 (stable v11 release)
  * **Structure:** Routers in `src/server/api/routers`.
  * **Procedures:**
      * `publicProcedure` for public access.
      * `protectedProcedure` for authenticated users.
  * **Validation:** Every procedure MUST have a `.input(zodSchema)`.
  * **Error Handling:** Throw `TRPCError` with specific codes (`UNAUTHORIZED`, `NOT_FOUND`).

### 5\. Authentication (Auth.js v5)

  * **Version:** NextAuth.js v5.0.0-beta.30 (Auth.js v5 standard for T3 stack)
  * **Adapter:** `@auth/prisma-adapter@^2.11.1`
  * **Server Side:** Use `auth()` from `@/server/auth` to validate requests (v5 API).
  * **Client Side:** Never trust the session payload alone for security. Re-verify on server.
  * **Secrets:** Store secrets in env vars only. Access via typed env module.

### 6\. Forms & Validation (Zod v4 + React Hook Form)

  * **Zod Version:** 4.1.13 (⚠️ Breaking changes from v3 - review `z.infer` usage)
  * **React Hook Form:** 7.68.0
  * **Resolver:** `@hookform/resolvers@^5.2.2`
  * **Schema First:** Define Zod schema -\> Infer Type -\> Create Form.
  * **Integration:** Use `zodResolver` with React Hook Form.
  * **UI:** Use Shadcn/UI Form components.
  * **Safety:** Never trust `req.body` or `FormData` without Zod validation.

### 7\. State Management

  * **Server State:** TanStack Query 5.90.12 (via tRPC).
  * **URL State:** Nuqs 2.8.3 (for search params, filters, pagination).
  * **Global Client State:** Zustand 5.0.9 (only for UI state like modals, sidebar toggle).

-----

## 🛡️ Critical Security Instructions

1.  **No Secrets:** Never commit `.env`. Never expose API keys to client.
2.  **Input Validation:** ALL Server Actions and API endpoints must validate inputs with Zod.
3.  **Auth Checks:** ALL protected routes must check session existence before executing logic.
4.  **No Hallucinations:** Do not install npm packages unless explicitly requested.

-----

## 🤖 AI Model Configuration

  * **Models:** Gemini 3 Pro, Gemini 2.5 Pro, Flash, and Flash-Lite with intelligent task-based selection
  * **Provider:** `@ai-sdk/google` (Vercel AI SDK)
  * **Configuration:** `src/lib/ai/config.ts`
  * **Selection Strategy:**
      * **Gemini 3 Pro** ($2/$12): Highest complexity, personality profiling, advanced reasoning
      * **Gemini 2.5 Pro** ($1.25/$10): Complex reasoning, multi-step tasks (cost-effective alternative)
      * **Flash** ($0.30/$2.50): Most content generation, Generative UI, quizzes
      * **Flash-Lite** ($0.10/$0.40): Simple tasks, summarization, text transformations
  * **Usage:** Use `getModelForTask(AITaskType)` for automatic selection
  * **Embeddings:** OpenAI `text-embedding-3-small` (1536 dimensions)
  * **Reference:** [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
  * **📖 Detailed Strategy:** See `.cursor/GEMINI_STRATEGY.mdc` for complete model selection guidelines, cost optimization, and task-based routing

## 📚 Canonical Documentation Reference

  * [Next.js 16 App Router](https://nextjs.org/docs/app)
  * [Tailwind CSS v4](https://tailwindcss.com/docs)
  * [tRPC v11](https://trpc.io/docs)
  * [Prisma 7](https://www.prisma.io/docs)
  * [Auth.js v5](https://authjs.dev)
  * [Gemini 3 API](https://ai.google.dev/gemini-api/docs/gemini-3)
  * [Vercel AI SDK](https://sdk.vercel.ai)
  * [Zod v4](https://zod.dev) (⚠️ Breaking changes from v3)
  * [Shadcn/UI](https://ui.shadcn.com/docs)
  * [React Hook Form](https://react-hook-form.com)
  * [TanStack Query](https://tanstack.com/query/latest)
  * [Nuqs](https://nuqs.47ng.com)
  * [React Email](https://react.email/docs)

## 📖 Project-Specific Documentation

**Essential Reading for Understanding This Codebase:**

  * **`.cursor/CURRICULUM_INTEGRATION_GUIDE.mdc`** - Academic Spine architecture, curriculum data flow, and "No Blank Canvases" philosophy. **Required reading** before working on curriculum features, generators, or course builder.
  
  * **`.cursor/FEATURES_OVERVIEW.mdc`** - Complete feature specifications, user flows, and implementation details for all major features (Family Blueprint, Student Assessment, Living Library, Generators, Course Builder, Grading).
  
  * **`.cursor/GEMINI_STRATEGY.mdc`** - AI model selection strategy, task-based model routing, cost optimization, and Gemini API configuration. **Required reading** before implementing any AI features.

**When to Reference:**
- **CURRICULUM_INTEGRATION_GUIDE**: When working with Academic Spine data, ResourceKinds, generators, or course building
- **FEATURES_OVERVIEW**: When implementing new features or understanding existing feature requirements
- **GEMINI_STRATEGY**: When adding AI functionality, selecting models, or optimizing AI costs

## 📦 Package Versions (December 2025)

**Core Framework:**
- Next.js: `16.0.7` (Active LTS)
- React: `19.2.1`
- React DOM: `19.2.1`
- TypeScript: `5.9.3`
- Node.js Types: `@types/node@^24.10.1` (Node.js 24 Active LTS)

**Styling:**
- Tailwind CSS: `4.1.17`
- tailwind-merge: `3.4.0`
- Phosphor Icons: `@phosphor-icons/react@^2.1.10`

**Database & ORM:**
- Prisma: `7.1.0` (Rust-free client)
- @prisma/client: `7.1.0`

**API & Data Fetching:**
- tRPC: `11.7.2` (stable v11)
- @trpc/server: `11.7.2`
- @trpc/client: `11.7.2`
- @trpc/react-query: `11.7.2`
- @trpc/next: `11.7.2`
- TanStack Query: `5.90.12`
- superjson: `2.2.6`

**Authentication:**
- next-auth: `5.0.0-beta.30` (Auth.js v5)
- @auth/prisma-adapter: `2.11.1`

**Forms & Validation:**
- React Hook Form: `7.68.0`
- @hookform/resolvers: `5.2.2`
- Zod: `4.1.13` (⚠️ Breaking changes from v3)

**State Management:**
- Zustand: `5.0.9`
- Nuqs: `2.8.3`

**Utilities:**
- clsx: `2.1.1`
- class-variance-authority: `0.7.0`
- @radix-ui/react-slot: `1.1.0`

**Development:**
- eslint: `9.15.0`
- eslint-config-next: `16.0.7`
- tsx: `4.21.0`
- js-yaml: `4.1.0`

<!-- end list -->