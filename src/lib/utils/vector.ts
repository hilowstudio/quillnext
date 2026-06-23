import { db, withTenant } from "@/server/db";
import { randomUUID } from "node:crypto";
import { embed, embedMany } from "ai";
import { embeddingModel, embeddingProviderOptions } from "@/lib/ai/config";

// Raw pgvector SQL for ORG-SCOPED tables (books) must run via withTenant so the
// RLS tenant GUCs are set on the query's connection (the per-query Prisma extension only wraps
// model ops, not $queryRaw/$executeRaw).
//
// The GLOBAL/cross-org video_extraction_chunks + video_extractions tables are CONTEXT_FREE_MODELS
// with USING(true)/WITH CHECK(true) RLS for app_user, so their raw SQL runs on the PLAIN `db`
// (no withTenant) — mirroring how the Inngest worker writes the global catalog.

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
    // Unsupported("vector") column directly). Plain db (global table).
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
 * STAGE full-text chunks for a GLOBAL book extraction: persist the chunk bodies into the cross-org
 * shared `book_text_chunks` table WITHOUT embeddings (the `embedding` column stays NULL). Phase-3
 * full-text RAG, split out from embedding so the Inngest worker can embed in small, individually-
 * memoized batches (see embedPendingBookTextChunks) instead of one monolithic step that re-does all
 * the work whenever a long-running invocation is killed/retried.
 *
 * - Fast + bounded: a single batched INSERT path, no AI calls — so even a 2000-chunk book stages
 *   well under any Vercel function ceiling.
 * - The table is CONTEXT_FREE / GLOBAL (no account_id; USING(true)/WITH CHECK(true) RLS for
 *   app_user), so it is written on the PLAIN `db` with NO withTenant — like the rest of the catalog.
 * - Idempotent: DELETEs any existing chunks for this extraction first, so a re-run replaces rather
 *   than duplicates. `chunk_index` is the global 0..n-1 order; `section_number` (nullable) lets
 *   retrieval filter to a single chapter. The Unsupported("vector") `embedding` column is omitted
 *   from createMany (Prisma excludes it from the type) and so defaults to NULL — exactly what the
 *   embed pass drains on.
 * - Best-effort / never throws: returns the number of rows staged (0 on any failure).
 */
export async function stageBookTextChunks(
  bookExtractionId: string,
  chunks: { sectionNumber: number | null; content: string }[],
): Promise<number> {
  try {
    const cleaned = chunks
      .map((c) => ({ sectionNumber: c.sectionNumber, content: c.content?.trim() }))
      .filter((c): c is { sectionNumber: number | null; content: string } => !!c.content);

    // Clear stale chunks first so staging is idempotent (a re-run/retry replaces cleanly).
    await db.$executeRaw`
      DELETE FROM "book_text_chunks" WHERE book_extraction_id = ${bookExtractionId};
    `;

    if (cleaned.length === 0) return 0;

    // Insert content-only rows (embedding left NULL) in sub-batches so a single statement never
    // gets unwieldy. Prisma's generated type omits the Unsupported vector column, so createMany
    // simply doesn't set it → NULL. Global table → plain db, no withTenant.
    const INSERT_BATCH = 500;
    let staged = 0;
    for (let i = 0; i < cleaned.length; i += INSERT_BATCH) {
      const slice = cleaned.slice(i, i + INSERT_BATCH).map((c, j) => ({
        bookExtractionId,
        sectionNumber: c.sectionNumber,
        chunkIndex: i + j,
        content: c.content,
      }));
      const res = await db.bookTextChunk.createMany({ data: slice });
      staged += res.count;
    }
    return staged;
  } catch (e) {
    console.error("[stageBookTextChunks] non-fatal chunk staging failure", e);
    return 0;
  }
}

/**
 * EMBED the next batch of not-yet-embedded chunks for a GLOBAL book extraction (Phase-3 full-text
 * RAG). Pairs with stageBookTextChunks: each call drains up to `limit` rows whose `embedding IS NULL`
 * (in chunk order), embeds them with gemini-embedding-2 (RETRIEVAL_DOCUMENT, batches of <=100 for
 * the provider input-count cap), and writes the vectors back. Returns how many it embedded.
 *
 * The worker calls this once per memoized Inngest step, so a killed/retried invocation re-does at
 * most ONE small batch, and the `embedding IS NULL` predicate means a replay naturally resumes
 * where it left off (already-embedded rows are skipped) — no offset bookkeeping, no re-embedding.
 *
 * GLOBAL/CONTEXT_FREE table → PLAIN db, no withTenant. Returns the number embedded, or 0 ONLY when
 * there are genuinely no pending rows. It THROWS on a real embed/DB failure (it does NOT swallow) so
 * the Inngest step retries — the `embedding IS NULL` drain makes that retry idempotent and
 * non-duplicating. Swallowing here would let the worker stamp the book INGESTED with missing vectors.
 */
export async function embedPendingBookTextChunks(
  bookExtractionId: string,
  limit: number,
): Promise<number> {
  // Pull the next slice of unembedded chunks in stable chunk order. Raw SQL because the
  // Unsupported("vector") column isn't queryable (`embedding IS NULL`) through the Prisma API.
  const pending = await db.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT id, content
    FROM "book_text_chunks"
    WHERE book_extraction_id = ${bookExtractionId}
      AND embedding IS NULL
    ORDER BY chunk_index ASC
    LIMIT ${limit};
  `;
  if (pending.length === 0) return 0;

  // Embed in sub-batches of <=100 (gemini-embedding-2 per-request input cap). Any failure here
  // propagates so the caller's step retries (and resumes via the IS NULL drain) rather than
  // silently leaving these rows un-embedded.
  const BATCH = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH).map((c) => c.content);
    const { embeddings: batchEmbeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
      providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
    });
    embeddings.push(...batchEmbeddings);
  }

  // Write each vector back by id via raw SQL so the pgvector `::vector` cast applies.
  let embedded = 0;
  for (let i = 0; i < pending.length; i++) {
    const vectorString = `[${embeddings[i].join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "book_text_chunks" SET embedding = $1::vector WHERE id = $2`,
      vectorString,
      pending[i].id,
    );
    embedded++;
  }
  return embedded;
}

/**
 * Retrieve the top full-text chunks for a GLOBAL book extraction by pgvector cosine similarity,
 * optionally scoped to a single chapter/section. Phase-3 full-text RAG over the book's chunks.
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

// ============================================================================
// Open-textbook corpus (by-subject grounding). GLOBAL / CONTEXT_FREE tables → PLAIN db (no
// withTenant). Mirrors the book_text_chunks stage/embed/retrieve helpers above.
// ============================================================================

/**
 * STAGE open-textbook section chunks for a TextbookDocument: persist content-only rows (embedding
 * NULL) tagged with subject/category/sectionTitle, so the per-book worker can embed them in small,
 * memoized Inngest batches (see embedPendingTextbookChunks). Idempotent delete-then-insert per
 * document. Returns the number of rows staged, or 0 ONLY when the input is genuinely empty. It THROWS
 * on a real DB failure so the Inngest step retries (and eventually marks the doc UNAVAILABLE) rather
 * than leaving the document stuck in PENDING with no retry.
 */
export async function stageTextbookChunks(
  documentId: string,
  meta: { subject: string | null; category: string | null },
  chunks: { sectionTitle: string | null; content: string }[],
): Promise<number> {
  const cleaned = chunks
    .map((c) => ({ sectionTitle: c.sectionTitle, content: c.content?.trim() }))
    .filter((c): c is { sectionTitle: string | null; content: string } => !!c.content);

  await db.$executeRaw`DELETE FROM "textbook_chunks" WHERE document_id = ${documentId};`;
  if (cleaned.length === 0) return 0;

  const INSERT_BATCH = 500;
  let staged = 0;
  for (let i = 0; i < cleaned.length; i += INSERT_BATCH) {
    const slice = cleaned.slice(i, i + INSERT_BATCH).map((c, j) => ({
      documentId,
      subject: meta.subject,
      category: meta.category,
      sectionTitle: c.sectionTitle,
      chunkIndex: i + j,
      content: c.content,
    }));
    const res = await db.textbookChunk.createMany({ data: slice });
    staged += res.count;
  }
  return staged;
}

/**
 * EMBED the next batch of not-yet-embedded chunks for a TextbookDocument. Drains `embedding IS NULL`
 * in chunk order, embeds with gemini-embedding-2 (RETRIEVAL_DOCUMENT, <=100/call), writes vectors
 * back. Returns count embedded, or 0 ONLY when none pending. THROWS on a real embed/DB failure so the
 * Inngest step retries (the IS NULL drain makes that idempotent) rather than silently leaving gaps.
 */
export async function embedPendingTextbookChunks(documentId: string, limit: number): Promise<number> {
  const pending = await db.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT id, content
    FROM "textbook_chunks"
    WHERE document_id = ${documentId} AND embedding IS NULL
    ORDER BY chunk_index ASC
    LIMIT ${limit};
  `;
  if (pending.length === 0) return 0;

  const BATCH = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH).map((c) => c.content);
    const { embeddings: be } = await embedMany({
      model: embeddingModel,
      values: batch,
      providerOptions: embeddingProviderOptions("RETRIEVAL_DOCUMENT"),
    });
    embeddings.push(...be);
  }

  // The write-back maps embeddings[i] → pending[i] by position, so the counts MUST line up; bail
  // (the step retries) rather than write a vector against the wrong chunk.
  if (embeddings.length !== pending.length) {
    throw new Error(
      `[embedPendingTextbookChunks] embedding/pending count mismatch (${embeddings.length} vs ${pending.length})`,
    );
  }

  let embedded = 0;
  for (let i = 0; i < pending.length; i++) {
    const vectorString = `[${embeddings[i].join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "textbook_chunks" SET embedding = $1::vector WHERE id = $2`,
      vectorString,
      pending[i].id,
    );
    embedded++;
  }
  return embedded;
}

/**
 * Retrieve top open-textbook excerpts for subject-driven grounding (GROUND-don't-echo). Embeds a
 * subject-enriched query and runs a cosine search over the GLOBAL textbook_chunks corpus, soft-
 * filtered to the subject/category when provided (ILIKE, so "Biology"/"Science" both match). Plain
 * db (global). Best-effort / never throws: returns [] on any failure so a miss degrades gracefully.
 */
export async function retrieveTextbookChunks(
  query: string,
  opts?: { subject?: string | null; limit?: number },
): Promise<{ content: string; sectionTitle: string | null; subject: string | null; similarity: number }[]> {
  try {
    const subject = opts?.subject?.trim() || null;
    const limit = opts?.limit ?? 6;

    // Enrich the embedding query with the subject so relevance survives a subject-tag taxonomy gap.
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: [subject, query].filter(Boolean).join(" "),
      providerOptions: embeddingProviderOptions("RETRIEVAL_QUERY"),
    });
    const vectorQuery = `[${queryEmbedding.join(",")}]`;

    const params: unknown[] = [vectorQuery];
    let subjectClause = "";
    if (subject) {
      params.push(`%${subject}%`);
      subjectClause = `AND (subject ILIKE $${params.length} OR category ILIKE $${params.length})`;
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const rows = await db.$queryRawUnsafe<
      Array<{ content: string; sectionTitle: string | null; subject: string | null; similarity: number }>
    >(
      `SELECT content,
              section_title as "sectionTitle",
              subject,
              1 - (embedding <=> $1::vector) as similarity
       FROM "textbook_chunks"
       WHERE embedding IS NOT NULL
         ${subjectClause}
         AND 1 - (embedding <=> $1::vector) > 0.5
       ORDER BY similarity DESC
       LIMIT ${limitParam}`,
      ...params,
    );
    return rows;
  } catch (e) {
    console.error("[retrieveTextbookChunks] non-fatal retrieval failure", e);
    return [];
  }
}
