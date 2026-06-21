import { withTenant } from "@/server/db";
import { excludeParentLearners } from "@/server/queries/learner-filters";
import { getMasterContext } from "./master-context";
import type { MasterContext } from "./master-context";
import { ContextSuggestion } from "./context-types";

export type { ContextSuggestion };

/**
 * Analyze context completeness and suggest improvements
 */
export async function analyzeContextCompleteness(
  organizationId: string | null,
  options?: {
    studentId?: string;
    courseId?: string;
    objectiveId?: string;
  },
): Promise<{
  completeness: number;
  suggestions: ContextSuggestion[];
}> {
  if (!organizationId) {
    return {
      completeness: 0,
      suggestions: [
        {
          type: "missing",
          category: "family",
          title: "Complete Family Blueprint",
          description: "Set up your family blueprint to enable personalized content generation",
          impact: "All Inkling-generated content will be personalized to your family's philosophy and schedule",
          actionUrl: "/onboarding",
          actionLabel: "Start Onboarding",
          priority: "high",
        },
      ],
    };
  }

  const masterContext = await getMasterContext({
    organizationId,
    studentId: options?.studentId,
    courseId: options?.courseId,
    objectiveId: options?.objectiveId,
  });

  const suggestions: ContextSuggestion[] = [];
  let completenessScore = 0;
  const maxScore = 5;

  // Check family context
  if (masterContext.family) {
    completenessScore += 1;
  } else {
    // Should not happen if org exists but safeguard
    suggestions.push({
      type: "missing",
      category: "family",
      title: "Complete Family Blueprint",
      description: "Set up your family blueprint to enable personalized content generation",
      impact: "All Inkling-generated content will be personalized to your family's philosophy and schedule",
      actionUrl: "/onboarding",
      actionLabel: "Start Onboarding",
      priority: "high",
    });
  }

  // Check student context
  if (options?.studentId) {
    if (masterContext.student) {
      completenessScore += 1;
      if (!masterContext.student.profile?.personalityData) {
        suggestions.push({
          type: "missing",
          category: "student",
          title: "Complete Student Assessment",
          description: "Complete the personality assessment for personalized learning",
          impact: "Content will be tailored to this student's learning style and communication preferences",
          actionUrl: `/students/${options.studentId}/assessment`,
          actionLabel: "Take Assessment",
          priority: "high",
        });
      }
    } else {
      suggestions.push({
        type: "missing",
        category: "student",
        title: "Student Not Found",
        description: "The selected student could not be found",
        impact: "Personalization will not be available for this student",
        actionUrl: "/students",
        actionLabel: "View Students",
        priority: "high",
      });
    }
  } else {
    // Check if any students exist for the organization
    const studentCount = await withTenant(
      (tx) => tx.learner.count({ where: { organizationId, ...excludeParentLearners } }),
      undefined,
      { organizationId, userId: null },
    );

    if (studentCount > 0) {
      completenessScore += 1;
    } else {
      suggestions.push({
        type: "opportunity",
        category: "student",
        title: "Add your students",
        description: "Select a student to personalize content generation",
        impact: "Content will be tailored to the student's learning style, interests, and preferences",
        actionUrl: "/students",
        actionLabel: "Select Student",
        priority: "medium",
      });
    }
  }

  // Check academic context
  if (options?.objectiveId) {
    if (masterContext.academic) {
      completenessScore += 1;
    } else {
      suggestions.push({
        type: "missing",
        category: "academic",
        title: "Objective Not Found",
        description: "The selected learning objective could not be found",
        impact: "Content may not align with specific learning standards",
        actionUrl: "/courses",
        actionLabel: "View Courses",
        priority: "medium",
      });
    }
  } else {
    // Check if any courses exist
    const courseCount = await withTenant(
      (tx) => tx.course.count({ where: { organizationId } }),
      undefined,
      { organizationId, userId: null },
    );

    if (courseCount > 0) {
      completenessScore += 1;
    } else {
      suggestions.push({
        type: "opportunity",
        category: "academic",
        title: "Create your course list",
        description: "Link content to a specific learning objective for better alignment",
        impact: "Content will be precisely aligned with academic standards and learning goals",
        actionUrl: "/courses",
        actionLabel: "View Courses",
        priority: "low",
      });
    }
  }

  // Check library context
  const bookCount = await withTenant(
    (tx) => tx.book.count({
      where: { organizationId },
    }),
    undefined,
    { organizationId, userId: null },
  );

  if (bookCount > 0) {
    completenessScore += 1;
    if (options?.courseId) {
      const course = await withTenant(
        (tx) => tx.course.findUnique({
          where: { id: options.courseId },
          include: {
            subject: true,
            strand: true,
          },
        }),
        undefined,
        { organizationId, userId: null },
      );

      if (course) {
        const relevantBooks = await withTenant(
          (tx) => tx.book.count({
            where: {
              organizationId,
              OR: [
                { subjectId: course.subjectId },
                { strandId: course.strandId || undefined },
              ],
            },
          }),
          undefined,
          { organizationId, userId: null },
        );

        if (relevantBooks === 0) {
          suggestions.push({
            type: "opportunity",
            category: "library",
            title: "Add Relevant Books",
            description: `Add books related to ${course.subject.name} to enhance content generation`,
            impact: "Inkling can reference specific books when generating course content",
            actionUrl: "/living-library/scan",
            actionLabel: "Scan Books",
            priority: "medium",
          });
        }
      }
    }
  } else {
    suggestions.push({
      type: "missing",
      category: "library",
      title: "Add books, videos, articles, and documents",
      description: "Scan books or add other media to enable Inkling to reference your library when generating content",
      impact: "Inkling can use your actual library materials as sources for content generation",
      actionUrl: "/living-library/scan",
      actionLabel: "Add Resources",
      priority: "medium",
    });
  }

  // Check schedule context
  if (masterContext.schedule) {
    completenessScore += 1;
  } else {
    suggestions.push({
      type: "missing",
      category: "schedule",
      title: "Complete Schedule Setup",
      description: "Set up your school schedule to enable automatic pacing calculations",
      impact: "Course pacing and scheduling will be automatically calculated based on your calendar",
      actionUrl: "/onboarding?step=2",
      actionLabel: "Complete Schedule",
      priority: "medium",
    });
  }

  const completeness = (completenessScore / maxScore) * 100;

  return {
    completeness: Math.round(completeness),
    suggestions: suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }),
  };
}



