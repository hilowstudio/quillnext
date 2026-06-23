# Q-12-007 — In-the-moment child-facing safety layer (Hybrid) — design spec

> **Status: ✅ BUILT 2026-06-23** (owner written sign-off + implemented per this spec; CI green — tsc 0 /
> eslint 0-err / vitest 212/212; nothing pushed). ⚠️ The UI (affordance + `/safety` review page) needs a manual
> browser smoke-test — CI has no component/e2e harness; the logic (resources, pre-check, query/action contracts,
> wording) is unit-tested. Re-verify the crisis resources periodically. (Originally approved/signed off 2026-06-23.)

## Problem (the finding)
Q-12-007 [HIGH]: the safety pipeline is async/post-hoc. The chat route enqueues `chat/message.sent`
(route.ts) then streams the reply in parallel — no synchronous pre-check; 4 of 6 resolutions only
`console.log`; no `SafetyFlag` UI reader exists; the only in-the-moment layer is the bypassable
Thinkling prompt. So in the moment a child discloses crisis, nothing reliably surfaces help, and no
persistent crisis affordance exists.

## Owner decisions (locked)
- **Architecture = Hybrid.** Synchronous regex pre-check → in-the-moment child-facing affordance;
  async LLM scan + flag pipeline unchanged; new parent SafetyFlag review UI.
- **Reporting policy = KEEP "Minimum Social Responsibility."** System surfaces resources to the child +
  notifies caregivers per existing policy. It does **NOT** auto-report to authorities and is **not** an
  automated mandated reporter. The operator's personal mandated-reporter status is their own counsel's
  call — out of scope for the system and unaffected by this design.
- **Resources** = the verified set in §Resources (US-primary + military-deployed/OCONUS + emergency +
  intl. fallback). Re-verify periodically; verify findahelpline.com before ship.

## Resources (verified 2026-06-23 against official sources — single source of truth)
| Need | Resource | Contact | Source |
|---|---|---|---|
| Suicide/self-harm (US) | 988 Suicide & Crisis Lifeline | Call/Text **988** · chat.988lifeline.org | 988lifeline.org |
| Child abuse (US) | Childhelp National Child Abuse Hotline | Call/Text **1-800-422-4453** (text "GO") · chat | childhelphotline.org |
| Text crisis (US) | Crisis Text Line | Text **HOME to 741741** (HOLA=español) | crisistextline.org |
| Military families (incl. OCONUS) | Military Crisis Line | **988 then Press 1** · Text **838255** · **DSN 988** on base · off-base: EUCOM +1-844-702-5495 / PACOM +1-844-702-5493 / CENTCOM +1-855-422-7719 / AFRICOM +1-888-482-6054 / SOUTHCOM +1-866-989-9599 | veteranscrisisline.net |
| Military support (non-crisis) | Military OneSource | **800-342-9647** · overseas VoIP/country-lookup | militaryonesource.mil |
| Immediate danger | Local emergency services | **911** (US) / local | — |
| Non-US fallback | Find A Helpline | findahelpline.com (verify before ship) | findahelpline.com |

## Bot-wording redline (`src/lib/thinkling.ts:58-59`) — approved
- :58 → drop "I may need to involve a trusted adult"; replace with "You're not in trouble. I can't fix
  this myself, but I can show you ways to reach someone who can help, any time — free and private."
- :59 → "If the person hurting you is someone at home, you can tell me — **you** decide who you talk to,
  and here are people you can reach any time: [resources]."
- Why: the old line promised notification the policy suppresses for implicated/feared caregivers;
  the new line offers RESOURCES (always deliverable) + preserves child agency + the home-harm carve-out.

## Architecture / components (implementation plan)
1. **Resources module** — `src/lib/safety/crisis-resources.ts` (NEW, pure, testable): the verified set as
   typed data + a selector (e.g. by category: self-harm → 988; abuse → Childhelp; military flag → Military
   Crisis Line). First unit test shape-locks the data (every entry has name/contact/applies-to). No I/O.
2. **Synchronous regex pre-check** — in `src/app/api/chat/route.ts`: run `SafetyRegexEngine.scan(lastMessage)`
   synchronously (pure, instant, no model). On a hit, include a `safety` payload (the relevant resources +
   a supportive line) in the chat response so the UI can surface it in the moment. The async LLM scan + flag
   pipeline stays exactly as-is. The pre-check NEVER notifies anyone.
3. **Child-facing affordance** — `src/components/thinkling/ThinklingChat.tsx`: (a) a persistent, calm
   "Need help now?" control always visible (opens the resources) — the legal-baseline persistent affordance;
   (b) in-the-moment surfacing of the pre-check's resources when present. Calm-tech styling (no alarm).
4. **Parent SafetyFlag review UI** — NEW page (e.g. `src/app/safety/page.tsx` + a server query): lists
   org-scoped `SafetyFlag` rows (honors Q-12-009 redaction; show category/severity/resolution/createdAt,
   redacted message), mark-reviewed via existing `isResolved`/`resolvedAt` (a server action). **No schema
   change.** Parent-gated (`assertParentProfile`) + org-scoped (RLS + explicit predicate). Add a Sidebar link.
5. **Wording** — apply the §redline to `thinkling.ts`.

## Fail-safe invariants (MUST hold; test them)
- The affordance/pre-check **only show the child resources — they notify no one**, so they cannot
  mis-notify an implicated/feared caregiver. Caregiver email stays gated by policy + `isAlertDeliverable`.
- Errs toward over-providing help (showing resources when unsure is fine); never toward notification.
- The synchronous path must not block/delay the reply on failure (guard it; resources are best-effort UI).
- The parent review UI must respect the hard-stop redaction (never reveal a redacted disclosure).

## Out of scope (noted)
- Scanning the bot's **streamed output** (a separate, harder enhancement — the pre-check covers the
  child's input). Roadmap.
- T3-F: labeled crisis/benign eval set + a stronger/second classifier. Roadmap (not a minted finding).

## Verification
TDD (failing test first) per unit; CI gates green (tsc 0 / eslint 0-err / vitest). The resources module +
the selector + the redaction-respecting review query are the priority unit tests. End-to-end trace the
child path (disclosure → pre-check → affordance shows verified resources) and the parent path (flag →
review UI → mark reviewed) before claiming done. Nothing pushed.
