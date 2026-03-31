"use server";

import { db } from "@/server/db";
import { z } from "zod";

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
    const courseId = typeof rawData === "string"
        ? rawData
        : getCourseBooksSchema.parse(rawData).courseId;

    const course = await db.course.findUnique({
        where: { id: courseId },
        select: { subjectId: true, strandId: true },
    });

    if (!course) return { books: [] };

    const books = await db.book.findMany({
        where: {
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
    const bookId = typeof rawData === "string"
        ? rawData
        : getBookChaptersSchema.parse(rawData).bookId;

    const book = await db.book.findUnique({
        where: { id: bookId },
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
