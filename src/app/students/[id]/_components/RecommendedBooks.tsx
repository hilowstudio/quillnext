import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BookWithRelations } from "@/server/queries/students";

interface RecommendedBooksProps {
    studentId: string;
    books: BookWithRelations[];
}

export function RecommendedBooks({ studentId, books }: RecommendedBooksProps) {
    if (books.length === 0) {
        return null;
    }

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="font-display text-xl">Recommended Books</CardTitle>
                <CardDescription>
                    Books from your library relevant to this student&apos;s courses
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {books.map((book) => (
                        <div
                            key={book.id}
                            className="p-4 bg-qc-warm-stone rounded-qc-md border border-qc-border-subtle hover:border-qc-primary/50 transition-colors"
                        >
                            <p className="font-body font-medium text-qc-charcoal mb-1">{book.title}</p>
                            {book.authors && (
                                <p className="font-body text-xs text-qc-text-muted mb-2">
                                    by {(book.authors as string[])?.join(", ") || (book.authors as string)}
                                </p>
                            )}
                            <p className="font-body text-xs text-qc-text-muted mb-3">
                                {book.subject.name}
                                {book.strand && ` > ${book.strand.name}`}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" asChild className="flex-1">
                                    <Link href={`/living-library/${book.id}`}>View</Link>
                                </Button>
                                <Button variant="outline" size="sm" asChild className="flex-1">
                                    <Link href={`/creation-station?studentId=${studentId}&bookId=${book.id}`}>
                                        Use
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
