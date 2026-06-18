"use server";

import { generateText } from "ai";
import { buildMasterPrompt } from "@/lib/utils/prompt-builder";
import { models } from "@/lib/ai/config";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";

interface GenerateFeedbackParams {
    studentId: string;
    courseId: string;
    questionText: string;
    responseContent: string | any;
}

interface GenerateOverallFeedbackParams {
    studentId: string;
    courseId: string;
    assessmentTitle: string;
    totalScore: number;
    maxScore: number;
}

/**
 * SECURITY: the organization is ALWAYS derived from the session — never accepted from the
 * caller — and the studentId is verified to belong to that org before any family/student
 * context is assembled. (Previously both actions trusted a client-supplied organizationId,
 * a cross-tenant context leak.)
 */
async function assertStudentInOrg(studentId: string): Promise<string> {
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("Forbidden");
    const student = await db.learner.findFirst({
        where: { id: studentId, organizationId },
        select: { id: true },
    });
    if (!student) throw new Error("Forbidden: student is not in your organization");
    return organizationId;
}

export async function generateItemFeedback({
    studentId,
    courseId,
    questionText,
    responseContent,
}: GenerateFeedbackParams) {
    const organizationId = await assertStudentInOrg(studentId);
    try {
        const prompt = await buildMasterPrompt({
            organizationId,
            studentId,
            courseId,
            userInstruction: `Provide personalized feedback for this assessment response:

Question: ${questionText}
Student Response: ${typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent)}

Provide feedback that:
- Uses the student's preferred communication style
- Is encouraging and constructive
- Explains what was done well and what could be improved
- Suggests specific ways to improve`,
        });

        const { text } = await generateText({
            model: models.flash,
            prompt,
        });

        return { text };
    } catch (error) {
        console.error("Server Action failed: generateItemFeedback", error);
        throw new Error("Failed to generate feedback");
    }
}

export async function generateOverallFeedback({
    studentId,
    courseId,
    assessmentTitle,
    totalScore,
    maxScore,
}: GenerateOverallFeedbackParams) {
    const organizationId = await assertStudentInOrg(studentId);
    try {
        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

        const prompt = await buildMasterPrompt({
            organizationId,
            studentId,
            courseId,
            userInstruction: `Provide overall personalized feedback for this assessment:

Assessment: ${assessmentTitle}
Score: ${totalScore} / ${maxScore} (${percentage.toFixed(1)}%)

Provide overall feedback that:
- Uses the student's preferred communication style
- Celebrates strengths
- Identifies areas for improvement
- Provides encouragement and next steps
- Suggests remedial resources if needed`,
        });

        const { text } = await generateText({
            model: models.flash,
            prompt,
        });

        return { text };
    } catch (error) {
        console.error("Server Action failed: generateOverallFeedback", error);
        throw new Error("Failed to generate overall feedback");
    }
}
