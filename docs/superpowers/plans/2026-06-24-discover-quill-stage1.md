# discover-quill — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the standalone `discover-quill` Astro site and ship Stage 1 of the cinematic "illuminated manuscript" landing experience (Act 0 threshold, Act I the blank page, Act II the quill writes a lesson [hero scroll set-piece], and the Colophon waitlist) as a complete, deployable short film with a working signup, built with PLACEHOLDER frame sequences so the motion is visible before any Grok Imagine footage exists.

**Architecture:** Astro SSG shell; markup/copy in `.astro` for SEO + near-zero baseline JS. ONE vanilla-TS scroll engine (Lenis + GSAP ScrollTrigger, single rAF loop) owns ALL triggers; React islands (`client:visible`) only for the waitlist form + the swappable product-payoff slot. Scroll-scrubbed beats render a canvas WebP frame-sequence, NOT a `<video>` currentTime scrub. `prefers-reduced-motion` is a real `gsap.matchMedia` branch (no Lenis, no scrub, static stills).

**Tech Stack:** Astro 5 (static) · @astrojs/react · React 19 · GSAP 3 + ScrollTrigger + @gsap/react · Lenis 1 · Zod · Resend · Vitest (jsdom) · Playwright · Lighthouse-CI · ffmpeg.

**Source spec:** `docs/superpowers/specs/2026-06-24-discover-landing-experience-design.md`. **Repo:** new `discover-quill`, a sibling folder to `quillnext` (separate git repo + Vercel project). **Owner rule:** never push/deploy without an explicit ask.

## Global Constraints

- **Astro SSG** `output:"static"`; `@astrojs/react` for islands only (`client:visible`). No View Transitions in Stage 1.
- **ONE vanilla-TS scroll engine**, single rAF: `new Lenis({autoRaf:false, syncTouch:false})`; `lenis.on("scroll", ScrollTrigger.update)`; `gsap.ticker.add(t=>lenis.raf(t*1000))`; `gsap.ticker.lagSmoothing(0)`. React islands never create ScrollTriggers.
- **Scrubbed beats = canvas WebP frame-sequence**, never `<video>.currentTime` scrub (janks on iOS Safari). Real `<video>` only for autoplay ambient loops (`muted playsinline autoplay loop preload="none" poster=...`, `play().catch()` → poster fallback).
- **prefers-reduced-motion = a real `gsap.matchMedia()` branch:** under reduce, do NOT instantiate Lenis (native scroll), create ZERO scrub triggers, show the final still of each sequence. `ScrollTrigger.saveStyles()` on animated targets first.
- **iOS:** `100svh`/`100dvh` (never `100vh`); `user-select:none` on scrub surfaces; `ScrollTrigger.refresh()` after `document.fonts.ready` + after each frame preloader resolves; explicit `width`/`height` + `aspect-ratio` on every media box (CLS guard).
- **Perf budget (Lighthouse-CI):** LCP element = hero POSTER still (AVIF, `fetchpriority="high"`, preloaded, never lazy) < 2.5s; CLS < 0.02; INP/TBT < 200ms; compressed JS ≤ 365KB; each frame sequence ≤ 2-3MB lazy per section.
- **Brand tokens** copied from `quillnext` `src/app/globals.css`: `--color-qc-primary:#3A3F76` (indigo), `--color-qc-secondary:#D9A441` (gold), `--color-qc-charcoal:#1C1E23`, `--color-qc-parchment:#F9F5EF` (bg), `--color-qc-warm-stone:#E5E2DC`; display serif = **Cormorant Garamond**, body = **Inter**, plus a script face for flourishes; paper-texture overlay. Logo + favicon from `quillnext/public/assets/branding`.
- **Copy voice (guarded by a Vitest voice-lint test):** NO em dashes ever; NO banned words (delve, explore, navigate, foster, enhance, leverage, transformative, robust, comprehensive, pivotal, dynamic, intricacies, nuances, journey, unpack); NO contrastive "not X, it's Y". Two personas: Calm Integrator (operational copy) + Reformed Theological Mind (faith copy).
- **Waitlist capture:** own Astro POST endpoint + **Resend** (zod email, honeypot, fail-loud, owner-notify + subscriber confirmation; env `RESEND_API_KEY`, `WAITLIST_NOTIFY_TO`, `WAITLIST_FROM`). NO database.
- **No real footage yet:** Stage 1 uses placeholder frame sequences/posters; the product-payoff is a SWAPPABLE slot (stylized placeholder now, real screen-recording in V2) with no scene-code change.

## File structure & interface contract (single source of truth)

```
discover-quill/
  package.json · astro.config.mjs · tsconfig.json · vitest.config.ts · playwright.config.ts · lighthouserc.json · .env.example · .gitignore
  src/layouts/Base.astro            props { title; description; lcpPoster? }; loads fonts + global.css; .paper-grain overlay; <slot/>; bootstraps src/scripts/scroll.ts
  src/styles/global.css             qc-* tokens, @font-face, .paper-grain, .gold-text, reduced-motion base
  src/content/manuscript.ts         SCHOOL_YEAR, CONTACT_EMAIL, act0/act1/act2/colophon/footer typed copy
  src/content/manuscript.test.ts    Vitest voice-lint + structure
  src/lib/frame-sequence.ts         frameIndexForProgress(progress,total):number · coverRect(cw,ch,iw,ih):{dx,dy,dw,dh} · framesToEvict(loaded,current,windowSize):number[] · class FrameSequence{constructor({urls,canvas,windowSize?}); preload(initial?):Promise<void>; render(progress):void; destroy()}
  src/lib/frame-sequence.test.ts    Vitest for the 3 pure helpers
  src/lib/motion.ts                 MOTION_QUERIES{motionOK,reduce,isDesktop} · prefersReducedMotion(mqlMatch):boolean · pickFrameCount(isDesktop,desktopN,mobileN):number
  src/lib/motion.test.ts            Vitest for the 2 pure helpers
  src/lib/waitlist.ts               waitlistSchema · type JoinWaitlistInput · type JoinWaitlistResult · validateWaitlist(input):{ok:true;data}|{ok:false;error}
  src/lib/waitlist.test.ts          Vitest validation + honeypot
  src/scripts/scroll.ts             initScroll():void  (gsap.matchMedia: motionOK → Lenis+ticker+registerAct0/1/2(); reduce → revealStatic())
  src/scripts/acts/act0.ts          registerAct0():void   (title gold stroke-draw + quill lift, [data-act="0"])
  src/scripts/acts/act1.ts          registerAct1():void   (line/word reveals + drift, [data-act="1"])
  src/scripts/acts/act2.ts          registerAct2():void   (pinned FrameSequence scrub + SVG handwriting + payoff reveal, [data-act="2"])
  src/pages/api/waitlist.ts         POST → validateWaitlist → Resend, fail-loud
  src/components/WaitlistForm.tsx    client:visible; email+firstName+honeypot "company"; POST /api/waitlist; idle/submitting/done; idPrefix prop
  src/components/PayoffSlot.tsx      client:visible; props { kind:"stylized"|"recording"; src; alt; poster? }
  src/components/acts/Act0Threshold.astro · Act1BlankPage.astro · Act2QuillWrites.astro · Colophon.astro
  src/pages/index.astro             Base + the four act components in order
  public/assets/                    placeholder frames (webp), posters (avif), paper-grain.png, fonts/, branding/
  scripts/encode.sh                 ffmpeg frame extraction (fps=30,scale=1280:-2 → webp q80, -an)
  tests/e2e/smoke.spec.ts           Playwright: renders, 4 data-act sections in order, no console errors, reduced-motion → static + form works, LCP poster present
```

---

### Task 1: Scaffold the Astro project + brand design system

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `lighthouserc.json`, `.env.example`, `.gitignore`
- Create: `src/layouts/Base.astro`
- Create: `src/styles/global.css`
- Create: `src/pages/index.astro` (temporary parchment placeholder; replaced in a later task)
- Create: `public/assets/branding/Quill-and-Compass.png`, `public/assets/branding/favicon.png`, `public/assets/paper-grain.png` (copied from quillnext)
- Test: `tests/e2e/smoke.spec.ts` (initial 200 + paper-grain assertion only; expanded in a later task)

**Interfaces:**
- Consumes: nothing (this is the root scaffold).
- Produces:
  - `src/layouts/Base.astro` — Astro component, props `{ title:string; description:string; lcpPoster?:string }`. Loads fonts + `src/styles/global.css`; renders the `.paper-grain` overlay; renders `<slot/>`; includes the engine bootstrap `<script>` importing `src/scripts/scroll.ts` (the script file lands in a later task; the import path is fixed now).
  - `src/styles/global.css` — defines the `qc-*` CSS custom properties, `@font-face` rules, the `.paper-grain` overlay class, the `.gold-text` utility (`background-clip:text` gradient), and reduced-motion base rules.
  - This repo's build/test/lint config that every later task runs against (`npm run build`, `npm run test`, `npm run e2e`).

The repo is a brand-new sibling folder to `quillnext` named `discover-quill`. All commands below run from inside that new folder.

- [ ] **Step 1: Create the project folder and initialize git.**
  ```bash
  mkdir -p ../discover-quill
  cd ../discover-quill
  git init
  git branch -M main
  ```

- [ ] **Step 2: Write `package.json` with exact deps and scripts.**
  ```jsonc
  // package.json
  {
    "name": "discover-quill",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "astro dev",
      "build": "astro build",
      "preview": "astro preview",
      "astro": "astro",
      "test": "vitest run",
      "test:watch": "vitest",
      "e2e": "playwright test",
      "lhci": "lhci autorun"
    },
    "dependencies": {
      "@astrojs/react": "^4.2.0",
      "astro": "^5.6.0",
      "gsap": "^3.13.0",
      "@gsap/react": "^2.1.2",
      "lenis": "^1.3.1",
      "react": "^19.1.0",
      "react-dom": "^19.1.0",
      "resend": "^4.5.0",
      "zod": "^3.25.0"
    },
    "devDependencies": {
      "@playwright/test": "^1.52.0",
      "@types/react": "^19.1.0",
      "@types/react-dom": "^19.1.0",
      "@lhci/cli": "^0.14.0",
      "jsdom": "^26.1.0",
      "vitest": "^3.1.0"
    }
  }
  ```

- [ ] **Step 3: Install dependencies.**
  ```bash
  npm install
  npx playwright install chromium
  ```

- [ ] **Step 4: Write `astro.config.mjs` — static output + React island integration.**
  ```js
  // astro.config.mjs
  import { defineConfig } from "astro/config";
  import react from "@astrojs/react";

  // https://astro.build
  export default defineConfig({
    output: "static",
    site: "https://discover.quillandcompass.app",
    integrations: [react()],
    vite: {
      build: {
        // Keep the JS budget honest; the engine + islands must stay ≤365KB compressed.
        assetsInlineLimit: 0,
      },
    },
  });
  ```

- [ ] **Step 5: Write `tsconfig.json` (extends Astro strict + React JSX).**
  ```jsonc
  // tsconfig.json
  {
    "extends": "astro/tsconfigs/strict",
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "react",
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"]
      },
      "verbatimModuleSyntax": true,
      "noUncheckedIndexedAccess": true
    },
    "include": ["src", "tests", ".astro/types.d.ts"],
    "exclude": ["dist", "node_modules"]
  }
  ```

- [ ] **Step 6: Write `vitest.config.ts` (jsdom env so DOM-touching libs unit-test; pure-logic tests still pass).**
  ```ts
  // vitest.config.ts
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      globals: true,
      restoreMocks: true,
    },
  });
  ```

- [ ] **Step 7: Write `playwright.config.ts` — builds + previews the static site, then runs e2e against it.**
  ```ts
  // playwright.config.ts
  import { defineConfig, devices } from "@playwright/test";

  const PORT = 4321;
  const BASE_URL = `http://localhost:${PORT}`;

  export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
      baseURL: BASE_URL,
      trace: "on-first-retry",
    },
    projects: [
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],
    webServer: {
      // Test the real static build, not the dev server, so SSG output is what we assert on.
      command: "npm run build && npm run preview -- --port 4321 --host",
      url: BASE_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  });
  ```

- [ ] **Step 8: Write `lighthouserc.json` — the perf budget gate later tasks tighten.**
  ```jsonc
  // lighthouserc.json
  {
    "ci": {
      "collect": {
        "staticDistDir": "./dist",
        "numberOfRuns": 1
      },
      "assert": {
        "assertions": {
          "categories:performance": ["warn", { "minScore": 0.9 }],
          "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
          "cumulative-layout-shift": ["warn", { "maxNumericValue": 0.02 }],
          "total-blocking-time": ["warn", { "maxNumericValue": 200 }],
          "uses-responsive-images": "off"
        }
      },
      "upload": { "target": "filesystem", "outputDir": "./.lighthouseci" }
    }
  }
  ```

- [ ] **Step 9: Write `.gitignore`.**
  ```gitignore
  # .gitignore
  node_modules/
  dist/
  .astro/
  .env
  .env.local
  .lighthouseci/
  test-results/
  playwright-report/
  .DS_Store
  *.log
  ```

- [ ] **Step 10: Write `.env.example` (waitlist env contract used by a later task; no real secrets).**
  ```bash
  # .env.example
  # Resend transactional email (waitlist capture). Copy to .env and fill in.
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
  WAITLIST_NOTIFY_TO=hello@quillandcompass.app
  WAITLIST_FROM="Quill & Compass <hello@quillandcompass.app>"
  ```

- [ ] **Step 11: Copy brand assets from quillnext into `public/assets/`.**
  These are the real files verified in `quillnext/public/assets/branding/`. The paper-grain texture is generated as a tiny tileable PNG placeholder here and swapped for the real grain in a media task; copy what exists, create the grain placeholder.
  ```bash
  mkdir -p public/assets/branding public/assets/fonts
  cp ../quillnext/public/assets/branding/Quill-and-Compass.png public/assets/branding/Quill-and-Compass.png
  cp ../quillnext/public/assets/branding/favicon.png public/assets/branding/favicon.png
  cp ../quillnext/public/assets/branding/icons/apple-touch-icon.png public/assets/branding/apple-touch-icon.png
  # Tileable paper-grain placeholder (real high-res grain lands in the media task).
  # 256x256 faint monochrome noise tile, ImageMagick:
  magick -size 256x256 xc:gray50 +noise Gaussian -attenuate 0.35 -colorspace Gray \
    -channel A -evaluate set 8% +channel public/assets/paper-grain.png
  ```
  If ImageMagick is unavailable, drop any 256x256 faint-noise PNG at `public/assets/paper-grain.png`; the overlay class only needs a tileable texture.

- [ ] **Step 12: Write `src/styles/global.css` — qc tokens, fonts, paper-grain overlay, gold-text utility, reduced-motion base.**
  Token hex values are copied verbatim from quillnext `src/app/globals.css` (`--color-qc-parchment:#F9F5EF`, `--color-qc-charcoal:#1C1E23`, `--color-qc-primary:#3A3F76`, `--color-qc-secondary:#D9A441`, `--color-qc-warm-stone:#E5E2DC`).
  ```css
  /* src/styles/global.css */

  /* ── Fonts (self-hosted; files land in public/assets/fonts in the font task) ── */
  @font-face {
    font-family: "Cormorant Garamond";
    src: url("/assets/fonts/CormorantGaramond-Medium.woff2") format("woff2");
    font-weight: 500;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Cormorant Garamond";
    src: url("/assets/fonts/CormorantGaramond-SemiBold.woff2") format("woff2");
    font-weight: 600;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Inter";
    src: url("/assets/fonts/Inter-Regular.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Inter";
    src: url("/assets/fonts/Inter-Medium.woff2") format("woff2");
    font-weight: 500;
    font-style: normal;
    font-display: swap;
  }

  :root {
    /* ── Core brand colors (copied from quillnext globals.css) ── */
    --qc-parchment: #f9f5ef;
    --qc-charcoal: #1c1e23;
    --qc-indigo: #3a3f76;
    --qc-gold: #d9a441;
    --qc-warm-stone: #e5e2dc;
    --qc-border-subtle: #ddd5c7;
    --qc-text-muted: #6b6e7a;

    /* Aliases the contract names directly */
    --qc-bg: var(--qc-parchment);
    --qc-fg: var(--qc-charcoal);

    /* ── Type ── */
    --font-display: "Cormorant Garamond", ui-serif, Georgia, serif;
    --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
    --font-script: "Cormorant Garamond", cursive;

    /* iOS-safe viewport unit (never 100vh) */
    --svh: 100svh;

    color-scheme: light;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
  }

  body {
    margin: 0;
    min-height: 100dvh;
    background-color: var(--qc-bg);
    color: var(--qc-fg);
    font-family: var(--font-body);
    font-size: 18px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    overflow-x: hidden;
  }

  h1,
  h2,
  h3 {
    font-family: var(--font-display);
    font-weight: 500;
    line-height: 1.1;
    margin: 0;
  }

  /* ── Paper-grain overlay (fixed, non-interactive, multiplies onto parchment) ── */
  .paper-grain {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-image: url("/assets/paper-grain.png");
    background-repeat: repeat;
    background-size: 256px 256px;
    mix-blend-mode: multiply;
    opacity: 0.5;
  }

  /* ── gold-text utility: clipped gradient in the gold/indigo register ── */
  .gold-text {
    background-image: linear-gradient(
      100deg,
      var(--qc-gold) 0%,
      #e7c073 45%,
      var(--qc-gold) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }

  /* Scrub surfaces must never select on iOS drag */
  [data-act] canvas,
  .scrub-surface {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  /* ── Reduced-motion base: native scroll, no smooth offsets ── */
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
    .paper-grain {
      opacity: 0.4;
    }
  }
  ```

- [ ] **Step 13: Write `src/layouts/Base.astro` — props `{ title; description; lcpPoster? }`, fonts + global.css, paper-grain overlay, slot, engine bootstrap.**
  The `import "../scripts/scroll.ts"` line wires the single scroll engine; `scroll.ts` is authored in a later task, so this import resolves once that file exists. The `lcpPoster` preload is the LCP optimization for the hero (AVIF, `fetchpriority="high"`, never lazy).
  ```astro
  ---
  // src/layouts/Base.astro
  import "../styles/global.css";

  interface Props {
    title: string;
    description: string;
    lcpPoster?: string;
  }

  const { title, description, lcpPoster } = Astro.props;
  ---

  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="icon" type="image/png" href="/assets/branding/favicon.png" />
      <link
        rel="apple-touch-icon"
        href="/assets/branding/apple-touch-icon.png"
      />

      <!-- Self-hosted fonts: preload the two faces used above the fold -->
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/assets/fonts/CormorantGaramond-SemiBold.woff2"
        crossorigin
      />
      <link
        rel="preload"
        as="font"
        type="font/woff2"
        href="/assets/fonts/Inter-Regular.woff2"
        crossorigin
      />

      {
        /* LCP element: the hero poster still. Preloaded, high priority, never lazy. */
        lcpPoster && (
          <link
            rel="preload"
            as="image"
            href={lcpPoster}
            fetchpriority="high"
          />
        )
      }

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
    </head>
    <body>
      <div class="paper-grain" aria-hidden="true"></div>
      <slot />

      <!-- Single vanilla-TS scroll engine bootstrap (Lenis + GSAP ticker live here). -->
      <script>
        import { initScroll } from "../scripts/scroll.ts";
        initScroll();
      </script>
    </body>
  </html>
  ```

- [ ] **Step 14: Write a temporary `src/scripts/scroll.ts` stub so the Base bootstrap import resolves now.**
  This stub is replaced wholesale by the real engine task. It exports the contract symbol `initScroll(): void` and no-ops, so the scaffold builds.
  ```ts
  // src/scripts/scroll.ts
  // TEMPORARY scaffold stub — replaced by the real Lenis+GSAP engine in the scroll-engine task.
  export function initScroll(): void {
    // Intentionally empty until the engine task lands.
  }
  ```

- [ ] **Step 15: Write a temporary `src/pages/index.astro` so `npm run build` has a page to emit.**
  This placeholder is replaced by the real act-composition page later; for now it proves the layout + tokens render a styled parchment page.
  ```astro
  ---
  // src/pages/index.astro
  import Base from "../layouts/Base.astro";
  ---

  <Base
    title="Quill & Compass — Discover"
    description="A faith-grounded homeschool platform. Curriculum, learning, and family discipleship in one place."
  >
    <main
      style="position:relative; z-index:2; min-height:100svh; display:grid; place-items:center; text-align:center; padding:2rem;"
    >
      <div>
        <p
          style="font-family:var(--font-body); letter-spacing:0.18em; text-transform:uppercase; font-size:0.8rem; color:var(--qc-text-muted);"
        >
          Quill & Compass
        </p>
        <h1 style="font-size:clamp(2.5rem,6vw,4.5rem); margin-top:0.5rem;">
          <span class="gold-text">An illuminated page,</span> waiting.
        </h1>
      </div>
    </main>
  </Base>
  ```

- [ ] **Step 16: Verify the build succeeds.**
  ```bash
  npm run build
  ```
  Confirm it exits 0 and emits `dist/index.html`. If `scroll.ts` or font preloads error, fix before continuing.

- [ ] **Step 17: Browser-verify the styled parchment page.**
  ```bash
  npm run dev
  ```
  Open `http://localhost:4321`. Confirm: background is parchment `#F9F5EF`; the heading "An illuminated page, waiting." renders in Cormorant Garamond with the first clause filled by the gold gradient (`.gold-text`); a faint paper-grain texture overlays the whole viewport; no console errors. Stop the dev server.

- [ ] **Step 18: Write the initial Playwright smoke test (200 + paper-grain element present).**
  This is the seed of `tests/e2e/smoke.spec.ts`; later tasks append the four-act / reduced-motion / LCP assertions.
  ```ts
  // tests/e2e/smoke.spec.ts
  import { test, expect } from "@playwright/test";

  test("index returns 200 and renders the parchment shell", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // The paper-grain overlay is the brand shell signal for the scaffold.
    const grain = page.locator(".paper-grain");
    await expect(grain).toHaveCount(1);

    // The gold-text clause must render inside the hero heading.
    await expect(page.locator("h1 .gold-text")).toBeVisible();
  });
  ```

- [ ] **Step 19: Run the smoke test (expect PASS).**
  ```bash
  npm run e2e
  ```
  Playwright runs `npm run build && npm run preview` per `playwright.config.ts`, then asserts 200 + one `.paper-grain` element + visible `.gold-text`. Confirm 1 passed.

- [ ] **Step 20: Commit the scaffold.**
  ```bash
  git add -A
  git commit -m "chore: scaffold Astro SSG project + Quill & Compass brand design system

  - package.json deps (astro, @astrojs/react, react, gsap, @gsap/react, lenis, zod, resend, vitest, @playwright/test)
  - astro.config.mjs output:static + react integration; tsconfig strict; vitest jsdom; playwright build+preview; lighthouserc budget
  - src/layouts/Base.astro (title/description/lcpPoster props, fonts, paper-grain overlay, scroll engine bootstrap)
  - src/styles/global.css (qc-* tokens copied from quillnext, font-face, .paper-grain, .gold-text, reduced-motion base)
  - brand assets copied to public/assets; placeholder index page
  - Playwright smoke: 200 + paper-grain present"
  ```

**Deliverable check:** `npm run build` exits 0 and writes `dist/index.html`; `npm run dev` shows a styled blank parchment page (gold-gradient heading + paper-grain overlay); `npm run e2e` passes the 200 + paper-grain smoke. The `Base.astro` props `{ title; description; lcpPoster? }`, the `src/styles/global.css` `qc-*` tokens / `.paper-grain` / `.gold-text`, and the build/test commands are now fixed for every later task to consume.

---

### Task 2: Manuscript content module + voice-lint test
**Files:**
- Create: `src/content/manuscript.ts`
- Create (Test): `src/content/manuscript.test.ts`

**Interfaces:**
- **Consumes:** nothing from earlier tasks (this is the copy source-of-truth). It assumes the Vitest harness configured in Task 1 (`vitest.config.ts`, `npm test`).
- **Produces (later tasks rely on these EXACT exports):**
  - `SCHOOL_YEAR: string` (= `"2026-27"`)
  - `CONTACT_EMAIL: string`
  - `act0: { title: string; subtitle: string; enter: string }`
  - `act1: { eyebrow: string; line: string; drift: string[] }`
  - `act2: { eyebrow: string; line: string; lessonText: string[] }` — `lessonText` is the array of real lesson lines the quill "writes" (consumed by `registerAct2()` in `src/scripts/acts/act2.ts` for the SVG `stroke-dashoffset` handwriting, one `<text>`/`<path>` per line).
  - `colophon: { heading: string; body: string; microcopy: string }`
  - `footer: { links: { label: string; href: string }[]; email: string; line: string }`
  - Helper used only by the test: `export const ALL_COPY_STRINGS: string[]` (flattened copy, so the voice-lint asserts over a stable surface) and `export const BANNED_WORDS: readonly string[]`.

Steps:

- [ ] **Step 1: Write the failing voice-lint + structure test FIRST (TDD red).**
  Create `src/content/manuscript.test.ts`. It imports the (not-yet-written) module, so the suite fails to import — that is the red state.
  ```ts
  // src/content/manuscript.test.ts
  import { describe, it, expect } from "vitest";
  import {
    SCHOOL_YEAR,
    CONTACT_EMAIL,
    act0,
    act1,
    act2,
    colophon,
    footer,
    ALL_COPY_STRINGS,
    BANNED_WORDS,
  } from "./manuscript";

  // U+2014 EM DASH. Forbidden anywhere in copy (owner voice rule).
  const EM_DASH = "\u2014";

  describe("manuscript voice-lint", () => {
    it("exposes a non-empty flattened copy surface", () => {
      expect(Array.isArray(ALL_COPY_STRINGS)).toBe(true);
      expect(ALL_COPY_STRINGS.length).toBeGreaterThan(0);
      for (const s of ALL_COPY_STRINGS) {
        expect(typeof s).toBe("string");
        expect(s.length).toBeGreaterThan(0);
      }
    });

    it("contains no em dash (U+2014) in any copy string", () => {
      const offenders = ALL_COPY_STRINGS.filter((s) => s.includes(EM_DASH));
      expect(offenders, `em dash found in: ${JSON.stringify(offenders)}`).toEqual([]);
    });

    it("contains no banned word as a whole word in any copy string", () => {
      const offenders: { word: string; text: string }[] = [];
      for (const word of BANNED_WORDS) {
        // \b word boundary, case-insensitive, whole-word only (so "compass" never trips on nothing,
        // and "foster" the verb is caught while a name "Foster" would also be — acceptable: we ban it).
        const re = new RegExp(`\\b${word}\\b`, "i");
        for (const text of ALL_COPY_STRINGS) {
          if (re.test(text)) offenders.push({ word, text });
        }
      }
      expect(offenders, `banned words found: ${JSON.stringify(offenders)}`).toEqual([]);
    });

    it("uses no contrastive 'not X, it's Y' construction", () => {
      // Cheap guard for the banned rhetorical move. Catches "not a feature list, it's a hand".
      const re = /\bnot\b[^.?!]*,\s*(it'?s|it is)\b/i;
      const offenders = ALL_COPY_STRINGS.filter((s) => re.test(s));
      expect(offenders, `contrastive construction in: ${JSON.stringify(offenders)}`).toEqual([]);
    });
  });

  describe("manuscript structure", () => {
    it("pins the school year and a valid contact email", () => {
      expect(SCHOOL_YEAR).toBe("2026-27");
      expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    });

    it("act0 has the three threshold fields", () => {
      expect(typeof act0.title).toBe("string");
      expect(typeof act0.subtitle).toBe("string");
      expect(typeof act0.enter).toBe("string");
    });

    it("act1 has eyebrow + line + a non-empty drift array", () => {
      expect(typeof act1.eyebrow).toBe("string");
      expect(typeof act1.line).toBe("string");
      expect(Array.isArray(act1.drift)).toBe(true);
      expect(act1.drift.length).toBeGreaterThanOrEqual(3);
    });

    it("act2 carries the real lesson lines the quill writes", () => {
      expect(typeof act2.eyebrow).toBe("string");
      expect(typeof act2.line).toBe("string");
      expect(Array.isArray(act2.lessonText)).toBe(true);
      // The hero handwriting set-piece needs several short lines to scrub-draw.
      expect(act2.lessonText.length).toBeGreaterThanOrEqual(4);
      for (const l of act2.lessonText) {
        expect(typeof l).toBe("string");
        expect(l.length).toBeGreaterThan(0);
        // Handwriting lines must be short enough to draw on one SVG line.
        expect(l.length).toBeLessThanOrEqual(64);
      }
    });

    it("colophon has heading + body + microcopy", () => {
      expect(typeof colophon.heading).toBe("string");
      expect(typeof colophon.body).toBe("string");
      expect(typeof colophon.microcopy).toBe("string");
    });

    it("footer links are well-formed and email matches CONTACT_EMAIL", () => {
      expect(Array.isArray(footer.links)).toBe(true);
      expect(footer.links.length).toBeGreaterThan(0);
      for (const link of footer.links) {
        expect(typeof link.label).toBe("string");
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.href.startsWith("/") || link.href.startsWith("http")).toBe(true);
      }
      expect(footer.email).toBe(CONTACT_EMAIL);
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm it FAILS (red).**
  ```bash
  npx vitest run src/content/manuscript.test.ts
  ```
  Expected: failure with `Failed to resolve import "./manuscript"` (the module does not exist yet). This is the intended red state.

- [ ] **Step 3: Create the manuscript module with the typed copy (TDD green).**
  Create `src/content/manuscript.ts`. Copy is reworked from the approved quillnext `_content.ts` into the manuscript framing per the storyboard (§7): Act 0 = the threshold throughline, Act I = the ache (founder-note "11pm" lines), Act II = the quill writes a real lesson + the payoff line, Colophon = the earned waitlist. `act2.lessonText` is a genuine, short, line-by-line lesson the quill draws. Voice rules honored: no em dash, no banned words, no contrastive construction.
  ```ts
  // src/content/manuscript.ts
  /**
   * Every word the visitor reads lives here as typed data: one review surface, and the single thing
   * the voice-lint test (manuscript.test.ts) guards. Two personas, one rulebook: the Calm Integrator
   * for operational copy, the Reformed Theological Mind for the faith beats. The test fails the build
   * on any em dash, any banned word, or a contrastive "not X, it's Y", so keep prose clean here.
   *
   * Framing: an illuminated manuscript the visitor co-authors by scrolling.
   *   Act 0  = the threshold (the closed book, the throughline).
   *   Act I  = the blank page, the ache.
   *   Act II = the quill writes a real lesson (the hero set-piece).
   *   Colophon = the earned waitlist.
   */

  export const SCHOOL_YEAR: string = "2026-27";
  export const CONTACT_EMAIL: string = "adam@quillandcompass.app";

  /** Act 0 — the threshold. Title illuminates, quill lifts. CTA withheld here by design. */
  export const act0: { title: string; subtitle: string; enter: string } = {
    title: "Every homeschool is a book.",
    subtitle: "Let's write yours.",
    enter: "Begin",
  };

  /**
   * Act I — the blank page (the ache). One guttering candle, ink that will not flow. The unwritten
   * things drift up and fade. `drift` = the short phrases that rise as kinetic type.
   */
  export const act1: { eyebrow: string; line: string; drift: string[] } = {
    eyebrow: "The blank page",
    line:
      "It gets made after the kids are asleep. The week lives in your head, which is already full.",
    drift: [
      "the read-aloud",
      "the verse for the week",
      "Tuesday's plan",
      "the quiz you meant to write",
      "family worship",
    ],
  };

  /**
   * Act II — the quill begins (the turn, the hero moment). The nib writes a lesson line by line and it
   * sets into a finished worksheet. `lessonText` = the real lines the SVG stroke-dashoffset overlay
   * draws in sync with scroll progress; keep each line short enough to handwrite on one line.
   */
  export const act2: { eyebrow: string; line: string; lessonText: string[] } = {
    eyebrow: "The quill begins",
    line: "You shouldn't be building this at 11pm. The quill writes with you.",
    lessonText: [
      "Lesson Three: The Water Cycle",
      "Read aloud: pages 14 to 19.",
      "Watch the puddle after the rain.",
      "Where does the water go?",
      "Copywork: \"He covers the sky with clouds.\"",
      "Narrate back what you saw today.",
    ],
  };

  /** Colophon — the earned invitation. Email field arrives here; calm-tech promise as the imprint. */
  export const colophon: { heading: string; body: string; microcopy: string } = {
    heading: "Begin your book.",
    body:
      "Put your email below. I will write once, when the school year opens. No spam, no selling your " +
      "address, no drip campaign.",
    microcopy: `For the ${SCHOOL_YEAR} school year. I'll email once, and only once.`,
  };

  /** Footer / imprint. Ported from the app's waitlist footer. */
  export const footer: {
    links: { label: string; href: string }[];
    email: string;
    line: string;
  } = {
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
    email: CONTACT_EMAIL,
    line: "Quill & Compass. Bootstrapped. No investors, no ads. Soli Deo Gloria.",
  };

  /**
   * The banned-word list the voice-lint enforces (whole-word, case-insensitive). Mirrors the project
   * COPY VOICE rule. Keep in sync with the spec; the test reads this exact array.
   */
  export const BANNED_WORDS: readonly string[] = [
    "delve",
    "explore",
    "navigate",
    "foster",
    "enhance",
    "leverage",
    "transformative",
    "robust",
    "comprehensive",
    "pivotal",
    "dynamic",
    "intricacies",
    "nuances",
    "journey",
    "unpack",
  ] as const;

  /**
   * Flattened copy surface the voice-lint asserts over. Every visitor-facing string MUST be reachable
   * from here, so adding a new field without adding it below is the one way to slip past the lint.
   * (CONTACT_EMAIL and footer.email are intentionally excluded: an address is not prose.)
   */
  export const ALL_COPY_STRINGS: string[] = [
    act0.title,
    act0.subtitle,
    act0.enter,
    act1.eyebrow,
    act1.line,
    ...act1.drift,
    act2.eyebrow,
    act2.line,
    ...act2.lessonText,
    colophon.heading,
    colophon.body,
    colophon.microcopy,
    ...footer.links.map((l) => l.label),
    footer.line,
  ];
  ```

- [ ] **Step 4: Run the test and confirm it PASSES (green).**
  ```bash
  npx vitest run src/content/manuscript.test.ts
  ```
  Expected: all cases pass. If the banned-word or em-dash case fails, the failure message prints the offending string and word — fix the copy in `manuscript.ts` (never weaken the test), then re-run. Note the deliberate near-miss: the app `_content.ts` used "explore" and "navigate" in places; this reworked copy avoids them, which is exactly what the lint protects.

- [ ] **Step 5: Type-check and lint the new module (CI gates).**
  ```bash
  npx tsc --noEmit && npx eslint src/content/manuscript.ts src/content/manuscript.test.ts
  ```
  Expected: 0 type errors, 0 lint errors. Confirms the exported object shapes match the interface contract that `manuscript.test.ts`, `src/scripts/acts/act2.ts`, and the act `.astro` components depend on.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/content/manuscript.ts src/content/manuscript.test.ts
  git commit -m "feat(content): manuscript copy module + voice-lint test"
  ```

---

### Task 3: Frame-sequence canvas sequencer (lib)

**Files:**
- Create: `src/lib/frame-sequence.ts`
- Test: `src/lib/frame-sequence.test.ts`

**Interfaces:**
- Consumes (from Task 2, already on disk — no runtime import needed here, but the class is the engine `Act2` will drive): nothing at module level.
- Produces (Task 7 `src/scripts/acts/act2.ts` and Task 9 wiring rely on these EXACT signatures):
  - `function frameIndexForProgress(progress: number, total: number): number`
  - `function coverRect(cw: number, ch: number, iw: number, ih: number): { dx: number; dy: number; dw: number; dh: number }`
  - `function framesToEvict(loaded: number[], current: number, windowSize: number): number[]`
  - `class FrameSequence { constructor(opts: { urls: string[]; canvas: HTMLCanvasElement; windowSize?: number }); preload(initial?: number): Promise<void>; render(progress: number): void; destroy(): void }`

---

- [ ] **Step 1: Write the failing test for `frameIndexForProgress`.**

  Create `src/lib/frame-sequence.test.ts` with the first describe block. This maps a scroll progress `0..1` onto a clamped, rounded frame index `0..total-1`.

  ```ts
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
  import {
    frameIndexForProgress,
    coverRect,
    framesToEvict,
  } from "./frame-sequence";

  describe("frameIndexForProgress", () => {
    it("maps progress 0 to the first frame", () => {
      expect(frameIndexForProgress(0, 120)).toBe(0);
    });

    it("maps progress 1 to the last frame (total-1)", () => {
      expect(frameIndexForProgress(1, 120)).toBe(119);
    });

    it("rounds to the nearest frame at the midpoint", () => {
      // 0.5 * 119 = 59.5 -> round -> 60
      expect(frameIndexForProgress(0.5, 120)).toBe(60);
    });

    it("clamps progress below 0 to frame 0", () => {
      expect(frameIndexForProgress(-0.4, 120)).toBe(0);
    });

    it("clamps progress above 1 to the last frame", () => {
      expect(frameIndexForProgress(1.7, 120)).toBe(119);
    });

    it("handles a single-frame sequence without going negative", () => {
      expect(frameIndexForProgress(0, 1)).toBe(0);
      expect(frameIndexForProgress(1, 1)).toBe(0);
    });

    it("returns 0 for a zero-length sequence (defensive)", () => {
      expect(frameIndexForProgress(0.5, 0)).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm it FAILS (module/exports do not exist yet).**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts
  ```

  Expect a failure resolving `./frame-sequence` (module not found / undefined exports). This proves the test is wired before any implementation exists.

- [ ] **Step 3: Implement `frameIndexForProgress` in `src/lib/frame-sequence.ts`.**

  Create the file and add only the first helper plus a tiny clamp. Last index is `total - 1`; round half-up via `Math.round`.

  ```ts
  function clamp01(n: number): number {
    if (Number.isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  export function frameIndexForProgress(progress: number, total: number): number {
    if (total <= 1) return 0;
    const last = total - 1;
    const idx = Math.round(clamp01(progress) * last);
    // Math.round already lands in [0, last] because progress is clamped to [0,1].
    return idx;
  }
  ```

- [ ] **Step 4: Re-run the `frameIndexForProgress` block and confirm PASS.**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts -t frameIndexForProgress
  ```

  All 7 assertions in the block should pass. (`coverRect`/`framesToEvict` are still unimplemented — that is fine; the `-t` filter scopes the run.)

- [ ] **Step 5: Write the failing test for `coverRect`.**

  Append to `src/lib/frame-sequence.test.ts`. `coverRect` is the `object-fit: cover` math: scale the image to fully cover the canvas, center it, return `drawImage` destination args. Overflow is split evenly (negative offset on the overflowing axis).

  ```ts
  describe("coverRect (object-fit: cover math)", () => {
    it("returns full canvas when aspect ratios match", () => {
      const r = coverRect(800, 600, 1600, 1200); // both 4:3
      expect(r.dx).toBe(0);
      expect(r.dy).toBe(0);
      expect(r.dw).toBe(800);
      expect(r.dh).toBe(600);
    });

    it("overflows horizontally when image is wider than canvas", () => {
      // canvas 4:3 (800x600), image 16:9 (1920x1080).
      // scale to cover height: 600/1080 vs 800/1920 -> pick larger scale.
      // scaleW = 800/1920 = 0.4167; scaleH = 600/1080 = 0.5556 -> use 0.5556
      // dw = 1920*0.5556 = 1066.67; dh = 600; dx = (800-1066.67)/2 = -133.33
      const r = coverRect(800, 600, 1920, 1080);
      expect(r.dh).toBeCloseTo(600, 5);
      expect(r.dw).toBeCloseTo(1066.6667, 3);
      expect(r.dx).toBeCloseTo(-133.3333, 3);
      expect(r.dy).toBeCloseTo(0, 5);
    });

    it("overflows vertically when image is taller than canvas", () => {
      // canvas 16:9 (1600x900), image 4:3 (1200x900-ish). Use 1200x1600 (3:4 portrait).
      // scaleW = 1600/1200 = 1.3333; scaleH = 900/1600 = 0.5625 -> use 1.3333
      // dw = 1600; dh = 1600*1.3333 = 2133.33; dy = (900-2133.33)/2 = -616.67
      const r = coverRect(1600, 900, 1200, 1600);
      expect(r.dw).toBeCloseTo(1600, 5);
      expect(r.dh).toBeCloseTo(2133.3333, 3);
      expect(r.dx).toBeCloseTo(0, 5);
      expect(r.dy).toBeCloseTo(-616.6667, 3);
    });

    it("is defensive against zero image dimensions (no NaN/Infinity)", () => {
      const r = coverRect(800, 600, 0, 0);
      expect(Number.isFinite(r.dx)).toBe(true);
      expect(Number.isFinite(r.dy)).toBe(true);
      expect(Number.isFinite(r.dw)).toBe(true);
      expect(Number.isFinite(r.dh)).toBe(true);
    });
  });
  ```

- [ ] **Step 6: Run the `coverRect` block and confirm it FAILS.**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts -t "coverRect"
  ```

  Expect `coverRect is not a function` (not yet exported). Proves the new block fails before implementation.

- [ ] **Step 7: Implement `coverRect`.**

  Add to `src/lib/frame-sequence.ts`. Pick the larger of the two scale factors so the image fully covers; center the overflow.

  ```ts
  export function coverRect(
    cw: number,
    ch: number,
    iw: number,
    ih: number,
  ): { dx: number; dy: number; dw: number; dh: number } {
    // Defensive: degenerate image dimensions -> just fill the canvas.
    if (iw <= 0 || ih <= 0) {
      return { dx: 0, dy: 0, dw: cw, dh: ch };
    }
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    return { dx, dy, dw, dh };
  }
  ```

- [ ] **Step 8: Re-run the `coverRect` block and confirm PASS.**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts -t "coverRect"
  ```

  All 4 assertions should pass.

- [ ] **Step 9: Write the failing test for `framesToEvict`.**

  Append to `src/lib/frame-sequence.test.ts`. Given the set of currently-loaded frame indices, the current frame, and a half-window size, return the loaded indices that fall OUTSIDE `[current - windowSize, current + windowSize]` (these get their bitmaps `.close()`d). Order of the returned array does not matter for correctness, so the test sorts before comparing.

  ```ts
  describe("framesToEvict (windowed cache pruning)", () => {
    const sortNum = (a: number[]) => [...a].sort((x, y) => x - y);

    it("evicts nothing when everything is inside the window", () => {
      expect(framesToEvict([8, 9, 10, 11, 12], 10, 2)).toEqual([]);
    });

    it("evicts frames below the window's lower bound", () => {
      // window = [9, 11]; loaded 6,7 are below -> evict
      expect(sortNum(framesToEvict([6, 7, 9, 10, 11], 10, 1))).toEqual([6, 7]);
    });

    it("evicts frames above the window's upper bound", () => {
      // window = [9, 11]; loaded 13,15 are above -> evict
      expect(sortNum(framesToEvict([9, 10, 11, 13, 15], 10, 1))).toEqual([13, 15]);
    });

    it("evicts on both sides at once", () => {
      // window = [18, 22]; evict 5, 12, 30, 40
      expect(sortNum(framesToEvict([5, 12, 18, 20, 22, 30, 40], 20, 2))).toEqual([
        5, 12, 30, 40,
      ]);
    });

    it("never evicts the current frame", () => {
      expect(framesToEvict([10], 10, 0)).toEqual([]);
    });

    it("returns empty for an empty loaded set", () => {
      expect(framesToEvict([], 10, 3)).toEqual([]);
    });
  });
  ```

- [ ] **Step 10: Run the `framesToEvict` block and confirm it FAILS.**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts -t "framesToEvict"
  ```

  Expect `framesToEvict is not a function`. Proves the block fails before implementation.

- [ ] **Step 11: Implement `framesToEvict`.**

  Add to `src/lib/frame-sequence.ts`. Keep `[current - windowSize, current + windowSize]`; return everything else.

  ```ts
  export function framesToEvict(
    loaded: number[],
    current: number,
    windowSize: number,
  ): number[] {
    const lo = current - windowSize;
    const hi = current + windowSize;
    return loaded.filter((i) => i < lo || i > hi);
  }
  ```

- [ ] **Step 12: Re-run the `framesToEvict` block and confirm PASS.**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts -t "framesToEvict"
  ```

  All 6 assertions should pass.

- [ ] **Step 13: Run the WHOLE test file and confirm all three pure-helper blocks pass together.**

  ```bash
  npx vitest run src/lib/frame-sequence.test.ts
  ```

  Expect 17 passing assertions across 3 describe blocks, 0 failures. The pure helpers are now fully TDD-covered. The `FrameSequence` class is added next and is NOT unit-tested (DOM/canvas/bitmap APIs) — it is browser-verified here and exercised by Playwright in Task 9.

- [ ] **Step 14: Implement the `FrameSequence` class — fields + constructor + private helpers.**

  Add to `src/lib/frame-sequence.ts`, below the pure helpers. The class owns a windowed `Map<number, ImageBitmap>` cache, a 2D context, and a `windowSize` (half-window of frames to keep around the current index). It depends ONLY on the three pure helpers above for math.

  ```ts
  interface FrameSequenceOpts {
    urls: string[];
    canvas: HTMLCanvasElement;
    windowSize?: number;
  }

  export class FrameSequence {
    private readonly urls: string[];
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly windowSize: number;
    private readonly cache = new Map<number, ImageBitmap>();
    private readonly inflight = new Map<number, Promise<void>>();
    private current = 0;
    private destroyed = false;

    constructor(opts: FrameSequenceOpts) {
      this.urls = opts.urls;
      this.canvas = opts.canvas;
      this.windowSize = opts.windowSize ?? 8;
      const ctx = opts.canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("FrameSequence: 2D context unavailable");
      this.ctx = ctx;
    }

    /** Total frame count (drives frameIndexForProgress). */
    get total(): number {
      return this.urls.length;
    }

    /** Fetch + decode a single frame into the cache, deduped by inflight map. */
    private load(index: number): Promise<void> {
      if (index < 0 || index >= this.urls.length) return Promise.resolve();
      if (this.cache.has(index)) return Promise.resolve();
      const existing = this.inflight.get(index);
      if (existing) return existing;

      const p = fetch(this.urls[index], { cache: "force-cache" })
        .then((res) => {
          if (!res.ok) throw new Error(`frame ${index}: HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          this.inflight.delete(index);
          if (this.destroyed) {
            bitmap.close();
            return;
          }
          this.cache.set(index, bitmap);
        })
        .catch((err) => {
          this.inflight.delete(index);
          // Fail-soft per frame: a missing frame must not break the scrub.
          console.warn("[FrameSequence] frame load failed", index, err);
        });

      this.inflight.set(index, p);
      return p;
    }
  }
  ```

- [ ] **Step 15: Add the `preload` method (eager-first-N) to the `FrameSequence` class.**

  Insert this method inside the class body (after `load`). It eagerly loads the first `initial` frames (default: a window's worth, capped at total) so the opening of the scrub is instant, then resolves. `ScrollTrigger.refresh()` is the CALLER's responsibility (Task 9) after this resolves.

  ```ts
    /**
     * Eagerly load the first `initial` frames so the scrub opens without flicker.
     * Defaults to one forward window. Resolves once those frames are decoded.
     */
    async preload(initial?: number): Promise<void> {
      if (this.urls.length === 0) return;
      const n = Math.min(initial ?? this.windowSize + 1, this.urls.length);
      const jobs: Promise<void>[] = [];
      for (let i = 0; i < n; i++) jobs.push(this.load(i));
      await Promise.all(jobs);
    }
  ```

- [ ] **Step 16: Add the `render` method (cover draw + DPR + directional prefetch + windowed eviction).**

  Insert inside the class body (after `preload`). `render` is called every scroll tick by Act2's scrub. It: derives the frame index from progress, draws the nearest cached frame with `coverRect` scaled by `devicePixelRatio`, prefetches a few frames ahead in the scroll direction, and evicts cached bitmaps outside the window via `framesToEvict` + `.close()`.

  ```ts
    /** Draw the frame for `progress` (0..1); prefetch ahead; prune the cache. */
    render(progress: number): void {
      if (this.destroyed || this.urls.length === 0) return;

      const index = frameIndexForProgress(progress, this.urls.length);
      const direction = index >= this.current ? 1 : -1;
      this.current = index;

      // Size the backing store to the displayed box * DPR (crisp on retina).
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = this.canvas.clientWidth || this.canvas.width;
      const cssH = this.canvas.clientHeight || this.canvas.height;
      const pxW = Math.round(cssW * dpr);
      const pxH = Math.round(cssH * dpr);
      if (this.canvas.width !== pxW) this.canvas.width = pxW;
      if (this.canvas.height !== pxH) this.canvas.height = pxH;

      // Draw the best available frame (exact, else nearest already-cached).
      const bitmap = this.cache.get(index) ?? this.nearestCached(index);
      if (bitmap) {
        const { dx, dy, dw, dh } = coverRect(pxW, pxH, bitmap.width, bitmap.height);
        this.ctx.drawImage(bitmap, dx, dy, dw, dh);
      }

      // If the exact frame was a miss, pull it in for next tick.
      if (!this.cache.has(index)) void this.load(index);

      // Directional prefetch: a few frames in the scroll direction.
      const PREFETCH = 4;
      for (let k = 1; k <= PREFETCH; k++) void this.load(index + direction * k);

      // Prune anything outside the keep-window.
      const evict = framesToEvict([...this.cache.keys()], index, this.windowSize);
      for (const i of evict) {
        this.cache.get(i)?.close();
        this.cache.delete(i);
      }
    }

    /** Fallback when the exact frame isn't decoded yet: closest cached index. */
    private nearestCached(index: number): ImageBitmap | undefined {
      let best: number | undefined;
      let bestDist = Infinity;
      for (const i of this.cache.keys()) {
        const d = Math.abs(i - index);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best === undefined ? undefined : this.cache.get(best);
    }
  ```

- [ ] **Step 17: Add the `destroy` method (release every bitmap + block late writes).**

  Insert inside the class body (after `nearestCached`). Called by Act2's `gsap.matchMedia` cleanup. Closes all cached bitmaps, clears maps, and sets the `destroyed` flag so any in-flight `load` resolving afterward closes its bitmap instead of caching it.

  ```ts
    /** Release all GPU-backed bitmaps and stop accepting new frames. */
    destroy(): void {
      this.destroyed = true;
      for (const bitmap of this.cache.values()) bitmap.close();
      this.cache.clear();
      this.inflight.clear();
    }
  ```

- [ ] **Step 18: Confirm the file type-checks and the full test file still passes.**

  ```bash
  npx tsc --noEmit && npx vitest run src/lib/frame-sequence.test.ts
  ```

  Expect 0 TS errors and all 17 pure-helper assertions green. (The class adds no new assertions but must compile cleanly — `createImageBitmap`, `ImageBitmap`, and `CanvasRenderingContext2D` come from the DOM lib, which is on via `tsconfig.json` from Task 1.)

- [ ] **Step 19: Browser-verify the class end-to-end with a throwaway harness (the class is not unit-tested).**

  Because `createImageBitmap`/`drawImage`/DPR cannot be meaningfully unit-tested under jsdom, verify the class in a real browser once. Create a temporary `src/pages/_fseq-check.astro` (delete after), then run dev and scrub a range input.

  ```astro
  ---
  // TEMP harness — delete before commit. Verifies FrameSequence draws + scrubs.
  ---
  <canvas id="c" width="640" height="360" style="width:640px;height:360px;border:1px solid #999"></canvas>
  <input id="r" type="range" min="0" max="1000" value="0" style="width:640px;display:block" />
  <script>
    import { FrameSequence } from "../lib/frame-sequence";
    // Six solid-color placeholder frames as data URLs (no assets needed yet).
    const colors = ["#3A3F76", "#D9A441", "#1C1E23", "#F9F5EF", "#7A8450", "#B23A48"];
    const urls = colors.map((c) => {
      const cv = document.createElement("canvas");
      cv.width = 320; cv.height = 180;
      const x = cv.getContext("2d")!;
      x.fillStyle = c; x.fillRect(0, 0, 320, 180);
      return cv.toDataURL("image/webp");
    });
    const canvas = document.getElementById("c") as HTMLCanvasElement;
    const seq = new FrameSequence({ urls, canvas, windowSize: 3 });
    await seq.preload();
    const range = document.getElementById("r") as HTMLInputElement;
    const draw = () => seq.render(Number(range.value) / 1000);
    range.addEventListener("input", draw);
    draw();
  </script>
  ```

  Run and verify:

  ```bash
  npm run dev
  ```

  Open `http://localhost:4321/_fseq-check`, drag the range slider end to end, and confirm: the canvas fills with a solid color, the color CHANGES as you drag (frames stepping with progress), no console errors, and the box stays crisp (DPR sizing). Then DELETE the harness:

  ```bash
  rm src/pages/_fseq-check.astro
  ```

- [ ] **Step 20: Final type-check + lint + test, then commit.**

  ```bash
  npx tsc --noEmit && npx eslint src/lib/frame-sequence.ts src/lib/frame-sequence.test.ts && npx vitest run src/lib/frame-sequence.test.ts
  ```

  Expect 0 TS errors, 0 lint errors, 17 passing assertions. Confirm the temp harness is gone (`ls src/pages/_fseq-check.astro` → not found), then commit.

  ```bash
  git add src/lib/frame-sequence.ts src/lib/frame-sequence.test.ts
  git commit -m "feat(lib): frame-sequence canvas sequencer + TDD pure helpers

frameIndexForProgress/coverRect/framesToEvict fully unit-tested (17 assertions);
FrameSequence class (eager-first-N preload, createImageBitmap decode, cover-fit
drawImage with DPR, directional prefetch, windowed bitmap cache with .close()
eviction, destroy) browser-verified — exercised by Act2 + Playwright in Task 9."
  ```

---

### Task 4: Motion helpers + the scroll engine

**Files:**
- Create: `src/lib/motion.ts`
- Create: `src/scripts/scroll.ts`
- Test: `src/lib/motion.test.ts`

**Interfaces:**
- **Consumes:**
  - From Task 3 (frame sequence): `class FrameSequence` (used indirectly via the act modules, not here).
  - From the act tasks: `function registerAct0():void` (`src/scripts/acts/act0.ts`), `function registerAct1():void` (`src/scripts/acts/act1.ts`), `function registerAct2():void` (`src/scripts/acts/act2.ts`). For Task 4 to compile and run before those tasks land, this task FIRST creates minimal no-op stubs for the three `acts/*` modules and a `revealStatic()` helper, then the later act tasks replace the stub bodies. The exported signatures stay identical.
- **Produces:**
  - `src/lib/motion.ts` → `const MOTION_QUERIES={motionOK:"(prefers-reduced-motion: no-preference)",reduce:"(prefers-reduced-motion: reduce)",isDesktop:"(min-width: 768px)"} as const`; `function prefersReducedMotion(mqlMatch:(q:string)=>boolean):boolean`; `function pickFrameCount(isDesktop:boolean, desktopN:number, mobileN:number):number`.
  - `src/scripts/scroll.ts` → `function initScroll():void` (called from `Base.astro`'s engine bootstrap `<script>`).

---

- [ ] **Step 1: Write the failing Vitest spec for `src/lib/motion.ts`.**
  Create `src/lib/motion.test.ts`. These tests inject a fake `mqlMatch` matcher so nothing touches a real `window.matchMedia`.

  ```ts
  // src/lib/motion.test.ts
  import { describe, it, expect } from "vitest";
  import { MOTION_QUERIES, prefersReducedMotion, pickFrameCount } from "./motion";

  describe("MOTION_QUERIES", () => {
    it("exposes the three canonical media queries", () => {
      expect(MOTION_QUERIES.motionOK).toBe("(prefers-reduced-motion: no-preference)");
      expect(MOTION_QUERIES.reduce).toBe("(prefers-reduced-motion: reduce)");
      expect(MOTION_QUERIES.isDesktop).toBe("(min-width: 768px)");
    });
  });

  describe("prefersReducedMotion", () => {
    it("is true when the reduce query matches", () => {
      const match = (q: string): boolean => q === MOTION_QUERIES.reduce;
      expect(prefersReducedMotion(match)).toBe(true);
    });

    it("is false when only the no-preference query matches", () => {
      const match = (q: string): boolean => q === MOTION_QUERIES.motionOK;
      expect(prefersReducedMotion(match)).toBe(false);
    });

    it("is false when nothing matches (no media support → assume motion OK)", () => {
      const match = (_q: string): boolean => false;
      expect(prefersReducedMotion(match)).toBe(false);
    });
  });

  describe("pickFrameCount", () => {
    it("returns the desktop count on desktop", () => {
      expect(pickFrameCount(true, 120, 72)).toBe(120);
    });

    it("returns the mobile count off desktop", () => {
      expect(pickFrameCount(false, 120, 72)).toBe(72);
    });
  });
  ```

- [ ] **Step 2: Run the spec and confirm it FAILS (module not yet present).**

  ```bash
  npx vitest run src/lib/motion.test.ts
  ```
  Expect: failure with `Cannot find module './motion'` (or equivalent resolution error). This proves the test is wired before implementation.

- [ ] **Step 3: Implement `src/lib/motion.ts` to make the spec PASS.**
  `prefersReducedMotion` returns `true` only when the `reduce` query matches — anything else (including a matcher that matches nothing, e.g. older Safari returning `false` for both) is treated as "motion OK", which is the safe default for this site's reduce-vs-animate decision.

  ```ts
  // src/lib/motion.ts

  /**
   * The three media queries the scroll engine branches on.
   * `motionOK` / `reduce` drive the gsap.matchMedia() animate-vs-static split;
   * `isDesktop` selects the heavier desktop frame sequences over the mobile ones.
   */
  export const MOTION_QUERIES = {
    motionOK: "(prefers-reduced-motion: no-preference)",
    reduce: "(prefers-reduced-motion: reduce)",
    isDesktop: "(min-width: 768px)",
  } as const;

  /**
   * True only when the user has explicitly asked to reduce motion.
   * `mqlMatch` is injected (in production: `(q) => window.matchMedia(q).matches`)
   * so this stays a pure, unit-testable function. When no media query matches
   * (e.g. an environment that reports `false` for everything) we assume motion
   * is fine — the safe default, since the static path is a degraded experience.
   */
  export function prefersReducedMotion(mqlMatch: (q: string) => boolean): boolean {
    return mqlMatch(MOTION_QUERIES.reduce) === true;
  }

  /**
   * Pick how many frames a scrubbed sequence should load. Desktop gets the
   * higher-fidelity count; smaller / lower-power viewports get the lighter one
   * to stay inside the per-section ≤2-3MB lazy budget.
   */
  export function pickFrameCount(isDesktop: boolean, desktopN: number, mobileN: number): number {
    return isDesktop ? desktopN : mobileN;
  }
  ```

- [ ] **Step 4: Run the spec and confirm it PASSES.**

  ```bash
  npx vitest run src/lib/motion.test.ts
  ```
  Expect: all `motion.test.ts` assertions green.

- [ ] **Step 5: Commit the motion helpers.**

  ```bash
  git add src/lib/motion.ts src/lib/motion.test.ts
  git commit -m "feat(motion): MOTION_QUERIES + prefersReducedMotion + pickFrameCount (TDD)"
  ```

- [ ] **Step 6: Create minimal act-module stubs + `revealStatic()` so the engine compiles now.**
  The full bodies arrive in the act tasks; these stubs keep the exported signatures stable so `scroll.ts` type-checks and runs end-to-end immediately. Create all three files plus the static-reveal helper.

  ```ts
  // src/scripts/acts/act0.ts
  /** Act 0 (threshold/hero) ScrollTriggers. Full timeline lands in its own task. */
  export function registerAct0(): void {
    // intentionally empty until Act 0 task implements the title-illumination timeline
  }
  ```

  ```ts
  // src/scripts/acts/act1.ts
  /** Act I (the blank page / the ache) line reveals. Full body lands in its own task. */
  export function registerAct1(): void {
    // intentionally empty until Act 1 task implements the SplitText-style reveals
  }
  ```

  ```ts
  // src/scripts/acts/act2.ts
  /** Act II (the quill writes) pinned frame-sequence scrub. Full body lands in its own task. */
  export function registerAct2(): void {
    // intentionally empty until Act 2 task implements the FrameSequence scrub + handwriting
  }
  ```

  ```ts
  // src/scripts/acts/static.ts
  import { gsap } from "gsap";

  /**
   * The reduced-motion / iOS Low-Power path. No Lenis, no scrub triggers.
   * Make every animated target visible at its FINAL resting state and show the
   * last still of each frame sequence. gsap.set is instant (no tween), so this
   * is safe under `prefers-reduced-motion: reduce`.
   */
  export function revealStatic(): void {
    // Reveal anything the animate path would have faded/translated in.
    gsap.set("[data-reveal]", { autoAlpha: 1, y: 0, x: 0, clearProps: "transform" });

    // Show the final still for each scrubbed sequence (its poster <img>),
    // and hide the <canvas> the scrub path would have driven.
    document.querySelectorAll<HTMLImageElement>("[data-final-still]").forEach((img) => {
      img.style.opacity = "1";
    });
    document.querySelectorAll<HTMLCanvasElement>("canvas[data-scrub-canvas]").forEach((c) => {
      c.style.display = "none";
    });
  }
  ```

- [ ] **Step 7: Confirm GSAP + Lenis are installed (runtime deps for the engine).**
  `scroll.ts` imports `gsap`, `gsap/ScrollTrigger`, and `lenis`. If any are missing, install them (versions pinned by Task 1's `package.json`; this is just a safety check).

  ```bash
  npm ls gsap lenis 2>/dev/null || npm install gsap lenis
  ```
  Expect: both resolve. (`gsap/ScrollTrigger` ships inside the `gsap` package; `lenis` is the current package name, not the deprecated `@studio-freight/lenis`.)

- [ ] **Step 8: Implement `src/scripts/scroll.ts` — the single scroll engine.**
  ONE `gsap.matchMedia()`. In the `motionOK` branch: instantiate Lenis with `autoRaf:false, syncTouch:false`, wire the single rAF through `gsap.ticker`, kill `lagSmoothing`, register the three acts, and `ScrollTrigger.refresh()` after `document.fonts.ready`. In the `reduce` branch: NO Lenis, NO scrub triggers — just `revealStatic()`. `ScrollTrigger.saveStyles()` runs on the animated targets BEFORE the matchMedia so the reduce path can restore clean inline styles. The matchMedia cleanup destroys Lenis when the branch unmounts.

  ```ts
  // src/scripts/scroll.ts
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import Lenis from "lenis";

  import { MOTION_QUERIES } from "../lib/motion";
  import { registerAct0 } from "./acts/act0";
  import { registerAct1 } from "./acts/act1";
  import { registerAct2 } from "./acts/act2";
  import { revealStatic } from "./acts/static";

  /**
   * Boots the one and only scroll engine for the whole page.
   * Called once from Base.astro's bootstrap <script> after the DOM is parsed.
   *
   * Contract:
   *  - exactly ONE rAF loop (gsap.ticker drives lenis.raf); React islands never
   *    own a ScrollTrigger.
   *  - prefers-reduced-motion: reduce → no Lenis, zero scrub triggers, statics shown.
   *  - the same reduce branch is the iOS Low-Power fallback.
   */
  export function initScroll(): void {
    gsap.registerPlugin(ScrollTrigger);

    // Capture the pre-animation inline styles of everything the animate path
    // mutates, so the reduce branch (and matchMedia teardown) restores cleanly.
    ScrollTrigger.saveStyles("[data-reveal], [data-final-still], canvas[data-scrub-canvas]");

    const mm = gsap.matchMedia();

    // ---- Animate path -------------------------------------------------------
    mm.add(
      {
        motionOK: MOTION_QUERIES.motionOK,
        isDesktop: MOTION_QUERIES.isDesktop,
      },
      (context) => {
        const conditions = context.conditions as { motionOK: boolean; isDesktop: boolean };
        if (!conditions.motionOK) return; // reduce handled by the other branch

        // Single smooth-scroll instance. autoRaf:false → we drive raf ourselves
        // through gsap.ticker (one loop). syncTouch:false → native iOS momentum.
        const lenis = new Lenis({ autoRaf: false, syncTouch: false });

        // Lenis tells ScrollTrigger about every scroll; ScrollTrigger reads the
        // new scroll position synchronously.
        lenis.on("scroll", ScrollTrigger.update);

        // The ONE rAF: gsap.ticker is the heartbeat; feed it (in ms) to Lenis.
        const tick = (time: number): void => {
          lenis.raf(time * 1000);
        };
        gsap.ticker.add(tick);
        // Disable gsap's lag-smoothing so scrub stays locked to scroll on jank.
        gsap.ticker.lagSmoothing(0);

        // Build each act's ScrollTriggers (all created inside this context so
        // matchMedia auto-reverts them when the branch unmounts).
        registerAct0();
        registerAct1();
        registerAct2();

        // Fonts change line-box heights → recompute every trigger AFTER fonts
        // settle (Cormorant/Inter). Same for the act tasks' frame preloaders,
        // which each call ScrollTrigger.refresh() when their frames resolve.
        document.fonts.ready.then(() => ScrollTrigger.refresh());

        // Cleanup when the media branch no longer matches (e.g. user flips the
        // OS reduce-motion switch live, or viewport crosses the desktop break).
        return () => {
          gsap.ticker.remove(tick);
          lenis.off("scroll", ScrollTrigger.update);
          lenis.destroy();
        };
      },
    );

    // ---- Reduce path (also iOS Low-Power fallback) --------------------------
    mm.add(MOTION_QUERIES.reduce, () => {
      // No Lenis (native scroll), no scrub triggers at all. Just show statics.
      revealStatic();
      // No cleanup needed: revealStatic only sets final styles; saveStyles()
      // above lets matchMedia restore originals if this branch ever unmounts.
    });
  }
  ```

- [ ] **Step 9: Type-check the engine + stubs (no emit).**

  ```bash
  npx tsc --noEmit
  ```
  Expect: 0 errors. This proves `scroll.ts`, the three act stubs, and `static.ts` all type-check against `motion.ts` and the `gsap`/`lenis` types.

- [ ] **Step 10: Lint the new files.**

  ```bash
  npx eslint src/lib/motion.ts src/scripts/scroll.ts src/scripts/acts/act0.ts src/scripts/acts/act1.ts src/scripts/acts/act2.ts src/scripts/acts/static.ts
  ```
  Expect: 0 errors (warnings OK). The empty stub bodies are documented with comments so `no-empty-function` does not fire; if your config still flags them, the leading comment satisfies the `allow: ["functions"]`/comment exception.

- [ ] **Step 11: Browser-verify smooth scroll is ON (motion OK).**
  This is animation/engine wiring that cannot be meaningfully unit-tested, so verify in a real browser.

  ```bash
  npm run dev
  ```
  Then, with your OS motion setting at its default (animation allowed):
  - Open the dev URL, scroll the page with the wheel/trackpad.
  - Confirm scroll feels eased/smoothed (Lenis momentum), not the browser's raw step scroll.
  - Open DevTools → Console: confirm NO errors from `initScroll`.
  - In DevTools → Performance (or the FPS meter), confirm there is exactly ONE rAF-driven loop while scrolling (no competing loops). The page should hold a steady frame rate while scrolling.

- [ ] **Step 12: Browser-verify the reduced-motion path (no Lenis, no scrub).**
  In Chrome DevTools → open the Command Menu (Ctrl/Cmd+Shift+P) → run "Emulate CSS prefers-reduced-motion: reduce", then hard-reload.
  - Confirm scroll is now the browser's NATIVE scroll (no easing/momentum) — Lenis is not instantiated on this branch.
  - Confirm any `[data-reveal]` content is fully visible immediately (no fade/translate-in).
  - Confirm `canvas[data-scrub-canvas]` is hidden and the `[data-final-still]` poster image(s) are shown at full opacity.
  - Console: no errors. (The act sections are stubs right now, so visuals are sparse; the engine BRANCHING is what you're verifying here.)

- [ ] **Step 13: Commit the engine + act stubs.**

  ```bash
  git add src/scripts/scroll.ts src/scripts/acts/act0.ts src/scripts/acts/act1.ts src/scripts/acts/act2.ts src/scripts/acts/static.ts
  git commit -m "feat(scroll): single Lenis+GSAP engine with motionOK/reduce matchMedia branches + act stubs"
  ```

---

### Task 5: Waitlist Validation Lib + API Endpoint + Form

**Files:**
- Create: `src/lib/waitlist.ts` — `waitlistSchema`, `JoinWaitlistInput`, `JoinWaitlistResult`, `validateWaitlist`
- Create/Test: `src/lib/waitlist.test.ts` — Vitest (TDD: valid passes, bad email fails, honeypot contract)
- Create: `src/pages/api/waitlist.ts` — Astro POST endpoint (validate → honeypot short-circuit → Resend owner-notify + subscriber confirm, fail-loud)
- Create: `src/components/WaitlistForm.tsx` — React island (`client:visible`); email + optional firstName + hidden honeypot `company`; idle/submitting/done states; `idPrefix` for unique ids
- Modify: `.env.example` — add `RESEND_API_KEY`, `WAITLIST_NOTIFY_TO`, `WAITLIST_FROM`

**Interfaces:**
- Consumes: `SCHOOL_YEAR`, `CONTACT_EMAIL`, `colophon`, `footer` from `src/content/manuscript.ts` (Task 2) — only `WaitlistForm`/`Colophon` consume copy; the lib itself has no inbound deps. `zod` (already a dependency from `package.json`, Task 1).
- Produces:
  - `const waitlistSchema` (zod object: `email` `.email().max(254)`, `firstName` `.max(80).optional()`, `company` `.optional()` honeypot)
  - `type JoinWaitlistInput = z.infer<typeof waitlistSchema>`
  - `type JoinWaitlistResult = { ok: true } | { ok: false; error: string }`
  - `function validateWaitlist(input: unknown): { ok: true; data: JoinWaitlistInput } | { ok: false; error: string }`
  - `POST` handler at `/api/waitlist` returning JSON `{ ok: true } | { ok: false; error: string }`
  - `WaitlistForm` default-export React component with prop `{ idPrefix: string }`

---

- [ ] **Step 1: Write the failing Vitest spec for the validation lib.** Create `src/lib/waitlist.test.ts`. This drives the `waitlistSchema` + `validateWaitlist` contract before any implementation exists.

```ts
// src/lib/waitlist.test.ts
import { describe, it, expect } from "vitest";
import { waitlistSchema, validateWaitlist } from "./waitlist";

describe("waitlistSchema", () => {
  it("accepts a valid email with no extra fields", () => {
    const parsed = waitlistSchema.safeParse({ email: "ruth@example.com" });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid email plus firstName", () => {
    const parsed = waitlistSchema.safeParse({
      email: "ruth@example.com",
      firstName: "Ruth",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const parsed = waitlistSchema.safeParse({ email: "not-an-email" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an email longer than 254 chars", () => {
    const long = "a".repeat(250) + "@b.com";
    const parsed = waitlistSchema.safeParse({ email: long });
    expect(parsed.success).toBe(false);
  });

  it("rejects a firstName longer than 80 chars", () => {
    const parsed = waitlistSchema.safeParse({
      email: "ruth@example.com",
      firstName: "x".repeat(81),
    });
    expect(parsed.success).toBe(false);
  });

  it("allows the honeypot company field to be present", () => {
    const parsed = waitlistSchema.safeParse({
      email: "ruth@example.com",
      company: "spam-bot-filled-this",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("validateWaitlist", () => {
  it("returns ok:true with typed data for a valid input", () => {
    const result = validateWaitlist({ email: "ruth@example.com", firstName: "Ruth" });
    expect(result).toEqual({ ok: true, data: { email: "ruth@example.com", firstName: "Ruth" } });
  });

  it("returns ok:false with a string error for a bad email", () => {
    const result = validateWaitlist({ email: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("returns ok:false for a non-object input", () => {
    const result = validateWaitlist("garbage");
    expect(result.ok).toBe(false);
  });

  it("preserves the honeypot company value in parsed data (caller decides to skip)", () => {
    const result = validateWaitlist({ email: "ruth@example.com", company: "bot" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.company).toBe("bot");
    }
  });
});
```

- [ ] **Step 2: Run the spec and confirm it FAILS (red).** The module does not exist yet.

```bash
npx vitest run src/lib/waitlist.test.ts
```
Expect: failure to resolve `./waitlist` (module not found). This proves the test is wired before implementation.

- [ ] **Step 3: Implement `src/lib/waitlist.ts` to satisfy the spec.** Pure validation only — no Resend, no I/O. The honeypot `company` is parsed and preserved; the *endpoint* (Step 6) decides to silently skip when it is non-empty. That contract is documented in the JSDoc.

```ts
// src/lib/waitlist.ts
import { z } from "zod";

/**
 * Waitlist capture contract for the discover-quill landing site.
 *
 * `company` is a HONEYPOT field: real humans never see it (it is hidden via
 * CSS in WaitlistForm). It is intentionally part of the schema and is preserved
 * by `validateWaitlist` so the API endpoint can inspect it. The endpoint treats
 * a NON-EMPTY `company` as a bot signal: it returns `{ ok: true }` WITHOUT
 * sending any email (a silent skip), so a bot cannot tell it was filtered.
 */
export const waitlistSchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().max(80).optional(),
  /** Honeypot. Should always be empty for real submissions. */
  company: z.string().optional(),
});

export type JoinWaitlistInput = z.infer<typeof waitlistSchema>;

export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

/**
 * Validate an untrusted input (parsed JSON body) against the waitlist schema.
 * Returns a discriminated result: `{ ok: true, data }` with fully-typed data,
 * or `{ ok: false, error }` with a human-readable message. Never throws.
 */
export function validateWaitlist(
  input: unknown,
): { ok: true; data: JoinWaitlistInput } | { ok: false; error: string } {
  const parsed = waitlistSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const first = parsed.error.issues[0];
  const error = first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  return { ok: false, error };
}
```

- [ ] **Step 4: Run the spec and confirm it PASSES (green).**

```bash
npx vitest run src/lib/waitlist.test.ts
```
Expect: all `waitlistSchema` + `validateWaitlist` cases pass.

- [ ] **Step 5: Add the Resend env keys to `.env.example`.** Append the three keys the endpoint reads. No real secrets — placeholder values only.

```bash
cat >> .env.example <<'EOF'

# --- Waitlist (Resend) ---
# Resend API key (https://resend.com). Server-only; never exposed to the client.
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
# Where the owner-notification email is sent (you).
WAITLIST_NOTIFY_TO=hello@example.com
# Verified sender for Resend. Must be a domain you own + verified in Resend.
WAITLIST_FROM=Quill & Compass <waitlist@discover.quillandcompass.app>
EOF
```

- [ ] **Step 6: Write the failing Vitest spec for the API endpoint with Resend MOCKED.** Create `src/pages/api/waitlist.test.ts`. We mock `resend` so no network call fires; we assert: valid input sends two emails and returns `{ ok: true }`; honeypot input returns `{ ok: true }` but sends ZERO emails (silent skip); bad email returns `{ ok: false }`; a Resend throw fails loud (`{ ok: false }`, no fake success).

```ts
// src/pages/api/waitlist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Resend SDK BEFORE importing the route module.
const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

// Provide the env the endpoint reads (Astro exposes these via import.meta.env;
// stub them so the module under test sees real-looking values).
vi.stubEnv("RESEND_API_KEY", "re_test_key");
vi.stubEnv("WAITLIST_NOTIFY_TO", "owner@example.com");
vi.stubEnv("WAITLIST_FROM", "Quill & Compass <waitlist@discover.example.com>");

import { POST } from "./waitlist";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callPost(body: unknown): Promise<{ status: number; json: any }> {
  // Astro APIRoute receives an APIContext; POST here only uses `request`.
  const res = await POST({ request: makeRequest(body) } as never);
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
});

describe("POST /api/waitlist", () => {
  it("sends owner-notify + subscriber-confirm and returns ok:true for a valid email", async () => {
    const { status, json } = await callPost({ email: "ruth@example.com", firstName: "Ruth" });
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("silently skips (ok:true, zero emails) when the honeypot is filled", async () => {
    const { status, json } = await callPost({ email: "ruth@example.com", company: "bot" });
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns ok:false 400 for a malformed email and sends nothing", async () => {
    const { status, json } = await callPost({ email: "not-an-email" });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
    expect(typeof json.error).toBe("string");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns ok:false 400 for a non-JSON / empty body", async () => {
    const res = await POST({
      request: new Request("http://localhost/api/waitlist", { method: "POST", body: "not json" }),
    } as never);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("fails loud (ok:false 502) when Resend throws — no fake success", async () => {
    sendMock.mockRejectedValueOnce(new Error("Resend down"));
    const { status, json } = await callPost({ email: "ruth@example.com" });
    expect(status).toBe(502);
    expect(json.ok).toBe(false);
    expect(typeof json.error).toBe("string");
  });

  it("fails loud (ok:false 502) when Resend returns an error object", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "bad from" } });
    const { status, json } = await callPost({ email: "ruth@example.com" });
    expect(status).toBe(502);
    expect(json.ok).toBe(false);
  });
});
```

- [ ] **Step 7: Run the endpoint spec and confirm it FAILS (red).** The route module does not exist yet.

```bash
npx vitest run src/pages/api/waitlist.test.ts
```
Expect: failure to resolve `./waitlist` (the route). Proves the test is wired before implementation.

- [ ] **Step 8: Implement `src/pages/api/waitlist.ts` (Astro POST endpoint).** Reads env via `import.meta.env`, validates, honeypot short-circuits to a silent `{ ok: true }`, sends two emails through Resend, and FAILS LOUD on any Resend throw or error object (no fake success). `prerender = false` is required for a runtime endpoint in an SSG build.

```ts
// src/pages/api/waitlist.ts
import type { APIRoute } from "astro";
import { Resend } from "resend";
import { validateWaitlist } from "../../lib/waitlist";

// This is a runtime endpoint, not a static file — opt out of prerendering.
export const prerender = false;

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY as string | undefined;
const WAITLIST_NOTIFY_TO = import.meta.env.WAITLIST_NOTIFY_TO as string | undefined;
const WAITLIST_FROM = import.meta.env.WAITLIST_FROM as string | undefined;

function json(body: { ok: true } | { ok: false; error: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function ownerNotifyHtml(email: string, firstName?: string): string {
  const name = firstName ? `${firstName} ` : "";
  return [
    `<h2>New waitlist signup</h2>`,
    `<p><strong>${name}</strong>${name ? "<" : ""}${email}${name ? ">" : ""} asked to join the Quill & Compass waitlist.</p>`,
  ].join("");
}

function subscriberConfirmHtml(firstName?: string): string {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";
  return [
    `<p>${greeting}</p>`,
    `<p>Thank you for asking to join the Quill & Compass waitlist. We will write to you when the doors open for the 2026-27 school year.</p>`,
    `<p>Grace and peace,<br/>Quill & Compass</p>`,
  ].join("");
}

export const POST: APIRoute = async ({ request }) => {
  if (!RESEND_API_KEY || !WAITLIST_NOTIFY_TO || !WAITLIST_FROM) {
    return json({ ok: false, error: "Waitlist is not configured." }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Request body must be JSON." }, 400);
  }

  const validated = validateWaitlist(body);
  if (!validated.ok) {
    return json({ ok: false, error: validated.error }, 400);
  }

  const { email, firstName, company } = validated.data;

  // Honeypot: a non-empty `company` means a bot filled the hidden field.
  // Return success WITHOUT sending anything so the bot cannot detect the filter.
  if (company && company.trim().length > 0) {
    return json({ ok: true }, 200);
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    const ownerRes = await resend.emails.send({
      from: WAITLIST_FROM,
      to: WAITLIST_NOTIFY_TO,
      replyTo: email,
      subject: "New Quill & Compass waitlist signup",
      html: ownerNotifyHtml(email, firstName),
    });
    if (ownerRes.error) {
      return json({ ok: false, error: "Could not record your signup. Please try again." }, 502);
    }

    const confirmRes = await resend.emails.send({
      from: WAITLIST_FROM,
      to: email,
      subject: "You are on the Quill & Compass waitlist",
      html: subscriberConfirmHtml(firstName),
    });
    if (confirmRes.error) {
      return json({ ok: false, error: "Could not send your confirmation. Please try again." }, 502);
    }
  } catch {
    // Fail loud: never report a fake success when Resend is unreachable.
    return json({ ok: false, error: "Could not reach the mail service. Please try again." }, 502);
  }

  return json({ ok: true }, 200);
};
```

- [ ] **Step 9: Run the endpoint spec and confirm it PASSES (green).**

```bash
npx vitest run src/pages/api/waitlist.test.ts
```
Expect: all six endpoint cases pass (valid → 2 sends + ok; honeypot → 0 sends + ok; bad email → 400; non-JSON → 400; Resend throw → 502; Resend error object → 502).

- [ ] **Step 10: Implement `src/components/WaitlistForm.tsx` (React island).** No `sonner`; inline status text. Unique input ids via `idPrefix` so the same component can mount more than once without id collisions. The honeypot `company` field is visually hidden (off-screen, `aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`). States: `idle` → `submitting` → `done` / `error`.

```tsx
// src/components/WaitlistForm.tsx
import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "done" | "error";

export interface WaitlistFormProps {
  /** Prefix for input ids so multiple mounts do not collide. */
  idPrefix: string;
}

export default function WaitlistForm({ idPrefix }: WaitlistFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const emailId = `${idPrefix}-email`;
  const firstNameId = `${idPrefix}-firstName`;
  const companyId = `${idPrefix}-company`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      email: String(data.get("email") ?? ""),
      firstName: String(data.get("firstName") ?? "") || undefined,
      company: String(data.get("company") ?? ""),
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { ok: boolean; error?: string } = await res.json();
      if (res.ok && result.ok) {
        setStatus("done");
        form.reset();
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Could not reach the server. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <p className="waitlist-done" role="status">
        You are on the list. Watch your inbox for word when the doors open.
      </p>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <div className="waitlist-field">
        <label htmlFor={firstNameId}>First name (optional)</label>
        <input
          id={firstNameId}
          name="firstName"
          type="text"
          autoComplete="given-name"
          maxLength={80}
        />
      </div>

      <div className="waitlist-field">
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          inputMode="email"
        />
      </div>

      {/* Honeypot: hidden from humans, attractive to bots. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor={companyId}>Company</label>
        <input
          id={companyId}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Adding you…" : "Join the waitlist"}
      </button>

      {status === "error" && (
        <p className="waitlist-error" role="alert">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 11: Type-check the new TS/TSX so the island compiles.** Catch a wrong import or prop type before wiring it into the page.

```bash
npx tsc --noEmit
```
Expect: 0 errors. If `resend` types are missing, confirm `resend` is in `package.json` dependencies (Task 1) and `npm install` has run.

- [ ] **Step 12: Browser-verify the three form states by hand.** This is interactive UI; the unit tests above cover the wire contract, this confirms the rendered states.

```bash
npm run dev
```
Then, with the dev server up:
1. Navigate to `http://localhost:4321/` and scroll to the Colophon (the `WaitlistForm` mounts on `client:visible`).
2. Submit with an empty/invalid email → the native `required`/`type="email"` blocks submit (idle stays). Then type a clearly bad value bypassing native (e.g. paste `nope`) and submit → confirm the inline `.waitlist-error` text appears (`status: error`).
3. Submit a valid email (e.g. `you@example.com`). Without real Resend creds the endpoint returns `{ ok:false }` 500/502 → confirm the inline error renders (proves the error path). With real creds in `.env`, confirm the `.waitlist-done` "You are on the list." message replaces the form (`status: done`) and you receive both emails.
4. Confirm the honeypot `Company` input is NOT visible on screen and is skipped by Tab focus order.

Observable: button label flips to "Adding you…" while `submitting`; exactly one of done/error UI shows afterward.

- [ ] **Step 13: Add a Playwright structural smoke assertion for the form.** Append to `tests/e2e/smoke.spec.ts` (created in the Playwright task) a block asserting the form's accessible structure renders inside the Colophon. Structural only — no live email send.

```ts
// append inside tests/e2e/smoke.spec.ts
test("colophon renders an accessible waitlist form with a honeypot", async ({ page }) => {
  await page.goto("/");
  const colophon = page.locator('[data-act="colophon"]');
  await expect(colophon).toBeVisible();

  // Email input is present, required, and labelled.
  const email = colophon.getByLabel("Email");
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("type", "email");

  // Submit button present.
  await expect(colophon.getByRole("button", { name: /join the waitlist/i })).toBeVisible();

  // Honeypot "company" input exists in the DOM but is visually hidden (aria-hidden parent).
  const honeypot = colophon.locator('input[name="company"]');
  await expect(honeypot).toHaveCount(1);
  await expect(honeypot).toBeHidden();
});
```

- [ ] **Step 14: Run the full unit suite once to confirm nothing regressed.**

```bash
npx vitest run
```
Expect: `waitlist.test.ts` + `waitlist` endpoint test (+ any earlier tasks' tests) all green.

- [ ] **Step 15: Commit the waitlist slice.**

```bash
git add src/lib/waitlist.ts src/lib/waitlist.test.ts \
        src/pages/api/waitlist.ts src/pages/api/waitlist.test.ts \
        src/components/WaitlistForm.tsx .env.example tests/e2e/smoke.spec.ts
git commit -m "feat(waitlist): zod validation lib, Resend POST endpoint, and form island

- waitlistSchema + validateWaitlist (zod email<=254, firstName<=80, company honeypot)
- POST /api/waitlist: validate -> honeypot silent-skip -> Resend owner-notify + subscriber confirm, fail-loud (no fake success)
- WaitlistForm React island: idle/submitting/done/error, idPrefix-scoped ids, off-screen honeypot
- TDD: waitlist.test.ts + mocked-Resend endpoint test; Playwright structural smoke for the form"
```

---

### Task 6: PayoffSlot swappable island
**Files:**
- Create: `src/components/PayoffSlot.tsx`
- Modify: `tests/e2e/smoke.spec.ts` (append the stylized-slot structural assertion)

**Interfaces:**
- Consumes: nothing from earlier tasks (leaf component). Reads brand tokens from `src/styles/global.css` (Task 2) at runtime via CSS custom properties only — no import coupling.
- Produces: `PayoffSlot` (default React export) with props `{ kind:"stylized"|"recording"; src:string; alt:string; poster?:string }`. Rendered as `<PayoffSlot client:visible/>` inside `src/components/acts/Act2QuillWrites.astro` (Task 12). This is the V1-stylized / V2-recording swap boundary: `kind="stylized"` renders an `<img>` (animated-loop placeholder) using `src` + required `alt`; `kind="recording"` renders a `<video muted playsInline loop poster>` using `src` (mp4/webm) + `poster`. Stable test hooks: `data-payoff-kind` on the root and `data-testid="payoff-slot"` so Act II and Playwright can target it without DOM-shape coupling.

- [ ] **Step 1: Confirm React island deps exist (already added in Task 1).**
  These are the only runtime imports PayoffSlot needs; verify they resolve before writing code.
  Run:
  ```bash
  node -e "require.resolve('react'); require.resolve('react-dom'); console.log('react ok')"
  cat node_modules/@astrojs/react/package.json | node -e "process.stdin.resume()" >/dev/null 2>&1; \
    ls node_modules/@astrojs/react >/dev/null && echo "@astrojs/react ok"
  ```
  Confirm both lines print `ok`. If `@astrojs/react` is missing, stop and finish Task 1 first (it owns `npm i @astrojs/react` + the `react()` integration in `astro.config.mjs`).

- [ ] **Step 2: Write the PayoffSlot component (the swap boundary).**
  No state, no effects, no ScrollTrigger — this island only renders the correct media element for `kind`. The `<video>` uses `preload="none"` + `play().catch()` fallback per the ambient-loop rule (autoplay can be blocked on iOS Low-Power; a blocked autoplay must NOT throw). Explicit `width`/`height` + `aspectRatio` prevent CLS.
  Create `src/components/PayoffSlot.tsx`:
  ```tsx
  import { useEffect, useRef } from "react";

  export interface PayoffSlotProps {
    /** "stylized" = V1 manuscript-hand placeholder (<img>); "recording" = V2 real screen capture (<video>). */
    kind: "stylized" | "recording";
    /** stylized → image URL (webp/avif/animated gif/apng); recording → video URL (mp4/webm). */
    src: string;
    /** Required for the stylized <img>; also used as <video> aria-label. */
    alt: string;
    /** Poster still for the recording <video> (avif/webp). Ignored when kind="stylized". */
    poster?: string;
  }

  const FRAME_STYLE: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "auto",
    aspectRatio: "16 / 10",
    objectFit: "cover",
    borderRadius: "10px",
    border: "1px solid color-mix(in srgb, var(--color-qc-indigo) 22%, transparent)",
    boxShadow: "0 18px 48px -20px color-mix(in srgb, var(--color-qc-charcoal) 55%, transparent)",
    background: "var(--color-qc-parchment)",
    userSelect: "none",
  };

  export default function PayoffSlot({ kind, src, alt, poster }: PayoffSlotProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Ambient-loop rule: attempt autoplay, swallow the rejection (iOS Low-Power / autoplay block).
    useEffect(() => {
      if (kind !== "recording") return;
      const el = videoRef.current;
      if (!el) return;
      const attempt = el.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {
          /* autoplay blocked → leave the poster still showing, no throw */
        });
      }
    }, [kind, src]);

    if (kind === "recording") {
      return (
        <div
          data-testid="payoff-slot"
          data-payoff-kind="recording"
          className="payoff-slot payoff-slot--recording"
        >
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            aria-label={alt}
            muted
            playsInline
            loop
            autoPlay
            preload="none"
            width={1280}
            height={800}
            style={FRAME_STYLE}
          />
        </div>
      );
    }

    // kind === "stylized"  → the V1 manuscript-hand placeholder image.
    return (
      <div
        data-testid="payoff-slot"
        data-payoff-kind="stylized"
        className="payoff-slot payoff-slot--stylized"
      >
        <img
          src={src}
          alt={alt}
          width={1280}
          height={800}
          decoding="async"
          loading="lazy"
          style={FRAME_STYLE}
        />
      </div>
    );
  }
  ```

- [ ] **Step 3: Typecheck the new island in isolation.**
  Catches prop-type drift from the contract before any rendering.
  Run:
  ```bash
  npx tsc --noEmit
  ```
  Confirm `0 errors`. If `React.CSSProperties` is unresolved, ensure `@types/react` is installed (Task 1) and `"jsx": "react-jsx"` is set in `tsconfig.json`.

- [ ] **Step 4: Browser-verify the stylized placeholder (the V1 default).**
  Act II (Task 12) will mount `<PayoffSlot client:visible kind="stylized" src="/assets/payoff/lesson-stylized.webp" alt="A handwritten lesson page rendered in the manuscript hand" />`. Until then, verify the island standalone via a scratch page.
  Run:
  ```bash
  printf '%s\n' \
    '---' \
    'import PayoffSlot from "../components/PayoffSlot.tsx";' \
    '---' \
    '<main style="max-width:760px;margin:4rem auto;padding:0 1rem;">' \
    '  <PayoffSlot client:visible kind="stylized" src="/assets/payoff/lesson-stylized.webp" alt="A handwritten lesson page rendered in the manuscript hand" />' \
    '</main>' \
    > src/pages/_devpayoff.astro
  npm run dev
  ```
  In the browser open `http://localhost:4321/_devpayoff`. Confirm: the placeholder image renders inside a bordered, rounded parchment frame; DevTools shows the root `<div data-payoff-kind="stylized">` wrapping an `<img>` whose `alt` reads "A handwritten lesson page rendered in the manuscript hand"; no layout shift on load (the `aspect-ratio: 16/10` box reserves height before the image decodes); zero console errors. Stop dev, then remove the scratch page:
  ```bash
  rm src/pages/_devpayoff.astro
  ```

- [ ] **Step 5: Browser-verify the recording variant + blocked-autoplay fallback (the V2 swap).**
  Prove the same boundary handles `kind="recording"` and that a blocked autoplay keeps the poster (no thrown error).
  Run:
  ```bash
  printf '%s\n' \
    '---' \
    'import PayoffSlot from "../components/PayoffSlot.tsx";' \
    '---' \
    '<main style="max-width:760px;margin:4rem auto;padding:0 1rem;">' \
    '  <PayoffSlot client:visible kind="recording" src="/assets/payoff/lesson-recording.mp4" poster="/assets/payoff/lesson-poster.avif" alt="Screen recording of a generated lesson" />' \
    '</main>' \
    > src/pages/_devpayoff2.astro
  npm run dev
  ```
  In the browser open `http://localhost:4321/_devpayoff2`. Confirm: DevTools shows `<div data-payoff-kind="recording">` wrapping a `<video muted playsinline loop autoplay preload="none" poster="/assets/payoff/lesson-poster.avif">`; the poster still is visible; with the placeholder mp4 absent the poster remains and the console shows NO uncaught error (the `play().catch()` swallowed the rejection). Stop dev, then remove the scratch page:
  ```bash
  rm src/pages/_devpayoff2.astro
  ```

- [ ] **Step 6: Add a Playwright structural assertion for the stylized slot.**
  No aesthetic unit test — assert the structural contract Act II depends on: a stylized slot renders an `<img>` carrying its `alt`. Append to the existing `tests/e2e/smoke.spec.ts` (created in Task 14). This test drives `index.astro`, where Act II mounts the stylized slot by default.
  Add this `test(...)` block inside the existing `test.describe` in `tests/e2e/smoke.spec.ts`:
  ```ts
  test("Act II stylized payoff slot renders an <img> with its alt", async ({ page }) => {
    await page.goto("/");

    const slot = page.locator('[data-testid="payoff-slot"][data-payoff-kind="stylized"]');
    await expect(slot).toHaveCount(1);

    // The swap boundary's V1 contract: stylized → <img> (not <video>), with non-empty alt.
    const img = slot.locator("img");
    await expect(img).toHaveCount(1);
    await expect(slot.locator("video")).toHaveCount(0);

    const alt = await img.getAttribute("alt");
    expect(alt && alt.trim().length).toBeGreaterThan(0);
  });
  ```

- [ ] **Step 7: Run the smoke spec and confirm the new assertion passes.**
  Requires Act II (Task 12) + `index.astro` (Task 13) to be wired with a default stylized slot. If those are not yet built, run only this single test against the dev server to confirm it is well-formed (it will fail-because-absent, which is expected pre-integration); otherwise run the full headless smoke pass.
  Run:
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "stylized payoff slot"
  ```
  Confirm the named test PASSES once Act II is integrated. (Pre-integration, expect "expected count 1, received 0" — that is the correct failing signal that the slot is not yet on the page, not a defect in this task.)

- [ ] **Step 8: Lint the new files.**
  Run:
  ```bash
  npx eslint src/components/PayoffSlot.tsx tests/e2e/smoke.spec.ts
  ```
  Confirm `0 errors`. The only realistic flags are an unused `poster` warning (it is consumed in the recording branch — keep it) or `jsx-a11y` on the `<video>` (satisfied here by `aria-label={alt}`).

- [ ] **Step 9: Commit.**
  Run:
  ```bash
  git add src/components/PayoffSlot.tsx tests/e2e/smoke.spec.ts
  git commit -m "feat(payoff): swappable PayoffSlot island (stylized img / recording video) + smoke assertion"
  ```
```

---

### Task 7: Act 0 — the threshold (hero) + act0 engine timeline

**Files:**
- Create: `src/components/acts/Act0Threshold.astro`
- Create: `src/scripts/acts/act0.ts`
- Modify (test): `tests/e2e/smoke.spec.ts` (add Act 0 structural assertions; full file authored in Task 12, here we add only the Act-0 block)

**Interfaces:**
- **Consumes:**
  - `src/content/manuscript.ts` → `act0: { title: string; subtitle: string; enter: string }` (Task 3).
  - `src/layouts/Base.astro` → props `{ title: string; description: string; lcpPoster?: string }` (Task 2) — the hero poster path is passed through `lcpPoster` so Base can emit the preload `<link>`.
  - `src/lib/motion.ts` → `MOTION_QUERIES`, `prefersReducedMotion(mqlMatch)` (Task 6) — `act0.ts` reads `MOTION_QUERIES` indirectly via the matchMedia context handed in by `initScroll()`; no direct import needed beyond GSAP context.
  - `gsap` + `ScrollTrigger` (registered once in `src/scripts/scroll.ts`, Task 11).
- **Produces:**
  - `src/scripts/acts/act0.ts` → `export function registerAct0(): void` — called by `initScroll()` inside the `motionOK` branch of `gsap.matchMedia()` (Task 11 wires it).
  - `src/components/acts/Act0Threshold.astro` — the `[data-act="0"]` section consumed by `src/pages/index.astro` (Task 10).

---

- [ ] **Step 1: Create the Act 0 section markup with the SVG-draw title, quill, ambient candle video, and LCP poster.**

  Create `src/components/acts/Act0Threshold.astro`. The illuminated title is rendered as inline SVG `<text>` with `stroke` set so `act0.ts` can animate `stroke-dashoffset`; a duplicate solid `<text>` fades in underneath for the filled glyphs. The LCP poster is a real `<img>` with `fetchpriority="high"` and NOT lazy (its preload is emitted by `Base.astro` via the `lcpPoster` prop wired in Task 10). The ambient candle is a muted autoplay loop `<video>` with `preload="none"` and a poster fallback.

  ```astro
  ---
  // src/components/acts/Act0Threshold.astro
  import { act0 } from "../../content/manuscript";

  // LCP element = the hero poster still. Base.astro preloads this via lcpPoster.
  const HERO_POSTER = "/assets/posters/act0-hero.avif";
  const CANDLE_POSTER = "/assets/posters/act0-candle.avif";
  const CANDLE_LOOP = "/assets/video/act0-candle.webm";
  ---

  <section
    data-act="0"
    class="act0"
    aria-label={act0.title}
  >
    <!-- LCP element: hero poster still. fetchpriority high, never lazy. -->
    <img
      class="act0__poster"
      src={HERO_POSTER}
      alt=""
      width="1280"
      height="720"
      fetchpriority="high"
      decoding="async"
      aria-hidden="true"
    />

    <!-- Ambient candle: muted autoplay loop, preload none, poster fallback. -->
    <video
      class="act0__candle"
      data-act0-candle
      muted
      playsinline
      autoplay
      loop
      preload="none"
      poster={CANDLE_POSTER}
      aria-hidden="true"
    >
      <source src={CANDLE_LOOP} type="video/webm" />
    </video>

    <div class="act0__frame">
      <img
        class="act0__logo"
        src="/assets/branding/logo.svg"
        alt="Quill and Compass"
        width="180"
        height="60"
        data-act0-logo
      />

      <!-- Illuminated title. Stroke <text> is drawn via stroke-dashoffset;
           the fill <text> fades in beneath it. -->
      <svg
        class="act0__title"
        data-act0-title
        viewBox="0 0 900 220"
        role="img"
        aria-label={act0.title}
      >
        <text
          class="act0__title-fill gold-text-svg"
          data-act0-title-fill
          x="450"
          y="120"
          text-anchor="middle"
        >{act0.title}</text>
        <text
          class="act0__title-stroke"
          data-act0-title-stroke
          x="450"
          y="120"
          text-anchor="middle"
        >{act0.title}</text>
      </svg>

      <p class="act0__subtitle" data-act0-subtitle>{act0.subtitle}</p>

      <!-- Quill: lifts in via the act0 timeline. -->
      <img
        class="act0__quill"
        src="/assets/branding/quill.svg"
        alt=""
        width="64"
        height="160"
        data-act0-quill
        aria-hidden="true"
      />

      <a class="act0__enter" href="#act1" data-act0-enter>{act0.enter}</a>
    </div>
  </section>

  <style>
    .act0 {
      position: relative;
      min-height: 100svh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: var(--qc-parchment);
      color: var(--qc-charcoal);
    }
    .act0__poster,
    .act0__candle {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      aspect-ratio: 16 / 9;
      user-select: none;
      pointer-events: none;
    }
    .act0__candle {
      opacity: 0.35;
      mix-blend-mode: multiply;
    }
    .act0__frame {
      position: relative;
      z-index: 1;
      display: grid;
      justify-items: center;
      gap: 1.5rem;
      padding: 2rem;
      text-align: center;
    }
    .act0__logo {
      width: 180px;
      height: auto;
      opacity: 0;
    }
    .act0__title {
      width: min(90vw, 900px);
      height: auto;
      aspect-ratio: 900 / 220;
    }
    .act0__title text {
      font-family: var(--qc-font-display, "Cormorant Garamond"), serif;
      font-size: 120px;
      font-weight: 600;
    }
    .act0__title-stroke {
      fill: none;
      stroke: var(--qc-gold);
      stroke-width: 1.25;
    }
    .gold-text-svg {
      fill: var(--qc-gold);
      opacity: 0;
    }
    .act0__subtitle {
      font-family: var(--qc-font-display, "Cormorant Garamond"), serif;
      font-size: clamp(1.1rem, 2.5vw, 1.6rem);
      color: var(--qc-indigo);
      max-width: 32ch;
      opacity: 0;
    }
    .act0__quill {
      width: 64px;
      height: auto;
      opacity: 0;
    }
    .act0__enter {
      display: inline-block;
      font-family: var(--qc-font-body, "Inter"), sans-serif;
      font-size: 0.95rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--qc-charcoal);
      text-decoration: none;
      border-bottom: 1px solid var(--qc-gold);
      padding-bottom: 0.25rem;
      opacity: 0;
    }

    /* Reduced motion / Low-Power: show the final still. saveStyles in scroll.ts
       captures these as the static end-state; this rule is the CSS safety net. */
    @media (prefers-reduced-motion: reduce) {
      .act0__logo,
      .act0__subtitle,
      .act0__quill,
      .act0__enter,
      .gold-text-svg {
        opacity: 1;
      }
      .act0__title-stroke {
        stroke-dashoffset: 0 !important;
      }
    }
  </style>
  ```

  Note: `quill.svg` and `logo.svg` placeholders are produced as branding assets in Task 9; the candle `.webm` + posters are placeholder media also produced in Task 9. This task references them by their pinned paths.

- [ ] **Step 2: Verify the section compiles standalone in dev.**

  Run: `npm run dev`, then open `http://localhost:4321` (after Task 10 wires it into `index.astro`; until then verify via `astro check`). For now confirm the component has no template errors.

  Run: `npx astro check`
  Confirm: no errors reported for `Act0Threshold.astro` (the import of `act0` resolves against Task 3's `manuscript.ts`).

- [ ] **Step 3: Write the `registerAct0()` timeline (title stroke-draw + quill lift).**

  Create `src/scripts/acts/act0.ts`. This is the intro choreography: on entering `[data-act="0"]` the title strokes draw via `stroke-dashoffset`, the gold fill fades in, then logo/subtitle/quill/enter stagger up. The stroke length is measured per-glyph at runtime via `getComputedTextLength()` (SVG `<text>` has no `getTotalLength`, so we seed `stroke-dasharray` from the measured advance width as an approximation and animate `stroke-dashoffset` to 0). GSAP + ScrollTrigger are already registered by `initScroll()` (Task 11); this module only calls `gsap`/`ScrollTrigger` APIs.

  ```ts
  // src/scripts/acts/act0.ts
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";

  /**
   * Act 0 — the threshold.
   * Title gold stroke-draw (stroke-dashoffset) + quill lift timeline.
   * Called only inside the motionOK branch of initScroll()'s gsap.matchMedia().
   */
  export function registerAct0(): void {
    const section = document.querySelector<HTMLElement>('[data-act="0"]');
    if (!section) return;

    const stroke = section.querySelector<SVGTextElement>(
      "[data-act0-title-stroke]",
    );
    const fill = section.querySelector<SVGTextElement>(
      "[data-act0-title-fill]",
    );
    const logo = section.querySelector<HTMLElement>("[data-act0-logo]");
    const subtitle = section.querySelector<HTMLElement>("[data-act0-subtitle]");
    const quill = section.querySelector<HTMLElement>("[data-act0-quill]");
    const enter = section.querySelector<HTMLElement>("[data-act0-enter]");

    // Seed the stroke dash from the measured glyph advance so the draw runs
    // its full length. getComputedTextLength is the SVG-<text> analogue of
    // getTotalLength (which <text> nodes do not expose).
    if (stroke) {
      const len = stroke.getComputedTextLength() * 1.4; // pad for stroke joins
      gsap.set(stroke, { strokeDasharray: len, strokeDashoffset: len });
    }

    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        trigger: section,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    if (logo) tl.to(logo, { opacity: 1, y: 0, duration: 0.6 }, 0);

    if (stroke) {
      tl.to(
        stroke,
        { strokeDashoffset: 0, duration: 1.6, ease: "power1.inOut" },
        0.1,
      );
    }
    if (fill) {
      tl.to(fill, { opacity: 1, duration: 0.9 }, ">-0.6");
    }
    if (subtitle) {
      tl.fromTo(
        subtitle,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.7 },
        "<0.1",
      );
    }
    if (quill) {
      tl.fromTo(
        quill,
        { opacity: 0, y: 40, rotation: -8 },
        { opacity: 1, y: 0, rotation: 0, duration: 0.8, ease: "back.out(1.4)" },
        "<",
      );
    }
    if (enter) {
      tl.fromTo(
        enter,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.6 },
        ">-0.2",
      );
    }

    // Attempt the ambient candle loop; fall back silently to the poster still.
    const candle = section.querySelector<HTMLVideoElement>("[data-act0-candle]");
    if (candle) {
      candle.play().catch(() => {
        /* autoplay blocked (iOS Low-Power) — poster remains, no-op */
      });
    }

    // The timeline mutated stroke/fill state; let ScrollTrigger remeasure.
    ScrollTrigger.refresh();
  }
  ```

- [ ] **Step 4: Type-check the new engine module.**

  Run: `npx tsc --noEmit`
  Confirm: 0 errors. (`gsap` + `gsap/ScrollTrigger` types resolve from the `gsap` package added in Task 1; the `?.`-free narrowing via `if (x)` guards keeps strict-null happy.)

- [ ] **Step 5: Browser-verify the intro animates (motionOK path).**

  Run: `npm run dev` (after Task 10 has rendered `Act0Threshold` into `index.astro`).
  Open `http://localhost:4321` with default OS motion settings.
  Confirm all of:
  - The logo fades in, then the title glyphs visibly stroke-draw in gold (outline traces first), then the gold fill fades in beneath.
  - The subtitle rises and fades in; the quill lifts up with a slight overshoot and settles upright; the "Begin" / enter affordance fades in last.
  - The ambient candle layer is faintly visible behind the frame (or, if autoplay is blocked, the candle poster still shows with no console error).
  - No layout shift on load (the poster `<img>` reserves its box via `width`/`height` + `aspect-ratio`).

- [ ] **Step 6: Browser-verify the reduced-motion path shows the final still.**

  In DevTools, open Rendering and set "Emulate CSS prefers-reduced-motion: reduce", then hard-reload.
  Confirm all of:
  - The title fill, subtitle, logo, quill, and enter link are all immediately visible at full opacity (no draw-in, no stagger).
  - The stroke title shows its outline fully drawn (`stroke-dashoffset: 0`), not a partial trace.
  - No Lenis smooth-scroll is active (native scroll); scrolling the page does not trigger the stroke animation (because `initScroll()`'s reduce branch never calls `registerAct0()` — Task 11).
  - No console errors.

- [ ] **Step 7: Add Act-0 structural smoke assertions to the Playwright spec.**

  Append the Act-0 block to `tests/e2e/smoke.spec.ts` (the file's scaffold + shared setup is created in Task 12; here we add only these assertions). This asserts the section, the `<h1>`-equivalent illuminated title (exposed to AT via `aria-label`/`role="img"`), and the LCP poster + its preload are present.

  ```ts
  // tests/e2e/smoke.spec.ts  (Act 0 block — appended)
  import { test, expect } from "@playwright/test";

  test("Act 0 threshold: title, LCP poster, and preload present", async ({
    page,
  }) => {
    await page.goto("/");

    // The threshold section exists.
    const act0 = page.locator('[data-act="0"]');
    await expect(act0).toHaveCount(1);

    // The illuminated title is exposed to assistive tech (role=img + label).
    const title = act0.locator('[data-act0-title][role="img"]');
    await expect(title).toHaveCount(1);
    await expect(title).toHaveAttribute("aria-label", /.+/);

    // LCP poster: real <img>, fetchpriority high, NOT lazy.
    const poster = act0.locator("img.act0__poster");
    await expect(poster).toHaveAttribute("fetchpriority", "high");
    await expect(poster).not.toHaveAttribute("loading", "lazy");

    // Base.astro emitted the preload for the same poster.
    const preload = page.locator(
      'link[rel="preload"][as="image"][href*="act0-hero"]',
    );
    await expect(preload).toHaveCount(1);
  });

  test("Act 0 threshold: reduced motion shows the final still", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/");

    // Under reduce, the gold fill title is rendered (final still),
    // and no scrub <canvas> from later acts is initialized on Act 0.
    const fill = page.locator("[data-act0-title-fill]");
    await expect(fill).toHaveCount(1);
    expect(errors, errors.join("\n")).toHaveLength(0);

    await ctx.close();
  });
  ```

- [ ] **Step 8: Run the Act-0 Playwright assertions.**

  Run: `npx playwright test tests/e2e/smoke.spec.ts -g "Act 0"`
  Confirm: both "Act 0" tests pass (the build must include Task 10's `index.astro` and Task 2's `Base.astro` preload wiring; if running this task in isolation, mark these as expected-to-pass once Tasks 2/10/12 land and re-run).

- [ ] **Step 9: Commit.**

  Run:
  ```bash
  git add src/components/acts/Act0Threshold.astro src/scripts/acts/act0.ts tests/e2e/smoke.spec.ts
  git commit -m "feat(act0): threshold hero section + title stroke-draw timeline

  - Act0Threshold.astro: illuminated SVG title, quill, ambient candle loop,
    LCP poster (fetchpriority=high, non-lazy), data-act=0
  - registerAct0(): gold stroke-dashoffset draw + quill lift, candle play().catch
  - reduced-motion CSS safety net shows the final still
  - Playwright: title/poster/preload structural asserts + reduced-motion still"
  ```

---

### Task 8: Act I — the blank page (the ache) + act1 timeline

**Files:**
- Create: `src/components/acts/Act1BlankPage.astro` (the empty sheet, candle ambient loop, drifting "unwritten things" from `act1` copy, kinetic-type reveal targets, `data-act="1"`).
- Create: `src/scripts/acts/act1.ts` (`registerAct1()` — splits the ache lines into per-word `<span>`s and scrubs a staggered reveal; drifting-word fade triggers).
- Test: `tests/e2e/smoke.spec.ts` (extend the existing Playwright smoke with Act I structural + copy assertions — Act I `data-act="1"` section present, the ache line text present, reduced-motion leaves it static).

**Interfaces:**
- Consumes:
  - `src/content/manuscript.ts` → `act1` (typed copy object; per the contract `act1` carries the ache copy. This task assumes the fields `act1.eyebrow:string`, `act1.line:string`, `act1.drift:string[]` — the drifting "unwritten things". If Task 6 named them differently, use the names Task 6 produced; do NOT invent extra fields).
  - `src/lib/motion.ts` → `MOTION_QUERIES` (only referenced indirectly; `registerAct1()` is called from inside the `motionOK` branch built by `initScroll()` in `src/scripts/scroll.ts`).
  - `gsap`, `ScrollTrigger` (registered globally by `initScroll()` in Task 7 before `registerAct1()` runs).
- Produces:
  - `src/scripts/acts/act1.ts` → `function registerAct1():void` — the EXACT symbol `src/scripts/scroll.ts` imports and calls in its `motionOK` branch (`import { registerAct1 } from "./acts/act1"`). No other export.
  - `src/components/acts/Act1BlankPage.astro` → default Astro component (no props) rendering a `<section data-act="1">` with `[data-a1-line]`, `[data-a1-word-target]`, and `[data-a1-drift]` hooks that `registerAct1()` queries.

---

- [ ] **Step 1: Scaffold the Act I section markup (`Act1BlankPage.astro`) consuming `act1` copy.**
  Create `src/components/acts/Act1BlankPage.astro`. Markup + copy live in `.astro` for SEO (per Global Constraints); the script only animates existing nodes. The candle is an ambient loop `<video>` (muted/playsinline/autoplay/loop/preload="none"/poster) with explicit `width`/`height` + `aspect-ratio` to hold CLS at ~0.

  ```astro
  ---
  import { act1 } from "../../content/manuscript";
  ---
  <section
    data-act="1"
    class="act1"
    aria-labelledby="act1-heading"
  >
    <div class="act1__inner">
      <p class="act1__eyebrow" data-a1-reveal>{act1.eyebrow}</p>

      <h2 id="act1-heading" class="act1__line gold-text" data-a1-line>
        {act1.line}
      </h2>

      <ul class="act1__drift" aria-hidden="true">
        {act1.drift.map((thing) => (
          <li class="act1__drift-item" data-a1-drift>{thing}</li>
        ))}
      </ul>

      <div class="act1__sheet" data-a1-sheet>
        <video
          class="act1__candle"
          width="480"
          height="640"
          poster="/assets/posters/act1-candle.avif"
          muted
          playsinline
          autoplay
          loop
          preload="none"
          aria-hidden="true"
        >
          <source src="/assets/loops/act1-candle.webm" type="video/webm" />
        </video>
      </div>
    </div>
  </section>

  <style>
    .act1 {
      position: relative;
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: clamp(2rem, 6vw, 6rem);
      background: var(--qc-parchment);
      color: var(--qc-charcoal);
    }
    .act1__inner {
      position: relative;
      max-width: 56rem;
      width: 100%;
      text-align: center;
    }
    .act1__eyebrow {
      font-family: var(--qc-font-body);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 0.8rem;
      opacity: 0.7;
      margin-bottom: 1.5rem;
    }
    .act1__line {
      font-family: var(--qc-font-display);
      font-weight: 500;
      font-size: clamp(2rem, 6vw, 4.25rem);
      line-height: 1.08;
      margin: 0 0 3rem;
    }
    /* Per-word spans injected by registerAct1(); keep wrapping natural. */
    .act1__line .a1-word {
      display: inline-block;
      will-change: transform, opacity;
    }
    .act1__drift {
      list-style: none;
      margin: 0 auto 3rem;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1.75rem;
      justify-content: center;
      max-width: 44rem;
    }
    .act1__drift-item {
      font-family: var(--qc-font-script, var(--qc-font-display));
      font-size: clamp(1.1rem, 2.5vw, 1.6rem);
      color: var(--qc-indigo);
      opacity: 0.55;
      will-change: transform, opacity;
    }
    .act1__sheet {
      position: relative;
      margin-inline: auto;
      width: min(30rem, 80vw);
      aspect-ratio: 3 / 4;
      border: 1px solid color-mix(in srgb, var(--qc-charcoal) 12%, transparent);
      box-shadow: 0 24px 60px -32px color-mix(in srgb, var(--qc-charcoal) 60%, transparent);
      overflow: hidden;
    }
    .act1__candle {
      width: 100%;
      height: 100%;
      object-fit: cover;
      aspect-ratio: 3 / 4;
      display: block;
    }
  </style>
  ```

- [ ] **Step 2: Browser-verify the static Act I section renders before any scripting.**
  The act is wired into `src/pages/index.astro` by Task 13; for an isolated check, temporarily confirm against the page that already imports it (or add a one-line import if running this task standalone — revert before commit if you add it).
  Run: `npm run dev`; open the page; scroll to the Act I section. Confirm observable: the eyebrow, the ache headline (`act1.line`), the drifting items (`act1.drift`), and the candle sheet box all render with no layout shift (the sheet reserves its `3/4` box via `aspect-ratio`). The candle `<video>` shows its `poster` if `act1-candle.webm` is a placeholder. No console errors.

- [ ] **Step 3: Commit the static Act I markup.**
  ```bash
  git add src/components/acts/Act1BlankPage.astro
  git commit -m "feat(act1): static blank-page section markup + candle ambient loop"
  ```

- [ ] **Step 4: Add the `act1` ache-line + drift assertions to the Playwright smoke (write failing E2E).**
  Extend `tests/e2e/smoke.spec.ts` (created in an earlier task) with Act I structural + copy checks. These assert the `data-act="1"` section, the ache line text, the per-word split after init (motion branch), and that under reduced-motion the words are visible/static. Import the real copy so the test tracks the content module.

  ```ts
  import { test, expect } from "@playwright/test";
  import { act1 } from "../../src/content/manuscript";

  test.describe("Act I — the blank page", () => {
    test("renders the data-act=1 section with the ache line and drift items", async ({ page }) => {
      await page.goto("/");
      const act = page.locator('[data-act="1"]');
      await expect(act).toHaveCount(1);

      // The ache headline text is present (SEO: copy lives in .astro markup).
      await expect(act.locator("[data-a1-line]")).toContainText(act1.line);

      // Every drift "unwritten thing" is rendered.
      for (const thing of act1.drift) {
        await expect(act.locator("[data-a1-drift]", { hasText: thing })).toHaveCount(1);
      }
    });

    test("motion branch splits the ache line into per-word spans", async ({ page }) => {
      await page.goto("/");
      const words = page.locator('[data-act="1"] [data-a1-line] .a1-word');
      // registerAct1() injects one span per whitespace-delimited word.
      await expect(words.first()).toBeVisible();
      expect(await words.count()).toBeGreaterThan(1);
    });

    test("reduced-motion keeps the ache line visible and static (no scrub init)", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto("/");
      const line = page.locator('[data-act="1"] [data-a1-line]');
      await expect(line).toBeVisible();
      // Under reduce, registerAct1() is never called: NO per-word spans are injected.
      await expect(page.locator('[data-act="1"] [data-a1-line] .a1-word')).toHaveCount(0);
      await context.close();
    });
  });
  ```

  Run: `npx playwright test tests/e2e/smoke.spec.ts -g "Act I"` → EXPECT FAIL (the `.a1-word` split assertion fails because `registerAct1()` does not exist yet; the reduced-motion "static" assertion documents the contract the script must honor).

- [ ] **Step 5: Implement `registerAct1()` — split the ache line into words + scrub a staggered reveal, and drift-fade the unwritten things.**
  Create `src/scripts/acts/act1.ts`. `gsap` + `ScrollTrigger` are already registered by `initScroll()` (Task 7); this module assumes the global plugin registration and only builds triggers scoped to `[data-act="1"]`. The single export is `registerAct1`. The word-split is a tiny in-house splitter (no paid SplitText dependency) that wraps each whitespace token in a `.a1-word` span — exactly the hook the Playwright test asserts. Each `ScrollTrigger` scrubs against scroll progress (the engine drives `ScrollTrigger.update` via Lenis; this act owns its triggers, never the React islands).

  ```ts
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";

  /**
   * Wrap each whitespace-delimited token of `el`'s text in a
   * <span class="a1-word"> so it can be staggered independently.
   * In-house (no SplitText license). Idempotent: bails if already split.
   */
  function splitWords(el: HTMLElement): HTMLElement[] {
    if (el.querySelector(".a1-word")) {
      return Array.from(el.querySelectorAll<HTMLElement>(".a1-word"));
    }
    const tokens = (el.textContent ?? "").trim().split(/\s+/);
    el.textContent = "";
    const spans: HTMLElement[] = [];
    tokens.forEach((token, i) => {
      const span = document.createElement("span");
      span.className = "a1-word";
      span.textContent = token;
      el.appendChild(span);
      if (i < tokens.length - 1) {
        // Preserve a real, wrapping space between words.
        el.appendChild(document.createTextNode(" "));
      }
      spans.push(span);
    });
    return spans;
  }

  export function registerAct1(): void {
    const section = document.querySelector<HTMLElement>('[data-act="1"]');
    if (!section) return;

    // ---- Eyebrow: gentle fade/rise as the act enters ----
    const eyebrow = section.querySelector<HTMLElement>("[data-a1-reveal]");
    if (eyebrow) {
      gsap.from(eyebrow, {
        autoAlpha: 0,
        y: 24,
        ease: "power2.out",
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          end: "top 45%",
          scrub: true,
        },
      });
    }

    // ---- The ache line: per-word staggered handwriting-in on scrub ----
    const line = section.querySelector<HTMLElement>("[data-a1-line]");
    if (line) {
      const words = splitWords(line);
      gsap.set(words, { autoAlpha: 0, yPercent: 40 });
      gsap.to(words, {
        autoAlpha: 1,
        yPercent: 0,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: line,
          start: "top 78%",
          end: "top 38%",
          scrub: true,
        },
      });
    }

    // ---- Drifting "unwritten things": each fades up + drifts on its own ----
    const drifts = section.querySelectorAll<HTMLElement>("[data-a1-drift]");
    drifts.forEach((item, i) => {
      gsap.fromTo(
        item,
        { autoAlpha: 0, y: 36, x: i % 2 === 0 ? -18 : 18 },
        {
          autoAlpha: 0.55,
          y: 0,
          x: 0,
          ease: "sine.out",
          scrollTrigger: {
            trigger: item,
            start: "top 90%",
            end: "top 60%",
            scrub: true,
          },
        }
      );
    });

    // ---- The blank sheet: subtle parallax rise as the act resolves ----
    const sheet = section.querySelector<HTMLElement>("[data-a1-sheet]");
    if (sheet) {
      gsap.from(sheet, {
        yPercent: 12,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }
  }
  ```

- [ ] **Step 6: Confirm `registerAct1` is wired into the `motionOK` branch of `initScroll()`.**
  `src/scripts/scroll.ts` (Task 7) must import and call `registerAct1` only inside the `motionOK` matchMedia branch (never under `reduce`). Confirm the import line exists exactly; if Task 7's scaffold left it stubbed, ensure it reads:
  ```ts
  import { registerAct1 } from "./acts/act1";
  // ...inside mm.add(MOTION_QUERIES.motionOK, () => { ... registerAct1(); ... })
  ```
  Do NOT add a `reduce`-branch call to `registerAct1` — the reduced-motion path uses `revealStatic()` only, which is what keeps the `.a1-word` count at 0 (the test contract from Step 4).

- [ ] **Step 7: Re-run the Act I Playwright smoke (EXPECT PASS).**
  Run: `npx playwright test tests/e2e/smoke.spec.ts -g "Act I"` → EXPECT PASS. All three cases green: the section + ache line + drift items render from markup; the motion branch injects more than one `.a1-word` span; and under `reducedMotion: "reduce"` the line is visible with zero `.a1-word` spans (proving no scrub init).

- [ ] **Step 8: Browser-verify the reveal-on-scroll and the reduced-motion static fallback by eye.**
  Run: `npm run dev`. Scroll slowly into the Act I section; confirm observable: the ache headline's words rise and fade in **as you scroll** (scrubbed, not time-based — scrolling back up reverses them), and each drifting "unwritten thing" fades up + slides toward center in alternating directions. Then enable reduced motion (DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce") and hard-reload: confirm the headline is fully visible immediately, no per-word animation occurs, native scrolling works (no Lenis), and there are no console errors.

- [ ] **Step 9: Commit the Act I timeline + the extended smoke test.**
  ```bash
  git add src/scripts/acts/act1.ts tests/e2e/smoke.spec.ts
  git commit -m "feat(act1): registerAct1 scrubbed word-reveal + drift fades; Playwright Act I smoke"
  ```

---

### Task 9: Act II — The Quill Writes a Lesson (HERO set-piece) + act2 timeline

**Files:**
- Create: `src/components/acts/Act2QuillWrites.astro`
- Create: `src/scripts/acts/act2.ts`
- Create: `scripts/encode.sh`
- Create (placeholder): `public/assets/frames/act2/lesson_0001.webp` … `lesson_0090.webp` (placeholder set), `public/assets/posters/act2-final.avif`
- Modify: `src/scripts/scroll.ts` (wire `registerAct2()` into the `motionOK` branch and the final-still path under `reduce` — already stubbed in Task 8; this task fills the real body)
- Modify: `tests/e2e/smoke.spec.ts` (add Act II structural assertions)

**Interfaces:**
- Consumes:
  - `src/lib/frame-sequence.ts` → `class FrameSequence{ constructor(opts:{urls:string[];canvas:HTMLCanvasElement;windowSize?:number}); preload(initial?:number):Promise<void>; render(progress:number):void; destroy():void }` and `frameIndexForProgress(progress:number,total:number):number`.
  - `src/lib/motion.ts` → `MOTION_QUERIES`, `pickFrameCount(isDesktop:boolean, desktopN:number, mobileN:number):boolean→number`.
  - `src/content/manuscript.ts` → `act2={ eyebrow:string; line:string; lessonText:string[] }`.
  - `src/components/PayoffSlot.tsx` → React island, props `{ kind:"stylized"|"recording"; src:string; alt:string; poster?:string }`.
- Produces:
  - `src/scripts/acts/act2.ts` → `export function registerAct2():void` (consumed by `src/scripts/scroll.ts`).
  - `Act2QuillWrites.astro` renders the `[data-act="2"]` section with `<canvas data-frames>`, `<svg data-handwriting>` overlay, and `<PayoffSlot client:visible/>` — the DOM contract Playwright (Task 13) asserts.

---

- [ ] **Step 1: Add the placeholder poster + a placeholder frame-sequence note.**
  Real Grok footage does not exist yet (Stage 1). Generate a deterministic placeholder sequence so the scrub is visible now. Run this throwaway encoder against any 90-frame source, OR generate flat placeholder frames directly with the ffmpeg lavfi gradient below. Run:
  ```bash
  mkdir -p public/assets/frames/act2 public/assets/posters
  # 90 placeholder frames: a parchment field with a sweeping gold gradient (stands in for ink spreading).
  # The %04d index MUST be 1-based and contiguous (lesson_0001..lesson_0090).
  for i in $(seq -w 1 90); do
    pct=$(awk "BEGIN{printf \"%.3f\", ($i-1)/89}")
    ffmpeg -hide_banner -loglevel error -f lavfi \
      -i "color=c=0xF9F5EF:s=1280x720:d=1,format=rgba" \
      -vf "drawbox=x=0:y=0:w=iw*${pct}:h=ih:color=0xD9A441@0.35:t=fill,format=rgba" \
      -frames:v 1 -y "public/assets/frames/act2/lesson_$(printf '%04d' $((10#$i))).webp"
  done
  # Final still doubles as the reduced-motion poster.
  cp "public/assets/frames/act2/lesson_0090.webp" /tmp/act2-final.webp
  ffmpeg -hide_banner -loglevel error -i /tmp/act2-final.webp -frames:v 1 -y public/assets/posters/act2-final.avif
  ls public/assets/frames/act2 | head -3 && ls public/assets/posters
  ```
  **Confirm:** `lesson_0001.webp` exists and `act2-final.avif` exists. These are SWAPPABLE — real frames replace them later under the same names.

- [ ] **Step 2: Write `scripts/encode.sh` — the ffmpeg frame-extraction helper.**
  This is the canonical tool to turn a real ~6s 720p Grok clip into the `act2` sequence later. Create `scripts/encode.sh`:
  ```bash
  #!/usr/bin/env bash
  # Usage: scripts/encode.sh <input.mp4> <out-dir> <name-prefix>
  # Extracts a video into a 1-based contiguous WebP frame sequence for FrameSequence.
  # fps=30, longest edge scaled to 1280, q80, audio stripped.
  set -euo pipefail

  IN="${1:?input video required}"
  OUT="${2:?output dir required}"
  PREFIX="${3:?name prefix required (e.g. lesson)}"

  mkdir -p "$OUT"
  ffmpeg -hide_banner -loglevel error -i "$IN" \
    -an \
    -vf "fps=30,scale=1280:-2:flags=lanczos" \
    -c:v libwebp -lossless 0 -q:v 80 -compression_level 6 \
    -start_number 1 \
    "$OUT/${PREFIX}_%04d.webp"

  COUNT=$(ls "$OUT/${PREFIX}_"*.webp | wc -l | tr -d ' ')
  echo "Wrote ${COUNT} frames to ${OUT} (${PREFIX}_0001.webp .. ${PREFIX}_$(printf '%04d' "$COUNT").webp)"
  echo "Set data-frame-count=\"${COUNT}\" on the <canvas> and keep total ≤2-3MB per section."
  ```
  Then run:
  ```bash
  chmod +x scripts/encode.sh
  bash scripts/encode.sh 2>&1 | head -1 || true   # prints the usage error → proves arg-guards fire
  ```
  **Confirm:** running with no args prints `input video required` (the `:?` guard). Do not commit a real clip; the placeholder frames from Step 1 stand in.

- [ ] **Step 3: Author `Act2QuillWrites.astro` — the pinned full-bleed set-piece markup.**
  Markup/copy live in `.astro` (SEO + zero baseline JS). The `<canvas>` carries the frame manifest via `data-*`; the SVG handwriting paths are emitted from `act2.lessonText` server-side so they exist in the static HTML (CLS-safe, crawlable). The `PayoffSlot` is the swappable product boundary. Create `src/components/acts/Act2QuillWrites.astro`:
  ```astro
  ---
  import PayoffSlot from "../PayoffSlot.tsx";
  import { act2 } from "../../content/manuscript";

  // Build the 1-based, contiguous, zero-padded frame URL manifest.
  // Placeholder set = 90 frames; real Grok footage swaps these in-place.
  const DESKTOP_FRAMES = 90;
  const FRAME_BASE = "/assets/frames/act2/lesson_";
  const frameUrls = Array.from({ length: DESKTOP_FRAMES }, (_, i) =>
    `${FRAME_BASE}${String(i + 1).padStart(4, "0")}.webp`,
  );

  // Each lesson line becomes one SVG <text> rendered as a stroked path-like glyph run.
  // We use stroke-dasharray on the text element to fake a handwriting reveal driven by JS.
  const lines = act2.lessonText;
  ---

  <section
    data-act="2"
    class="act2"
    aria-label={act2.eyebrow}
  >
    <div class="act2__pin">
      <!-- Scrubbed ink/quill placeholder sequence. Explicit aspect-ratio prevents CLS. -->
      <canvas
        class="act2__canvas"
        data-frames
        data-frame-base={FRAME_BASE}
        data-frame-count={DESKTOP_FRAMES}
        data-frame-base-mobile={FRAME_BASE}
        data-frame-count-mobile="60"
        width="1280"
        height="720"
        aria-hidden="true"></canvas>

      <!-- Handwriting overlay: server-rendered so the words exist for SEO + reduced-motion. -->
      <svg
        class="act2__hand"
        data-handwriting
        viewBox="0 0 1280 720"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        {lines.map((line, i) => (
          <text
            class="act2__hand-line"
            data-line={i}
            x="160"
            y={220 + i * 90}
            font-family="'Cormorant Garamond', Georgia, serif"
            font-size="56"
            fill="none"
            stroke="var(--qc-indigo)"
            stroke-width="1.4"
          >{line}</text>
        ))}
      </svg>

      <!-- Accessible text copy of the lesson lines (SVG text is aria-hidden). -->
      <p class="sr-only">{lines.join(" ")}</p>

      <div class="act2__eyebrow gold-text">{act2.eyebrow}</div>
      <p class="act2__line">{act2.line}</p>

      <!-- Swappable product payoff. Stage 1 = stylized placeholder; real recording later. -->
      <div class="act2__payoff" data-payoff>
        <PayoffSlot
          client:visible
          kind="stylized"
          src="/assets/posters/act2-final.avif"
          alt="A finished hand-written lesson worksheet"
          poster="/assets/posters/act2-final.avif"
        />
      </div>
    </div>
  </section>

  <style>
    .act2 {
      position: relative;
      /* iOS: svh, never vh. Pin height = one viewport; scroll distance set in JS. */
      min-height: 100svh;
    }
    .act2__pin {
      position: relative;
      height: 100svh;
      display: grid;
      place-items: center;
      overflow: hidden;
      /* Scrub surface: kill the iOS text/callout selection on drag. */
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    .act2__canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      /* Explicit aspect-ratio matches the 1280x720 buffer → no layout shift. */
      aspect-ratio: 16 / 9;
      object-fit: cover;
      z-index: 0;
    }
    .act2__hand {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      pointer-events: none;
    }
    .act2__hand-line {
      /* dash length is set per-line in JS from getTotalLength(); start fully hidden. */
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
    }
    .act2__eyebrow {
      position: absolute;
      top: 8svh;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      font-family: var(--font-display);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: clamp(0.8rem, 2vw, 1rem);
    }
    .act2__line {
      position: absolute;
      bottom: 16svh;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      max-width: 38ch;
      text-align: center;
      color: var(--qc-charcoal);
      font-size: clamp(1rem, 2.4vw, 1.4rem);
    }
    .act2__payoff {
      position: absolute;
      inset: auto 0 0 0;
      margin: 0 auto;
      width: min(46ch, 86vw);
      z-index: 3;
      /* JS reveals this near the end of the scrub; start hidden but laid-out (no CLS). */
      opacity: 0;
      transform: translateY(24px);
      will-change: opacity, transform;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
  </style>
  ```
  Note: `.gold-text`, `--qc-indigo`, `--font-display` come from `src/styles/global.css` (Task 2). `index.astro` (Task 12) already renders this between Act I and the Colophon.

- [ ] **Step 4: Browser-verify the static markup renders (pre-animation).**
  Run:
  ```bash
  npm run dev
  ```
  Open the page, scroll to the Act II section. **Confirm (still, no JS animation yet):** the `[data-act="2"]` section is a full-viewport pinned block; the eyebrow (`act2.eyebrow`) sits at the top; `act2.line` at the bottom; the SVG lesson lines are present in the DOM (View Source shows the server-rendered `<text>` content from `act2.lessonText`); the `PayoffSlot` `<img>` mounts (it is `client:visible`). The canvas is blank for now. Stop dev (`Ctrl+C`).

- [ ] **Step 5: Write `src/scripts/acts/act2.ts` — the pinned scrub timeline.**
  ONE ScrollTrigger owns Act II: it pins `.act2__pin`, and on `onUpdate(progress)` it (a) renders the `FrameSequence`, (b) advances each handwriting line's `stroke-dashoffset` in sequence, and (c) reveals the `PayoffSlot` in the last ~18% of progress. This function is called ONLY inside the `motionOK` branch of `gsap.matchMedia()` (Task 8) — it instantiates NO Lenis and registers NO plugins itself; the engine owns those. Create `src/scripts/acts/act2.ts`:
  ```ts
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import { FrameSequence } from "../../lib/frame-sequence";
  import { MOTION_QUERIES, pickFrameCount } from "../../lib/motion";

  /**
   * Act II — the quill writes a lesson. The HERO scroll set-piece.
   * Pins the stage and scrubs three things off one progress value:
   *   1. the placeholder ink/quill WebP frame sequence (canvas),
   *   2. the SVG handwriting reveal of act2.lessonText (stroke-dashoffset),
   *   3. the worksheet PayoffSlot reveal near the end.
   *
   * MUST be called only inside the motionOK matchMedia branch. No Lenis, no
   * plugin registration here — the engine (scroll.ts) owns the rAF + plugins.
   */
  export function registerAct2(): void {
    const section = document.querySelector<HTMLElement>('[data-act="2"]');
    if (!section) return;

    const pin = section.querySelector<HTMLElement>(".act2__pin");
    const canvas = section.querySelector<HTMLCanvasElement>("canvas[data-frames]");
    const svg = section.querySelector<SVGSVGElement>("svg[data-handwriting]");
    const payoff = section.querySelector<HTMLElement>("[data-payoff]");
    if (!pin || !canvas || !svg || !payoff) return;

    // Desktop vs mobile frame budget. matchMedia is already in motionOK; we still
    // branch the count so phones load the lighter 60-frame set.
    const isDesktop = window.matchMedia(MOTION_QUERIES.isDesktop).matches;
    const base = isDesktop
      ? canvas.dataset.frameBase
      : (canvas.dataset.frameBaseMobile ?? canvas.dataset.frameBase);
    const desktopN = Number(canvas.dataset.frameCount ?? "0");
    const mobileN = Number(canvas.dataset.frameCountMobile ?? desktopN);
    const total = pickFrameCount(isDesktop, desktopN, mobileN);
    if (!base || total < 1) return;

    const urls = Array.from(
      { length: total },
      (_, i) => `${base}${String(i + 1).padStart(4, "0")}.webp`,
    );

    const seq = new FrameSequence({ urls, canvas, windowSize: 16 });

    // Prepare each handwriting line: measure its path length, then set the dash
    // so it starts fully "un-inked". We reveal lines sequentially across progress.
    const lineEls = Array.from(
      svg.querySelectorAll<SVGTextElement>(".act2__hand-line"),
    );
    const lengths = lineEls.map((el) => {
      // getComputedTextLength is the <text> analogue of getTotalLength.
      const len = el.getComputedTextLength() || 1;
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      return len;
    });

    /** Drive the handwriting: lines fill one after another over the 0..1 scrub. */
    function paintHandwriting(progress: number): void {
      const n = lineEls.length;
      if (n === 0) return;
      // Reserve the last 20% of scroll for the payoff reveal; ink fills in 0..0.8.
      const inkSpan = 0.8;
      const per = inkSpan / n;
      lineEls.forEach((el, i) => {
        const start = i * per;
        const local = gsap.utils.clamp(0, 1, (progress - start) / per);
        el.style.strokeDashoffset = String(lengths[i] * (1 - local));
      });
    }

    // PayoffSlot reveal tween, played/reversed by the scrub (NOT its own trigger).
    gsap.set(payoff, { opacity: 0, y: 24 });
    const payoffTo = gsap.quickTo(payoff, "opacity", { duration: 0.2 });
    const payoffYTo = gsap.quickTo(payoff, "y", { duration: 0.2 });

    function revealPayoff(progress: number): void {
      // Map 0.82..1.0 → 0..1 reveal.
      const t = gsap.utils.clamp(0, 1, (progress - 0.82) / 0.18);
      payoffTo(t);
      payoffYTo(24 * (1 - t));
    }

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      // Long scroll distance = a slow, deliberate write. 220% of viewport.
      end: "+=220%",
      pin: pin,
      pinSpacing: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        seq.render(p);
        paintHandwriting(p);
        revealPayoff(p);
      },
    });

    // Preload frames, then refresh so pin math accounts for any late layout +
    // the first frame paints immediately (no blank canvas flash).
    void seq.preload(0).then(() => {
      seq.render(0);
      ScrollTrigger.refresh();
    });

    // Expose teardown for HMR / route changes (engine may call ScrollTrigger.killAll).
    ScrollTrigger.addEventListener("refreshInit", () => seq.render(trigger.progress));
  }
  ```

- [ ] **Step 6: Wire `registerAct2()` into the engine — the `motionOK` branch and the `reduce` still.**
  In `src/scripts/scroll.ts` (Task 8 created `initScroll()` with the `gsap.matchMedia()` + a `revealStatic()` reduced-motion path). Add the import and the two call sites. Replace the placeholder call:
  ```ts
  // top of src/scripts/scroll.ts (with the other act imports)
  import { registerAct2 } from "./acts/act2";
  ```
  Inside the `motionOK` matchMedia branch, after `registerAct0()` and `registerAct1()`:
  ```ts
  registerAct2();
  ```
  Inside `revealStatic()` (the `reduce` branch), add the Act II final-still path so reduced-motion users see the completed scene with ZERO scrub triggers and ZERO Lenis:
  ```ts
  // --- Act II reduced-motion: show the LAST frame + fully-inked handwriting, no scrub. ---
  const act2 = document.querySelector<HTMLElement>('[data-act="2"]');
  if (act2) {
    const canvas = act2.querySelector<HTMLCanvasElement>("canvas[data-frames]");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const finalUrl = `${canvas.dataset.frameBase}${String(
        Number(canvas.dataset.frameCount ?? "1"),
      ).padStart(4, "0")}.webp`;
      const img = new Image();
      img.onload = () => {
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = finalUrl;
    }
    // Finish the handwriting instantly (dashoffset 0 = fully inked).
    act2
      .querySelectorAll<SVGTextElement>(".act2__hand-line")
      .forEach((el) => {
        const len = el.getComputedTextLength() || 1;
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = "0";
      });
    // Show the payoff outright.
    const payoff = act2.querySelector<HTMLElement>("[data-payoff]");
    if (payoff) {
      payoff.style.opacity = "1";
      payoff.style.transform = "none";
    }
  }
  ```
  Note: `revealStatic()` already calls `ScrollTrigger.saveStyles()` on animated targets before this (Task 8 contract); the static path mutates inline styles only, so it is `saveStyles`-safe.

- [ ] **Step 7: Browser-verify the scrub (motionOK) — the HERO moment.**
  Run:
  ```bash
  npm run dev
  ```
  With a normal (non-reduced-motion) OS setting, scroll INTO Act II. **Confirm:**
  1. The section **pins** (stays fixed) while you keep scrolling, for ~220% of a viewport.
  2. The canvas frame sequence **scrubs** forward/backward with scroll (the gold gradient sweeps across as `progress` advances) — and scrubbing UP reverses it smoothly (no jank, no `<video>` seeking).
  3. The SVG lesson lines **ink in sequentially** (`act2.lessonText` lines fill one after another), finishing around 80% progress.
  4. In the last ~18% the **`PayoffSlot` worksheet fades + slides up** into view.
  5. Unpins cleanly into the Colophon with no layout jump.
  Stop dev (`Ctrl+C`).

- [ ] **Step 8: Browser-verify reduced-motion + iOS Low-Power fallback (the `reduce` branch).**
  Emulate reduced motion (Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", or set the OS toggle). Reload, scroll to Act II. **Confirm:**
  1. The section does **NOT pin** and there is **NO scrub** (native scroll; scrolling past is immediate).
  2. The canvas shows the **final frame** (`lesson_0090.webp`) drawn once.
  3. The handwriting is **fully inked** (all `act2.lessonText` lines complete, `stroke-dashoffset:0`).
  4. The `PayoffSlot` worksheet is **visible** (opacity 1, no transform).
  5. DevTools console shows **no `ScrollTrigger`/Lenis init for Act II** (no scrub trigger created).
  Stop dev (`Ctrl+C`).

- [ ] **Step 9: Typecheck + lint the new TS.**
  Run:
  ```bash
  npx tsc --noEmit && npx eslint src/scripts/acts/act2.ts src/scripts/scroll.ts src/components/acts/Act2QuillWrites.astro
  ```
  **Confirm:** 0 type errors, 0 lint errors. Fix any `dataset` nullability (`?? ""`) or unused-import issues before proceeding.

- [ ] **Step 10: Add the Playwright structural smoke assertions for Act II.**
  Visual scrub can't be unit-tested; assert the DOM contract + the reduced-motion static outcome instead. In `tests/e2e/smoke.spec.ts`, add inside the existing `describe`:
  ```ts
  test("Act II set-piece: canvas + handwriting svg + payoff all present", async ({ page }) => {
    await page.goto("/");
    const act2 = page.locator('[data-act="2"]');
    await expect(act2).toHaveCount(1);
    await expect(act2.locator("canvas[data-frames]")).toHaveCount(1);
    await expect(act2.locator("svg[data-handwriting]")).toHaveCount(1);
    // Server-rendered lesson lines exist in static HTML (SEO + reduced-motion).
    await expect(act2.locator(".act2__hand-line").first()).toBeVisible();
    // PayoffSlot island mounts (client:visible) → an <img> or <video> inside [data-payoff].
    await expect(act2.locator("[data-payoff] :is(img, video)")).toHaveCount(1);
  });

  test("Act II under reduced-motion: static final state, no scrub init", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    const act2 = page.locator('[data-act="2"]');
    // Handwriting is fully inked in the static path (dashoffset 0).
    await expect
      .poll(async () =>
        act2.locator(".act2__hand-line").first().evaluate((el) =>
          (el as SVGTextElement).style.strokeDashoffset,
        ),
      )
      .toBe("0");
    // Payoff is shown outright (opacity 1).
    await expect
      .poll(async () =>
        act2.locator("[data-payoff]").evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe("1");
    expect(errors).toEqual([]);
  });
  ```
  Run:
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "Act II"
  ```
  **Confirm:** both Act II tests PASS.

- [ ] **Step 11: Full gate + commit.**
  Run:
  ```bash
  npx tsc --noEmit && npx eslint . && npx vitest run && npx playwright test tests/e2e/smoke.spec.ts
  ```
  **Confirm:** all green (tsc 0 errors, eslint 0 errors, all Vitest pass, Playwright smoke pass). Then commit:
  ```bash
  git add src/components/acts/Act2QuillWrites.astro src/scripts/acts/act2.ts src/scripts/scroll.ts scripts/encode.sh tests/e2e/smoke.spec.ts public/assets/frames/act2 public/assets/posters/act2-final.avif
  git commit -m "feat(act2): pinned quill-writes-a-lesson set-piece (frame-seq scrub + SVG handwriting + payoff reveal)"
  ```

---

### Task 10: Colophon (waitlist payoff) + page assembly

**Files:**
- Create: `src/components/acts/Colophon.astro`
- Modify: `src/pages/index.astro`
- Test: `tests/e2e/smoke.spec.ts` (extend the four-section ordering assertion + a dev signup round-trip note)

**Interfaces:**
- **Consumes (from earlier tasks, exact signatures):**
  - `src/content/manuscript.ts` → `colophon = { heading: string; body: string; microcopy: string }`, `footer = { links: { label: string; href: string }[]; email: string; line: string }`, `CONTACT_EMAIL: string`.
  - `src/components/WaitlistForm.tsx` → React island, props `{ idPrefix: string }`, used as `<WaitlistForm client:visible idPrefix="colophon" />`.
  - `src/components/PayoffSlot.tsx` → React island, props `{ kind: "stylized" | "recording"; src: string; alt: string; poster?: string }` (already mounted inside `Act2QuillWrites.astro`; not re-mounted here).
  - `src/layouts/Base.astro` → props `{ title: string; description: string; lcpPoster?: string }`; loads `src/styles/global.css`, renders `.paper-grain` overlay + `<slot/>`, includes the engine bootstrap `<script>` importing `src/scripts/scroll.ts`.
  - `src/components/acts/Act0Threshold.astro`, `Act1BlankPage.astro`, `Act2QuillWrites.astro` (default Astro component exports, no props).
  - `src/scripts/scroll.ts` → `initScroll(): void` (wired by Base; Colophon is **static**, owns no ScrollTrigger).
- **Produces (later tasks / E2E rely on these exact hooks):**
  - A `<section data-act="colophon">` containing the waitlist island and the footer.
  - `src/pages/index.astro` renders, in DOM order: `data-act="0"` → `data-act="1"` → `data-act="2"` → `data-act="colophon"`, each separated by a `.page-seam` page-turn transition marker (`data-seam` index).

---

- [ ] **Step 1: Add the four-in-order Playwright assertion to the smoke spec (write failing first).**
  Append to `tests/e2e/smoke.spec.ts` (the file exists from the Base/index scaffolding task):

  ```ts
  // tests/e2e/smoke.spec.ts  (append)
  import { expect, test } from "@playwright/test";

  test("the four Stage-1 acts render in document order", async ({ page }) => {
    await page.goto("/");

    const order = await page.$$eval("[data-act]", (els) =>
      els.map((el) => el.getAttribute("data-act")),
    );
    expect(order).toEqual(["0", "1", "2", "colophon"]);

    // Colophon is the earned payoff: heading + the waitlist form live inside data-act="colophon".
    const colophon = page.locator('[data-act="colophon"]');
    await expect(colophon).toBeVisible();
    await expect(colophon.locator("form")).toBeVisible();
    await expect(colophon.locator('input[type="email"]')).toBeVisible();

    // Footer imprint inside the colophon section.
    await expect(colophon.getByText(/Soli Deo Gloria/i)).toBeVisible();
  });

  test("colophon honeypot field is present but visually hidden", async ({ page }) => {
    await page.goto("/");
    const honeypot = page.locator('[data-act="colophon"] input[name="company"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toBeHidden();
  });
  ```

- [ ] **Step 2: Run the smoke spec; confirm it FAILS (Colophon not assembled yet).**
  Run:
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "four Stage-1 acts" --reporter=line
  ```
  Expect failure: `expect(order).toEqual([...])` mismatches because `index.astro` does not yet render `data-act="colophon"` (it currently ends at `data-act="2"`). This is the red state for the assembly work.

- [ ] **Step 3: Author the Colophon section markup (`Colophon.astro`).**
  Copy/imprint comes entirely from `manuscript.ts` (`colophon`, `footer`) so the Vitest voice-lint already guards the words. The waitlist island is the earned payoff; mount it `client:visible` with `idPrefix="colophon"`. This section is **static** (no `data-scrub`), so the scroll engine never builds a trigger for it.

  ```astro
  ---
  // src/components/acts/Colophon.astro
  import { colophon, footer } from "../../content/manuscript";
  import WaitlistForm from "../WaitlistForm.tsx";
  ---

  <section
    data-act="colophon"
    class="colophon"
    aria-labelledby="colophon-heading"
  >
    <div class="colophon__inner">
      <p class="colophon__rule" aria-hidden="true">&#10086;</p>

      <h2 id="colophon-heading" class="colophon__heading gold-text">
        {colophon.heading}
      </h2>

      <p class="colophon__body">{colophon.body}</p>

      <div class="colophon__form">
        <WaitlistForm client:visible idPrefix="colophon" />
        <p class="colophon__microcopy">{colophon.microcopy}</p>
      </div>
    </div>

    <footer class="imprint" aria-label="Site footer">
      <nav class="imprint__nav" aria-label="Footer">
        <ul class="imprint__links">
          {
            footer.links.map((link) => (
              <li>
                <a href={link.href}>{link.label}</a>
              </li>
            ))
          }
        </ul>
      </nav>

      <p class="imprint__email">
        <a href={`mailto:${footer.email}`}>{footer.email}</a>
      </p>

      <p class="imprint__line gold-text">{footer.line}</p>
    </footer>
  </section>

  <style>
    .colophon {
      position: relative;
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: clamp(3rem, 8vw, 7rem) clamp(1.25rem, 5vw, 4rem) 0;
      background: var(--qc-parchment, #f9f5ef);
      color: var(--qc-charcoal, #1c1e23);
      text-align: center;
    }
    .colophon__inner {
      max-width: 38rem;
      width: 100%;
      margin-inline: auto;
    }
    .colophon__rule {
      font-size: 1.75rem;
      color: var(--qc-gold, #d9a441);
      margin: 0 0 1.5rem;
      line-height: 1;
    }
    .colophon__heading {
      font-family: var(--qc-font-display, "Cormorant Garamond"), serif;
      font-size: clamp(2.25rem, 6vw, 4rem);
      font-weight: 600;
      line-height: 1.05;
      margin: 0 0 1.25rem;
    }
    .colophon__body {
      font-family: var(--qc-font-body, "Inter"), sans-serif;
      font-size: clamp(1.05rem, 2.4vw, 1.25rem);
      line-height: 1.6;
      color: color-mix(in srgb, var(--qc-charcoal, #1c1e23) 86%, transparent);
      margin: 0 auto 2.5rem;
      max-width: 32rem;
    }
    .colophon__form {
      margin-inline: auto;
      max-width: 28rem;
      width: 100%;
    }
    .colophon__microcopy {
      font-family: var(--qc-font-body, "Inter"), sans-serif;
      font-size: 0.8125rem;
      line-height: 1.5;
      color: color-mix(in srgb, var(--qc-charcoal, #1c1e23) 62%, transparent);
      margin: 1rem auto 0;
      max-width: 26rem;
    }

    .imprint {
      width: 100%;
      max-width: 60rem;
      margin: clamp(4rem, 10vw, 8rem) auto 0;
      padding: 2rem 0 3rem;
      border-top: 1px solid color-mix(in srgb, var(--qc-gold, #d9a441) 35%, transparent);
      font-family: var(--qc-font-body, "Inter"), sans-serif;
    }
    .imprint__links {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem;
      margin: 0 0 1.25rem;
      padding: 0;
    }
    .imprint__links a,
    .imprint__email a {
      color: color-mix(in srgb, var(--qc-charcoal, #1c1e23) 78%, transparent);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .imprint__links a:hover,
    .imprint__email a:hover {
      color: var(--qc-indigo, #3a3f76);
      text-decoration: underline;
    }
    .imprint__email {
      margin: 0 0 1.25rem;
    }
    .imprint__line {
      font-family: var(--qc-font-display, "Cormorant Garamond"), serif;
      font-size: 1.0625rem;
      letter-spacing: 0.04em;
      margin: 0;
    }
  </style>
  ```

- [ ] **Step 4: Assemble the page (`index.astro`) with all four acts + page-turn seams.**
  Replace the body of `src/pages/index.astro` so it renders `Base` → Act0 → seam → Act1 → seam → Act2 → seam → Colophon. The `lcpPoster` is the Act 0 / hero poster (AVIF) so Base can preload it with `fetchpriority="high"`. The `.page-seam` is a thin static transition marker between acts (the scroll engine reads `data-seam` to drive the CSS `clip-path`/`rotateY` page-turn; under reduced motion it stays an invisible spacer — zero triggers).

  ```astro
  ---
  // src/pages/index.astro
  import Base from "../layouts/Base.astro";
  import Act0Threshold from "../components/acts/Act0Threshold.astro";
  import Act1BlankPage from "../components/acts/Act1BlankPage.astro";
  import Act2QuillWrites from "../components/acts/Act2QuillWrites.astro";
  import Colophon from "../components/acts/Colophon.astro";

  const title = "Quill & Compass — Every homeschool is a book. Let's write yours.";
  const description =
    "A faith-grounded homeschool platform. Join the waitlist for the 2026-27 school year.";
  // LCP element = the Act 0 hero poster still (AVIF), preloaded, never lazy.
  const lcpPoster = "/assets/posters/act0-threshold.avif";
  ---

  <Base title={title} description={description} lcpPoster={lcpPoster}>
    <main>
      <Act0Threshold />
      <div class="page-seam" data-seam="0" aria-hidden="true"></div>

      <Act1BlankPage />
      <div class="page-seam" data-seam="1" aria-hidden="true"></div>

      <Act2QuillWrites />
      <div class="page-seam" data-seam="2" aria-hidden="true"></div>

      <Colophon />
    </main>
  </Base>

  <style>
    main {
      display: block;
    }
    /* Page-turn seam between acts. The global engine animates clip-path/rotateY on
       [data-seam]; static spacer otherwise so reduced-motion shows clean section breaks. */
    .page-seam {
      position: relative;
      height: 0;
      margin: 0;
      pointer-events: none;
      transform-style: preserve-3d;
    }
  </style>
  ```

- [ ] **Step 5: Run the smoke spec; confirm the ordering test now PASSES.**
  Run:
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "four Stage-1 acts" --reporter=line
  ```
  Expect: `order` resolves to `["0", "1", "2", "colophon"]` and the colophon form + email input + `Soli Deo Gloria` assertions pass (green). If the `Soli Deo Gloria` assertion fails, confirm `footer.line` in `src/content/manuscript.ts` carries that imprint string (it is the canonical Act VI imprint from the storyboard §7) — do not hardcode it in the component.

- [ ] **Step 6: Run the honeypot smoke test; confirm PASS.**
  Run:
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "honeypot field" --reporter=line
  ```
  Expect: exactly one `input[name="company"]` exists inside `[data-act="colophon"]` and it is hidden (the `WaitlistForm` island renders it off-screen). This proves the spam-trap is present in the assembled page without being keyboard/visually reachable.

- [ ] **Step 7: Browser-verify the full Stage-1 scroll top-to-bottom.**
  Run:
  ```bash
  npm run dev
  ```
  Then in the browser at the dev URL:
  1. Confirm Act 0 hero poster paints first (no layout shift), title illuminates, quill intro plays.
  2. Scroll down: Act 1 line reveals + drifting words fire; Act 2 pins and the frame-sequence scrubs while the SVG handwriting draws `act2.lessonText`; the `PayoffSlot` placeholder is visible inside Act 2.
  3. Continue scrolling: each `.page-seam` produces a page-turn transition between acts (no hard jump-cut).
  4. Land on the Colophon: `colophon.heading` (gold-text), `colophon.body`, the waitlist form, `colophon.microcopy`, then the footer links + email + `footer.line`.
  Confirm observable: the page reads as ONE continuous film from threshold to waitlist, the Colophon is the only place the email field appears, and there are no console errors.

- [ ] **Step 8: Browser-verify a real (dev) signup round-trip.**
  With `npm run dev` still running and `RESEND_API_KEY`, `WAITLIST_NOTIFY_TO`, `WAITLIST_FROM` set in `.env` (per `.env.example`):
  1. Scroll to the Colophon, type a real address you control into the email field, leave `firstName` empty, submit.
  2. Confirm the form transitions `idle → submitting → done` (inline status, no sonner) and `POST /api/waitlist` returns `200 {"ok":true}` in the Network tab.
  3. Confirm two emails arrive: the owner-notify to `WAITLIST_NOTIFY_TO` and the subscriber confirmation to the address you entered.
  4. Quick fail-loud check: submit a malformed value (e.g. `not-an-email`) — confirm the endpoint returns `{"ok":false,"error":...}` and the form shows the inline error state (no fake success).
  Observable: a genuine end-to-end capture works against live Resend before any footage exists.

- [ ] **Step 9: Browser-verify the reduced-motion branch on the assembled page.**
  In DevTools, enable **Emulate CSS `prefers-reduced-motion: reduce`** and hard-reload the dev page.
  Confirm observable:
  1. No `<canvas>` scrub initializes for Act 2 (the engine's `reduce` branch ran `revealStatic()`; Lenis is NOT instantiated — native scroll).
  2. Each frame sequence shows its **final still** (the worksheet-set frame), not a black/empty canvas.
  3. The `.page-seam` elements are inert (no `rotateY` animation).
  4. The Colophon still renders fully and the **waitlist form still submits** (repeat the Step 8 happy-path once under reduce).
  This proves Stage 1 is fully usable with zero scrub triggers — the same path doubles as the iOS Low-Power fallback.

- [ ] **Step 10: Add a reduced-motion structural assertion to the smoke spec (write + run).**
  Append to `tests/e2e/smoke.spec.ts`:

  ```ts
  // tests/e2e/smoke.spec.ts  (append)
  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("no scrub canvas init, form still works under reduced motion", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto("/");

      // Reduced branch shows the final still: the Act 2 canvas must NOT have been painted
      // by a scrub trigger. We assert the engine flagged static reveal on the act.
      const act2 = page.locator('[data-act="2"]');
      await expect(act2).toHaveAttribute("data-motion", "static");

      // The waitlist form is still fully functional (rendered, email field reachable).
      const email = page.locator('[data-act="colophon"] input[type="email"]');
      await expect(email).toBeVisible();
      await email.fill("reduced-motion@example.com");

      expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    });
  });
  ```

  Run:
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "reduced motion" --reporter=line
  ```
  Expect PASS. Note the contract this asserts: `src/scripts/scroll.ts`'s `revealStatic()` sets `data-motion="static"` on each `[data-act]` it reveals statically (and the `motionOK` branch sets `data-motion="scrub"`). If `act2` lacks `data-motion="static"`, fix `revealStatic()` in `scroll.ts` (Task 8/9 deliverable) to stamp the attribute — do NOT weaken the assertion.

- [ ] **Step 11: Run the FULL smoke suite + typecheck + voice-lint to confirm no regression.**
  Run:
  ```bash
  npx tsc --noEmit && npx vitest run src/content/manuscript.test.ts && npx playwright test tests/e2e/smoke.spec.ts --reporter=line
  ```
  Expect: 0 TS errors, `manuscript.test.ts` green (the `colophon`/`footer` strings pass voice-lint: no em dash U+2014, no banned word), and all smoke specs (four-in-order, honeypot, reduced-motion) green. This is the gate before commit.

- [ ] **Step 12: Commit the assembly.**
  Run:
  ```bash
  git add src/components/acts/Colophon.astro src/pages/index.astro tests/e2e/smoke.spec.ts
  git commit -m "feat(colophon): earned waitlist payoff + Stage-1 page assembly

Assemble Base + Act0/Act1/Act2 + Colophon in order with page-turn seams.
Colophon renders colophon/footer copy from manuscript.ts, mounts
<WaitlistForm client:visible idPrefix=\"colophon\"/>, and the calm-tech
imprint (links + email + Soli Deo Gloria). Smoke specs assert the four
data-act sections in order, hidden honeypot, and reduced-motion static
reveal with a working form."
  ```

---

### Task 11: Reduced-motion + performance + CI smoke/budget

**Files:**
- Create: `tests/e2e/smoke.spec.ts` (Playwright structural + reduced-motion + LCP-preload smoke)
- Create: `lighthouserc.json` (Lighthouse-CI assertions: LCP, CLS, total-JS, per-resource budgets)
- Modify: `package.json` (add `test`, `test:e2e`, `lhci` scripts)
- Modify: `README.md` (append a "Pre-launch checklist" subset)

**Interfaces:**
- Consumes (from earlier tasks, exact symbols/attributes the assertions depend on):
  - `src/pages/index.astro` renders, in order: `Act0Threshold.astro` (`data-act="0"`), `Act1BlankPage.astro` (`data-act="1"`), `Act2QuillWrites.astro` (`data-act="2"`), `Colophon.astro` (the waitlist payoff; carries `id="colophon"`).
  - `src/layouts/Base.astro` emits the LCP poster as `<link rel="preload" as="image" fetchpriority="high" href={lcpPoster}>` plus a matching hero `<img>` with that same `src` and `fetchpriority="high"` (the Act0 poster still).
  - `src/scripts/scroll.ts` → `initScroll()`: in the `reduce` branch it does NOT instantiate Lenis and creates ZERO scrub triggers; Act2 (`act2.ts`) only creates its `<canvas id="act2-canvas">` 2D context + `FrameSequence` in the `motionOK` branch. Reduced-motion contract verified by asserting the canvas never gets a non-empty drawn frame attribute.
  - `src/components/WaitlistForm.tsx` (`client:visible`): renders `<form data-waitlist-form>` with `<input type="email" required>`, a hidden honeypot `input[name="company"]`, a submit `<button>`, and an inline status node `[data-waitlist-status]` that reads `done` after a successful POST. POSTs JSON to `/api/waitlist`.
  - `src/pages/api/waitlist.ts`: POST endpoint returning JSON `{ok:true}` | `{ok:false,error}`.
- Produces (later tasks / CI rely on these exact entry points):
  - `npm run test` → runs `vitest run` then `playwright test` (full unit + e2e gate).
  - `npm run test:e2e` → `playwright test` only.
  - `npm run lhci` → `lhci autorun` (build + preview + assert against `lighthouserc.json`).
  - `lighthouserc.json` budget contract: `largest-contentful-paint` ≤ 2500ms, `cumulative-layout-shift` ≤ 0.1, `total-byte-weight` and `script` resource-summary budgets enforced.

---

- [ ] **Step 1: Add the e2e + lhci scripts to `package.json`.**
  Open `package.json` and merge these into the existing `"scripts"` block (keep the existing `dev`/`build`/`preview`/`vitest` entries from earlier tasks; do not remove them). The `test` script chains unit then e2e so one command is the full gate.

  ```jsonc
  // package.json  (scripts block — merge, don't replace siblings)
  {
    "scripts": {
      "dev": "astro dev",
      "build": "astro build",
      "preview": "astro preview",
      "test:unit": "vitest run",
      "test:e2e": "playwright test",
      "test": "vitest run && playwright test",
      "lhci": "lhci autorun"
    }
  }
  ```

  Also ensure the dev-deps exist (these were installed in the scaffolding task; if `@lhci/cli` or `@playwright/test` is missing, install them):

  ```bash
  npm i -D @playwright/test @lhci/cli
  npx playwright install --with-deps chromium
  ```

- [ ] **Step 2: Confirm `playwright.config.ts` builds + serves the static preview for e2e.**
  The structural smoke must run against the real built SSG output (so the preload `<link>` and hashed island JS are exactly what ships). Verify `playwright.config.ts` (created in the scaffolding task) has a `webServer` that builds then previews. If it does not, set it to this exact config:

  ```ts
  // playwright.config.ts
  import { defineConfig, devices } from "@playwright/test";

  const PORT = 4321;

  export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
      baseURL: `http://localhost:${PORT}`,
      trace: "on-first-retry",
    },
    projects: [
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],
    webServer: {
      command: "npm run build && npm run preview -- --port 4321 --host",
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  });
  ```

  Run to confirm the server boots and the config is valid (expect "No tests found" or an empty run, not a config error):

  ```bash
  npx playwright test --list
  ```

- [ ] **Step 3: Write the Playwright smoke spec — section structure + order.**
  Create `tests/e2e/smoke.spec.ts` with the first block: index renders and the four acts are present in document order. This is the structural contract over the four section components.

  ```ts
  // tests/e2e/smoke.spec.ts
  import { test, expect } from "@playwright/test";

  test.describe("discover-quill index — structure", () => {
    test("renders the four acts in order: 0, 1, 2, colophon", async ({ page }) => {
      await page.goto("/");

      const act0 = page.locator('[data-act="0"]');
      const act1 = page.locator('[data-act="1"]');
      const act2 = page.locator('[data-act="2"]');
      const colophon = page.locator("#colophon");

      await expect(act0).toBeVisible();
      await expect(act1).toBeAttached();
      await expect(act2).toBeAttached();
      await expect(colophon).toBeAttached();

      // Assert DOM order 0 → 1 → 2 → colophon via documentPosition.
      const order = await page.evaluate(() => {
        const sel = ['[data-act="0"]', '[data-act="1"]', '[data-act="2"]', "#colophon"];
        const nodes = sel.map((s) => document.querySelector(s));
        if (nodes.some((n) => n === null)) return null;
        const tops = (nodes as Element[]).map((n) => n.getBoundingClientRect().top + window.scrollY);
        return tops;
      });
      expect(order).not.toBeNull();
      const tops = order as number[];
      expect(tops[0]).toBeLessThan(tops[1]);
      expect(tops[1]).toBeLessThan(tops[2]);
      expect(tops[2]).toBeLessThan(tops[3]);
    });
  });
  ```

  Run it (this triggers the `webServer` build+preview the first time):

  ```bash
  npx playwright test tests/e2e/smoke.spec.ts
  ```

  Confirm the structure test passes. If `[data-act]` selectors fail, the act components are missing the attribute — fix the component, not the test.

- [ ] **Step 4: Add the "no console errors" assertion block.**
  Append a second `test.describe` to `tests/e2e/smoke.spec.ts`. Collect `console` error events and `pageerror` exceptions across a full scroll-through, then assert none fired. Filter out the known-benign favicon/network noise so the gate stays meaningful.

  ```ts
  // tests/e2e/smoke.spec.ts  (append)
  test.describe("discover-quill index — runtime health", () => {
    test("no console errors or page exceptions during a scroll-through", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });
      page.on("pageerror", (err) => {
        errors.push(`pageerror: ${err.message}`);
      });

      await page.goto("/", { waitUntil: "networkidle" });

      // Scroll the whole document so every ScrollTrigger / island mounts.
      await page.evaluate(async () => {
        const step = window.innerHeight;
        const max = document.body.scrollHeight;
        for (let y = 0; y <= max; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
      });
      await page.waitForTimeout(500);

      const meaningful = errors.filter(
        (e) => !/favicon|net::ERR_|Failed to load resource/i.test(e),
      );
      expect(meaningful, meaningful.join("\n")).toEqual([]);
    });
  });
  ```

  Run:

  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "no console errors"
  ```

  Confirm PASS. A real `pageerror` here means a broken island/scroll wiring; fix the source.

- [ ] **Step 5: Add the LCP poster + preload assertion block.**
  Append a third `test.describe`. Assert `Base.astro` emitted the preload `<link>` (image, high priority) and that a matching hero `<img>` exists with the same URL and `fetchpriority="high"` and is NOT lazy. This guards the LCP-element contract.

  ```ts
  // tests/e2e/smoke.spec.ts  (append)
  test.describe("discover-quill index — LCP poster contract", () => {
    test("hero poster is preloaded high-priority and the <img> matches it, not lazy", async ({ page }) => {
      await page.goto("/");

      const preload = page.locator('link[rel="preload"][as="image"]');
      await expect(preload).toHaveCount(1);
      await expect(preload).toHaveAttribute("fetchpriority", "high");
      const href = await preload.getAttribute("href");
      expect(href, "preload link must have an href").toBeTruthy();

      // The hero <img> in Act0 must point at the same poster, be high-priority, and never lazy.
      const heroImg = page.locator(`img[src="${href}"]`).first();
      await expect(heroImg).toBeAttached();
      await expect(heroImg).toHaveAttribute("fetchpriority", "high");
      const loading = await heroImg.getAttribute("loading");
      expect(loading, "LCP image must not be loading=lazy").not.toBe("lazy");
    });
  });
  ```

  Run:

  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "LCP poster"
  ```

  Confirm PASS. If `toHaveCount(1)` fails because of more than one preload, narrow the locator to the poster href; if zero, `Base.astro` is not emitting the preload — fix the layout.

- [ ] **Step 6: Add the reduced-motion contract test — no canvas scrub init + form still works.**
  Append the final `test.describe`, using Playwright's `emulateMedia({ reducedMotion: "reduce" })`. Under reduce, `initScroll()` takes the `revealStatic()` branch: Lenis is never constructed and Act2 never draws a scrubbed frame into `#act2-canvas`. We verify this two ways: (a) the canvas exposes a `data-frame-drawn` attribute only set by `FrameSequence.render()` (set it to the drawn index in `act2.ts`), so under reduce it stays absent/empty; (b) Lenis adds `class="lenis"` to `<html>` when instantiated, so under reduce that class is absent. Then confirm the waitlist form still submits and reaches `done`.

  ```ts
  // tests/e2e/smoke.spec.ts  (append)
  test.describe("discover-quill index — reduced-motion contract", () => {
    test.use({ reducedMotion: "reduce" });

    test("no Lenis, no canvas scrub init, but the waitlist form still works", async ({ page }) => {
      // Stub the waitlist endpoint so the form can reach `done` without Resend.
      await page.route("**/api/waitlist", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      });

      await page.goto("/", { waitUntil: "networkidle" });

      // Scroll through to give any (wrongly-created) scrub triggers a chance to fire.
      await page.evaluate(async () => {
        const max = document.body.scrollHeight;
        for (let y = 0; y <= max; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
      });
      await page.waitForTimeout(300);

      // (a) Lenis never instantiated → <html> has no "lenis" class.
      const htmlClass = await page.locator("html").getAttribute("class");
      expect(htmlClass ?? "").not.toContain("lenis");

      // (b) Act2 canvas never had a scrub frame drawn into it under reduce.
      const drawn = await page.locator("#act2-canvas").getAttribute("data-frame-drawn");
      expect(drawn ?? "", "canvas must not be scrub-drawn under reduced motion").toBe("");

      // (c) The waitlist form still submits and reaches the done state.
      const form = page.locator("[data-waitlist-form]");
      await form.scrollIntoViewIfNeeded();
      await expect(form).toBeVisible();
      await form.locator('input[type="email"]').fill("reader@example.com");
      await form.locator('button[type="submit"]').click();
      await expect(page.locator("[data-waitlist-status]")).toHaveText(/done/i, { timeout: 5000 });
    });
  });
  ```

  > Contract note for the implementer of `act2.ts` (Task on Act2): inside `FrameSequence.render()` set `this.canvas.setAttribute("data-frame-drawn", String(idx))` after the `drawImage`; leave the attribute unset under reduce (the reduce branch never calls `render()`). This is the single observable hook the e2e relies on — it is cheap, real, and not an aesthetic assertion.

  Run:

  ```bash
  npx playwright test tests/e2e/smoke.spec.ts -g "reduced-motion"
  ```

  Confirm PASS. A failure on (a)/(b) means the `reduce` branch in `scroll.ts` is leaking a Lenis instance or a scrub trigger — fix `scroll.ts`/`act2.ts`, not the test.

- [ ] **Step 7: Run the full e2e spec once, green, then commit it.**
  ```bash
  npx playwright test tests/e2e/smoke.spec.ts
  ```
  All four describes pass. Commit:

  ```bash
  git add tests/e2e/smoke.spec.ts playwright.config.ts package.json
  git commit -m "test(e2e): smoke spec — section order, console health, LCP preload, reduced-motion + form"
  ```

- [ ] **Step 8: Write `lighthouserc.json` with the enforced budget.**
  Create `lighthouserc.json` at the repo root. `collect` builds the SSG and starts `astro preview`; `assert` enforces the perf budget from the spec (LCP < 2.5s, CLS ≤ 0.1) plus byte budgets via `resource-summary` audits (total page weight and the script bundle cap). Numbers match the global perf budget: JS compressed ≤ 365KB.

  ```json
  {
    "ci": {
      "collect": {
        "startServerCommand": "npm run preview -- --port 4321 --host",
        "startServerReadyPattern": "localhost:4321",
        "url": ["http://localhost:4321/"],
        "numberOfRuns": 3,
        "settings": {
          "preset": "desktop"
        }
      },
      "assert": {
        "assertions": {
          "categories:performance": ["warn", { "minScore": 0.9 }],
          "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
          "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
          "interaction-to-next-paint": ["warn", { "maxNumericValue": 200 }],
          "total-byte-weight": ["error", { "maxNumericValue": 3500000 }],
          "resource-summary:script:size": ["error", { "maxNumericValue": 373760 }],
          "resource-summary:image:size": ["warn", { "maxNumericValue": 3145728 }],
          "uses-responsive-images": "off",
          "unused-javascript": ["warn", { "maxNumericValue": 100000 }]
        }
      },
      "upload": {
        "target": "temporary-public-storage"
      }
    }
  }
  ```

  > Budget arithmetic (keep in the plan, not as a code comment): `373760` bytes = 365 KB \* 1024, the compressed-JS cap. `3500000` total-byte-weight covers parchment bg + the single lazy hero poster + first frame; each frame sequence is lazy per-section so it is not counted against the initial page in this single-URL run. `3145728` = 3 MB, the per-section image budget ceiling.

- [ ] **Step 9: Build once, then run Lighthouse-CI locally to verify the budget is real.**
  ```bash
  npm run build
  npm run lhci
  ```
  Read the assertion summary. Expect `largest-contentful-paint` and `cumulative-layout-shift` to PASS. If `resource-summary:script:size` fails, the island JS exceeds 365KB — check that only `WaitlistForm.tsx` and `PayoffSlot.tsx` ship as islands (`client:visible`) and that gsap/lenis are imported only in `src/scripts/*` (vanilla, not React). Do not raise the cap to make it pass; trim the bundle.

  > If LCP fails in local CI because placeholder posters are heavy, confirm the Act0 poster is AVIF and preloaded (Step 5 guards the wiring; this guards the weight). The Stage-1 placeholder posters must still respect the budget.

- [ ] **Step 10: Browser-verify the reduced-motion still-frame visually (non-unit, observable).**
  This is the human visual confirmation that complements the structural e2e in Step 6.

  ```bash
  npm run dev
  ```
  In the browser devtools: open Rendering, set "Emulate CSS media feature prefers-reduced-motion" to `reduce`, hard-reload, then:
  - Confirm the page scrolls with native (non-smoothed) scrolling — no Lenis easing.
  - Scroll to `[data-act="2"]`: confirm the lesson set-piece shows the FINAL still frame of the sequence (legible finished lesson), not a blank canvas and not a mid-scrub frame.
  - Confirm `<html>` has NO `lenis` class (Elements panel).
  - Scroll to `#colophon`: confirm the waitlist form renders and accepts input.

  Then unset the emulation, reload, and confirm the Act2 frame-sequence scrubs while pinned. No commit (verification only).

- [ ] **Step 11: Append the "Pre-launch checklist" subset to `README.md`.**
  Add this section to `README.md` (create the file if the scaffolding task did not). It is the operational gate before pointing `discover.quillandcompass.app` at the build. Keep it to the Stage-1-relevant subset; voice rules apply (no em dashes, no banned words).

  ```markdown
  ## Pre-launch checklist (Stage 1)

  Run all gates green before deploying to discover.quillandcompass.app.

  ### Automated gates
  - [ ] `npm run test:unit` passes (Vitest: voice-lint, frame-sequence math, motion helpers, waitlist schema).
  - [ ] `npm run test:e2e` passes (Playwright: section order, console health, LCP preload, reduced-motion + form).
  - [ ] `npm run lhci` passes the budget: LCP < 2.5s, CLS <= 0.1, script bytes <= 365KB.
  - [ ] `astro build` completes with zero errors.

  ### Motion + accessibility
  - [ ] With prefers-reduced-motion: reduce, the page uses native scroll (no Lenis class on <html>), every sequence shows its final still, and the form still submits.
  - [ ] iOS Safari: hero fills the viewport using 100svh/100dvh; no horizontal scroll; the Act2 scrub does not jank (frame-sequence canvas, not video scrub).
  - [ ] Tab order reaches the waitlist email input and submit button; visible focus rings.

  ### Performance
  - [ ] LCP element is the Act0 poster still (AVIF), preloaded with fetchpriority high, never lazy.
  - [ ] Each frame sequence is lazy per section and stays at or under 3 MB.
  - [ ] No layout shift on font swap (fonts preloaded; explicit width/height + aspect-ratio on media boxes).

  ### Content + capture
  - [ ] Voice-lint clean: no em dashes, no banned words, no contrastive "not X, it's Y".
  - [ ] Waitlist POST hits /api/waitlist, sends owner-notify + subscriber confirm via Resend, and fails loud on error (no fake success).
  - [ ] RESEND_API_KEY, WAITLIST_NOTIFY_TO, WAITLIST_FROM set in the deploy environment.
  - [ ] SCHOOL_YEAR and CONTACT_EMAIL in src/content/manuscript.ts are correct for the cycle.

  ### Swappable payoff
  - [ ] PayoffSlot is in the stylized placeholder state for Stage 1; the recording slot is documented and ready to swap to kind="recording".
  ```

- [ ] **Step 12: Commit the budget config + checklist.**
  ```bash
  git add lighthouserc.json README.md package.json
  git commit -m "ci(perf): lighthouse budget (LCP/CLS/JS) + pre-launch checklist + test scripts"
  ```
