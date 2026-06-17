import { db, withTenant } from "@/server/db";
import { randomUUID } from "node:crypto";
import { embed, embedMany } from "ai";
import { embeddingModel, embeddingProviderOptions } from "@/lib/ai/config";

// Raw pgvector SQL for ORG-SCOPED tables (books, video_resources) must run via withTenant so the
// RLS tenant GUCs are set on the query's connection (the per-query Prisma extension only wraps
// model ops, not $queryRaw/$executeRaw).
//
// The GLOBAL/cross-org video_extraction_chunks + video_extractions tables are CONTEXT_FREE_MODELS
// with USING(true)/WITH CHECK(true) RLS for app_user, so their raw SQL runs on the PLAIN `db`
// (no withTenant) — mirroring how the Inngest worker writes the global catalog.

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
 *
 * The org-scoped UPDATE runs inside withTenant. When called off the request frame
 * (e.g. an Inngest worker, or anywhere AsyncLocalStorage doesn't propagate into Prisma),
 * pass the tenant explicitly via `ctx` so the GUCs are stamped from an EXPLICIT context
 * rather than relying on async-context propagation (which would otherwise fail closed and
 * throw "new row violates row-level security policy"). When omitted, withTenant falls back
 * to resolving the tenant from the session, preserving the previous behavior.
 */
export async function generateBookEmbedding(
  bookId: string,
  text: string,
  ctx?: { organizationId: string | null; userId: string | null },
) {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
  });
  const vectorString = `[${embedding.join(",")}]`;

  await withTenant(
    (tx) =>
      tx.$executeRaw`
    UPDATE "books"
    SET embedding = ${vectorString}::vector
    WHERE id = ${bookId};
  `,
    undefined,
    ctx,
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
 * Embed transcript chunks for a GLOBAL video extraction and store them in the cross-org shared
 * `video_extraction_chunks` table (pgvector). Mirrors the book-extraction embed step.
 *
 * - Embeds with `embeddingModel` + RETRIEVAL_DOCUMENT task type, in batches of <=100 so a very
 *   long video never blows the provider's per-request input cap.
 * - The chunk table is CONTEXT_FREE (no account_id; USING(true)/WITH CHECK(true) RLS for app_user),
 *   so it is written on the PLAIN `db` with NO withTenant — exactly like the Inngest worker writes
 *   the rest of the global catalog. (AsyncLocalStorage doesn't reach Prisma in the worker anyway.)
 * - Idempotent: DELETEs any existing chunks for this extraction, then INSERTs the fresh set, so a
 *   re-run (or a retry) replaces rather than duplicates.
 * - Best-effort / never throws: chunk search is an enhancement, so an embedding failure must not
 *   fail the extraction. We log and swallow.
 */
export async function embedVideoChunks(videoExtractionId: string, chunks: string[]): Promise<void> {
  try {
    const cleaned = chunks.map((c) => c?.trim()).filter((c): c is string => !!c);

    // Always clear stale chunks first so a re-embed (or an empty input) is idempotent and never
    // leaves a mix of old + new chunks. Global table → plain db, no withTenant.
    await db.$executeRaw`
      DELETE FROM "video_extraction_chunks" WHERE video_extraction_id = ${videoExtractionId};
    `;

    if (cleaned.length === 0) return;

    // Embed in batches of <=100 (provider input-count cap), preserving global chunk order.
    const BATCH = 100;
    const embeddings: number[][] = [];
    for (let i = 0; i < cleaned.length; i += BATCH) {
      const batch = cleaned.slice(i, i + BATCH);
      const { embeddings: batchEmbeddings } = await embedMany({
        model: embeddingModel,
        values: batch,
        providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
      });
      embeddings.push(...batchEmbeddings);
    }

    // INSERT each chunk via raw SQL so the pgvector `::vector` cast applies (Prisma can't bind the
    // Unsupported("vector") column directly). Mirrors the generateVideoEmbedding [v.join(",")]::vector
    // idiom. Plain db (global table).
    for (let i = 0; i < cleaned.length; i++) {
      const vectorString = `[${embeddings[i].join(",")}]`;
      await db.$executeRawUnsafe(
        `INSERT INTO "video_extraction_chunks" (id, video_extraction_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        randomUUID(),
        videoExtractionId,
        i,
        cleaned[i],
        vectorString,
      );
    }
  } catch (e) {
    console.error("[embedVideoChunks] non-fatal chunk embedding failure", e);
  }
}

/**
 * Semantic search for video resources using pgvector cosine similarity over the GLOBAL transcript
 * chunks, scoped to a single org's library.
 *
 * The embeddings live in the cross-org shared `video_extraction_chunks` catalog (one row per video,
 * shared by every org). We make search ORG-SCOPED by joining each matching extraction back to THIS
 * org's `video_resources` row via `video_extraction_id` — so an org only ever sees videos that
 * exist in its own library, even though the embeddings themselves are shared. (The org filter is
 * the per-org VideoResource join + the explicit account_id predicate, NOT RLS on the global table,
 * which is USING(true) for everyone.)
 *
 * Returns DISTINCT videos (the per-org VideoResource id) ranked by their single best-matching chunk.
 * The cosine search over the global chunk table runs on the plain `db`; the join to the org-scoped
 * `video_resources` runs inside withTenant so its RLS GUCs are stamped on the same connection.
 */
export async function searchVideos(query: string, organizationId: string, limit = 10) {
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
  });
  const vectorQuery = `[${queryEmbedding.join(",")}]`;

  return withTenant((tx) =>
    tx.$queryRaw<
      Array<{
        id: string;
        title: string | null;
        extractedSummary: string | null;
        similarity: number;
      }>
    >`
    SELECT vr.id,
           vr.title,
           vr.extracted_summary as "extractedSummary",
           MAX(1 - (vec.embedding <=> ${vectorQuery}::vector)) as similarity
    FROM "video_extraction_chunks" vec
    JOIN "video_extractions" ve ON ve.id = vec.video_extraction_id
    JOIN "video_resources" vr ON vr.video_extraction_id = ve.id
    WHERE vec.embedding IS NOT NULL
      AND vr.account_id = ${organizationId}
      AND 1 - (vec.embedding <=> ${vectorQuery}::vector) > 0.5
    GROUP BY vr.id, vr.title, vr.extracted_summary
    ORDER BY similarity DESC
    LIMIT ${limit};
  `,
  );
}

/**
 * Embed full-text chunks for a GLOBAL book extraction and store them in the cross-org shared
 * `book_text_chunks` table (pgvector). Phase-3 full-text RAG counterpart to embedVideoChunks.
 *
 * - Embeds with `embeddingModel` + RETRIEVAL_DOCUMENT task type, in batches of <=100 so a very
 *   long book never blows the provider's per-request input cap.
 * - The chunk table is CONTEXT_FREE / GLOBAL (no account_id; USING(true)/WITH CHECK(true) RLS for
 *   app_user), so it is written on the PLAIN `db` with NO withTenant — exactly like embedVideoChunks
 *   and the Inngest worker write the rest of the global catalog.
 * - Idempotent: DELETEs any existing chunks for this extraction, then INSERTs the fresh set, so a
 *   re-run (or a retry) replaces rather than duplicates.
 * - Carries each chunk's nullable `section_number` (book_text_chunks has the same shape as
 *   video_extraction_chunks plus that one extra column) so retrieval can filter to a single chapter.
 * - Best-effort / never throws: chunk search is an enhancement, so an embedding failure must not
 *   fail the extraction. We log and swallow.
 */
export async function embedBookTextChunks(
  bookExtractionId: string,
  chunks: { sectionNumber: number | null; content: string }[],
): Promise<void> {
  try {
    const cleaned = chunks
      .map((c) => ({ sectionNumber: c.sectionNumber, content: c.content?.trim() }))
      .filter((c): c is { sectionNumber: number | null; content: string } => !!c.content);

    // Always clear stale chunks first so a re-embed (or an empty input) is idempotent and never
    // leaves a mix of old + new chunks. Global table → plain db, no withTenant.
    await db.$executeRaw`
      DELETE FROM "book_text_chunks" WHERE book_extraction_id = ${bookExtractionId};
    `;

    if (cleaned.length === 0) return;

    // Embed in batches of <=100 (provider input-count cap), preserving global chunk order.
    const BATCH = 100;
    const embeddings: number[][] = [];
    for (let i = 0; i < cleaned.length; i += BATCH) {
      const batch = cleaned.slice(i, i + BATCH).map((c) => c.content);
      const { embeddings: batchEmbeddings } = await embedMany({
        model: embeddingModel,
        values: batch,
        providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
      });
      embeddings.push(...batchEmbeddings);
    }

    // INSERT each chunk via raw SQL so the pgvector `::vector` cast applies (Prisma can't bind the
    // Unsupported("vector") column directly). Mirrors the embedVideoChunks [v.join(",")]::vector
    // idiom, with the extra nullable section_number column. Plain db (global table).
    for (let i = 0; i < cleaned.length; i++) {
      const vectorString = `[${embeddings[i].join(",")}]`;
      await db.$executeRawUnsafe(
        `INSERT INTO "book_text_chunks" (id, book_extraction_id, section_number, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        randomUUID(),
        bookExtractionId,
        cleaned[i].sectionNumber,
        i,
        cleaned[i].content,
        vectorString,
      );
    }
  } catch (e) {
    console.error("[embedBookTextChunks] non-fatal chunk embedding failure", e);
  }
}

/**
 * Retrieve the top full-text chunks for a GLOBAL book extraction by pgvector cosine similarity,
 * optionally scoped to a single chapter/section. Phase-3 full-text RAG counterpart to searchVideos.
 *
 * - Embeds the query with RETRIEVAL_QUERY (asymmetric to the stored RETRIEVAL_DOCUMENT vectors).
 * - The chunk table is GLOBAL / CONTEXT_FREE (USING(true) RLS for app_user), so the cosine search
 *   runs on the PLAIN `db` with NO withTenant — these are public-domain chunks shared across orgs.
 * - The section_number predicate is applied ONLY when a number is passed (so `null`/undefined search
 *   the whole book); built with $executeRawUnsafe-style positional params so the filter is optional.
 * - Best-effort / never throws: returns [] on any embedding or query failure so a retrieval miss
 *   degrades grounded generation gracefully rather than crashing the caller.
 */
export async function retrieveBookChunks(
  bookExtractionId: string,
  query: string,
  opts?: { sectionNumber?: number | null; limit?: number },
): Promise<{ content: string; sectionNumber: number | null; similarity: number }[]> {
  try {
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: query,
      providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
    });
    const vectorQuery = `[${queryEmbedding.join(",")}]`;

    const limit = opts?.limit ?? 6;
    const hasSection = typeof opts?.sectionNumber === "number";

    // Positional params: $1 extraction id, $2 query vector, then optionally $3 section number,
    // with $limit always last. Global table → plain db, no withTenant.
    const params: unknown[] = [bookExtractionId, vectorQuery];
    let sectionClause = "";
    if (hasSection) {
      params.push(opts!.sectionNumber);
      sectionClause = `AND section_number = $${params.length}`;
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const rows = await db.$queryRawUnsafe<
      Array<{ content: string; sectionNumber: number | null; similarity: number }>
    >(
      `SELECT content,
              section_number as "sectionNumber",
              1 - (embedding <=> $2::vector) as similarity
       FROM "book_text_chunks"
       WHERE book_extraction_id = $1
         AND embedding IS NOT NULL
         ${sectionClause}
       ORDER BY similarity DESC
       LIMIT ${limitParam}`,
      ...params,
    );

    return rows;
  } catch (e) {
    console.error("[retrieveBookChunks] non-fatal chunk retrieval failure", e);
    return [];
  }
}

/**
 * Generate and store an embedding for a video (summary + key points).
 *
 * Like generateBookEmbedding, the org-scoped UPDATE runs inside withTenant. Pass `ctx`
 * explicitly when invoked off the request frame (e.g. a background video-extract worker)
 * so the RLS GUCs are stamped from an EXPLICIT context instead of relying on
 * async-context propagation. Omitting `ctx` preserves the previous session-resolved behavior.
 */
export async function generateVideoEmbedding(
  videoId: string,
  text: string,
  ctx?: { organizationId: string | null; userId: string | null },
) {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
  });
  const vectorString = `[${embedding.join(",")}]`;

  await withTenant(
    (tx) =>
      tx.$executeRaw`
    UPDATE "video_resources"
    SET embedding = ${vectorString}::vector
    WHERE id = ${videoId};
  `,
    undefined,
    ctx,
  );

  return embedding;
}
