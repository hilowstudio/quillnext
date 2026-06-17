"use server";

import { db } from "@/server/db";
import { z } from "zod";
import { getTextbooksForTopic } from "@/lib/textbook-coverage";

const getStrandsSchema = z.object({
    subjectId: z.string().uuid(),
});

const getTopicsSchema = z.object({
    strandId: z.string().uuid(),
});

const getSubtopicsSchema = z.object({
    topicId: z.string().uuid(),
});

const getObjectivesSchema = z.object({
    subtopicId: z.string().uuid(),
});

export async function getSubjects() {
    // Removed defensive try/catch - schema changes should fail explicitly
    const subjects = await db.subject.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, code: true },
        take: 100, // Explicit bound - reasonable limit for academic subjects
    });
    return { success: true, subjects };
}

export async function getStrands(rawData: unknown) {
    const data = getStrandsSchema.parse(rawData);

    // Removed defensive try/catch
    const strands = await db.strand.findMany({
        where: { subjectId: data.subjectId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, code: true },
        take: 100, // Explicit bound
    });
    return { success: true, strands };
}

export async function getTopics(rawData: unknown) {
    const data = getTopicsSchema.parse(rawData);

    // Removed defensive try/catch
    const topics = await db.topic.findMany({
        where: { strandId: data.strandId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, code: true },
        take: 100, // Explicit bound
    });
    return { success: true, topics };
}

export async function getSubtopics(rawData: unknown) {
    const data = getSubtopicsSchema.parse(rawData);

    // Removed defensive try/catch
    const subtopics = await db.subtopic.findMany({
        where: { topicId: data.topicId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, code: true },
        take: 100, // Explicit bound
    });
    return { success: true, subtopics };
}

export async function getObjectives(rawData: unknown) {
    const data = getObjectivesSchema.parse(rawData);

    // Removed defensive try/catch
    const objectives = await db.objective.findMany({
        where: { subtopicId: data.subtopicId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, code: true },
        take: 200, // Explicit bound - objectives can be numerous
    });
    return { success: true, objectives };
}

const getTopicCoverageSchema = z.object({
    topicId: z.string().uuid(),
});

/**
 * Which ingested open textbooks ground a given spine Topic (coverage cross-walk (b)). Best-match
 * first. Powers the "📚 grounded by N open textbook(s)" hint in the spine browser and spine-gap
 * awareness (an empty result = no open textbook covers this topic yet). Best-effort.
 */
export async function getTopicTextbookCoverage(rawData: unknown) {
    const data = getTopicCoverageSchema.parse(rawData);
    const textbooks = await getTextbooksForTopic(data.topicId);
    return { success: true, textbooks };
}
