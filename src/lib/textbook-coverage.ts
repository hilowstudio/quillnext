/**
 * textbook-coverage.ts — coarse textbook↔spine-Topic cross-walk (grounded-generation (b)).
 *
 * Maps an ingested open textbook to the spine TOPICS it covers, at the reliable TOPIC grain (NOT the
 * improbable objective grain — see the design decision). It's pure SEMANTIC MATCH, reusing the chunk
 * embeddings already in the corpus: for each Topic under the book's subject, the best cosine
 * similarity of ANY of the book's chunks; Topics above a threshold are recorded as coverage. This
 * powers "which textbooks teach topic X" (navigation) and spine-gap discovery (topics no textbook
 * covers = a query over the coverage table). textbook_* tables are GLOBAL/CONTEXT_FREE → plain db.
 */

import { db } from "@/server/db";
import { embedMany } from "ai";
import { embeddingModel, embeddingProviderOptions } from "@/lib/ai/config";

const COVERAGE_THRESHOLD = 0.5; // min best-chunk cosine for a topic to count as "covered"
const MAX_TOPICS = 250; // bound the per-book cross-walk work

/**
 * Cross-walk one ingested textbook to the spine Topics it covers and store the results (idempotent
 * delete-then-insert). Returns the number of topics covered. Best-effort / NEVER throws — coverage is
 * an enhancement; a failure must not break ingestion.
 */
export async function crossWalkTextbookTopics(documentId: string): Promise<number> {
    try {
        const doc = await db.textbookDocument.findUnique({
            where: { id: documentId },
            select: { subject: true, category: true },
        });
        if (!doc) return 0;

        // Resolve the spine Subject from the textbook's broad CATEGORY (else its subject), fuzzily:
        // OpenStax "Science" ↔ spine "Science & Nature"; "Math" ↔ "Mathematics"; "Social Studies" ↔
        // "History & Social Studies". Match on the whole hint and on its first word.
        const hint = (doc.category || doc.subject || "").trim();
        if (!hint) return 0;
        const firstWord = hint.split(/\s+/)[0];
        const subjects = await db.subject.findMany({
            where: {
                OR: [
                    { name: { contains: hint, mode: "insensitive" } },
                    { name: { contains: firstWord, mode: "insensitive" } },
                ],
            },
            select: { id: true },
        });
        if (subjects.length === 0) return 0;
        const subjectIds = subjects.map((s) => s.id);

        // Topics under the matched subject(s), with light context (their subtopic names) for the embed.
        const topics = await db.topic.findMany({
            where: { strand: { subjectId: { in: subjectIds } } },
            select: { id: true, name: true, subtopics: { select: { name: true }, take: 8 } },
            take: MAX_TOPICS,
        });
        if (topics.length === 0) return 0;

        // Embed each topic (name + subtopic names) as a retrieval query (batched ≤100 for the cap).
        const topicTexts = topics.map((t) =>
            `${t.name} ${t.subtopics.map((s) => s.name).join(" ")}`.trim(),
        );
        const BATCH = 100;
        const embeddings: number[][] = [];
        for (let i = 0; i < topicTexts.length; i += BATCH) {
            const { embeddings: be } = await embedMany({
                model: embeddingModel,
                values: topicTexts.slice(i, i + BATCH),
                providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
            });
            embeddings.push(...be);
        }

        // For each topic, the best cosine of any of the book's chunks. Plain db (global table).
        const covered: { documentId: string; topicId: string; similarity: number }[] = [];
        for (let i = 0; i < topics.length; i++) {
            const vec = `[${embeddings[i].join(",")}]`;
            const rows = await db.$queryRawUnsafe<Array<{ sim: number }>>(
                `SELECT max(1 - (embedding <=> $1::vector)) AS sim
                 FROM "textbook_chunks"
                 WHERE document_id = $2 AND embedding IS NOT NULL`,
                vec,
                documentId,
            );
            const sim = Number(rows[0]?.sim ?? 0);
            if (sim >= COVERAGE_THRESHOLD) {
                covered.push({ documentId, topicId: topics[i].id, similarity: sim });
            }
        }

        // Idempotent replace for this book.
        await db.textbookTopicCoverage.deleteMany({ where: { documentId } });
        if (covered.length > 0) {
            await db.textbookTopicCoverage.createMany({ data: covered });
        }
        return covered.length;
    } catch (e) {
        console.error("[crossWalkTextbookTopics] non-fatal failure", e);
        return 0;
    }
}

/**
 * Which ingested textbooks cover a given spine Topic, best-match first. For the coverage/navigation
 * consumer. Plain db (global). NEVER throws.
 */
export async function getTextbooksForTopic(
    topicId: string,
): Promise<{ documentId: string; title: string; subject: string | null; similarity: number }[]> {
    try {
        const rows = await db.textbookTopicCoverage.findMany({
            where: { topicId },
            orderBy: { similarity: "desc" },
            select: { documentId: true, similarity: true, document: { select: { title: true, subject: true } } },
            take: 20,
        });
        return rows.map((r) => ({
            documentId: r.documentId,
            title: r.document.title,
            subject: r.document.subject,
            similarity: r.similarity,
        }));
    } catch (e) {
        console.error("[getTextbooksForTopic] non-fatal failure", e);
        return [];
    }
}
