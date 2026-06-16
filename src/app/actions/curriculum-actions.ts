"use server";

import { db } from "@/server/db";
import { z } from "zod";
import { getCurrentUserOrg } from "@/lib/auth-helpers";

// Define validation schemas inline since these are simple
const getCourseBooksSchema = z.object({
    courseId: z.string().uuid("Invalid course ID"),
});

const getBookChaptersSchema = z.object({
    bookId: z.string().uuid("Invalid book ID"),
});

const getSubtopicObjectivesSchema = z.object({
    subtopicId: z.string().uuid("Invalid subtopic ID"),
});

export async function getCourseBooks(rawData: unknown) {
    // SECURITY: require a session and scope all reads to the caller's org. Course ownership
    // is verified, and books are filtered by organizationId (not just shared subject/strand).
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) return { books: [] };

    const courseId = typeof rawData === "string"
        ? rawData
        : getCourseBooksSchema.parse(rawData).courseId;

    const course = await db.course.findFirst({
        where: { id: courseId, organizationId },
        select: { subjectId: true, strandId: true },
    });

    if (!course) return { books: [] };

    const books = await db.book.findMany({
        where: {
            organizationId,
            OR: [
                { subjectId: course.subjectId },
                { strandId: course.strandId || undefined },
            ],
        },
        select: { id: true, title: true, tableOfContents: true },
        orderBy: { title: "asc" },
        take: 50,
    });

    return { books };
}

export async function getBookChapters(rawData: unknown) {
    // SECURITY: scope the book lookup to the caller's org so a foreign bookId returns nothing.
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) return { chapters: [] };

    const bookId = typeof rawData === "string"
        ? rawData
        : getBookChaptersSchema.parse(rawData).bookId;

    const book = await db.book.findFirst({
        where: { id: bookId, organizationId },
        select: { tableOfContents: true },
    });

    if (!book || !book.tableOfContents) return { chapters: [] };

    // Parse TOC. Assumes standard structure. Adjust based on actual JSON shape.
    const toc = book.tableOfContents as any[];

    const chapters = Array.isArray(toc) ? toc.map((item: any) => ({
        id: item.id || item.label,
        label: item.label || item.title || "Untitled Chapter",
    })) : [];

    return { chapters };
}

export async function getSubtopicObjectives(rawData: unknown) {
    const subtopicId = typeof rawData === "string"
        ? rawData
        : getSubtopicObjectivesSchema.parse(rawData).subtopicId;

    const objectives = await db.objective.findMany({
        where: { subtopicId: subtopicId },
        select: { id: true, text: true, code: true },
        orderBy: { sortOrder: 'asc' },
        take: 200, // Explicit bound - subtopics can have many objectives
    });

    return { objectives };
}
