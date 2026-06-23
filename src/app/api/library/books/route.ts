export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { db, withTenant } from "@/server/db";
import { revalidateTag } from "next/cache";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mutating the org catalog is a parent-only action (defense-in-depth: the proxy does NOT
  // gate /api routes, so a STUDENT-profile session on the shared family login could POST here).
  try {
    await assertParentProfile();
  } catch {
    return NextResponse.json({ error: "This action requires a parent profile." }, { status: 403 });
  }

  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "User has no organization" }, { status: 400 });
  }

  const data = await request.json();

  if (!data.subjectId) {
    return NextResponse.json({ error: "Subject ID required" }, { status: 400 });
  }

  // Verify subject exists
  const subject = await db.subject.findUnique({
    where: { id: data.subjectId },
  });

  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 400 });
  }

  // Verify strand if provided
  if (data.strandId) {
    const strand = await db.strand.findUnique({
      where: { id: data.strandId },
    });

    if (!strand || strand.subjectId !== data.subjectId) {
      return NextResponse.json(
        { error: "Strand not found or doesn't belong to subject" },
        { status: 400 },
      );
    }
  }

  // org-scoped INSERT: stamp the RLS tenant GUCs from the EXPLICIT org (resolved above via
  // getCurrentUserOrg) so creation does not depend on async-context propagation into Prisma.
  const book = await withTenant(
    (tx) =>
      tx.book.create({
        data: {
          organizationId,
          addedByUserId: userId,
          title: data.title,
          authors: data.authors || [],
          publisher: data.publisher,
          publishedDate: data.publishedDate,
          description: data.description,
          pageCount: data.pageCount,
          coverUrl: data.coverUrl,
          isbn: data.isbn,
          externalSource: data.externalSource || "MANUAL",
          externalId: data.externalId,
          subjectId: data.subjectId,
          strandId: data.strandId || null,
          extractionStatus: "NOT_EXTRACTED",
        },
        include: {
          subject: true,
          strand: true,
        },
      }),
    undefined,
    { organizationId, userId },
  );

  // Bust the cached /living-library catalog so the new book shows immediately
  // (matches addArticle/addDocuments and the extract routes — the create route
  // previously omitted this, leaving the catalog stale up to the 1h TTL).
  revalidateTag(`library-${organizationId}`, {});

  // Generate embedding for semantic search. Best-effort: a failure must not fail
  // book creation, but it's logged loudly + traceably (with the book id) because a
  // NULL-embedding book is silently invisible to semantic search until re-embedded.
  let embedded = false;
  if (data.description || data.title) {
    try {
      const { generateBookEmbedding } = await import("@/lib/utils/vector");
      const embeddingText = `${data.title} ${data.description || ""} ${(data.authors || []).join(" ")}`;
      // Thread the explicit tenant so the embedding UPDATE's withTenant stamps the right GUCs
      // (this runs in its own transaction — NOT nested inside the create above).
      await generateBookEmbedding(book.id, embeddingText, { organizationId, userId });
      embedded = true;
    } catch (error) {
      console.error(
        `[book-embedding] FAILED for book ${book.id} ("${data.title}") — it will be missing from semantic search until re-embedded:`,
        error,
      );
    }
  }

  // Ingest to Hi-Low Studio content engine (if configured)
  const hilowUrl = process.env.HILOW_INGEST_URL;
  const hilowKey = process.env.HILOW_INGEST_KEY;
  if (hilowUrl && hilowKey) {
    try {
      const authors = (data.authors || []) as string[];
      const summary = (data.description || "") as string;
      const res = await fetch(hilowUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hilowKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "book",
          raw_insight: `Book: "${data.title}"${authors.length ? ` by ${authors.join(", ")}` : ""}. ${summary.slice(0, 500)}`,
          source_metadata: {
            source_system: "quill_and_compass",
            external_id: `book:${book.id}`,
            title: data.title,
            authors,
            summary,
            page_count: data.pageCount,
            subjects: subject?.name ? [subject.name] : [],
          },
        }),
      });
      if (res.ok) {
        console.log(`✅ Book ingested to Hi-Low (${res.status === 201 ? "created" : "exists"})`);
      } else {
        console.error("Hi-Low ingest failed:", res.status, await res.text());
      }
    } catch (error) {
      console.error("Error ingesting to Hi-Low:", error);
    }
  }

  return NextResponse.json({ book, embedded });
}
