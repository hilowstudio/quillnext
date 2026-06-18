import { db, withTenant } from "@/server/db";
import { getMasterContext, type MasterContextParams } from "@/lib/context/master-context";
import { serializeMasterContext, type SerializationOptions } from "@/lib/context/context-serializer";

// -----------------------------------------------------------------------
// Academic Spine Context Injection
// Builds AI prompts with full academic context from the Spine
// -----------------------------------------------------------------------

type ObjectiveWithHierarchy = {
  id: string;
  code: string;
  description: string;
  subtopic: {
    id: string;
    code: string;
    name: string;
    topic: {
      id: string;
      code: string;
      name: string;
      strand: {
        id: string;
        code: string;
        name: string;
        subject: {
          id: string;
          code: string;
          name: string;
        };
      };
    };
  };
};

/**
 * Builds a comprehensive prompt with Academic Spine context
 * This solves the "blank canvas" problem by pre-populating context
 */
export async function buildSpineAwarePrompt(
  objectiveId: string,
  userInstruction: string,
): Promise<string> {
  // 1. Fetch the full Spine hierarchy
  const objective = await db.objective.findUnique({
    where: { id: objectiveId },
    include: {
      subtopic: {
        include: {
          topic: {
            include: {
              strand: {
                include: {
                  subject: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!objective) {
    throw new Error(`Objective ${objectiveId} not found`);
  }

  // 2. Extract metadata
  const hierarchy = [
    objective.subtopic.topic.strand.subject.name,
    objective.subtopic.topic.strand.name,
    objective.subtopic.topic.name,
    objective.subtopic.name,
  ].join(" > ");

  const complexity = objective.complexity
    ? `Bloom's Taxonomy Level: ${objective.complexity}`
    : "Complexity not specified";

  const gradeLevel = objective.gradeLevel
    ? `Grade Level: ${objective.gradeLevel === 0 ? "Kindergarten" : `Grade ${objective.gradeLevel}`}`
    : "";

  const standardText = objective.text;

  // 3. Construct System Prompt
  return `
You are an expert educator creating personalized educational content.

ACADEMIC CONTEXT:
${hierarchy}

LEARNING OBJECTIVE:
"${standardText}"

${gradeLevel ? `${gradeLevel}\n` : ""}DIFFICULTY: ${complexity}

TASK:
${userInstruction}

Please create content that:
- Directly addresses the learning objective above
- Is appropriate for the specified grade level and complexity
- Aligns with the academic hierarchy context
- Is engaging and pedagogically sound
`.trim();
}

/**
 * Builds a prompt with student personality context
 * Injects the AI-generated system prompt from LearnerProfile
 */
export async function buildPersonalizedPrompt(
  studentId: string,
  basePrompt: string,
  organizationId: string,
): Promise<string> {
  const student = await withTenant(
    (tx) =>
      tx.learner.findUnique({
        where: { id: studentId },
        include: {
          learnerProfile: true,
        },
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!student) {
    throw new Error(`Student ${studentId} not found`);
  }

  const profile = student.learnerProfile;
  if (!profile?.personalityData) {
    return basePrompt; // No personality data, return base prompt
  }

  // Extract the suggested system prompt from AI-generated profile
  const personalityData = profile.personalityData as {
    suggestedSystemPrompt?: string;
    communicationStyle?: string;
    primaryDrivers?: string[];
  };

  const systemInstruction = personalityData.suggestedSystemPrompt || "";
  const communicationStyle = personalityData.communicationStyle || "";
  const drivers = personalityData.primaryDrivers || [];

  return `
${systemInstruction}

STUDENT CONTEXT:
- Name: ${student.firstName} ${student.lastName || ""}
- Communication Style: ${communicationStyle}
- Primary Drivers: ${drivers.join(", ")}

${basePrompt}

Please adapt your response to match the student's communication style and primary drivers.
`.trim();
}

/**
 * Builds a prompt with family blueprint context
 * Injects educational philosophy and faith background
 */
export async function buildFamilyContextPrompt(
  organizationId: string,
  basePrompt: string,
): Promise<string> {
  const organization = await withTenant(
    (tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        include: {
          classrooms: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    undefined,
    { organizationId, userId: null },
  );

  const orgWithClassrooms = organization as unknown as { classrooms?: Array<{ educationalPhilosophy: string | null; educationalPhilosophyOther: string | null; faithBackground: string | null; faithBackgroundOther: string | null }> };

  if (!organization || !orgWithClassrooms.classrooms || orgWithClassrooms.classrooms.length === 0) {
    return basePrompt; // No classroom data
  }

  const classroom = orgWithClassrooms.classrooms[0]!;

  const philosophy = classroom.educationalPhilosophy;
  const faithBackground = classroom.faithBackground;

  return `
FAMILY EDUCATIONAL CONTEXT:
- Educational Philosophy: ${philosophy}
${classroom.educationalPhilosophyOther ? `- Philosophy Details: ${classroom.educationalPhilosophyOther}\n` : ""}
- Faith Background: ${faithBackground}
${classroom.faithBackgroundOther ? `- Faith Details: ${classroom.faithBackgroundOther}\n` : ""}

${basePrompt}

Please ensure all content aligns with the family's educational philosophy and respects their faith background.
`.trim();
}

/**
 * Combined prompt builder with all context
 * This is the main function to use for AI generation
 * @deprecated Use buildMasterPrompt() instead for better context integration
 */
export async function buildCompletePrompt(
  params: {
    objectiveId?: string;
    studentId?: string;
    organizationId: string;
    userInstruction: string;
  },
): Promise<string> {
  let prompt = params.userInstruction;

  // 1. Add Academic Spine context if objective provided
  if (params.objectiveId) {
    prompt = await buildSpineAwarePrompt(params.objectiveId, prompt);
  }

  // 2. Add student personality context
  if (params.studentId) {
    prompt = await buildPersonalizedPrompt(params.studentId, prompt, params.organizationId);
  }

  // 3. Add family context
  prompt = await buildFamilyContextPrompt(params.organizationId, prompt);

  return prompt;
}

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
    courseBlockId?: string;
    bookId?: string;
    videoId?: string;
    articleId?: string;
    documentId?: string;
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
    courseBlockId: params.courseBlockId,
    bookId: params.bookId,
    videoId: params.videoId,
    articleId: params.articleId,
    documentId: params.documentId,
  };

  const masterContext = await getMasterContext(contextParams);

  // Serialize context to prompt string
  const contextString = serializeMasterContext(masterContext, {
    maxTokens: options?.maxTokens || 2000,
    includeDetails: options?.includeDetails !== false,
    prioritize: options?.prioritize || ["academic", "student", "family", "library", "schedule"],
    modelType: options?.modelType || "flash",
  });

  // Combine with user instruction
  return `
You are an expert educator creating personalized educational content.

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
`.trim();
}

// Helper function
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

