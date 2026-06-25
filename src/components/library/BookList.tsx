"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { LibraryBook } from "@/components/library/library-types";
import { Trash } from "@phosphor-icons/react";
import { deleteBook } from "@/app/actions/resource-library-actions";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface BookListProps {
    books: LibraryBook[];
    refreshBooks: () => void;
    organizationId: string;
}

export function BookList({ books, refreshBooks: _refreshBooks, organizationId: _organizationId }: BookListProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button asChild>
                    <Link href="/living-library/scan">Add Book</Link>
                </Button>
            </div>

            {books.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No books yet. Add your first book to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {books.map((book) => (
                        <BookCard key={book.id} book={book} />
                    ))}
                </div>
            )}
        </div>
    );
}

import { useRouter } from "next/navigation";

// ... (existing imports)

function BookCard({ book }: { book: LibraryBook }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteBook({ id: book.id });
            if (result.success) {
                toast.success("Book deleted successfully");
                router.refresh();
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="hover:shadow-lg transition-shadow relative group">
            <CardHeader>
                <CardTitle className="font-display text-lg line-clamp-2">
                    {book.title}
                </CardTitle>
                <CardDescription>
                    {book.authors && Array.isArray(book.authors)
                        ? book.authors.join(", ")
                        : (book.authors as string) || "Unknown Author"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {book.subject && (
                    <div>
                        <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                            Subject
                        </p>
                        <p className="font-body text-sm text-qc-charcoal">
                            {book.subject.name}
                        </p>
                    </div>
                )}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span
                            className={`font-body text-xs px-2 py-1 rounded ${book.extractionStatus === "EXTRACTED"
                                ? "bg-qc-success/10 text-qc-success"
                                : book.extractionStatus === "EXTRACTING"
                                    ? "bg-qc-warning/10 text-qc-warning"
                                    : "bg-qc-text-muted/10 text-qc-text-muted"
                                }`}
                        >
                            {book.extractionStatus || "NOT_EXTRACTED"}
                        </span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link href={`/living-library/${book.id}`}>View</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link href={`/creation-station?sourceType=BOOK&sourceId=${book.id}`}>Use</Link>
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-qc-text-muted hover:text-red-500">
                                    <Trash size={18} />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Book?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete &quot;{book.title}&quot;? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                                        {isDeleting ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
