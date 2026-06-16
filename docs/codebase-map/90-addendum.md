# 90 — Addendum: Coverage-Gap Reference

This file documents source files that were missed by the main codebase map. Each
entry is written from a full read of the actual code (trust code, not docs).

---

## `src/types/index.ts`

### Role

Intended to be the project's central barrel for **shared TypeScript types**. In
practice it is an **empty scaffold stub** — a placeholder generated when the
`src/types/` directory was created, never filled in.

The entire file is four lines, all comments:

```ts
// Export shared types here
// Example:
// export type { User } from "@prisma/client";
```

There is **no executable code and no exports** — only a usage hint pointing at the
intended pattern (re-exporting Prisma-generated types such as `User`).

### Key exports

**None.** The file exports nothing. The single illustrative `export type { User }
from "@prisma/client";` line is commented out and is documentation, not code.

### Server / client

Not applicable. A pure (would-be) type module is erased at compile time and is
neither server- nor client-specific. There is no `"use client"`/`"use server"`
directive and nothing runtime to classify. As written, importing it would yield an
empty module.

### Auth / tenancy

None. No auth, session, or tenant (`familyId` / household-scoping) logic. Pure type
surface by intent.

### Prisma models

None directly. The commented example references the Prisma `User` model
(`@prisma/client`) only to illustrate the re-export pattern. No model is actually
imported or re-exported.

### External dependencies

None active. The only dependency *mentioned* (in the comment) is `@prisma/client`.
At its current state the file pulls in nothing.

### Bug / dead-code / drift

This is the load-bearing finding for this file:

- **Dead / unused scaffold.** `src/types/index.ts` is the only file in `src/types/`
  and is an untouched stub. A repo-wide search for imports of `@/types`, `@/types/*`,
  or `src/types` returns **zero hits** — nothing in the codebase imports from it.
- **The "shared types" pattern lives elsewhere (drift).** The project did adopt the
  intended convention, but *colocated* next to features rather than centralized in
  `src/types/`. Verified examples of where shared/domain types actually live:
  - `@/lib/context/context-types` — e.g. `ContextSuggestion`, plus the
    `getContextImpactDescription` helper (imported by
    `src/components/context/ContextCompleteness.tsx`).
  - `@/components/transcript/types` — `TranscriptData`, `TranscriptCourse`,
    `StudentInfo`, `SchoolInfo` (imported by `src/server/actions/transcript.ts`).
  - `@/inngest/types` — Inngest event `schema` (imported by `src/inngest/client.ts`).
  - `@/lib/safety/types` — `SafetyResolution` (imported by
    `src/inngest/functions/safety-scan.ts`).

  So the central barrel was never used; types are scattered into per-domain
  `types.ts` / `*-types.ts` modules. `src/types/index.ts` represents the abandoned
  original plan.

- **Path alias note.** `@/*` is wired in `tsconfig.json` (`paths`), so `@/types`
  *would* resolve to this file if anyone imported it — but no one does.

### Flows

No flow passes through this file. It is reachable in principle via the `@/types`
alias but is import-dead. Removing it would have no functional effect; it persists
only as boilerplate.

### Recommendation (informational)

Either delete `src/types/` (it is unused boilerplate) or actually adopt it as the
shared-types barrel and migrate the scattered `*-types.ts` modules behind it. As of
this audit it is purely vestigial.
