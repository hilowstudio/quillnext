import type {
  MasterContext,
  FamilyContext,
  StudentContext,
  AcademicContext,
  LibraryContext,
  ScheduleContext,
} from "./master-context";
import { PHILOSOPHY_PROMPTS } from "@/lib/constants/educational-philosophies";
import { EducationalPhilosophy } from "@/generated/client";

// -----------------------------------------------------------------------
// Context Serialization
// Converts database models to optimized prompt strings for AI
// -----------------------------------------------------------------------

export interface SerializationOptions {
  maxTokens?: number;
  includeDetails?: boolean;
  prioritize?: ("family" | "student" | "academic" | "library" | "schedule")[];
  modelType?: "pro3" | "flash" | "flash-lite";
}

const DEFAULT_MAX_TOKENS = 2000; // Rough estimate, will vary by model

/**
 * Serialize master context to prompt string
 * Handles smart truncation and prioritization
 */
export function serializeMasterContext(
  context: MasterContext,
  options: SerializationOptions = {},
): string {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    includeDetails = true,
    prioritize = ["academic", "student", "family", "library", "schedule"],
    modelType = "flash",
  } = options;

  const parts: string[] = [];

  // Serialize in priority order
  for (const priority of prioritize) {
    switch (priority) {
      case "academic":
        if (context.academic) {
          parts.push(serializeAcademicContext(context.academic, includeDetails));
        }
        break;
      case "student":
        if (context.student) {
          parts.push(serializeStudentContext(context.student, includeDetails));
        }
        break;
      case "family":
        if (context.family) {
          parts.push(serializeFamilyContext(context.family, includeDetails));
        }
        break;
      case "library":
        if (context.library) {
          parts.push(serializeLibraryContext(context.library, includeDetails));
        }
        break;
      case "schedule":
        if (context.schedule) {
          parts.push(serializeScheduleContext(context.schedule, includeDetails));
        }
        break;
    }
  }

  let result = parts.join("\n\n");

  // Apply smart truncation if needed
  if (estimateTokenCount(result) > maxTokens) {
    result = truncateContext(result, maxTokens, prioritize, context);
  }

  return result;
}

/**
 * Serialize family context
 */
function serializeFamilyContext(
  context: FamilyContext,
  includeDetails: boolean,
): string {
  const parts: string[] = [];

  parts.push("FAMILY EDUCATIONAL CONTEXT:");
  parts.push(`- Classroom: ${context.classroom.name}`);

  if (context.classroom.description) {
    parts.push(`- Description: ${context.classroom.description}`);
  }

  parts.push(`- Educational Philosophy: ${context.classroom.educationalPhilosophy}`);
  if (context.classroom.educationalPhilosophyOther) {
    parts.push(`- Philosophy Details: ${context.classroom.educationalPhilosophyOther}`);
  }

  // Inject Mental Model for Philosophy
  const philosophy = context.classroom.educationalPhilosophy as EducationalPhilosophy;
  if (philosophy && PHILOSOPHY_PROMPTS[philosophy]) {
    parts.push(`\n${PHILOSOPHY_PROMPTS[philosophy]}`);
  }

  parts.push(`- Faith Background: ${context.classroom.faithBackground}`);
  if (context.classroom.faithBackgroundOther) {
    parts.push(`- Faith Details: ${context.classroom.faithBackgroundOther}`);
  }

  if (includeDetails && context.instructors.length > 0) {
    parts.push(`- Instructors: ${context.instructors.map((i) => `${i.firstName} ${i.lastName || ""}`.trim()).join(", ")}`);
  }

  if (includeDetails && context.environment) {
    // Defensive: environmentPreferences is a JSON column; the app write path Zod-validates it
    // (blueprint.ts), but guard the read so a malformed legacy/hand-edited row degrades gracefully
    // instead of throwing on .length/.join.
    if (Array.isArray(context.environment.goals) && context.environment.goals.length > 0) {
      parts.push(`- Educational Goals: ${context.environment.goals.join(", ")}`);
    }
    if (Array.isArray(context.environment.challenges) && context.environment.challenges.length > 0) {
      parts.push(`- Current Challenges: ${context.environment.challenges.join(", ")}`);
    }
  }

  return parts.join("\n");
}

/**
 * Serialize student context
 */
/**
 * Serialize student context
 */
function serializeStudentContext(
  context: StudentContext,
  includeDetails: boolean,
): string {
  const parts: string[] = [];

  parts.push("STUDENT CONTEXT:");
  parts.push(`- Name: ${context.student.preferredName || context.student.firstName} ${context.student.lastName || ""}`.trim());
  parts.push(`- Grade: ${context.student.currentGrade}`);

  // 1. Personality & Motivation
  if (context.profile?.personalityData) {
    const pd = context.profile.personalityData;

    parts.push("\nPERSONALITY & MOTIVATION:");
    if (pd.motivationalDriver) parts.push(`- Motivational Driver: ${pd.motivationalDriver}`);
    if (pd.feedbackStyle) parts.push(`- Feedback Preference: ${pd.feedbackStyle}`);
    if (pd.workStyle) parts.push(`- Work Style: ${pd.workStyle}`);
    if (pd.gamificationMode) parts.push(`- Gamification: Enabled (Frame tasks as missions/challenges)`);
    if (pd.scaffoldingLevel) parts.push(`- Scaffolding Needed: ${pd.scaffoldingLevel}`);

    if (includeDetails && pd.toneInstructions) {
      parts.push(`- Tone Instructions: ${pd.toneInstructions}`);
    }
  }

  // 2. Learning Style
  if (context.profile?.learningStyleData) {
    const ls = context.profile.learningStyleData;

    parts.push("\nLEARNING STYLE:");
    if (ls.inputMode) parts.push(`- Input Mode: ${ls.inputMode}`);
    if (ls.outputMode) parts.push(`- Output Mode: ${ls.outputMode}`);
    if (ls.processingMode) parts.push(`- Processing Mode: ${ls.processingMode}`);

    if (includeDetails && ls.formatInstructions) {
      parts.push(`- Format Instructions: ${ls.formatInstructions}`);
    }
  }

  // 3. Interests (New Section)
  if (context.profile?.interestsData) {
    const id = context.profile.interestsData;

    parts.push("\nINTERESTS & HOOKS:");
    if (id.integrationMode) parts.push(`- Integration Strategy: ${id.integrationMode}`);

    if (id.hookThemes && id.hookThemes.length > 0) {
      parts.push(`- Themes: ${id.hookThemes.join(", ")}`);
    }

    if (id.specificEntities && id.specificEntities.length > 0) {
      const favorites = id.specificEntities.map(e => `${e.category}=${e.favorite}`).join(", ");
      parts.push(`- Specific Favorites: ${favorites}`);
    }

    if (includeDetails && id.analogyStrategy) {
      parts.push(`- Analogy Strategy: ${id.analogyStrategy}`);
    }
  }

  if (context.student.learningDifficulties && context.student.learningDifficulties.length > 0) {
    parts.push(`\n- Learning Considerations: ${context.student.learningDifficulties.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Serialize academic context
 */
function serializeAcademicContext(
  context: AcademicContext,
  includeDetails: boolean,
): string {
  const parts: string[] = [];

  parts.push("ACADEMIC CONTEXT:");
  parts.push(`- Subject Hierarchy: ${context.fullPath}`);
  parts.push(`- Learning Objective: "${context.objective.text}"`);
  parts.push(`- Objective Code: ${context.objective.code}`);

  if (context.objective.gradeLevel !== null) {
    const gradeLabel = context.objective.gradeLevel === 0 ? "Kindergarten" : `Grade ${context.objective.gradeLevel}`;
    parts.push(`- Grade Level: ${gradeLabel}`);
  }

  if (context.objective.complexity !== null) {
    parts.push(`- Bloom's Taxonomy Level: ${context.objective.complexity}`);
  }

  if (includeDetails) {
    parts.push(`- Subject: ${context.hierarchy.subject.name} (${context.hierarchy.subject.code})`);
    parts.push(`- Strand: ${context.hierarchy.strand.name} (${context.hierarchy.strand.code})`);
    parts.push(`- Topic: ${context.hierarchy.topic.name} (${context.hierarchy.topic.code})`);
    parts.push(`- Subtopic: ${context.hierarchy.subtopic.name} (${context.hierarchy.subtopic.code})`);
  }

  return parts.join("\n");
}

/**
 * Serialize library context
 */
function serializeLibraryContext(
  context: LibraryContext,
  includeDetails: boolean,
): string {
  const parts: string[] = [];

  if (context.relevantBooks.length > 0 || context.relevantVideos.length > 0) {
    parts.push("AVAILABLE RESOURCES:");

    if (context.relevantBooks.length > 0) {
      parts.push("\nRelevant Books:");
      for (const book of context.relevantBooks.slice(0, includeDetails ? 5 : 3)) {
        parts.push(`- ${book.title}${book.authors ? ` by ${book.authors.join(", ")}` : ""} (${book.subject}${book.strand ? ` > ${book.strand}` : ""})`);
        if (includeDetails && book.summary) {
          const summary = truncateText(book.summary, 150);
          parts.push(`  Summary: ${summary}`);
        }
      }
    }

    if (context.relevantVideos.length > 0) {
      parts.push("\nRelevant Videos:");
      for (const video of context.relevantVideos.slice(0, includeDetails ? 3 : 2)) {
        parts.push(`- ${video.title || "Untitled Video"}`);
        if (includeDetails && video.extractedSummary) {
          const summary = truncateText(video.extractedSummary, 150);
          parts.push(`  Summary: ${summary}`);
        }
      }
    }

    if (includeDetails && context.courseResources.length > 0) {
      parts.push("\nCourse Resources:");
      for (const resource of context.courseResources.slice(0, 5)) {
        parts.push(`- ${resource.title} (${resource.resourceKind})`);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Serialize schedule context
 */
function serializeScheduleContext(
  context: ScheduleContext,
  includeDetails: boolean,
): string {
  const parts: string[] = [];

  parts.push("SCHEDULE CONTEXT:");
  parts.push(`- School Year: ${formatDate(context.schoolYearStartDate)} to ${formatDate(context.schoolYearEndDate)}`);
  parts.push(`- Current Week: Week ${context.currentWeek} of ${context.totalWeeks}`);

  if (context.dailyStartTime && context.dailyEndTime) {
    parts.push(`- Daily Schedule: ${formatTime(context.dailyStartTime)} - ${formatTime(context.dailyEndTime)}`);
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const schoolDays = context.schoolDaysOfWeek.map((d) => dayNames[d]).join(", ");
  parts.push(`- School Days: ${schoolDays}`);

  if (includeDetails && context.holidays.length > 0) {
    const upcomingHolidays = context.holidays
      .filter((h) => h.holidayDate >= new Date())
      .slice(0, 5)
      .map((h) => `${formatDate(h.holidayDate)}: ${h.name}`)
      .join(", ");
    if (upcomingHolidays) {
      parts.push(`- Upcoming Holidays: ${upcomingHolidays}`);
    }
  }

  return parts.join("\n");
}

/**
 * Estimate token count (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate context intelligently based on priority
 */
function truncateContext(
  text: string,
  maxTokens: number,
  priorities: string[],
  context: MasterContext,
): string {
  const currentTokens = estimateTokenCount(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Calculate how much to truncate
  const excessTokens = currentTokens - maxTokens;
  const targetLength = text.length - excessTokens * 4;

  // Try to preserve high-priority sections
  const lines = text.split("\n");
  const sections: { priority: number; lines: string[]; start: number; end: number }[] = [];

  let currentSection: { priority: number; lines: string[]; start: number } | null = null;
  let sectionStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const sectionType = getSectionType(line);
    const priority = priorities.indexOf(sectionType);

    if (currentSection === null || currentSection.priority !== priority) {
      if (currentSection) {
        sections.push({
          ...currentSection,
          end: i - 1,
        });
      }
      currentSection = {
        priority,
        lines: [line],
        start: i,
      };
    } else {
      currentSection.lines.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      ...currentSection,
      end: lines.length - 1,
    });
  }

  // Sort sections by priority (lower index = higher priority)
  sections.sort((a, b) => a.priority - b.priority);

  // Build truncated text, keeping high-priority sections
  const result: string[] = [];
  let remainingLength = targetLength;

  for (const section of sections) {
    const sectionText = section.lines.join("\n");
    const sectionTokens = estimateTokenCount(sectionText);

    if (remainingLength >= sectionText.length) {
      result.push(sectionText);
      remainingLength -= sectionText.length;
    } else if (remainingLength > 100) {
      // Truncate this section
      const truncated = truncateText(sectionText, remainingLength);
      result.push(truncated);
      break;
    } else {
      // Skip this section
      break;
    }
  }

  return result.join("\n\n");
}

/**
 * Get section type from line
 */
function getSectionType(line: string): string {
  if (line.includes("ACADEMIC CONTEXT") || line.includes("Learning Objective")) {
    return "academic";
  }
  if (line.includes("STUDENT CONTEXT") || line.includes("Communication Style")) {
    return "student";
  }
  if (line.includes("FAMILY EDUCATIONAL CONTEXT") || line.includes("Educational Philosophy")) {
    return "family";
  }
  if (line.includes("AVAILABLE RESOURCES") || line.includes("Relevant Books")) {
    return "library";
  }
  if (line.includes("SCHEDULE CONTEXT") || line.includes("School Year")) {
    return "schedule";
  }
  return "other";
}

/**
 * Truncate text to approximate length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

