# Thinkling (Student AI Chat) & Child-Safety Pipeline

> Code-truth reference. Verified against source on 2026-06-15. Where this doc and
> repo prose/comments disagree, **the code wins**. Citations are `path:line`.

## Purpose & role in the app

**Thinkling** is the student-facing AI chat assistant (brand name "Inkling,
supercharged"). A signed-in caregiver/teacher picks one of their organization's
students and one of three pedagogical **modes** (Subject Tutor, Research
Assistant, College & Career), then chats. The chat is streamed from Google
Gemini Flash with a system prompt assembled from the student's learner profile +
mode + a hard-coded ethics/safeguarding charter.

Bolted onto every user turn is a **child-safety pipeline**: the chat route fires
an Inngest event for each user message; a background function (`scanMessage`)
runs a two-stage assessment (regex fast-path + LLM deep-path), applies a
deterministic **policy decision matrix**, writes a `SafetyFlag` row, runs
**pattern escalation** over recent flags, and — only for the two
`PARENT_SUMMARY_*` resolutions — emails caregivers via Resend. The pipeline's
defining principle is **"Minimum Social Responsibility"**: if a caregiver is
implicated in the harm or the child fears disclosure, **no caregiver is
notified** (`policy.ts:5-22`).

Note the operational reality: chat is gated by login but **not by role** — the
"student" is a `Student` record selected from a dropdown, not the logged-in
principal. There is currently **no UI anywhere that surfaces `SafetyFlag`
records to caregivers** — the only output path is the Resend email.

## File-by-file reference

### `src/app/thinkling/page.tsx` — Thinkling route (Server Component)
- **Role:** Server page at `/thinkling`. Auth gate + tenancy + loads the org's
  students, then renders the client shell.
- **Server/client:** Server Component (async, no `"use client"`).
- **Auth/tenancy:** `auth()` → redirect `/login` if no session (`:13-17`);
  `getCurrentUserOrg()` → redirect `/onboarding` if no org (`:19-22`).
  `db.student.findMany({ where: { organizationId } })` is correctly org-scoped
  (`:24-33`). **No role check** — any authenticated org member (OWNER, ADMIN,
  TEACHER, PARENT) can open Thinkling for any student in the org.
- **Prisma:** reads `Student` (`id, preferredName, firstName, lastName`).
- **Exports:** `metadata`, default `ThinklingPage`.

### `src/components/thinkling/ThinklingClient.tsx` — client shell (`"use client"`)
- **Role:** Holds the two pieces of UI state: `selectedStudentId` (defaults to
  first student, `:23`) and `mode` (defaults `"TUTOR"`, `:24`). Renders the
  student `<Select>` and the `<ThinklingChat>` interface.
- **Notable:** `<ThinklingChat key={selectedStudentId} ...>` (`:74`) — keying on
  student id forces a full remount (and thus fresh `useChat` state) when the
  student changes. Empty-state card if the org has no students (`:26-37`).
- **Props:** `students: {id, preferredName, firstName, lastName}[]`.

### `src/components/thinkling/ThinklingChat.tsx` — chat UI (`"use client"`)
- **Role:** The actual chat surface. Uses `@ai-sdk/react` `useChat` (`:30`) to
  manage messages/streaming against `/api/chat`.
- **Transport quirk (important):** `apiUrl` with query params is computed
  (`:28`) but **the `api` option is commented out** (`:31`) — `useChat` defaults
  to `POST /api/chat`. Student/mode are instead passed per-send via
  `sendMessage({ role, content }, { body: { studentId, mode } })` (`:86-91`).
  The query-param fallback in the route (`route.ts:28-33`) is therefore dead in
  the normal path but kept as a belt-and-suspenders.
- **Message shape handling:** Renders `m.content` OR joins `m.parts[].text`
  (`:146-150`) to tolerate both legacy string content and the SDK's UIMessage
  `parts` array. `onFinish` manually appends the final message if the stream
  didn't update the UI (`:35-52`) — a workaround for SDK-version flakiness.
- **Resets:** `useEffect` clears messages on `mode`/`studentId` change (`:68-71`).
- **Markdown:** `react-markdown` + GFM + breaks + KaTeX math (`:10-15`,
  `:133-145`).
- **Smells:** several `@ts-ignore`/`as any` casts (`:85-89`), leftover debug
  `console.log` on every assistant render (`:120`), duplicated commented lines.

### `src/components/thinkling/ModeSelector.tsx` — mode buttons (`"use client"`)
- **Role:** Renders three mode buttons from a local `MODES` array (`:13-38`):
  `TUTOR` / `RESEARCH` / `CAREER`. Pure presentational; calls
  `onSelectMode(mode.id)`.
- **Drift note:** the visible label for `CAREER` is "College & Career" with a
  `Compass` icon; `Scales` is imported (`:5`) but unused.

### `src/lib/thinkling.ts` — system-prompt assembly (server module)
- **Role:** `getContextForThinkling(studentId, mode)` builds the Gemini system
  prompt. Loads the student with `learnerProfile` + `courseEnrollments.course.subject`
  (`:11-23`), throws "Student not found" if missing (`:25-27`).
- **Prompt contents (`:35-115`):** a `basePrompt` containing the student name,
  grade, course titles, JSON-stringified `interestsData`/`learningStyleData`,
  plus a hard-coded charter:
  - **CRITICAL ETHICAL GUIDELINES** — "TOOL and SERVANT, not teacher/companion";
    no relational bonding; do not replace the teacher; **do not lead worship**;
    Socratic guidance vs. answers (factual recall may be answered + challenged;
    skill application must NOT be answered).
  - **SAFEGUARDING PROTOCOL** — neutral acknowledgment on disclosure of
    self-harm/abuse/grooming; explicit "we'll be careful about who gets notified"
    language for in-home abusers; tells the model a monitoring system exists.
  - **FORMATTING** rules (double line breaks, bullets).
  - A per-mode `specificPrompt` appended (`:90-115`).
- **Bugs/drift:**
  - Duplicate guideline #3 "DO NOT LEAD WORSHIP" appears twice (`:47-48`); and
    the numbered list jumps 1,2,3,3,4 (mis-numbered).
  - Typo "ALWAYS uses BULLET POINTS" (`:72`).
  - The `ThinklingContext.studentName` is returned but the **route ignores it**
    (route only destructures `systemPrompt`, `route.ts:56`).
- **Exports:** `type ThinklingMode = "TUTOR" | "RESEARCH" | "CAREER"`,
  `getContextForThinkling`.

### `src/app/api/chat/route.ts` — chat streaming endpoint (Route Handler)
- **Role:** `POST /api/chat`. Streams Gemini Flash and fires the safety event.
- **Server/runtime:** `export const dynamic = "force-dynamic"` (`:6`),
  `maxDuration = 30` (`:10`). Standard Node route handler.
- **Auth/tenancy:**
  1. `auth()` → 401 if no session (`:14-20`).
  2. Requires `studentId` + `mode` (body, falling back to query params) → 400 if
     missing (`:29-45`).
  3. **Multi-tenant guard (`:48-54`):** loads the `Student`, compares its
     `organizationId` to `getCurrentUserOrg().organizationId`; **403** if the
     student is not in the caller's org. This is the real IDOR protection.
- **Flow:**
  - `getContextForThinkling(studentId, mode)` → `systemPrompt` (`:56`).
  - Normalizes UIMessages to `{role, content}` core messages, joining `parts`
    when `content` is absent (`:60-69`).
  - **Safety hook (`:73-82`):** if the last message is from `user`, fires
    `inngest.send({ name: "chat/message.sent", data: { studentId, message }})`.
    This `await` blocks the response until the event is *enqueued* (not
    processed); the scan itself runs in the background.
  - `streamText({ model: models.flash, system, messages })` (`:85-89`) and
    returns `toDataStreamResponse()` (with `toUIMessageStreamResponse()`
    fallback, `:94`).
- **Bugs/smells:**
  - Heavy `console.log` of full request JSON including raw message content
    (`:13,15,22-23`) — logs student chat text, a privacy concern.
  - Only the **last** message is scanned; a multi-turn payload's earlier user
    turns are never re-scanned (acceptable since each turn POSTs).
  - `@ts-ignore` on the response method (`:93`).
  - Streaming itself is **not blocked** on the safety result — an unsafe message
    is answered by the model in real time; flagging/alerting is fully async and
    after-the-fact. The model's own safeguarding prompt is the only synchronous
    guardrail.

### `src/lib/safety/types.ts` — shared safety types
- `SafetyResolution` union (6 values: `NO_ACTION`, `PARENT_SUMMARY_SAFETY_COACH`,
  `PARENT_SUMMARY_URGENT`, `SUPPORTIVE_ONLY`, `STUDENT_OPTIONAL_OUTREACH`,
  `INTERNAL_LOG_ONLY`).
- `SafetyAssessment` interface — the rich assessment object: `isSafe`,
  `severity` (CONCERN/DANGER/SAFE/TIER_1/TIER_2/TIER_3), `category`,
  `implicatedCaregiver`, `reasoning`, plus nuance fields `evidenceLevel`,
  `target`, `relationshipToTarget`, `coercion`, `ageGap`, `disclosureRisk`, and
  optional `recommendedResolution`.

### `src/lib/safety/guard.ts` — detection (`assessMessageSafety`)
- **Role:** Two-stage classifier returning a `SafetyAssessment`.
- **Stage 1 — `SafetyRegexEngine` fast-path (`:42-134`):**
  - **Negation guard (`:97-99`):** returns `null` (safe) if text matches
    `not/never/don't want to ... kill|hurt|suicide`.
  - **Whitelist (`:44-48,91-93`):** academic contexts (health class, biology,
    "we studied", "reproduction", etc.) short-circuit to safe.
  - **Caregiver/fear detection (`:51-52,106-110`):** `caregiverRegex` flags a
    parent/teacher/relative as the source of harm; `fearRegex` detects
    "don't tell mom"-style fear → sets `disclosureRisk = "HIGH"`.
  - **Pattern list (`:54-89`):** SELF_HARM (TIER_1 intent / TIER_2 action),
    physical abuse (BULLYING TIER_1 victim disclosure), INCEST thought vs action,
    VIOLENCE threat. First match returns immediately with hard-coded
    `target: "SELF"` and `relationshipToTarget: "OTHER"` defaults (`:123-124`) —
    a known coarseness of the fast-path.
- **Stage 2 — LLM deep-path (`:144-166`):** if no regex hit, calls
  `generateObject({ model: models.flashLite, schema: safetySchema, prompt })`.
  The Zod `safetySchema` (`:6-26`) mirrors `SafetyAssessment`. The prompt
  embeds the raw student message via template literal (`:163`) — **prompt-
  injection surface** (no escaping/delimiting).
- **Fail-open (`:167-182`):** on any LLM error it returns
  `{ isSafe: true, severity: "SAFE", ... }` — i.e. a deep-path failure silently
  treats the message as safe (no flag, no alert).
- **External:** `ai` SDK `generateObject`, `models.flashLite` (Gemini
  2.5 Flash-Lite), `zod`.

### `src/lib/safety/policy.ts` — decision matrix (`decideSafetyResolution`)
- **Role:** Pure function mapping a `SafetyAssessment` → `SafetyResolution`.
  No I/O, no Prisma.
- **Precedence (`:11-67`):**
  1. **HARD STOPS (`:13-22`):** if `implicatedCaregiver` OR
     `disclosureRisk === "HIGH"` → never notify a caregiver. DANGER/TIER_1 →
     `SUPPORTIVE_ONLY`; CONCERN/TIER_2/TIER_3 → `STUDENT_OPTIONAL_OUTREACH`;
     else `INTERNAL_LOG_ONLY`.
  2. **Urgent danger (`:24-35`):** `severity === "DANGER"` →
     `PARENT_SUMMARY_URGENT`; also PLAN/ACTION/VICTIM_DISCLOSURE self/other-child
     TIER_1/2 self-harm/violence → urgent.
  3. **Sibling/incest (`:38-50`):** action/coercion → `PARENT_SUMMARY_SAFETY_COACH`;
     thought-only → `STUDENT_OPTIONAL_OUTREACH`.
  4. **Default by severity (`:52-66`):** SAFE→NO_ACTION, TIER_3→INTERNAL_LOG_ONLY,
     CONCERN/TIER_2→STUDENT_OPTIONAL_OUTREACH, TIER_1→PARENT_SUMMARY_SAFETY_COACH.
- **Key invariant:** only `PARENT_SUMMARY_SAFETY_COACH` and
  `PARENT_SUMMARY_URGENT` ever cause an email (enforced downstream in
  `safety-scan.ts:85`). All other resolutions are silent server-side; **the
  "bot offers help lines / suggests talking to someone" behaviors implied by
  `SUPPORTIVE_ONLY` / `STUDENT_OPTIONAL_OUTREACH` are NOT implemented** —
  nothing feeds the resolution back into the live chat response.

### `src/inngest/functions/safety-scan.ts` — orchestrator (`scanMessage`)
- **Role:** Inngest function `id: "scan-chat-message"`, triggered by
  `event: "chat/message.sent"` (`:8-11`). Registered in
  `src/app/api/inngest/route.ts:11`.
- **Pipeline (`:12-96`):**
  1. Skip empty/non-string messages (`:14-16`).
  2. `assessMessageSafety(message)` (`:19`).
  3. `decideSafetyResolution(result)` (`:22`).
  4. **Pattern escalation (`:25-64`):** for non-hard-stop unsafe results, loads
     `SafetyFlag`s from the last 10 days for the student (`:30-40`). Rule A:
     `>=2` prior flags in the same `category` (+current = 3) escalates. Rule B:
     a prior flag whose stored reasoning contains `[EVIDENCE:THOUGHT]` plus a
     current PLAN/ACTION/INTENT escalates. Escalation bumps
     `STUDENT_OPTIONAL_OUTREACH → SAFETY_COACH → URGENT` (`:57-62`).
  5. **Store (`:66-82`):** if `!isSafe`, creates a `SafetyFlag` with the
     **first 100 chars** of the message (data minimization, `:76`) and embeds
     `[EVIDENCE:<level>]` prefix into `reasoning` (`:78`) so future runs can
     parse evidence escalation.
  6. **Act (`:84-92`):** only `PARENT_SUMMARY_*` resolutions call
     `sendSafetyAlert(flag.id)`; logs LOUDLY if delivery fails (`:87-89`);
     otherwise logs that notification was suppressed (`:91`).
- **Notes:**
  - **Tenancy:** the function trusts the `studentId` from the event; it does no
    org check (the chat route already verified org membership before sending the
    event). `SafetyFlag` has no `organizationId` column — tenancy is derived via
    `student.organization` at alert time.
  - The escalation `findMany` is **not wrapped in `step.run`** — if the function
    retries after a partial failure, the DB read/writes re-execute (no
    idempotency / step memoization is used anywhere here).
  - `recommendedResolution` from the LLM schema is computed but **never used**
    by policy or storage.

### `src/lib/notifications/safety-alert.ts` — caregiver email (`sendSafetyAlert`)
- **Role:** Loads the flag with `student → organization → users` (`:25-36`),
  computes recipients, renders text+HTML, sends via Resend, and **only on
  confirmed delivery** sets `safetyFlag.alertSent = true` (`:147`).
- **Recipients (`:44-46`):** org users with an email whose `role` is `OWNER`,
  `PARENT`, or `ADMIN`. **`TEACHER` is deliberately excluded.** Matches the
  `UserRole` enum (OWNER/TEACHER/ADMIN/PARENT, `schema.prisma:918-923`).
- **Privacy:** strips the `[EVIDENCE:...]` prefix from reasoning (`:50`); HTML-
  escapes interpolated values via `esc()` (`:4-5`, XSS-safe); the email
  **excludes the raw message content** by design (`:92,105`).
- **Guidance copy:** different text/HTML for `SAFETY_COACH` (calm, no
  shame/punishment) vs `URGENT` (call emergency services) (`:52-74`).
- **`alertSent` semantics / fail-loud invariant (`:13-23,108-152`):** the flag
  is marked sent **only** after Resend returns no error. Three fail paths return
  `{ sent: false }` and never flip `alertSent`:
  1. `RESEND_API_KEY` missing → "Email provider not configured" (`:114-121`).
  2. No caregiver recipients in the org → "No caregiver recipients"
     (`:129-135`) — a detected concern with **no one to notify**.
  3. Resend send error/exception (`:141-152`).
  This guarantees the system never *claims* an abuse/self-harm alert was
  delivered when it wasn't.
- **Resend domain-verification gap (KNOWN):** `from` defaults to Resend's test
  sender `onboarding@resend.dev` when `SAFETY_ALERT_FROM` is unset
  (`:113,122-128`) — that sender **only delivers to the Resend account owner**,
  so caregiver emails silently won't arrive in dev. In `.env`,
  `SAFETY_ALERT_FROM="Quill & Compass Safety <safety@quillandcompass.app>"`
  (`.env:55`) — **but that domain must be verified in the Resend dashboard or
  the send returns an error and `alertSent` stays false.** The docstring example
  even uses the wrong TLD (`quillandcompass.com`, `:22`) vs the app's actual
  `quillandcompass.app`. This is the single biggest delivery risk in the
  subsystem.

## Data models & tenancy

- **`SafetyFlag`** (`prisma/schema.prisma:317-334`, table `safety_flags`):
  `id, studentId, severity, category, message, reasoning, isResolved (false),
  alertSent (false), resolution?, implicatedCaregiver (false), createdAt,
  resolvedAt?`; relation `student` (cascade delete). Columns are loose `String`
  (no DB enums) — severities/categories/resolutions are app-level strings. The
  schema comments are stale (e.g. `severity // "CONCERN" | "DANGER"` omits the
  TIER_* values actually written).
- **`Student`** (`:279-315`): `organizationId` (`account_id`), `firstName`,
  `lastName?`, `preferredName?`, `currentGrade` (String), `learnerProfile?`,
  `courseEnrollments` (`CourseStudent[]`), `safetyFlags`. The student is the
  tenancy anchor for both prompt assembly and flag/alert resolution.
- **`User`** (`:140-173`): `role: UserRole @default(PARENT)`, `organizationId`
  (`account_id`), `email?`. Caregiver recipients are derived from
  `organization.users`.
- **`LearnerProfile`** (`:350+`): `interestsData` / `learningStyleData` (`Json?`)
  feed the system prompt.
- **Tenancy posture:** org isolation is enforced at the **chat route** (page
  `findMany` by org; POST handler's 403 student-org check). Downstream
  (Inngest + alert) trust the `studentId` and re-derive the org through the
  `Student` relation. `SafetyFlag` itself has no org column.

## Entry points & end-to-end flows

**Reaching Thinkling:** sidebar nav "Thinkling Chat" → `/thinkling`
(`src/components/layout/Sidebar.tsx:29`) and the Inkling toolkit card
(`src/components/navigation/InklingToolkit.tsx:24-27`).

**Flow A — normal chat turn:**
1. Caregiver selects student + mode in `ThinklingClient` → `ThinklingChat`.
2. `handleFormSubmit` → `sendMessage({role:"user",content}, {body:{studentId,mode}})`
   → `POST /api/chat`.
3. Route: `auth()` → param check → **org 403 guard** → `getContextForThinkling`
   builds system prompt.
4. Route fires `chat/message.sent` (await enqueue only), then
   `streamText(models.flash)` streams the reply back to the UI.

**Flow B — safety scan (background, async):**
1. Inngest delivers `chat/message.sent` → `scanMessage`.
2. `assessMessageSafety` (regex → LLM Flash-Lite). Fail-open to "safe" on error.
3. `decideSafetyResolution` → initial resolution.
4. Pattern escalation over last-10-day `SafetyFlag`s (frequency / evidence
   escalation) may upgrade the resolution.
5. If unsafe → create `SafetyFlag` (100-char snippet, `[EVIDENCE:…]` reasoning).
6. If resolution is `PARENT_SUMMARY_*` → `sendSafetyAlert`:
   load org users → filter OWNER/PARENT/ADMIN → render → Resend send → on
   success set `alertSent = true`. All other resolutions: server-side log only,
   **no caregiver output and no student-facing output**.

## External dependencies & services

- **Google Gemini** via `@ai-sdk/google` + `ai` SDK (`src/lib/ai/config.ts`):
  `models.flash` = `gemini-2.5-flash` (chat), `models.flashLite` =
  `gemini-2.5-flash-lite` (safety deep-path). API key shim accepts `GEMINI_API_KEY`
  in place of `GOOGLE_GENERATIVE_AI_API_KEY` (`config.ts:3-6`).
- **Inngest** (`inngest`): client `id: "quillnext"` (`src/inngest/client.ts`),
  typed event `chat/message.sent` (`src/inngest/types.ts:11-29`), served at
  `/api/inngest` (`src/app/api/inngest/route.ts`). Needs
  `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` in prod.
- **Resend** (`resend`): caregiver email. Needs `RESEND_API_KEY` +
  verified-domain `SAFETY_ALERT_FROM`.
- **NextAuth** via `@/auth` `auth()` + `@/lib/auth-helpers` `getCurrentUserOrg`.
- **Prisma** via `@/server/db` `db`.
- **UI:** `@ai-sdk/react` `useChat`, `react-markdown` + `remark-gfm` /
  `remark-breaks` / `remark-math` / `rehype-katex`, `@phosphor-icons/react`,
  shadcn UI primitives.

## Auth / security posture

- **Authentication:** required for the page and the route (`auth()` → redirect /
  401). The Inngest function and `sendSafetyAlert` run server-side/background and
  are not user-authenticated (they trust the verified event).
- **Authorization / tenancy:** enforced at the chat boundary — page query is
  org-scoped; POST handler 403s if the `studentId`'s org ≠ caller's org
  (`route.ts:48-54`). No role gating: any org member can chat as any student.
- **Data minimization:** flags store only a 100-char snippet; alert emails omit
  message content; HTML is `esc()`-escaped. Good.
- **Privacy leak:** chat route `console.log`s the **full request JSON including
  raw user message text** (`route.ts:13,15,22-23`), and `ThinklingChat` logs
  assistant messages — student content lands in server/browser logs.
- **Fail-open detection:** an LLM error in the deep-path returns "safe"
  (`guard.ts:167-182`) — genuine unsafe messages that error out are not flagged.
- **Prompt injection:** the raw student message is string-interpolated into the
  safety classifier prompt (`guard.ts:163`) with no delimiting/escaping.

## Risks, drift, dead-code & half-built

1. **Resend domain-verification gap (highest risk):** without a verified
   `SAFETY_ALERT_FROM` domain in Resend, safety emails either go only to the
   Resend account owner (test sender) or fail outright — caregivers may never be
   alerted. Docstring TLD (`.com`) disagrees with `.env`/app (`.app`).
2. **No caregiver-facing surface for flags:** `SafetyFlag` is written but **no
   page/dashboard reads it** (grep: only pipeline files + schema + docs touch
   `safetyFlag`). `isResolved`/`resolvedAt`/`resolution` are never updated after
   creation — there is no resolution workflow. Email is the only output.
3. **Detection fails open** on LLM error (`guard.ts:167-182`).
4. **Resolutions are partly aspirational:** `SUPPORTIVE_ONLY` and
   `STUDENT_OPTIONAL_OUTREACH` imply the bot offers help lines / nudges the
   student, but nothing wires the resolution back into the live chat. The only
   acted-on resolutions are the two `PARENT_SUMMARY_*`. The chat reply is
   produced independently of the scan.
5. **No Inngest step idempotency:** `scanMessage` does DB reads/writes outside
   `step.run`; on retry it can double-create flags / re-send alerts.
6. **Regex fast-path coarseness:** hard-codes `target:"SELF"`,
   `relationshipToTarget:"OTHER"` for any pattern hit (`guard.ts:123-124`),
   which can misroute the policy matrix (e.g. a sibling-incest regex hit reports
   relationship "OTHER", bypassing the sibling branch in policy).
7. **Privacy logging** of raw messages (route + chat component).
8. **Prompt drift in `thinkling.ts`:** duplicated "DO NOT LEAD WORSHIP" guideline
   (`:47-48`), mis-numbered list, typo "ALWAYS uses BULLET POINTS".
9. **Dead/unused:** `ThinklingContext.studentName` returned but unused by route;
   route query-param fallback (`route.ts:28-33`) unreachable in normal flow;
   `Scales` import unused (`ModeSelector.tsx:5`); LLM `recommendedResolution`
   field computed but never consumed.
10. **Stale schema comments** on `SafetyFlag` (severity/category/resolution
    comments don't list the TIER_*/full values actually stored).
11. **Streaming not safety-gated:** unsafe content is answered live; the only
    synchronous guard is the model's own safeguarding system prompt.

## Cross-links to other subsystems

- **AI config** (`src/lib/ai/config.ts`) — `models.flash` / `models.flashLite`;
  shared model registry. See doc 09 (curriculum compiler) and the AI subsystem.
- **Inngest infra** (`src/inngest/client.ts`, `src/inngest/types.ts`,
  `src/app/api/inngest/route.ts`) — `scanMessage` registered alongside
  `processDocument` + `compileCurriculum`. See docs 01 and 09.
- **Auth/tenancy** (`src/auth.ts`, `src/lib/auth-helpers.ts`) — `auth()` +
  `getCurrentUserOrg`. See doc 04.
- **Data model** (`prisma/schema.prisma`, doc 02) — `Student`, `User`/`UserRole`,
  `LearnerProfile`, `SafetyFlag`, `CourseStudent`.
- **Students / personality** (doc 12) — `LearnerProfile.interestsData` /
  `learningStyleData` consumed by the system prompt.
- **Navigation** — `src/components/layout/Sidebar.tsx`,
  `src/components/navigation/InklingToolkit.tsx` link to `/thinkling`.

## Open questions

1. Is the `quillandcompass.app` sender actually verified in Resend? If not, no
   caregiver alert is being delivered today.
2. Is a caregiver-facing SafetyFlag review/resolution UI planned? Currently
   `isResolved`/`resolution` are write-once and never surfaced or updated.
3. Should the chat stream be blocked / interrupted on a high-severity synchronous
   detection, rather than relying solely on the model's system prompt + async
   flag?
4. Should the safety deep-path fail **closed** (treat errors as potentially
   unsafe / queue for retry) rather than fail open to "safe"?
5. Were the resolution-driven student-facing behaviors (`SUPPORTIVE_ONLY`,
   `STUDENT_OPTIONAL_OUTREACH`) ever intended to alter the live chat reply, or
   are they purely server-side bookkeeping?
6. Should `scanMessage` use Inngest `step.run` for idempotency to avoid duplicate
   flags/alerts on retry?
