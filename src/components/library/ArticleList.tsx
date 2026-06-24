"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner, Newspaper, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { addArticle, deleteArticle } from "@/app/actions/resource-library-actions";
import type { LibraryArticle } from "@/components/library/library-types";
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

interface ArticleListProps {
    articles: LibraryArticle[];
    setArticles: (articles: LibraryArticle[]) => void;
}

export function ArticleList({ articles, setArticles }: ArticleListProps) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAddArticle = async () => {
        if (!url) return;

        setIsProcessing(true);
        toast.info("Scraping article...");
        try {
            const result = await addArticle(url);
            if (result.success && result.article) {
                setArticles([result.article, ...articles]);
                setOpen(false);
                setUrl("");
                toast.success("Article added successfully!");
            } else {
                toast.error(result.error || "Failed to add article");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to add article");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Newspaper size={20} />
                            Add Article
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Article</DialogTitle>
                            <DialogDescription>
                                Enter the URL of a web article to import. We will extract the content for you.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="url">Article URL</Label>
                                <Input
                                    id="url"
                                    placeholder="https://..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddArticle} disabled={!url || isProcessing}>
                                {isProcessing ? <Spinner className="animate-spin mr-2" /> : null}
                                Import
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {articles.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No articles yet. Import one to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articles.map((article) => (
                        <ArticleCard key={article.id} article={article} />
                    ))}
                </div>
            )}
        </div>
    );
}

import { useRouter } from "next/navigation";

// ... (existing imports)

function ArticleCard({ article }: { article: LibraryArticle }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteArticle(article.id);
            if (result.success) {
                toast.success("Article deleted successfully");
                router.refresh();
            } else {
                // ...
                // @ts-expect-error result is {success:true} (action throws on failure); 'error' not on type — defensive UI branch
                toast.error(result.error || "Failed to delete article");
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
            {article.imageUrl && (
                <div className="h-48 w-full overflow-hidden">
                    <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
                </div>
            )}
            <CardHeader>
                <CardTitle className="font-display text-lg line-clamp-2">
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {article.title}
                    </a>
                </CardTitle>
                <CardDescription className="line-clamp-3">
                    {article.description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" asChild className="w-full flex-1">
                        <Link href={`/creation-station?sourceType=URL&sourceId=${article.id}&url=${encodeURIComponent(article.url)}`}>
                            Use in Generator
                        </Link>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-qc-text-muted hover:text-red-500">
                                <Trash size={18} />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Article?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{article.title}&quot;? This action cannot be undone.
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
            </CardContent>
        </Card>
    );
}
