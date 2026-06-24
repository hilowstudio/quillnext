import { z } from "zod";

/**
 * Lenient READ schemas for the three `LearnerProfile.*` Prisma `Json` columns.
 *
 * These columns are WRITTEN by the strict `generateObject` schemas in
 * `src/server/ai/personality.ts` (PersonalityProfileSchema / LearningStyleSchema /
 * InterestProfileSchema — the source of truth for the field set). Reads, however, must:
 *   1. tolerate older rows that predate newer fields (e.g. `suggestedSystemPrompt`), and
 *   2. never throw into a render (a parse failure that bubbles into a Server Component is a
 *      white screen for the family).
 *
 * So every field is `.optional()` and the enum-ish fields are read as plain `string` (a row written
 * before the Q-08-005 `Micro-Learning` typo fix still parses). The `parse*` helpers `safeParse` and
 * fall back to `null` — the same graceful "assessment not yet completed" state the UI already shows
 * for a missing profile — instead of crashing. Mirrors the all-optional `StudentContext.profile`
 * shapes in `src/lib/context/master-context.ts`.
 */

export const personalityDataSchema = z.object({
  motivationalDriver: z.string().optional(),
  creativityPreference: z.string().optional(),
  feedbackStyle: z.string().optional(),
  frustrationResponse: z.string().optional(),
  workStyle: z.string().optional(),
  gamificationMode: z.boolean().optional(),
  scaffoldingLevel: z.string().optional(),
  toneInstructions: z.string().optional(),
  suggestedSystemPrompt: z.string().optional(),
});
export type PersonalityData = z.infer<typeof personalityDataSchema>;

export const learningStyleDataSchema = z.object({
  inputMode: z.string().optional(),
  contentDensity: z.string().optional(),
  outputMode: z.string().optional(),
  processingMode: z.string().optional(),
  formatInstructions: z.string().optional(),
});
export type LearningStyleData = z.infer<typeof learningStyleDataSchema>;

export const interestsDataSchema = z.object({
  hookThemes: z.array(z.string()).optional(),
  specificEntities: z
    .array(z.object({ category: z.string(), favorite: z.string() }))
    .optional(),
  expertTopics: z.array(z.string()).optional(),
  integrationMode: z.string().optional(),
  analogyStrategy: z.string().optional(),
});
export type InterestsData = z.infer<typeof interestsDataSchema>;

export function parsePersonalityData(value: unknown): PersonalityData | null {
  if (value == null) return null;
  const result = personalityDataSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseLearningStyleData(value: unknown): LearningStyleData | null {
  if (value == null) return null;
  const result = learningStyleDataSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseInterestsData(value: unknown): InterestsData | null {
  if (value == null) return null;
  const result = interestsDataSchema.safeParse(value);
  return result.success ? result.data : null;
}
