import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { type Prisma } from "@/generated/client";
import { withTenant } from "@/server/db";
import { findSimilarBooks } from "@/lib/utils/vector";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExtractBookButton } from "@/components/library/ExtractBookButton";
import Link from "next/link";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();

  const book = await withTenant((tx) => tx.book.findUnique({
    where: { id },
    include: {
      subject: true,
      strand: true,
      generatedMaterials: {
        take: 5,
        include: {
          resource: true,
          resourceKind: true,
        },
        orderBy: { createdAt: "desc" },
      },
      bookExtraction: {
        select: {
          status: true,
          summary: true,
          mainThemes: true,
          sources: true,
          readingLevel: true,
          extractedAt: true,
        },
      },
    },
  }), undefined, { organizationId, userId: null }) as Prisma.BookGetPayload<{
    include: {
      subject: true;
      strand: true;
      generatedMaterials: {
        include: {
          resource: true;
          resourceKind: true;
        };
      };
      bookExtraction: {
        select: {
          status: true;
          summary: true;
          mainThemes: true;
          sources: true;
          readingLevel: true;
          extractedAt: true;
        };
      };
    };
  }> | null;

  if (!book || book.organizationId !== organizationId) {
    redirect("/living-library");
  }

  // SELF-HEAL: a Book may have linked to a BookExtraction that another org kicked
  // off while it was still in flight. If that shared extraction has since finished
  // but this Book is still stuck in EXTRACTING, copy the result down once before render.
  let summary = book.summary;
  let extractionStatus = book.extractionStatus;
  let extractedAt = book.extractedAt;
  if (
    book.extractionStatus === "EXTRACTING" &&
    book.bookExtraction?.status === "EXTRACTED"
  ) {
    const healedAt = book.bookExtraction.extractedAt ?? new Date();
    await withTenant(
      (tx) =>
        tx.book.update({
          where: { id: book.id },
          data: {
            summary: book.bookExtraction!.summary,
            extractionStatus: "EXTRACTED",
            extractedAt: healedAt,
          },
        }),
      undefined,
      { organizationId, userId: null },
    );
    summary = book.bookExtraction.summary;
    extractionStatus = "EXTRACTED";
    extractedAt = healedAt;
  }

  // Normalize the JSON `sources` column into a typed list of links for rendering.
  const extractionSources: Array<{ title?: string; url: string }> = Array.isArray(
    book.bookExtraction?.sources,
  )
    ? (book.bookExtraction.sources as unknown[]).filter(
        (s): s is { title?: string; url: string } =>
          typeof s === "object" &&
          s !== null &&
          "url" in s &&
          typeof (s as { url?: unknown }).url === "string",
      )
    : [];

  // Get similar books
  // Similar books feature - gracefully degrade if unavailable rather than breaking page
  const similarBooks = await findSimilarBooks(book.id, organizationId, 5).catch(() => []);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/living-library">← Back to Library</Link>
        </Button>
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          {book.title}
        </h1>
        {book.authors && Array.isArray(book.authors) && (
          <p className="font-body text-lg text-qc-text-muted mb-4">
            by {book.authors.join(", ")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Book Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Book Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {book.coverUrl && (
                <div className="flex justify-center">
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="max-w-xs rounded-qc-md border border-qc-border-subtle"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {book.publisher && (
                  <div>
                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                      Publisher
                    </p>
                    <p className="font-body text-qc-charcoal">{book.publisher}</p>
                  </div>
                )}
                {book.publishedDate && (
                  <div>
                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                      Published
                    </p>
                    <p className="font-body text-qc-charcoal">{book.publishedDate}</p>
                  </div>
                )}
                {book.pageCount && (
                  <div>
                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                      Pages
                    </p>
                    <p className="font-body text-qc-charcoal">{book.pageCount}</p>
                  </div>
                )}
                {book.isbn && (
                  <div>
                    <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                      ISBN
                    </p>
                    <p className="font-body text-qc-charcoal">{book.isbn}</p>
                  </div>
                )}
              </div>

              {book.subject && (
                <div>
                  <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                    Subject
                  </p>
                  <p className="font-body text-qc-charcoal">
                    {book.subject.name}
                    {book.strand && ` > ${book.strand.name}`}
                  </p>
                </div>
              )}

              {book.description && (
                <div>
                  <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                    Description
                  </p>
                  <p className="font-body text-qc-charcoal whitespace-pre-wrap">
                    {book.description}
                  </p>
                </div>
              )}

              {summary && (
                <div>
                  <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                    Inkling-Generated Summary
                  </p>
                  <p className="font-body text-qc-charcoal whitespace-pre-wrap">
                    {summary}
                  </p>
                </div>
              )}

              {/* Shared (cross-org) deep-extraction insights */}
              {book.bookExtraction && (
                <div className="space-y-4 border-t border-qc-border-subtle pt-4">
                  {book.bookExtraction.summary && summary !== book.bookExtraction.summary && (
                    <div>
                      <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                        Deep Extraction Summary
                      </p>
                      <p className="font-body text-qc-charcoal whitespace-pre-wrap">
                        {book.bookExtraction.summary}
                      </p>
                    </div>
                  )}

                  {book.bookExtraction.readingLevel && (
                    <div>
                      <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                        Reading Level
                      </p>
                      <p className="font-body text-qc-charcoal">
                        {book.bookExtraction.readingLevel}
                      </p>
                    </div>
                  )}

                  {book.bookExtraction.mainThemes &&
                    book.bookExtraction.mainThemes.length > 0 && (
                      <div>
                        <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                          Main Themes
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {book.bookExtraction.mainThemes.map((theme) => (
                            <span
                              key={theme}
                              className="font-body text-xs px-2 py-1 rounded bg-qc-parchment border border-qc-border-subtle text-qc-charcoal"
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {extractionSources.length > 0 && (
                    <div>
                      <p className="font-body text-sm font-medium text-qc-text-muted mb-2">
                        Sources
                      </p>
                      <ul className="space-y-1">
                        {extractionSources.map((source, i) => (
                          <li key={`${source.url}-${i}`}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-body text-sm text-qc-primary hover:underline break-words"
                            >
                              {source.title || source.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button asChild className="flex-1">
                  <Link href={`/creation-station?bookId=${book.id}`}>
                    Generate Content From This Book
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/courses/new?bookId=${book.id}`}>
                    Use in Course Builder
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Generated Materials */}
          {book.generatedMaterials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl">Generated Materials</CardTitle>
                <CardDescription>
                  Content generated from this book
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {book.generatedMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle"
                    >
                      <p className="font-body font-medium text-qc-charcoal mb-1">
                        {material.resource.title}
                      </p>
                      <p className="font-body text-xs text-qc-text-muted">
                        {material.resourceKind.label}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Similar Books */}
          {similarBooks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Similar Books</CardTitle>
                <CardDescription>
                  Books with similar content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {similarBooks.map((similar) => (
                    <Link
                      key={similar.id}
                      href={`/living-library/${similar.id}`}
                      className="block p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle hover:border-qc-primary/50 transition-colors"
                    >
                      <p className="font-body font-medium text-qc-charcoal mb-1">
                        {similar.title}
                      </p>
                      {similar.summary && (
                        <p className="font-body text-xs text-qc-text-muted line-clamp-2">
                          {similar.summary}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extraction Status */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Extraction Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-qc-charcoal">Status</span>
                  <span
                    className={`font-body text-xs px-2 py-1 rounded ${extractionStatus === "EXTRACTED"
                      ? "bg-qc-success/10 text-qc-success"
                      : extractionStatus === "EXTRACTING"
                        ? "bg-qc-warning/10 text-qc-warning"
                        : "bg-qc-text-muted/10 text-qc-text-muted"
                      }`}
                  >
                    {extractionStatus || "NOT_EXTRACTED"}
                  </span>
                </div>
                {extractedAt && (
                  <div className="flex items-center justify-between">
                    <span className="font-body text-sm text-qc-charcoal">Extracted</span>
                    <span className="font-body text-xs text-qc-text-muted">
                      {new Date(extractedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="pt-1">
                  <ExtractBookButton
                    bookId={book.id}
                    status={extractionStatus ?? "NOT_EXTRACTED"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

