import { getMasterContext, type MasterContextParams } from "@/lib/context/master-context";
import { serializeMasterContext, type SerializationOptions } from "@/lib/context/context-serializer";
import { INKLING_BASE_PERSONALITY, INKLING_ETHICAL_GUIDELINES } from "@/lib/constants/ai-guardrails";

/**
 * Build master prompt using Master Context Service
 * This is the new recommended function for AI generation
 * Aggregates all context sources (family, student, academic, library, schedule)
 */
export async function buildMasterPrompt(
  params: {
    objectiveId?: string;
    studentId?: string;
    organizationId: string;
    courseId?: string;
    userInstruction: string;
  },
  options?: SerializationOptions,
): Promise<string> {
  // Build master context
  const contextParams: MasterContextParams = {
    organizationId: params.organizationId,
    studentId: params.studentId,
    objectiveId: params.objectiveId,
    courseId: params.courseId,
  };

  const masterContext = await getMasterContext(contextParams);

  // Serialize context to prompt string
  const contextString = serializeMasterContext(masterContext, {
    maxTokens: options?.maxTokens || 2000,
    includeDetails: options?.includeDetails !== false,
    prioritize: options?.prioritize || ["academic", "student", "family", "library", "schedule"],
    modelType: options?.modelType || "flash",
  });

  // Combine with user instruction. The Inkling persona + ethical guardrails are sourced from the
  // shared @/lib/constants/ai-guardrails so this master-context path (AI grading feedback)
  // carries the SAME safety bounds as the class PromptBuilder (Inkling resource generation). The
  // guardrails are prepended ABOVE the serialized context so the ethical bounds frame the family/
  // student data. See Q-08-001 (docs/codebase-map/08-ai-core.md).
  return `
${INKLING_BASE_PERSONALITY}

${INKLING_ETHICAL_GUIDELINES}

${contextString}

TASK:
${params.userInstruction}

Please create content that:
- Directly addresses the learning objective (if provided)
- Is personalized to the student's learning style and preferences (if student context available)
- Aligns with the family's educational philosophy and faith background
- Uses relevant resources from the library when appropriate
- Respects the schedule and pacing constraints
- Is engaging, pedagogically sound, and age-appropriate
- Is presented as a draft for parental review
`.trim();
}
