export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db, withTenant } from "@/server/db";
import { computeDedupKey } from "@/lib/utils/book-dedup";
import { inngest } from "@/inngest/client";
import type { Prisma } from "@/generated/client";

/**
 * POST /api/library/books/[id]/extract
 *
 * Idempotent trigger + poll for the cross-org, web-grounded book extraction.
 *
 * The heavy AI work happens ONCE per real-world book in the GLOBAL `book_extractions`
 * catalog (deduped on `dedupKey`). This endpoint:
 *   - If the global row is already EXTRACTED, copies its result DOWN onto THIS org's Book
 *     immediately (the cheap, common "second org" path) and returns EXTRACTED.
 *   - If extraction is in flight (EXTRACTING), links this Book and reports EXTRACTING. A
 *     client polls this same endpoint; once the global row flips to EXTRACTED the first
 *     branch copies it down on the next call.
 *   - Otherwise kicks off the background extraction (Inngest) and reports EXTRACTING+started.
 *
 * Every branch is safe to call repeatedly.
 *
 * RLS: the global `BookExtraction` is CONTEXT_FREE — read/write with plain `db` (no withTenant).
 * The org-scoped `Book` is always touched inside `withTenant(..., { organizationId, userId })`,
 * which are NEVER nested (each runs in its own transaction).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "User has no organization" }, { status: 400 });
  }

  // Load the org-scoped Book (RLS already scopes to this org; an explicit org filter is not
  // needed because findUnique-by-id can't cross tenants under RLS). 404 when absent.
  const book = await withTenant(
    (tx) =>
      tx.book.findUnique({
        where: { id },
        select: {
          id: true,
          isbn: true,
          title: true,
          authors: true,
          publisher: true,
          publishedDate: true,
          description: true,
          pageCount: true,
          extractionStatus: true,
          bookExtractionId: true,
          subject: { select: { name: true } },
        },
      }),
    undefined,
    { organizationId, userId },
  );

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const authors = Array.isArray(book.authors) ? (book.authors as string[]) : [];
  const { dedupKey, isbn13, titleAuthorSlug } = computeDedupKey({
    isbn: book.isbn,
    title: book.title,
    authors,
  });

  // Find the GLOBAL extraction row (plain db — BookExtraction is context-free).
  const existing = await db.bookExtraction.findUnique({ where: { dedupKey } });

  // --- Case 1: a completed extraction already exists → copy it DOWN to this org's Book now.
  if (existing && existing.status === "EXTRACTED") {
    await withTenant(
      (tx) =>
        tx.book.update({
          where: { id },
          data: {
            summary: existing.summary,
            tableOfContents: existing.tableOfContents as Prisma.InputJsonValue,
            extractionStatus: "EXTRACTED",
            extractedAt: existing.extractedAt ?? new Date(),
            bookExtractionId: existing.id,
          },
        }),
      undefined,
      { organizationId, userId },
    );

    // Best-effort embedding so the now-summarized book surfaces in semantic search.
    // A failure must not fail the copy-down (the extraction is already persisted).
    try {
      const { generateBookEmbedding } = await import("@/lib/utils/vector");
      const embeddingText = `${book.title} ${existing.summary ?? book.description ?? ""} ${authors.join(" ")}`.trim();
      await generateBookEmbedding(book.id, embeddingText, { organizationId, userId });
    } catch (error) {
      console.error(
        `[book-extract] embedding FAILED for book ${book.id} ("${book.title}") after reuse — it will be missing from semantic search until re-embedded:`,
        error,
      );
    }

    revalidateTag(`library-${organizationId}`, {});
    revalidatePath("/living-library");
    revalidatePath("/library");

    return NextResponse.json({ status: "EXTRACTED", reused: true });
  }

  // --- Case 2: extraction is in flight → link this Book + mark EXTRACTING, then report (poll).
  if (existing && existing.status === "EXTRACTING") {
    await withTenant(
      (tx) =>
        tx.book.update({
          where: { id },
          data: {
            extractionStatus: "EXTRACTING",
            bookExtractionId: existing.id,
          },
        }),
      undefined,
      { organizationId, userId },
    );

    return NextResponse.json({ status: "EXTRACTING" });
  }

  // --- Case 3: no row yet, or a prior NOT_EXTRACTED/FAILED attempt → (re)start extraction.
  // Upsert the GLOBAL row by dedupKey to EXTRACTING (plain db — context-free). The upsert is
  // what makes the "start" path idempotent across orgs: concurrent triggers converge on one row.
  const extraction = await db.bookExtraction.upsert({
    where: { dedupKey },
    create: {
      dedupKey,
      isbn13,
      titleAuthorSlug,
      title: book.title,
      authors,
      status: "EXTRACTING",
    },
    update: {
      status: "EXTRACTING",
      // Keep identity fields fresh in case the prior (failed) attempt had thinner metadata.
      isbn13,
      titleAuthorSlug,
      title: book.title,
      authors,
    },
  });

  // Link this org's Book to the (re)started extraction + mark EXTRACTING.
  await withTenant(
    (tx) =>
      tx.book.update({
        where: { id },
        data: {
          extractionStatus: "EXTRACTING",
          bookExtractionId: extraction.id,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  // Kick off the background worker. Threads org/user so the worker stamps RLS on its writes.
  await inngest.send({
    name: "book/extract.requested",
    data: {
      bookExtractionId: extraction.id,
      triggeringBookId: id,
      organizationId,
      userId,
    },
  });

  return NextResponse.json({ status: "EXTRACTING", started: true });
}
