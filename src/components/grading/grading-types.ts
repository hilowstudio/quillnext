import type { Prisma } from "@/generated/client";

// The grading attempt payload the /grading/[id] page loads (assessmentAttempt.findUnique) and
// hands to GradingInterface. tsc enforces this stays in sync with that page's include at the
// <GradingInterface attempt={…} /> call site.
export type GradingAttempt = Prisma.AssessmentAttemptGetPayload<{
  include: {
    assessment: {
      include: {
        course: { include: { subject: true; strand: true } };
        items: true;
      };
    };
    student: { include: { learnerProfile: true } };
    itemResponses: { include: { item: true } };
  };
}>;
