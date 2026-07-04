// Deterministic learner-personalization map — the assessment's ENUM answers → fixed, auditable
// generation instructions, tuned by grade band. Mirrors PHILOSOPHY_PROMPTS. This REPLACES the old
// AI-authored free-text instruction fields (toneInstructions / formatInstructions / analogyStrategy /
// suggestedSystemPrompt), so no model-written prose from free-text is ever injected as an instruction.
// Grounded in gradual-release (I-do/we-do/you-do), Universal Design for Learning (multiple means of
// representation & expression), and self-determination motivation hooks.
//
// Server-safe plain constants (types imported type-only). Unknown/edited enum values simply map to
// nothing — only known options can produce an instruction (injection-safe by construction).

import type { GradeBandId } from "./grade-bands";
import type {
  PersonalityData,
  LearningStyleData,
  InterestsData,
} from "@/lib/students/learner-profile";

// Per-band calibration used by the grade-sensitive entries (scaffolding, content density, reading).
const BAND: Record<GradeBandId, { text: string; example: string; chunk: string }> = {
  EARLY_ELEMENTARY: {
    text: "very short sentences (one idea each) with strong picture/visual support",
    example: "simple, concrete examples from everyday life",
    chunk: "one small idea at a time",
  },
  UPPER_ELEMENTARY: {
    text: "short paragraphs with clear headings and defined key terms",
    example: "concrete examples with a little abstraction",
    chunk: "a few related ideas per section",
  },
  MIDDLE: {
    text: "structured multi-paragraph text with subject vocabulary defined on first use",
    example: "examples that connect the concept to its application",
    chunk: "coherent sections building toward the whole",
  },
  HIGH: {
    text: "fuller, well-organized prose with precise academic vocabulary",
    example: "nuanced examples, including edge cases",
    chunk: "developed sections with connected reasoning",
  },
  ADULT: {
    text: "concise, professional prose assuming adult background knowledge",
    example: "practical, real-world examples",
    chunk: "efficient sections that respect the learner's time",
  },
};

const MOTIVATION: Record<string, string> = {
  "The Why": "Open by connecting the material to a real-world purpose or bigger idea — say why it matters before the how.",
  "The Win": "Frame the work as a challenge with clear, attainable wins (a goal to beat, a level to clear, a streak to keep).",
  "The List": "Present the work as a clear, finite checklist of steps the student can see and cross off.",
  "The Story": "Wrap the task in a light narrative, character, or quest so it reads as an adventure.",
};

const FEEDBACK: Record<string, string> = {
  Cheerleader: "Keep feedback warm and encouraging; lead with what went well before a next step.",
  Coach: "Give direct, concise, improvement-focused feedback; name the single most useful next step plainly.",
  Socratic: "Prompt with guiding questions that lead the student to the answer rather than stating it outright.",
};

const CREATIVITY: Record<string, string> = {
  "Loves it": "Favor open-ended prompts and student choice; invite them to invent, design, or extend.",
  Freezes: "Avoid blank-canvas tasks — give concrete prompts, a worked example, and clear constraints to start from.",
};

const FRUSTRATION: Record<string, string> = {
  Persist: "",
  Deflect: "Keep tasks bite-sized and low-stakes; normalize mistakes as an expected part of learning.",
  Disengage: "Front-load a quick early win and keep momentum with short segments and frequent check-ins.",
  Pivot: "State the purpose of each task up front so its value is obvious and it doesn't feel arbitrary.",
};

const WORK_STYLE: Record<string, string> = {
  Autonomy: "Design for independent work: give directions clear enough to follow without an adult present.",
  Collaboration: "Build in discussion prompts or think-together moments alongside the independent work.",
};

const INPUT_MODE: Record<string, string> = {
  Visual: "Lead with diagrams, labeled visuals, charts, or tables.",
  Auditory: "Use read-aloud-friendly phrasing and suggest audio/video where it helps.",
  Textual: "Use clear, well-structured written explanations.",
  Kinesthetic: "Include hands-on activities, manipulatives, or a build-it/do-it task.",
};

const OUTPUT_MODE: Record<string, string> = {
  Speaking: "Offer a way to answer aloud or by recording, not only in writing.",
  Writing: "Written responses fit well; offer a planning organizer when the task is longer.",
  Building: "Offer a make/build/create option to demonstrate understanding.",
  Testing: "Selected-response checks (quizzes) are a good fit for demonstrating mastery.",
};

const PROCESSING: Record<string, string> = {
  "The Forest": "Start with the big picture or an advance organizer, then move into the details.",
  "The Trees": "Build from concrete facts and examples up toward the big idea.",
  Sequential: "Present strictly step by step — one idea fully before the next.",
};

const INTEGRATION: Record<string, string> = {
  Surface: "Swap the student's favorite names/nouns into examples (e.g. count basketballs instead of apples).",
  Deep: "Where it fits naturally, build the lesson's context around a favorite theme.",
  Reward: "Keep the core content standard; use the student's interests as a reward or closer, not the vehicle.",
};

/** Grade-sensitive: gradual-release scaffolding tuned to the band's example complexity. */
function scaffolding(level: string, b: (typeof BAND)[GradeBandId]): string {
  switch (level) {
    case "High":
      return `Scaffold heavily (I do / we do / you do): model each step with a worked example using ${b.example}, then a guided attempt, then independent practice. Provide sentence starters, hints, and a small reference the student can lean on.`;
    case "Medium":
      return `Give one worked example, then let the student attempt with light hints available if they get stuck.`;
    case "Low":
      return `Keep scaffolding light: pose the task and let the student work independently, with an optional challenge extension.`;
    default:
      return "";
  }
}

/** Grade-sensitive: text density tuned to the band's chunking. */
function density(mode: string, b: (typeof BAND)[GradeBandId]): string {
  switch (mode) {
    case "Skimmer":
      return `Use bullet points, bolded key terms, short paragraphs, and clear headers (${b.text}).`;
    case "Deep Reader":
      return `Fuller explanations and detail are welcome (${b.text}).`;
    case "Micro-Learning":
      return `Break content into very short, single-idea chunks — ${b.chunk}.`;
    default:
      return "";
  }
}

/**
 * Compose the deterministic "TEACHING APPROACH" block from the student's assessment enums, tuned to
 * their grade band. Returns "" when nothing is known. Emits only recognized enum values.
 */
export function composeLearnerPersonalization(
  personality?: PersonalityData | null,
  learning?: LearningStyleData | null,
  interests?: InterestsData | null,
  gradeBand?: GradeBandId | null,
): string {
  const b = BAND[gradeBand ?? "MIDDLE"];
  const lines: string[] = [];
  const push = (s?: string) => {
    if (s) lines.push(`- ${s}`);
  };

  if (personality) {
    push(MOTIVATION[personality.motivationalDriver ?? ""]);
    push(FEEDBACK[personality.feedbackStyle ?? ""]);
    push(CREATIVITY[personality.creativityPreference ?? ""]);
    push(FRUSTRATION[personality.frustrationResponse ?? ""]);
    push(WORK_STYLE[personality.workStyle ?? ""]);
    if (personality.scaffoldingLevel) push(scaffolding(personality.scaffoldingLevel, b));
    if (personality.gamificationMode) {
      push("Add light game elements (points, levels, badges, or a progress bar) to keep engagement up.");
    }
  }

  if (learning) {
    push(INPUT_MODE[learning.inputMode ?? ""]);
    if (learning.contentDensity) push(density(learning.contentDensity, b));
    push(OUTPUT_MODE[learning.outputMode ?? ""]);
    push(PROCESSING[learning.processingMode ?? ""]);
  }

  if (interests) {
    push(INTEGRATION[interests.integrationMode ?? ""]);
  }

  if (lines.length === 0) return "";
  return `TEACHING APPROACH FOR THIS STUDENT (apply naturally; don't announce these mechanics):\n${lines.join("\n")}`;
}
