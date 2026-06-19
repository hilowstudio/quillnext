# 12 — Child-Safety Subsystem
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope
| File | Role (one line) |
|------|-----------------|
| `src/lib/safety/guard.ts` | Two-stage content-safety detector: regex fast-path (`SafetyRegexEngine`) + LLM deep-path (`assessMessageSafety`) producing a `SafetyAssessment`. |
| `src/lib/safety/policy.ts` | `decideSafetyResolution()` — deterministic decision matrix mapping a `SafetyAssessment` to a `SafetyResolution` (which action to take). |
| `src/lib/safety/types.ts` | Shared types: `SafetyAssessment` (detector output) and `SafetyResolution` (policy output / action enum). |
| `src/lib/notifications/safety-alert.ts` | `sendSafetyAlert(flagId)` — delivers a caregiver email summary via Resend and flips `SafetyFlag.alertSent` only on confirmed delivery. |

Cross-ref: the **only** consumer of all four files is the Inngest job `src/inngest/functions/safety-scan.ts` (`scanMessage`), owned by chapter **23**. SafetyFlag model details are in **02-data-model.md**. RLS/tenancy machinery (`withTenant`, `setRlsContext`) is in **04-security-auth-tenancy.md**.

## 2. Purpose / intent
Monitor student↔Thinkling chat for self-harm, abuse, bullying, violence, grooming, sexual content, and incest/sibling-boundary signals; classify severity and nuance; then decide a *proportionate* response under a stated "Minimum Social Responsibility" principle: only notify caregivers when notification plausibly reduces harm, and **never** notify when the caregiver is the implicated threat or the child fears disclosure/retaliation. Detected concerns become `SafetyFlag` rows; the highest-severity resolutions email caregivers a content-redacted summary.

## 3. Architecture & key files
Pipeline (detect → decide → escalate → store → act):

1. **Detect** (`guard.ts`). `assessMessageSafety(message)` (guard.ts:136):
   - **Fast path**: `SafetyRegexEngine.scan()` (guard.ts:95). Runs a negation check (guard.ts:97), an academic-context whitelist (guard.ts:91/44-48), caregiver-implication regex (guard.ts:51/106), and fear/disclosure regex (guard.ts:52/109), then matches a small pattern table (guard.ts:54-89) covering SELF_HARM, BULLYING/physical-abuse, INCEST (thought vs action), and VIOLENCE. First match returns a hand-built `SafetyAssessment` (guard.ts:116-128).
   - **Deep path**: if no regex match, `generateObject` with `models.flashLite` (Gemini, ai/config.ts:76) against `safetySchema` (guard.ts:6-26) returns the full assessment (guard.ts:166).
2. **Decide** (`policy.ts`). `decideSafetyResolution(assessment)` (policy.ts:11). Precedence: hard-stops (caregiver implicated OR disclosureRisk HIGH → never notify, policy.ts:14-22) → must-notify DANGER / self-harm-or-violence plan/action (policy.ts:26-36) → sibling/incest boundaries (policy.ts:39-50) → default severity switch (policy.ts:53-66).
3. **Escalate** (in job, not here). The `scanMessage` job (safety-scan.ts:32-79) re-checks the same hard-stops, then upgrades resolution one notch if ≥3 same-category flags in 10 days or a THOUGHT→PLAN/ACTION/INTENT escalation is detected from prior flags' `[EVIDENCE:...]` prefix.
4. **Store** (in job). `SafetyFlag.create` (safety-scan.ts:86) with message truncated to 100 chars (data minimization, safety-scan.ts:92) and `reasoning` prefixed `[EVIDENCE:<level>]` (safety-scan.ts:94) so future runs can parse evidence level.
5. **Act** (`safety-alert.ts`). Only `PARENT_SUMMARY_SAFETY_COACH` / `PARENT_SUMMARY_URGENT` resolutions call `sendSafetyAlert(flag.id)` (safety-scan.ts:104-105). All other resolutions only log (safety-scan.ts:110).

`types.ts` is the contract between `guard.ts` (produces `SafetyAssessment`) and `policy.ts` (consumes it, returns `SafetyResolution`).

## 4. Data flow (concrete trace)
- `src/app/api/chat/route.ts:74-85` — on each user chat turn, emits Inngest event `chat/message.sent` with `{ studentId, message, organizationId }`. (Event typed at inngest/types.ts:99.) This is the **sole** entry point; journals/other surfaces do **not** feed safety.
- `safety-scan.ts:15` — worker sets RLS context from the event org (`setRlsContext({ organizationId, userId: null })`); empty/blank messages skip (safety-scan.ts:17-19).
- `safety-scan.ts:22` → `assessMessageSafety` (guard.ts:136) → regex (guard.ts:95) or LLM (guard.ts:145).
- `safety-scan.ts:25` → `decideSafetyResolution` (policy.ts:11).
- `safety-scan.ts:44-55` → `withTenant(... tx.safetyFlag.findMany ...)` reads last-10-day flags (org-scoped via `withTenant`) for pattern escalation.
- `safety-scan.ts:85-101` → `withTenant(... tx.safetyFlag.create ...)` writes the flag (org-scoped).
- `safety-scan.ts:105` → `sendSafetyAlert(flag.id)`:
  - `safety-alert.ts:25-36` — `db.safetyFlag.findUnique` joins `student → organization → users` (raw `db`, NOT `withTenant`).
  - `safety-alert.ts:44-46` — recipients = org users with email and role OWNER/PARENT/ADMIN.
  - `safety-alert.ts:50` — strips `[EVIDENCE:...]` prefix from `reasoning` for the email body.
  - `safety-alert.ts:78-106` — builds text + HTML (HTML escaped via `esc`, safety-alert.ts:4); explicitly excludes raw message content (safety-alert.ts:92,105).
  - `safety-alert.ts:114-135` — fail-loud guards: missing `RESEND_API_KEY` → return `sent:false`; missing `SAFETY_ALERT_FROM` → warn + fall back to `onboarding@resend.dev`; zero recipients → return `sent:false`.
  - `safety-alert.ts:138-147` — Resend send; only on success does `db.safetyFlag.update({ alertSent: true })`.
- **Alert channel = email only (Resend).** No push/SMS/in-app path exists. SafetyFlag rows have **no UI/dashboard reader** anywhere in the repo (grep: only the job + alert function touch `safetyFlag`).

## 5. Status table
| Unit | Status | Evidence |
|------|--------|----------|
| `assessMessageSafety` (guard.ts) | DONE | Wired via safety-scan.ts:22; regex + LLM both implemented (guard.ts:136-183). |
| `SafetyRegexEngine.scan` (guard.ts) | DONE | Called by assessMessageSafety (guard.ts:138); pattern table populated (guard.ts:54-89). |
| LLM deep-path error handler (guard.ts:167-182) | PARTIAL | Catch returns `isSafe:true` (fail-open) — model outage silently suppresses detection. See Q-12-001. |
| `decideSafetyResolution` (policy.ts) | DONE | Wired via safety-scan.ts:25; full matrix implemented (policy.ts:11-67). |
| `sendSafetyAlert` (safety-alert.ts) | DONE | Wired via safety-scan.ts:105; Resend send + alertSent gating implemented (safety-alert.ts:137-148). |
| `SafetyAssessment` / `SafetyResolution` types (types.ts) | DONE | Imported by guard.ts:4, policy.ts:1, safety-scan.ts:6. |
| `recommendedResolution` field (types.ts:23, guard.ts:18-25) | DEAD | Grep: defined in schema + type but never read; policy re-derives deterministically. See Q-12-002. |
| Severity values `CONCERN`/`DANGER`/`SAFE`/`TIER_3` | PARTIAL | Regex path only emits TIER_1/TIER_2 (guard.ts:59,64,70,76,81,87); `DANGER`/`CONCERN`/`SAFE`/`TIER_3` producible only by LLM (guard.ts:8); `severity` is a free `String` (schema.prisma:323) so nothing enforces consistency and vocabularies drift. See Q-12-003. |

## 6. Integration points
- **Imports in (guard.ts):** `ai` (`generateObject`), `@/lib/ai/config` (`models.flashLite`, ai/config.ts:76), `zod`, `./types`.
- **Imports in (policy.ts):** `./types` only.
- **Imports in (safety-alert.ts):** `@/server/db` (raw `db`), `resend`.
- **Importers out:** ONLY `src/inngest/functions/safety-scan.ts` (`scanMessage`), registered at `src/app/api/inngest/route.ts:4,29`. Triggered by `chat/message.sent` emitted at `src/app/api/chat/route.ts:75`.
- **Env vars:** `RESEND_API_KEY` (required to send), `SAFETY_ALERT_FROM` (Resend-verified sender; falls back to `onboarding@resend.dev`). Both only read in safety-alert.ts:109,113,122.
- **External APIs:** Google Gemini (`gemini-3.1-flash-lite`) via Vercel AI SDK; Resend email API.
- **Prisma models used:** `SafetyFlag` (read/create/update), via relation `Learner` (`student`) → `Organization` → `User` (safety-alert.ts:27-35). See 02-data-model.md.
- **Inngest jobs:** `scanMessage` (chapter 23) is the orchestrator; these files define no jobs themselves.

## 7. Findings

Q-12-001  [HIGH]  LLM deep-path fails OPEN on any error — safety detection silently disabled  — src/lib/safety/guard.ts:167-182
  Evidence: `catch (error) { ... return { isSafe: true, severity: "SAFE", category: "NONE", ... } }`. Any Gemini outage, rate-limit, timeout, or schema-parse failure returns a fully-safe assessment. The job then logs nothing unsafe and creates no flag (safety-scan.ts:81). The regex fast-path covers only a handful of phrasings, so most messages depend on the LLM.
  Impact: A provider hiccup means genuine self-harm/abuse messages pass undetected with no flag, no alert, and no operator signal beyond a `console.error`. For a child-safety system, fail-open is the dangerous direction; a degraded/queued/retry path or a "needs human review" flag would be safer.
  Status: documented (not fixed)

Q-12-002  [LOW]  `recommendedResolution` is dead — the LLM's own suggested action is collected then ignored  — src/lib/safety/guard.ts:18-25, src/lib/safety/types.ts:23
  Evidence: `safetySchema` asks the model for `recommendedResolution` and the type carries it, but grep shows no reader: `policy.ts` derives the resolution deterministically from other fields and `safety-scan.ts` never references `result.recommendedResolution`.
  Impact: Wasted model output/tokens and misleading surface area — future maintainers may assume the LLM's recommendation influences the decision when it does not. Harmless to behavior; remove or wire it.
  Status: documented (not fixed)

Q-12-003  [MED]  Severity vocabulary drift across schema / regex / policy / DB  — src/lib/safety/guard.ts:8,59,64,70,76,81,87; src/lib/safety/policy.ts:14-66; prisma/schema.prisma:323
  Evidence: `safetySchema`/`SafetyAssessment` allow six severities (`CONCERN|DANGER|SAFE|TIER_1|TIER_2|TIER_3`). The regex engine only ever emits `TIER_1`/`TIER_2` (guard.ts pattern table). `DANGER`/`CONCERN`/`TIER_3`/`SAFE` are producible only by the LLM. The DB column comment says only `// "CONCERN" | "DANGER"` (schema.prisma:323) and `category` comment omits INCEST/SEXUAL_CONTENT/BYPASS_ATTEMPT (schema.prisma:324). `severity` is a free String, so nothing enforces consistency.
  Impact: Two parallel severity ontologies (TIER_n vs CONCERN/DANGER) raise the chance the LLM emits a value the policy branch never anticipated (it would fall through the switch `default` → `INTERNAL_LOG_ONLY`, policy.ts:64-65), silently downgrading a real concern. Schema comments are also stale vs the actual enum, a drift hazard for 02-.
  Status: documented (not fixed)

Q-12-004  [MED]  Academic whitelist + crude negation can null out the entire regex guard  — src/lib/safety/guard.ts:91-103, 44-48, 97
  Evidence: `scan()` returns `null` if ANY whitelist term (`class`, `book`, `project`, `homework`, `body parts`, etc., guard.ts:44-48) appears anywhere in the message, and also returns `null` on a loose negation match (`/\b(not|never|don'?t want to).{0,10}\b(kill|hurt|suicide)\b/i`, guard.ts:97). Both checks operate on the whole message, not the offending span.
  Evidence (mitigation): a `null` from `scan()` only disables the **fast path**; `assessMessageSafety` still falls through to the LLM (guard.ts:138-166), so it is not a full bypass.
  Impact: A message like "for my project, I want to kill myself" loses the deterministic regex guarantee and relies entirely on the LLM (which per Q-12-001 fails open). The negation regex also mis-handles "I do not care, I will kill myself"-style sentences. Span-scoped checks would be safer.
  Status: documented (not fixed)

Q-12-005  [LOW]  `sendSafetyAlert` uses raw `db` (not `withTenant`) for the flag lookup  — src/lib/notifications/safety-alert.ts:25-36
  Evidence: `db.safetyFlag.findUnique({ where: { id: flagId }, include: { student.organization.users } })` runs on the un-tenanted client (RLS is OFF per anchor facts). Recipients are derived from the flag's own student→organization relation, so the join is self-scoping; the only input is a UUID `flagId` produced one step earlier in the same trusted job.
  Impact: Low in practice because the caller is a server-side Inngest job passing a freshly-created flag id, and recipients are bounded by the flag's own org relation. But it is an org-scoped read with no explicit `organizationId` predicate; if `sendSafetyAlert` were ever called from a less-trusted context with an attacker-supplied flagId, it would read/notify across tenants. Worth a `withTenant` wrap or an explicit org assertion for defense-in-depth.
  Status: documented (not fixed)

Q-12-006  [LOW]  Hard-stop logic is duplicated between policy and job (drift risk)  — src/lib/safety/policy.ts:14-22, src/inngest/functions/safety-scan.ts:32-37
  Evidence: The "never notify when caregiver implicated or disclosureRisk HIGH" invariant is encoded once in `decideSafetyResolution` (policy.ts:14) and again as guards on the escalation block (safety-scan.ts:33-37). The job's comment (safety-scan.ts:28-31) explains the redundancy is intentional (escalation could otherwise upgrade `STUDENT_OPTIONAL_OUTREACH` to a `PARENT_SUMMARY_*`).
  Impact: Correct today, but the safety invariant now lives in two files; a change to severity/risk handling in one must be mirrored in the other or a flagged child could be exposed to the caregiver they fear. Centralizing the predicate would reduce this risk.
  Status: documented (not fixed)
