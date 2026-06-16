import { withTenant } from "@/server/db";
import { embed } from "ai";
import { embeddingModel, embeddingProviderOptions } from "@/lib/ai/config";

// Raw pgvector SQL must run via withTenant so the RLS tenant GUCs are set on the query's
// connection (the per-query Prisma extension only wraps model ops, not $queryRaw/$executeRaw).

/**
 * Semantic search for books using pgvector cosine similarity.
 */
export async function searchBooks(query: string, limit = 5) {
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
  });
  const vectorQuery = `[${queryEmbedding.join(",")}]`;

  return withTenant((tx) =>
    tx.$queryRaw<
      Array<{ id: string; title: string; summary: string | null; similarity: number }>
    >`
    SELECT id, title, summary,
      1 - (embedding <=> ${vectorQuery}::vector) as similarity
    FROM "books"
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorQuery}::vector) > 0.5
    ORDER BY similarity DESC
    LIMIT ${limit};
  `,
  );
}

/**
 * Generate and store an embedding for a book.
 */
export async function generateBookEmbedding(bookId: string, text: string) {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
  });
  const vectorString = `[${embedding.join(",")}]`;

  await withTenant((tx) =>
    tx.$executeRaw`
    UPDATE "books"
    SET embedding = ${vectorString}::vector
    WHERE id = ${bookId};
  `,
  );

  return embedding;
}

/**
 * Find books similar to a given book. Both sides of the cross-join are org-filtered
 * (defense in depth alongside RLS) so the sidebar never leaks another tenant's titles.
 */
export async function findSimilarBooks(bookId: string, organizationId: string, limit = 5) {
  return withTenant((tx) =>
    tx.$queryRaw<
      Array<{ id: string; title: string; summary: string | null; similarity: number }>
    >`
    SELECT b2.id, b2.title, b2.summary,
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
  `,
  );
}

/**
 * Semantic search for video resources using pgvector cosine similarity.
 */
export async function searchVideos(query: string, limit = 5) {
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
  });
  const vectorQuery = `[${queryEmbedding.join(",")}]`;

  return withTenant((tx) =>
    tx.$queryRaw<
      Array<{ id: string; title: string | null; extractedSummary: string | null; similarity: number }>
    >`
    SELECT id, title, extracted_summary as "extractedSummary",
      1 - (embedding <=> ${vectorQuery}::vector) as similarity
    FROM "video_resources"
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorQuery}::vector) > 0.5
    ORDER BY similarity DESC
    LIMIT ${limit};
  `,
  );
}

/**
 * Generate and store an embedding for a video (summary + key points).
 */
export async function generateVideoEmbedding(videoId: string, text: string) {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
  });
  const vectorString = `[${embedding.join(",")}]`;

  await withTenant((tx) =>
    tx.$executeRaw`
    UPDATE "video_resources"
    SET embedding = ${vectorString}::vector
    WHERE id = ${videoId};
  `,
  );

  return embedding;
}
