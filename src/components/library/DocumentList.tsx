"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner, FileText, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { addDocuments, deleteDocument } from "@/app/actions/resource-library-actions";
import type { LibraryDocument } from "@/components/library/library-types";
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

interface DocumentListProps {
    documents: LibraryDocument[];
    setDocuments: (documents: LibraryDocument[]) => void;
}

export function DocumentList({ documents, setDocuments }: DocumentListProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
        }
    };

    const handleAddDocuments = async () => {
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append("files", file);
        });

        toast.info(`Uploading and extracting text from ${files.length} file(s)...`);
        try {
            const result = await addDocuments(formData);

            if (result.success && result.documents && result.documents.length > 0) {
                setDocuments([...result.documents, ...documents]);
                setOpen(false);
                setFiles(null);
                toast.success(`Successfully added ${result.documents.length} document(s)!`);
            }

            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(err => toast.error(err));
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to add documents");
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
                            <FileText size={20} />
                            Add Documents
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Documents</DialogTitle>
                            <DialogDescription>
                                Upload PDF, Text, or Markdown files. We will extract the text for use in the generator.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="files">Files</Label>
                                <Input
                                    id="files"
                                    type="file"
                                    accept=".pdf,.txt,.md"
                                    multiple
                                    onChange={handleFileChange}
                                    disabled={isProcessing}
                                />
                                {files && files.length > 0 && (
                                    <div className="text-sm text-qc-text-muted mt-2">
                                        Selected {files.length} file(s):
                                        <ul className="list-disc list-inside mt-1">
                                            {Array.from(files).map((f, i) => (
                                                <li key={i} className="truncate">{f.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddDocuments} disabled={!files || isProcessing}>
                                {isProcessing ? <Spinner className="animate-spin mr-2" /> : null}
                                Upload & Extract ({files?.length || 0})
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {documents.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No documents yet. Upload one to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.map((doc) => (
                        <DocumentCard key={doc.id} doc={doc} />
                    ))}
                </div>
            )}
        </div>
    );
}

import { useRouter } from "next/navigation";

// ... (existing imports)

function DocumentCard({ doc }: { doc: LibraryDocument }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteDocument({ id: doc.id });
            if (result.success) {
                toast.success("Document deleted successfully");
                router.refresh();
            } else {
                // ...
                // @ts-expect-error result is {success:true} (action throws on failure); 'error' not on type — defensive UI branch
                toast.error(result.error || "Failed to delete document");
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
                    {doc.fileName}
                </CardTitle>
                <CardDescription>
                    {doc.fileType} • {(doc.fileSize / 1024).toFixed(1)} KB
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" asChild className="w-full flex-1">
                        <Link href={`/creation-station?sourceType=FILE&sourceId=${doc.id}`}>
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
                                <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{doc.fileName}&quot;? This action cannot be undone.
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
