import { generateObject } from "ai";
import { getModelForTask, AITaskType } from "@/lib/ai/config";
import { z } from "zod";

/**
 * --------------------------------------------------------------------------
 * 1. PERSONALITY & MOTIVATION SCHEMA
 * Determines the "Tone" and "Hook"
 * --------------------------------------------------------------------------
 */
const PersonalityProfileSchema = z.object({
  motivationalDriver: z
    .enum(["The Why", "The Win", "The List", "The Story"])
    .describe("Primary hook strategy: Meaning, Competition, Checklist, or Narrative"),
  creativityPreference: z
    .enum(["Loves it", "Freezes"])
    .describe("Reaction to open-ended tasks"),
  feedbackStyle: z
    .enum(["Cheerleader", "Coach", "Socratic"])
    .describe("Preferred tone for feedback and correction"),
  frustrationResponse: z
    .enum(["Persist", "Deflect", "Disengage", "Pivot"])
    .describe("Typical reaction to mistakes"),
  workStyle: z
    .enum(["Autonomy", "Collaboration"])
    .describe("Preference for independent vs shared work"),
  // Derived System Variables
  gamificationMode: z.boolean().describe("If true, use scores, XP, and challenges"),
  scaffoldingLevel: z.enum(["High", "Medium", "Low"]).describe("Amount of support/hints to provide"),
  toneInstructions: z.string().describe("Specific instructions for the AI persona (e.g. 'Act like a sports coach')"),
  suggestedSystemPrompt: z.string().describe("A complete, ready-to-use system prompt (2-4 sentences) an AI tutor can adopt to match this student — synthesize from the motivational driver, feedback style, scaffolding level, work style, and tone instructions."),
});

export type PersonalityProfile = z.infer<typeof PersonalityProfileSchema>;

/**
 * --------------------------------------------------------------------------
 * 2. LEARNING STYLE & COGNITIVE PREFERENCE SCHEMA
 * Determines the "Format" and "Input/Output"
 * --------------------------------------------------------------------------
 */
const LearningStyleSchema = z.object({
  inputMode: z
    .enum(["Visual", "Auditory", "Textual", "Kinesthetic"])
    .describe("Preferred method for receiving new information"),
  contentDensity: z
    .enum(["Skimmer", "Deep Reader", "Micro-Learning"])
    .describe("Preference for text length and formatting (Skimmer = bullet points)"),
  outputMode: z
    .enum(["Speaking", "Writing", "Building", "Testing"])
    .describe("Preferred method for demonstrating knowledge"),
  processingMode: z
    .enum(["The Forest", "The Trees", "Sequential"])
    .describe("Top-down (Forest) vs Bottom-up (Trees) vs Linear (Sequential) processing"),
  // Derived System Variables
  formatInstructions: z.string().describe("Instructions for formatting content (e.g. 'Use many diagrams')"),
});

export type LearningStyleProfile = z.infer<typeof LearningStyleSchema>;

/**
 * --------------------------------------------------------------------------
 * 3. INTERESTS & PASSIONS SCHEMA
 * Determines "Context" and "Insertables"
 * --------------------------------------------------------------------------
 */
const InterestProfileSchema = z.object({
  hookThemes: z
    .array(z.string())
    .describe("Broad categories of interest (e.g. 'Natural World', 'Tech World')"),
  specificEntities: z
    .array(
      z.object({
        category: z.string().describe("The category (e.g. Sport, Team, Game)"),
        favorite: z.string().describe("The specific favorite (e.g. Basketball, Warriors, Minecraft)"),
      })
    )
    .describe("List of specific favorites identified in the user's interests"),
  expertTopics: z
    .array(z.string())
    .describe("Topics where the student has deep knowledge, useful for analogies"),
  integrationMode: z
    .enum(["Surface", "Deep", "Reward"])
    .describe("How to use interests: Skinning (Surface), Thematic (Deep), or Reward-only"),
  // Derived System Variables
  analogyStrategy: z.string().describe("Strategy for using student interests in analogies"),
});

export type InterestProfile = z.infer<typeof InterestProfileSchema>;

/**
 * GENERATE PERSONALITY PROFILE
 */
export async function generateStudentProfile(
  answers: Record<string, string>,
  studentName: string,
): Promise<PersonalityProfile> {
  const answersText = Object.entries(answers)
    .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: getModelForTask(AITaskType.PERSONALITY_PROFILING),
    schema: PersonalityProfileSchema,
    prompt: `Analyze the following questionnaire answers for ${studentName} to determine their motivational drivers and personality variables.

Questionnaire Data:
${answersText}

Map these answers to the schema variables. For example:
- If they like "The Win", set gamificationMode to true.
- If they are "Overwhelmed" or "Freeze", set scaffoldingLevel to High.

Also synthesize suggestedSystemPrompt: a concise, ready-to-use system prompt an AI tutor can adopt to match this student's drivers, feedback style, scaffolding level, and tone.`,
  });

  return object;
}

/**
 * GENERATE LEARNING STYLE PROFILE
 */
export async function generateLearningStyleProfile(
  answers: Record<string, string>,
  studentName: string,
): Promise<LearningStyleProfile> {
  const answersText = Object.entries(answers)
    .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: getModelForTask(AITaskType.LEARNING_STYLE_ANALYSIS),
    schema: LearningStyleSchema,
    prompt: `Analyze the following learning style questionnaire answers for ${studentName}.

Questionnaire Data:
${answersText}

Determine their cognitive preferences, input/output modes, and formatting needs.`,
  });

  return object;
}

/**
 * GENERATE INTEREST PROFILE
 */
export async function generateInterestProfile(
  answers: Record<string, unknown>, // Allow complex objects for specific entities
  studentName: string,
): Promise<InterestProfile> {
  const { object } = await generateObject({
    model: getModelForTask(AITaskType.PERSONALITY_PROFILING), // Reuse profiling model
    schema: InterestProfileSchema,
    prompt: `Analyze the provided interest data for ${studentName}.

Interest Data:
${JSON.stringify(answers, null, 2)}

Extract the specific entities (nouns) that can be inserted into content, and determine the integration strategy.`,
  });

  return object;
}

