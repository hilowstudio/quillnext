// Deterministic artifact-guidance map — "how to build this artifact well" keyed on the resource's
// ResourceContentType (not the hundreds of generator names), grade-band tuned. Mirrors
// PHILOSOPHY_PROMPTS / learner-personalization / support-accommodations. Server-safe plain constants.
//
// NOTE: `contentType` is currently keyword-inferred from the generator name at seed time; a later,
// re-seed-gated change can declare it in GENERATOR_CONTENT_TYPES.YAML. This map keys on the STORED
// value, so it works today regardless.

import type { GradeBandId } from "./grade-bands";

const KIND_GUIDANCE: Record<string, string> = {
  WORKSHEET:
    "Open with a brief instruction and one worked model, then practice items sequenced from simpler to harder. Include clear directions, room to work, and an answer key.",
  QUIZ:
    "Write clear, unambiguous questions aligned to the objective; mix recall and application; avoid trick questions. Include an answer key with a one-line rationale per item.",
  GUIDE:
    "Lead with the key ideas, then a structured explanation with examples, then a short summary. For a teacher guide, add brief teaching notes and discussion prompts.",
  RUBRIC:
    "Provide 3–4 criteria across 3–4 performance levels, each with concrete, observable descriptors (not just 'good/better/best').",
  TEMPLATE:
    "Provide a reusable scaffold: clearly labeled sections with prompts or sentence starters the student fills in; keep it flexible across topics.",
  PROMPT:
    "Give an engaging, focused prompt with any needed context and clear success criteria; include a sentence starter for a scaffolded start.",
  OTHER:
    "Default to clear structure, a worked example where useful, and grade-appropriate language.",
};

// Grade-band sizing note appended to the artifact guidance (volume / layout / reading load).
const BAND_SIZING: Partial<Record<GradeBandId, string>> = {
  EARLY_ELEMENTARY: "Keep it short — few items, a large clear layout, and minimal reading.",
  UPPER_ELEMENTARY: "Keep the length moderate with clear headings.",
  MIDDLE: "A fuller set is fine; keep instructions crisp.",
  HIGH: "Depth and volume are welcome; expect independent work.",
  ADULT: "Keep it concise and practical; respect the learner's time.",
};

/**
 * Compose the deterministic "how to build this artifact well" guidance from the resource's
 * contentType, tuned to the grade band. Returns "" for an unrecognized/absent type.
 */
export function composeKindGuidance(
  contentType?: string | null,
  gradeBand?: GradeBandId | null,
): string {
  const base = contentType ? KIND_GUIDANCE[contentType] : undefined;
  if (!base) return "";
  const sizing = gradeBand ? BAND_SIZING[gradeBand] : undefined;
  return sizing ? `${base} ${sizing}` : base;
}
