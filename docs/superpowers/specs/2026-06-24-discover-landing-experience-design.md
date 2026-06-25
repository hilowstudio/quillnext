# discover.quillandcompass.app — Cinematic Landing Experience (Design Spec)

**Date:** 2026-06-24
**Status:** Storyboard approved; technical approach grounded in a 2025-2026 research sweep (5 briefs).
**Owner rules:** never push/deploy without an explicit ask. This spec is written, NOT committed unless asked.
**Repo:** a NEW, separate repo **`discover-quill`** (sibling folder to `quillnext`) + separate Vercel project (isolated from the app's prod pipeline).

---

## 1. What this is

A heavy, award-tier, scroll-driven marketing site at **discover.quillandcompass.app** whose only jobs are
to capture a homeschool parent who's never heard of Quill & Compass, walk them through an emotional
journey, and land them on a waitlist for the **2026-27 school year** (activation in **August 2026**).

This follows a **completely different playbook from the in-app calm-tech minimalism.** The app earns trust
by getting out of the way; the landing site earns attention by taking the visitor somewhere.

**Throughline (approved):** *"Every homeschool is a book. Let's write yours."* The visitor co-authors an
illuminated manuscript by scrolling. We open on the terror of the blank page, the quill (the product)
begins writing *with* them, and the waitlist is the invitation to begin their own book.

**Art direction (approved):** illuminated manuscript + product payoff. Candlelit parchment, ink, quill,
gold leaf. The product appears as the co-author's hand, not a feature list.

## 2. Scope & non-goals

- **V1 product-payoff = STYLIZED** (rendered in the manuscript's own hand), NOT literal screen recordings,
  because the real UI needs polish before August. Build the product-payoff layer as a **swappable slot**
  (each payoff = an asset reference behind a clean boundary) so real screen recordings drop into V2 with no
  scene-code changes.
- **Staged delivery** so V1 is live collecting emails early (see §11). Not all-or-nothing.
- **No DB** for the waitlist (own Resend serverless fn). **No** in-app calm-tech constraints on motion.
- **No View Transitions / multi-page** in V1 (one long page) — removes a whole class of ScrollTrigger bugs.
- Retire the in-app `/waitlist` once `discover.*` ships; its copy + Resend logic port over.

## 3. The three asset layers (keep them in their lanes — this is what makes it read as one film)

1. **Atmosphere = AI-generated cinematic video → canvas frame sequences.** Candlelit parchment, ink
   blooming, the quill, pages turning, a scriptorium dolly. Carries the manuscript world + the scrubbed
   hero beats.
2. **Product truth = a swappable payoff slot.** V1 = stylized renders (in the manuscript hand). V2 = real
   screen recordings. Same component boundary either way.
3. **Readable words = SVG / DOM type.** Every headline and the "handwritten" lesson lines sit *on top* of
   the video. AI video cannot spell, and DOM text is better for SEO/a11y/crispness anyway.

## 4. Architecture (grounded in the research)

- **Astro (SSG, `output: "static"`).** Markup + copy in `.astro` for SEO + near-zero baseline JS.
  `@astrojs/react` for payoff islands only.
- **ONE vanilla-TS scroll engine**, not one giant React island. `src/scripts/scroll.ts` initialized once
  from the layout. ScrollTrigger is document-global; a page-spanning React island would force `client:load`
  and evaporate Astro's bundle win. **React islands are per-payoff-moment only, `client:visible`**, and they
  do NOT own ScrollTriggers — the global engine owns all triggers.
- **Single rAF loop (the #1 correctness decision):**
  ```ts
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ autoRaf: false, syncTouch: false }); // GSAP drives the clock
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0); // no violent catch-up after a tab blur
  ```
- **Reduced-motion is a first-class branch via `gsap.matchMedia()`**, not CSS afterthought. Under
  `(prefers-reduced-motion: reduce)`: **do not instantiate Lenis** (native scroll), create **zero** scrub
  triggers, show the final still of each sequence. `ScrollTrigger.saveStyles()` on animated targets so the
  matchMedia revert never contaminates inline styles. Same code path doubles as the iOS-Low-Power and
  no-WebCodecs fallback.
- **`ScrollTrigger.refresh()`** after `document.fonts.ready` and after each frame-preloader resolves; explicit
  `width`/`height` + `aspect-ratio` on every media box (CLS guard).
- **iOS:** `100svh`/`100dvh` (never `100vh`) for full-bleed spreads; `user-select:none` on scrub surfaces;
  lazy-mount/unmount scrub surfaces per section.
- **No `<ClientRouter>` (View Transitions) in V1.**

## 5. Scroll-scrubbed video pipeline (the decision that makes or breaks render quality)

Default for **scrubbed** beats = **canvas + WebP frame sequence** (the Apple / Codrops-OPTIKKA pattern).
Do **NOT** scrub a real `<video>` via `currentTime` on scroll — it looks fine on desktop and visibly dies on
iOS Safari (coarse seek, delta-frame decode lag). Real `<video>` is used **only** for *autoplaying*
(non-scrubbed) ambient loops.

- **Generate frames + poster from the AI clip:**
  ```bash
  ffmpeg -i clip.mp4 -vf "fps=30,scale=1280:-2" png/f_%04d.png      # 24-30fps is plenty
  ffmpeg -i png/f_%04d.png -c:v libwebp -quality 80 webp/f_%04d.webp # ~90% smaller than PNG
  ```
- **Frame budget:** ~150-400 frames/desktop beat (ambient ink/parchment needs far fewer than Apple's 1000+),
  ~50% on mobile. Each sequence **≤ 2-3 MB mobile / ≤ 5-6 MB desktop**, **lazy-loaded per section.**
- **Paint to `<canvas>`** (not `<img>` swaps): decode to `ImageBitmap` (`createImageBitmap`), `drawImage` with
  `devicePixelRatio` cover math, only redraw on frame-index change. **Window the bitmap cache and `.close()`
  stale frames** (OOM crashes low-RAM iPhones otherwise). Preload first ~10 frames eagerly + ~5 ahead in scroll
  direction; `await img.decode()` before first paint.
- **Drive with ScrollTrigger** `scrub: true`, `pin: true`, `start/end`; `frame = Math.round(progress*(n-1))`.
- **Ambient (non-scrubbed) loops:** `<video muted playsinline autoplay loop preload="none" poster=...>`,
  `IntersectionObserver`-mounted, `play().catch(() => keep poster)` (iOS Low-Power rejects autoplay; animated
  WebP is the LPM-safe fallback). MP4/H.264 mandatory (`-pix_fmt yuv420p -movflags +faststart`), WebM/VP9
  optional-smaller via `<source>` order.
- **WebCodecs** (`VideoDecoder`→canvas) is a future enhancement for long beats (now in Safari 26/iOS 26 too,
  but uneven) — keep the frame-sequence as the baseline. Not in V1.

## 6. AI video production pipeline — Grok Imagine (owner's choice)

- **Tool: Grok Imagine Video 1.5** (xAI Aurora engine) — #1 on the May-2026 Image-to-Video Arena leaderboard,
  fast and cheap, strong image-to-video. **Known constraints (design around them):** caps at **720p**, native
  **~6s** clips at **24fps**, and it's a **Preview** (limits/behavior can change). 720p is acceptable for our
  treatment (frames scaled to ≤1280px; dark grainy footage under parchment/grain/vignette hides softness);
  upscale hero-beat frames in post (ffmpeg/Topaz) if needed. Grok bakes in native audio, which is irrelevant to
  us — we strip it (`-an`) since we scrub.
- **Consistency is a process, not a model feature** (this matters MORE with Grok than a multi-reference model):
  1. **Lock ONE brand keyframe still first** (a strong text-to-image model) defining candlelight color temp,
     parchment tone, ink black, gold-leaf hue, grain, lens, vignette. The North Star for every clip.
  2. **Always image-to-video FROM that still**, never pure text-to-video.
  3. **Use Grok's "Extend from Frame"** to lengthen and chain clips with minimal drift (a page-turn that
     continues seamlessly into the next beat) — Grok's native mechanism for cross-clip continuity.
  4. **Locked prompt template** — fix STYLE/lighting/lens/grain words; vary only subject + action + camera.
     Negative prompt always includes `no text, no letters, no legible writing, no modern objects, no people`.
  5. **One shared color-grade LUT** applied to every clip in post (ffmpeg/DaVinci) — the strongest cross-clip
     unifier. Matched grain/vignette overlay.
- **Generate ~6s, trim to the 1.5-4s scrubbed.** Grok's speed/cost makes iteration cheap (its core strength);
  budget rerolls generously ("AI video is a slot machine").
- **Validate consistency EARLY (top external risk):** generate 3-4 test clips from the locked keyframe and
  confirm they read as one film before committing the full shot list.
- **Never let the model render words.** The "quill writes a real lesson" beat = Grok video of nib + ink motion
  (letters-free) UNDER an **SVG `stroke-dashoffset` handwriting animation** of the real text.

## 7. The storyboard (acts → scenes → technique → copy)

Each act is a pinned "spread" (Cartier-style chaptered rooms), joined by page-turn transitions (CSS
`clip-path`/`rotateY` + dissolve; WebGL paper-curl is a later nicety). Copy reuses/reworks the approved
`/waitlist` `_content.ts`.

- **Act 0 — The threshold.** Closed manuscript on parchment, gold-embossed emblem, quill resting. On load:
  title illuminates (SVG gold stroke-draw), quill lifts. *"Every homeschool is a book. Let's write yours."*
  CTA withheld. **Technique:** SVG draw + one ambient candle loop. **Signature set-piece #1.** This still is
  the **LCP poster** (AVIF, `fetchpriority="high"`, preloaded).
- **Act I — The blank page (the ache).** Vast empty sheet, one guttering candle, ink that won't flow; the
  unwritten things drift up and fade (*the read-aloud, the verse, Tuesday's plan*). Kinetic type (SplitText).
  *"It gets made after the kids are asleep. The week lives in your head, which is already full."* **Technique:**
  SplitText + clip-path; light scrubbed candle. The emotional low.
- **Act II — The quill begins (the turn).** Ink flows; the quill writes a lesson line-by-line; the handwriting
  *sets* into a finished worksheet (first product glimpse). *"You shouldn't be building this at 11pm. The quill
  writes with you."* **Technique:** AI-video nib/ink **frame-sequence scrub** + SVG handwriting overlay + the
  payoff slot. **Signature set-piece #2 (the hero moment).**
- **Act III — The three gifts (the grounding stack, 3 chapters):**
  - **Ch I — The outline (academic spine).** The spine assembles as an illuminated table of contents / a literal
    column; objectives cascade. *"The map exists before you sit down."* Payoff slot: spine cascade. **Signature
    set-piece #3** (column-raise frame sequence).
  - **Ch II — The sources (Living Library).** The shelf flies in; a book opens and its real text flows into a
    lesson with true quotes. *"Your bookshelf, finally teaching."* Payoff slot: library → grounded lesson.
    **Signature set-piece #4** (book-open frame sequence).
  - **Ch III — The voice (each child).** The manuscript changes its hand per child; the same lesson re-writes for
    the hands-on 9-year-old vs the bookish 13-year-old. *"Built around each child."* Payoff slot: profile shaping
    output. **Technique:** variable-font axis morph + crossfade (cheaper).
- **Act IV — The dedication (discipleship).** A dedication page, Reformed voice, ink + gold, reverent and quiet.
  *"None of it earns anything. It sets the table. The Lord feeds the children."* **Technique:** gold-leaf
  `background-clip:text` shimmer + ink reveal. The soul of the page.
- **Act V — The margins (the ledger).** Fast, beautiful pass: the tutor with its safety layer, the planner, the
  transcript. *"And the book keeps its own ledger."* **Technique:** marginalia reveals; compressed, no checklist.
- **Act VI — The colophon (the invitation).** The waitlist, earned. *"Begin your book."* Email field arrives
  here; calm-tech promises as the imprint. **Footer/imprint:** about, privacy, terms, *Soli Deo Gloria*.

**Signature set-pieces (the four that get real frame-sequence budget):** (1) title illumination, (2) the quill
writing a lesson [hero], (3) the spine/column raising, (4) the book opening. Everything else = clip-path,
SplitText, variable-font, gold-text, parallax, page-turns.

## 8. Materiality kit (cheap, high-impact)

One paper-grain PNG `mix-blend-mode:multiply` fixed overlay (unifies every section); gold = animated gradient +
grain shimmer masked via `background-clip:text`; drop-caps = variable-font optical-size/weight axis on enter
(Editorial New move); ink reveal = `clip-path`/SVG mask wipe scrub-bound; **quill-nib custom cursor with a fading
ink trail** (`gsap.quickTo`), desktop-only, off under reduced-motion/touch. Display type: Cormorant Garamond (the
app's display serif) + a script face for flourishes; Inter for UI/body.

## 9. Waitlist capture + analytics

- Own serverless function (Astro endpoint / Vercel function) + **Resend**, logic ported from the in-app
  `joinWaitlist` (Zod email, honeypot, fail-loud, owner-notify + subscriber confirmation). Own `RESEND_API_KEY`.
- **Privacy-respecting analytics OK here** (Plausible / Fathom / Vercel) — different playbook from the no-track
  app — to measure the funnel. No invasive tracking.

## 10. Performance, accessibility & CI budget (enforced)

| Metric | Target |
|---|---|
| LCP | < 2.5s (LCP = hero **poster still**, preloaded `fetchpriority="high"`, never lazy) |
| CLS | ~0 (explicit dims + `aspect-ratio` on every media box) |
| INP | < 200ms (redraw only on frame change; nothing heavy in the scroll path) |

| Bucket | Budget |
|---|---|
| Initial critical load (HTML+CSS+critical JS+hero poster) | ≤ 600 KB |
| JS (compressed) | ≤ 365 KB (GSAP+ScrollTrigger+Lenis tree-shaken fit) |
| Each scrubbed frame sequence | ≤ 2-3 MB, lazy per section |
| Each ambient/UI video | ≤ 5 MB mobile / ≤ 10 MB desktop, `preload="none"` + IO |
| Above-the-fold transfer | ≤ 1.5 MB |
| Full-page (all sections) | soft cap ~15-20 MB, **streamed lazily**, never front-loaded |

**CI:** Lighthouse-CI budgets assert the per-bucket weights; build fails on regression. **Pre-launch checklist**
(reduced-motion branch creates zero scrub triggers; `saveStyles` called; Lenis absent under reduce; keyboard/anchor
scroll works; `play().catch` everywhere; single rAF loop; bitmap cache windowed; tested on a real mid-tier Android
+ an iPhone in Low Power Mode).

## 11. Staged delivery (get V1 live before August)

- **Stage 1 (ship to collect emails):** Act 0 + I + II + the colophon. A complete short film with the hero moment
  (the quill writing) and a working waitlist. Deployable on its own to `discover.*`.
- **Stage 2:** Act III (the three chapters / grounding stack).
- **Stage 3:** Act IV (dedication) + Act V (margins). Polish, sound design (optional, gesture-gated), V2 swap of
  real product recordings into the payoff slots once the UI is ready.

## 12. Stack & repo

- **Astro (SSG)** · `@astrojs/react` (payoff islands) · `gsap` + `gsap/ScrollTrigger` + `@gsap/react` (islands) ·
  `lenis` · `ffmpeg` (asset pipeline) · Resend · Vercel (separate project) · CNAME `discover.quillandcompass.app`.
- **Repo `discover-quill`** (sibling folder to `quillnext`). **Layout (proposed):** `src/pages/index.astro`, `src/layouts/`, `src/components/acts/*` (one per act),
  `src/components/payoffs/*.tsx` (the swappable React islands), `src/scripts/scroll.ts` (the engine),
  `src/lib/frame-sequence.ts` (canvas sequencer), `src/pages/api/waitlist.ts` (Resend), `public/assets/`
  (frames, posters, ambient videos, paper grain, fonts), `scripts/encode.sh` (ffmpeg helpers).
- Reuse the app's brand tokens/fonts/logo (copy them in; no shared package yet).

## 13. Open decisions / risks

- **Repo:** `discover-quill`, a sibling folder to `quillnext` (resolved 2026-06-24). Separate git repo + Vercel project.
- **AI video:** Grok Imagine Video 1.5 (resolved 2026-06-24). **Top external risk:** Grok is 720p + Preview, and
  cross-clip consistency leans on the locked keyframe + Extend-from-Frame + post LUT — validate with 3-4 test clips
  before committing the full shot list (§6).
- V1 product-payoff exact treatment (stylized look) — owner deferred ("we'll see"); slot is swappable regardless.
- Sound design (candle crackle / quill scratch) — Cartier-style narrative-audio is a Stage-3 nicety, gesture-gated.
