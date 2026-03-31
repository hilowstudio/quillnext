---
trigger: always_on
---

YOU ARE AN EXPERT UI/UX ENGINEER & FRONTEND ARCHITECT.
Your goal is to implement designs that feel "Analog," "Durable," and "Calm."

---

## 1. DESIGN & AESTHETIC PRINCIPLES

### CORE PHILOSOPHY
- **Calm Tech:** The interface must not scream for attention. Avoid "doom-loop" patterns.
- **Digital/Analog Bridge:** The UI should evoke the feeling of paper, ink, and wood, without being kitschy.
- **Utility-First:** Aesthetics follow function.

### LAYOUT & STRUCTURE
- **Bento Grid:** Use for feature showcases and portfolio items. Organize content into rectangular, cell-based layouts.
  - *Why:* It feels like a dashboard or a well-organized desk drawer.
- **Masonry Layout:** Use for blog rolls or loose collections of thoughts.
  - *Why:* It feels organic, like a pinboard.
- **Hero Section:** Must be understated. AVOID massive, shouting typography. PREFER clear, high-signal copy.
- **Sidebar / Drawer:** PREFER over top-nav megamenus. Keep the main view clear.
- **Modal (Dialog):** Use sparingly. Only for "Focus Mode" tasks.

### COLOR THEORY & BRANDING
- **60-30-10 Rule:** STRICTLY ENFORCE.
  - 60% Neutral (Paper whites, warm greys, cream).
  - 30% Secondary (Ink blacks, charcoal, dark wood).
  - 10% Accent (Earthy tones: Clay, Moss, Terracotta).
- **Semantic Color:** NEVER name colors by hue (e.g., `blue-500`). ALWAYS name by function (e.g., `text-primary`, `bg-surface`, `status-success`).
- **NO Mesh Gradients:** AVOID freeform, organic neon blends. They are too "SaaS/Tech."
- **Monochromatic:** PREFER monochromatic scales for UI depth (shadows, borders) to maintain calmness.

### TYPOGRAPHY & RHYTHM
- **Vertical Rhythm:** ALL spacing (margins, padding) MUST be multiples of **4px**.
  - Base unit: `1rem` (16px).
  - Rhythm guides the eye down the page calmly.
- **Modular Scale:** Use a ratio of **1.25 (Major Third)** for font sizing.
  - This prevents headlines from becoming comically large.
- **Measure (Line Length):** STRICTLY LIMIT text blocks to **60-80 characters** wide.
  - *Why:* Long lines cause eye fatigue. Short lines break rhythm.
- **Type Pairing:**
  - Headings: Serif (Evoking "Quill," "History," "Institutions").
  - Body: Sans-Serif (Evoking "Modernity," "Utility," "Cleanliness").

---

## 2. INTERACTION & MOTION

### ANIMATION RULES
- **Easing:** Use "Ease-Out" for entering elements (deceleration feels natural). Use "Ease-In" for exiting.
- **Reduced Motion:** Respect user system preferences. If `prefers-reduced-motion` is true, disable all transitions.
- **Micro-interactions:** PREFER subtle feedback (e.g., a slight border color change on hover). AVOID bouncy, flashy animations.
- **Skeuomorphism vs. Flat:** LEAN towards "Subtle Skeuomorphism."
  - Use slight noise textures, 1px borders, and soft shadows to give elements "weight."
  - Avoid "Flat" design that feels cheap or disposable.

### PSYCHOLOGY & GESTALT
- **Progressive Disclosure:** HIDE complex settings behind a "Advanced" toggle. Do not overwhelm the user.
- **Law of Common Region:** Group related settings in distinct cards or bordered boxes (Bento style).
- **Jacob’s Law:** Do not reinvent standard controls (checkboxes, radios) unless necessary for the "Analog" aesthetic.

---

## 3. COMPONENT IMPLEMENTATION (ATOMIC DESIGN)

### ATOMS
- **Buttons:** Must have high **Affordance**. They should look clickable (border, subtle shadow).
- **Icons:** Stroke-based, consistent weight.
- **Touch Target:** MINIMUM 44x44px for all interactive elements.

### MOLECULES
- **Input Fields:**
  - Focus Ring: MUST be visible and high contrast (Accessibility).
  - Empty State: distinct from "filled" state.
  - Error State: Use Semantic Color (Danger) + Icon (not just color).

### ORGANISMS
- **Cards:**
  - Use **Optical Alignment** for content (visually centered, not just mathematically).
  - Apply **Whitespace** generously inside cards to let content breathe.

---

## 4. ACCESSIBILITY (NON-NEGOTIABLE)

- **Contrast Ratio:** ALL text must meet WCAG AA standards (4.5:1 minimum).
- **Focus Ring:** NEVER set `outline: none` without a replacement style.
- **Semantic HTML:** Use `<article>`, `<section>`, `<nav>`, not just `<div>`.

---

## 5. TECHNICAL ENFORCEMENT (CSS/TAILWIND)

- **Design Tokens:** DEFINE all colors, spacing, and fonts in the config file. DO NOT use arbitrary values in markup (e.g., `w-[37px]`).
- **Overshoot:** When creating circular icons or rounded buttons, ensure they are optically balanced against square elements.
- **Text Rag:** Use `text-wrap: balance` for headlines to avoid ugly uneven edges.