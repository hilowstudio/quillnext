// Deterministic support-accommodation map — the Support-Profile wizard's selected options →
// concrete, auditable generation instructions, tuned by support intensity and grade band. Mirrors
// PHILOSOPHY_PROMPTS / learner-personalization. The option strings are the EXACT wizard labels
// (SupportProfileWizard CORE_SUPPORTS), so stored selections map 1:1; any unrecognized string maps to
// nothing (injection-safe). Framed as helpful supports, never as diagnosis-driven directives.
//
// Server-safe plain constants.

import type { GradeBandId } from "./grade-bands";

// Flat option → accommodation instruction. Keyed by the wizard's exact option text.
const SUPPORT: Record<string, string> = {
  // A. Focus & Attention
  "Shorter lessons or tasks": "Keep each task short and self-contained; prefer several small tasks over one long one.",
  "One step at a time": "Reveal one step at a time; avoid presenting the whole multi-step task at once.",
  "Fewer distractions on the page": "Keep pages visually clean — minimal decoration, generous white space, one focus per screen.",
  "Gentle reminders to stay on task": "Build in brief, encouraging check-in prompts between segments.",
  // B. Instructions & Language
  "Clear, step-by-step instructions": "Write instructions as explicit numbered steps.",
  "Simple, direct wording": "Use plain, direct language; short sentences; avoid idioms and unnecessary jargon.",
  "Visual examples or diagrams": "Pair instructions and concepts with a visual example or diagram.",
  "Extra time to process information": "Keep the pace unhurried; avoid timed pressure and re-state key ideas.",
  // C. Organization & Planning
  "Checklists for tasks": "Provide a checklist the student can work through and tick off.",
  "Clear goals and expectations": "State the goal and what 'done well' looks like up front.",
  "Predictable lesson structure": "Use a consistent, predictable structure (same sections in the same order).",
  "Help breaking big tasks into parts": "Break larger tasks into clearly labeled smaller parts.",
  // D. Reading Support
  "Shorter reading passages": "Keep reading passages short; break longer text into small labeled chunks.",
  "Key ideas highlighted": "Bold or call out the key ideas so they stand out from supporting detail.",
  "Larger or easier-to-read text": "Prefer clean, simple formatting and short lines; avoid dense blocks.",
  "Option to hear text read aloud": "Write in read-aloud-friendly phrasing suitable for text-to-speech.",
  // E. Writing & Responses
  "Sentence starters or templates": "Provide sentence starters or a response template for written answers.",
  "Fewer written responses": "Minimize the amount of writing required; offer non-written response options.",
  "Option to answer in different ways": "Offer more than one way to respond (draw, say, build, or select).",
  "Help organizing ideas before writing": "Provide a graphic organizer or outline to plan before writing.",
  // F. Math Support
  "Step-by-step problem solving": "Show worked problems fully step by step.",
  "Visual models or examples": "Use visual models (number lines, arrays, diagrams) for math ideas.",
  "Fewer practice problems": "Use a smaller, well-chosen set of practice problems rather than many.",
  "Formula or reference sheets": "Include a small formula/reference box the student can consult.",
  // G. Sensory & Comfort
  "Simple, uncluttered pages": "Keep layouts simple and uncluttered.",
  "Calm colors and layout": "Use a calm, low-stimulation visual style.",
  "No time pressure": "Avoid timers and speed-based framing.",
  "Limited animations or sound": "Avoid relying on animation or sound; keep content static and quiet.",
  // H. Confidence & Emotional Support
  "Clear expectations before starting": "Set clear, reassuring expectations before the task begins.",
  "Low-pressure practice": "Frame practice as low-stakes; separate practice from assessment.",
  "Encouraging, reassuring tone": "Keep the tone warm, patient, and encouraging throughout.",
  "Extra practice before assessments": "Offer a short warm-up or review before any assessment.",
};

const KNOWN_CATEGORIES = [
  "focus", "instructions", "organization", "reading", "writing", "math", "sensory", "emotional",
] as const;

const INTENSITY_PREAMBLE: Record<string, string> = {
  LOW: "Apply these supports lightly, only where they help:",
  MODERATE: "Apply these supports consistently:",
  HIGH: "These supports are important — apply them throughout:",
};

const BAND_READING: Partial<Record<GradeBandId, string>> = {
  EARLY_ELEMENTARY: " For this age, keep passages to just a few short sentences.",
  UPPER_ELEMENTARY: " Keep passages to a short paragraph or two.",
};

/**
 * Compose the deterministic accommodations block from a stored `support_profile` (Json: category →
 * selected option strings) + `support_intensity` + grade band. Only recognized option strings render.
 * Returns "" when nothing is selected.
 */
export function composeSupportAccommodations(
  supportProfile: unknown,
  supportIntensity?: string | null,
  gradeBand?: GradeBandId | null,
): string {
  if (!supportProfile || typeof supportProfile !== "object") return "";
  const profile = supportProfile as Record<string, unknown>;

  const selected: string[] = [];
  for (const cat of KNOWN_CATEGORIES) {
    const opts = profile[cat];
    if (Array.isArray(opts)) {
      for (const opt of opts) {
        if (typeof opt === "string" && SUPPORT[opt] && !selected.includes(opt)) selected.push(opt);
      }
    }
  }
  if (selected.length === 0) return "";

  const readingNote = gradeBand ? BAND_READING[gradeBand] ?? "" : "";
  const lines = selected.map((opt) => {
    const base = SUPPORT[opt];
    return `- ${opt === "Shorter reading passages" ? base + readingNote : base}`;
  });

  const preamble = INTENSITY_PREAMBLE[supportIntensity ?? "MODERATE"] ?? INTENSITY_PREAMBLE.MODERATE;
  return `HELPFUL SUPPORTS & ACCOMMODATIONS FOR THIS STUDENT (weave in naturally; never mention them or any label to the student):\n${preamble}\n${lines.join("\n")}`;
}
