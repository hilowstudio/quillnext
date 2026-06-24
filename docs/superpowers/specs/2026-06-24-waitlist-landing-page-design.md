# Waitlist Landing Page — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design + voice). Building.
**Owner rule honored:** this spec is written, NOT committed/pushed unless explicitly asked.

## 1. Goal

A public, calm, long-scroll landing page at `/waitlist` that lets prospective homeschool
parents read about Quill & Compass and join a waitlist for the upcoming **2026–27 school year**.
The page leads with the *pain* each feature solves, not a feature dump, and gives each feature a
short Q&A parents will actually ask. It reuses the established Quill & Compass aesthetic and
follows the owner's two voice personas.

## 2. Non-goals (explicit)

- No new DB table / Prisma migration (the seeded prod DB is precious; waitlist capture is Resend-only).
- No change to the existing `/` home-route behavior or the auth proxy beyond one allow-list entry.
- No managed-list (ConvertKit/Tally) integration this pass — Resend-to-inbox only.
- No dark-mode design (page is parchment/light only).
- No analytics, tracking pixels, streaks, or push (against the calm-tech values the page sells).
- Do NOT advertise features the audit flagged as stub/gap: file-upload generation, auto-graded
  student tests, in-app transcript *signing*, "private" prayers, cross-family book search.

## 3. Voice (two personas, one rulebook)

- **The Calm Integrator** (operational copy): warm, direct, lived-experience (working-memory load,
  attention economy, the 11pm worksheet). Source: `~/hi-low/lib/voice-persona.ts`.
- **The Reformed Theological Mind** (faith copy: founder note, discipleship section, gospel framing):
  reverent without stuffiness, christotelic, Soli Deo Gloria, pastoral, comfort the afflicted. No
  therapeutic moralism, no prosperity tonality, quote economy (one attributed reference > a pile).
- **Shared hard rules (enforced by a test):** never an em dash (—). Never these words: delve, explore,
  navigate, foster, enhance, leverage, transformative, robust, comprehensive, pivotal, dynamic,
  intricacies, nuances, journey (generic), unpack (teaching cliché). No AI transitions (Furthermore,
  Moreover, In addition, Additionally, In conclusion, Overall, In summary). No contrastive
  "not X, it's Y" / "not just X, but Y" framing. Contractions, burstiness, a real point of view.

## 4. Placement & routing

- New route `src/app/waitlist/page.tsx` (server component, public).
- `src/proxy.ts`: add `"/waitlist"` to `PUBLIC_ROUTES` so logged-out visitors reach it.
- `src/components/layout/GlobalShell.tsx`: add `"/waitlist"` to `CHROMELESS_PREFIXES` so the page
  renders WITHOUT the app sidebar (same mechanism `/select-profile` uses).
- The proxy matcher already excludes `/assets/*`, so the logo loads fine.

## 5. Waitlist capture (Resend, no DB)

- `src/app/waitlist/actions.ts` → `joinWaitlist(input)` server action.
- Validates with Zod: `email` (required, `.email()`), `firstName` (optional, trimmed, ≤80),
  `honeypot` (hidden anti-bot field; if non-empty, return `{ ok: true }` and send nothing).
- Uses the existing Resend client (`new Resend(process.env.RESEND_API_KEY)`) exactly like
  `src/lib/notifications/safety-alert.ts`:
  - Notify the owner: `to = process.env.WAITLIST_NOTIFY_TO || "adam@quillandcompass.app"`,
    subject `New waitlist signup`, body = email + first name + timestamp.
  - Optional subscriber confirmation: one short plain email ("You're on the list. I'll write once,
    when the 2026–27 school year opens.").
  - `from = process.env.WAITLIST_FROM || process.env.SAFETY_ALERT_FROM || "Quill & Compass <onboarding@resend.dev>"`.
- **Fail-loud, never fake success:** if `RESEND_API_KEY` is unset or the send errors, `console.error`
  and return `{ ok: false, error }`. The client shows a graceful "couldn't reach us, email me directly"
  fallback with a `mailto:` so a signup is never silently lost.
- `.env.example`: add `WAITLIST_NOTIFY_TO`, `WAITLIST_FROM` with comments.
- Known limitation (documented, accepted): no rate-limiting beyond the honeypot (no infra this pass).

## 6. Components (focused files)

```
src/app/waitlist/
  page.tsx               server; metadata + composes sections from _content.ts
  actions.ts             "use server"; joinWaitlist (Resend)
  _content.ts            ALL copy as typed data (hero, founder note, grounding triad,
                         features[], values, honesty note, footer). Single review surface.
  _content.test.ts       voice-lint: copy has no em dash + none of the banned words
  _components/
    Hero.tsx             logo (next/image, /assets/branding/Quill-and-Compass.png) + headline + form
    WaitlistForm.tsx     client island; email + optional name + honeypot; sonner toast; inline success
    GroundingStack.tsx   the 3-pillar "how it works together" triad
    FeatureSection.tsx   reusable: { eyebrow, headline, body, faqs[] }; alternating bg
    Faq.tsx              native <details>/<summary> (accessible, JS-free, calm)
    ValueStrip.tsx       calm-tech values row
    SiteFooter.tsx       About/Privacy/Terms + contact email + doxological line
```

- Aesthetic: parchment bg + global paper-texture overlay; `font-display` (Cormorant) headlines,
  `font-body` (Inter); indigo `#3A3F76` / gold `#D9A441` accents; `shadow-qc-soft`; generous spacing.
- Reuse `Button`, `Input`, `Label` primitives. Logo via `next/image`; `Inkling.png` as a small mark
  in the AI-generation section.
- Accessibility: one `<h1>` (hero), `<h2>` per section, `<h3>` in cards; labelled inputs; visible
  focus; ≥44px targets; `alt` on images; reduced-motion already global.
- Metadata: title "Quill & Compass — calm, grounded homeschooling"; description; `openGraph` with the logo.

## 7. Page structure + final copy

### Hero
- Logo + wordmark **Quill & Compass**.
- H1: **Homeschool that runs on rest.**
- Sub: "You shouldn't be building curriculum at 11pm. Quill & Compass plans the week, drafts the
  lessons, grounds them in real books and a real K–12 spine, and keeps the records. Discipleship is
  built in. Your attention and your data stay yours."
- Form: email + optional first name + button **Join the waitlist**.
- Microcopy: "For the 2026–27 school year. I'll email once. No spam, no selling your address, ever."

### Why this exists (founder note — Reformed voice)
> I built this after watching good parents run their homes on willpower alone. The curriculum gets
> made after the kids are asleep. The week lives in your head, which is already full. By February the
> read-alouds and family worship are the first to fall off, because they're the things with no deadline.
>
> Most of that is a working-memory problem. Naming it that way changes the fix. So Quill & Compass holds
> the structure: the plan, the lessons, the records, the verse for the week. It asks for almost none of
> your attention back, so you can give that attention to the children in front of you.
>
> One honest word. Software doesn't disciple your children. The Spirit does that, through the Word,
> through prayer, through the ordinary faithfulness of a parent and a church. This tool keeps the table
> set, so the good things stay daily.

### How it works together (grounding triad)
- H2: **Three things, working as one.**
- Body: "Good teaching needs three things at once: the map, the right book open, and a real sense of
  the child. Quill & Compass holds all three and hands them to the AI together."
- Pillars: **The spine** (a real K–12 scope and sequence, so every lesson has a place in the year) ·
  **Your library** (the books and videos you chose, read and ready, so lessons quote real sources) ·
  **Your child** (a profile of how each one learns, so the work fits the kid).
- Close: "Generate anything and it draws on all three at once. That's why the output sounds like your
  homeschool instead of a stranger's."

### Feature sections (pain → solution → Q&A)

**1. Lessons that are actually yours.**
Body: "You sit down to make a worksheet and lose an hour to formatting. Quill & Compass drafts the
lesson, the quiz, the reading guide, in the time it takes to pour coffee. You pick the subject and the
child; it writes content aimed at where that child actually is. Every piece comes out marked as a draft
for you to read and approve. You stay the teacher. The machine does the typing."
- *Is this just ChatGPT with a logo?* "It's grounded. Every generation is built from your child's
  profile, the objective you chose, and the books on your shelf, then checked against the source text so
  the facts hold. A blank chat box gives you none of that structure."
- *Can I edit what it makes?* "Yes. Everything is a starting draft. Keep it, rewrite it, or regenerate
  with a note about what to change."
- *What can it make?* "Lessons and readings, worksheets, quizzes, slides, and full unit bundles you can
  drop straight into a course."

**2. Always know what's next.**
Body: "Most curriculum anxiety is a planning-load problem wearing a scary mask. Quill & Compass ships
with a full K–12 scope and sequence already built: twelve subjects broken into thousands of specific
objectives, kindergarten through high school. Pick where your child is and the next right thing is in
front of you. The plan exists before you sit down."
- *Do I have to follow your sequence?* "No. It's there when you want a track to stand on. Teach off it,
  ahead of it, or around it. Add your own topics and it stretches to fit."
- *What subjects are covered?* "The usual academics (math, science, language arts, history, geography,
  the arts) plus Bible and theology, life and home skills, and digital discipleship as real subjects."
- *Is it aligned to standards?* "It's a coherent K–12 progression you can teach with confidence. Each
  objective carries a grade level and a difficulty, so a lesson lands at the right height."

**3. Your bookshelf, finally doing some teaching.**
Body: "You already own the good stuff. Living books, the science text, the documentary you keep meaning
to use. Add a book by scanning its barcode or photographing the cover, and Quill & Compass reads it,
outlines it, and remembers it. Generate a lesson from that book and it pulls from the actual pages, with
real quotes about your title. Add a book once and the heavy reading is done for every family who adds it
after you."
- *Do I have to type the whole book in?* "No. Scan the barcode, search the title, or snap the cover. We
  pull the details, and for public-domain works, the full text."
- *Will it summarize, or actually use my book?* "It uses your book. Lessons quote and reference the real
  text, with a check that catches anything invented."
- *What can I add?* "Books, YouTube videos (it reads the transcript), web articles, and your own
  documents. They all become material a lesson can draw from."

**4. Built around each child.**
Body: "One worksheet for three different children serves none of them well. Each learner gets a short
profile: how they learn, what lights them up, where they need a gentler on-ramp. Quill & Compass folds
that into everything it writes, so the lesson for your hands-on nine-year-old reads differently from the
one for your bookish thirteen-year-old. You can see exactly what the AI knows about each child, and fix
it, on one page."
- *How does it learn about my kid?* "A short set of questions per child about personality, learning
  style, and interests. Update it any time, and read the whole profile in plain language."
- *Can I see what the AI is using?* "Yes. A context page shows the exact picture each generation is built
  from, scored for completeness, with simple ways to fill the gaps."

**5. AI your kids can use, that you can trust.**
Body: "Thinkling is a tutor your child can talk to, built to ask good questions instead of handing over
answers. Three modes: subject help, research, and college-and-career. Underneath runs a safety layer
that reads every message a child sends for signs of harm, built to fail safe. If a child is in real
trouble, it surfaces verified help and tells no one who shouldn't be told. You see a calm summary; the
child sees care."
- *What keeps it from just giving my kid the answers?* "It's shaped to guide with questions and to stay
  within bounds you set as the parent. You choose which child is using it and which mode."
- *What happens if my child types something worrying?* "The system flags it, shows the child real crisis
  resources (verified, current, including lines for military families overseas), and emails you a careful
  summary. When a parent might be the source of the fear, it's built to protect the child first."
- *Does it report us to anyone?* "No. The family's information stays inside the family. The crisis help
  shown to a child notifies no one; it points to real, qualified human help."

**6. Discipleship that stays on the table.** (Reformed voice)
Body: "The year's plan always finds room for math. It rarely protects family worship. Quill & Compass
keeps the means of grace in the daily rhythm: Scripture memory with a real method, Bible reading that
traces the one story from promise to fulfillment in Christ (Luke 24:27), catechism in the historic
Reformed stream, a prayer journal, the unreached world to pray for, the neighbor down the road to love.
Matthew Henry sits alongside the text for the hard parts. The catechisms are the ones the church has
trusted: the Westminster Shorter and Larger, the Heidelberg, the 1689, and more. None of it earns
anything. It sets the table. The Lord feeds the children."
- *Does the app replace church or family worship?* "No. It keeps the structure so the Word stays daily.
  The discipling is the Lord's work through the Word, prayer, and the gathered church. The tool protects
  the time."
- *Is the Bible teaching from a particular tradition?* "Yes, and we're plain about it: Scripture read as
  one story fulfilled in Christ, in the Reformed confessional stream."
- *My kids are young. Is any of this for them?* "Yes. There's a children's catechism, a gospel-shaped
  guide to big emotions, and memory work that meets a younger child where they are."

**7. The records you dread, handled.**
Body: "Two fears run under a lot of homeschooling: the day-to-day (what are we even doing Tuesday?) and
the long game (will the records hold up when she applies to college?). The weekly planner spreads a
course across your real school days, skipping your holidays, so Tuesday plans itself. For the high-school
years, the transcript builder keeps courses, credits, and GPA in order and prints clean. The paperwork
stops being the thing you avoid."
- *Can it build an actual high-school transcript?* "Yes. Courses by year, credits, weighted or unweighted
  GPA on the scale you choose, ready to print as a PDF."
- *Does scheduling understand our calendar?* "Yes. Set your school days and holidays once. Distributing a
  course lays its lessons across the days you actually teach."
- *What if I want my data out?* "Export everything you've put in as a single file, any time. It's yours."

**8. Calm by design.**
Body: "Most software is built to pull you back in. This one is built to let you leave. No ads. No
tracking. No streaks, badges, or push notifications inventing urgency you don't need. Your data is yours:
take all of it with you whenever you want, and delete it for good. It's bootstrapped by one person,
funded by the families who use it, with no investors and no one in the attention business holding a stake."
- *How do you make money, then?* "A simple subscription, once it's ready. You pay for the software and
  the software works for you. We'll never sell your data or run ads."
- *Is it free right now?* "It's free while it's in active development. Waitlist members hear first when
  the school-year plan opens."
- *Who's behind it?* "One builder, in the open, who got tired of tools that treat families as engagement
  to harvest. You can email a real person: adam@quillandcompass.app."

### Where we are, honestly
- H2: **Built in the open, by one person.**
- Body: "I'd rather tell you the truth than sell you a finish line. Most of what's here works today:
  generation, the library, the spine, the discipleship tools, the planner and transcripts, the student
  tutor with its safety layer. A few corners are still being built, and the waitlist is how I bring
  families in as the 2026–27 version is readied. You'll hear from me when your spot opens. Once."

### Final CTA
- H2: **Come build a calmer school year.**
- Body + the same form. Microcopy repeats the "one email, no spam" promise.

### Footer
- Links: About (`/about`), Privacy (`/privacy`), Terms (`/terms`).
- Contact: `adam@quillandcompass.app`.
- Line: "Quill & Compass. Bootstrapped. No investors, no ads. Soli Deo Gloria."

## 8. Verification

- `npx tsc --noEmit` → 0 errors.
- `npx eslint .` → 0 errors (warnings OK).
- `npx vitest run` → all pass, including the new `_content.test.ts` voice-lint.
- Confirm `prisma/` and `prisma/migrations/` UNCHANGED.
- `git status` shows only the intended new/edited files.
- A browser smoke-test of the page + form is **owed** (CI has no e2e harness) → offer to run the app
  and screenshot after the gates pass.

## 9. Touched files

New: `src/app/waitlist/{page.tsx,actions.ts,_content.ts,_content.test.ts}`,
`src/app/waitlist/_components/{Hero,WaitlistForm,GroundingStack,FeatureSection,Faq,ValueStrip,SiteFooter}.tsx`.
Edited: `src/proxy.ts` (+1 route), `src/components/layout/GlobalShell.tsx` (+1 prefix), `.env.example` (+2 vars).
