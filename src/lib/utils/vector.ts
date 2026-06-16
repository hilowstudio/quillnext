import { db } from "@/server/db";
import { embed } from "ai";
import { embeddingModel, embeddingProviderOptions } from "@/lib/ai/config";

/**
 * Semantic search for books using pgvector
 * Uses cosine similarity to find relevant books based on query
 */
export async function searchBooks(query: string, limit = 5) {
  // 1. Generate embedding for user query
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
  });

  // 2. Perform vector similarity search (Cosine Distance)
  // We cast the embedding array to a string for the SQL query
  const vectorQuery = `[${queryEmbedding.join(",")}]`;

  // 3. Query using raw SQL (Prisma doesn't fully support vector queries yet)
  const books = await db.$queryRaw<
    Array<{
      id: string;
      title: string;
      summary: string | null;
      similarity: number;
    }>
  >`
    SELECT 
      id, 
      title, 
      summary, 
      1 - (embedding <=> ${vectorQuery}::vector) as similarity
    FROM "books"
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorQuery}::vector) > 0.5
    ORDER BY similarity DESC
    LIMIT ${limit};
  `;

  return books;
}

/**
 * Generate and store embedding for a book
 * Called when book content is extracted or updated
 */
export async function generateBookEmbedding(bookId: string, text: string) {
  // Generate embedding
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
  });

  // Store in database using raw SQL
  const vectorString = `[${embedding.join(",")}]`;

  await db.$executeRaw`
    UPDATE "books"
    SET embedding = ${vectorString}::vector
    WHERE id = ${bookId};
  `;

  return embedding;
}

/**
 * Find books similar to a given book
 * Useful for "related books" or "if you liked this" features
 */
export async function findSimilarBooks(bookId: string, organizationId: string, limit = 5) {
  // SECURITY: both the source book (b1) and every candidate (b2) MUST belong to the caller's
  // org (DB column `account_id`); otherwise this cross-join leaks other tenants' titles/summaries.
  const books = await db.$queryRaw<
    Array<{
      id: string;
      title: string;
      summary: string | null;
      similarity: number;
    }>
  >`
    SELECT
      b2.id,
      b2.title,
      b2.summary,
      1 - (b1.embedding <=> b2.embedding) as similarity
    FROM "books" b1
    CROSS JOIN "books" b2
    WHERE b1.id = ${bookId}
      AND b1.account_id = ${organizationId}
      AND b2.account_id = ${organizationId}
      AND b2.id != ${bookId}
      AND b1.embedding IS NOT NULL
      AND b2.embedding IS NOT NULL
      AND 1 - (b1.embedding <=> b2.embedding) > 0.5
    ORDER BY similarity DESC
    LIMIT ${limit};
  `;

  return books;
}

/**
 * Link to video_resources table search
 */
export async function searchVideos(query: string, limit = 5) {
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
  });

  const vectorQuery = `[${queryEmbedding.join(",")}]`;

  const videos = await db.$queryRaw<
    Array<{
      id: string;
      title: string | null;
      extractedSummary: string | null;
      similarity: number;
    }>
  >`
    SELECT 
      id, 
      title, 
      extracted_summary as "extractedSummary",
      1 - (embedding <=> ${vectorQuery}::vector) as similarity
    FROM "video_resources"
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorQuery}::vector) > 0.5
    ORDER BY similarity DESC
    LIMIT ${limit};
  `;

  return videos;
}

/**
 * Generate embedding for a video (summary + key points)
 */
export async function generateVideoEmbedding(videoId: string, text: string) {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
  });

  const vectorString = `[${embedding.join(",")}]`;

  await db.$executeRaw`
    UPDATE "video_resources"
    SET embedding = ${vectorString}::vector
    WHERE id = ${videoId};
  `;

  return embedding;
}

