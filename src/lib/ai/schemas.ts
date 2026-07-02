import { z } from "zod";

/**
 * Quiz Schema
 * For interactive quizzes with auto-grading capabilities.
 */
export const QuizQuestionSchema = z.object({
    id: z.string().describe("Unique identifier for the question"),
    text: z.string().describe("The question text"),
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]).describe("Type of question"),
    options: z.array(z.string()).optional().describe("Options for multiple choice questions"),
    correctAnswer: z.string().describe("The correct answer text"),
    explanation: z.string().optional().describe("Explanation of why the answer is correct"),
    points: z.number().default(1).describe("Point value for this question"),
});

export const QuizSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    questions: z.array(QuizQuestionSchema),
    gradingScale: z.array(z.object({
        minScore: z.number().describe("Minimum score percentage (0-100)"),
        maxScore: z.number().describe("Maximum score percentage (0-100)"),
        feedback: z.string().describe("Feedback message for this score range"),
    })).optional().describe("Feedback rules based on score percentage"),
});

/**
 * Worksheet Schema
 * For interactive worksheets with mixed content and input fields.
 */
export const WorksheetItemSchema = z.object({
    id: z.string(),
    type: z.enum(["TEXT", "INPUT_SHORT", "INPUT_LONG", "CHECKBOX", "IMAGE"]).describe("Type of worksheet element"),
    content: z.string().describe("The text content or label for the input"),
    placeholder: z.string().optional().describe("Placeholder text for inputs"),
    correctAnswer: z.string().optional().describe("Expected answer key for manual grading"),
});

export const WorksheetSectionSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    items: z.array(WorksheetItemSchema),
});

export const WorksheetSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    sections: z.array(WorksheetSectionSchema),
});

// Union type for type safety in the generator
