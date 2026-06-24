
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ContextLineageDisplay } from "@/components/context/ContextLineageDisplay";
import { Trash, Sparkle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { deleteGeneratedResource } from "@/app/actions/resource-library-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

interface GeneratedResourceCardProps {
    resource: any; // Type as needed, mimicking resources/page.tsx
}

export function GeneratedResourceCard({ resource }: GeneratedResourceCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteGeneratedResource({ id: resource.id });
            if (result.success) {
                toast.success("Resource deleted successfully");
                router.refresh();
            } else {
                // @ts-expect-error result is {success:true} (action throws on failure); 'error' not on type — defensive UI branch
                toast.error(result.error || "Failed to delete resource");
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
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="font-display text-xl">
                                {resource.title}
                            </CardTitle>
                            <Badge variant="ai" className="text-[10px] gap-1 shrink-0">
                                <Sparkle size={10} weight="fill" />
                                AI-Generated
                            </Badge>
                        </div>
                        <CardDescription>
                            {resource.resourceKind.label} • Created{" "}
                            {format(new Date(resource.createdAt), "PPP")}
                        </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/living-library/resource/${resource.id}`}>View</Link>
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-qc-text-muted hover:text-red-500">
                                    <Trash size={18} />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete &quot;{resource.title}&quot;? This action cannot be undone.
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
            </CardHeader>
            <CardContent>
                {resource.description && (
                    <p className="font-body text-sm text-qc-charcoal mb-4">
                        {resource.description}
                    </p>
                )}

                {/* Context Lineage */}
                <div className="pt-4 border-t border-qc-border-subtle">
                    <p className="font-body text-xs font-medium text-qc-text-muted mb-3">
                        Generation Context:
                    </p>
                    <ContextLineageDisplay
                        student={resource.student}
                        book={resource.book}
                        video={resource.video}
                        generationContext={
                            resource.generationContext
                                ? JSON.stringify(resource.generationContext, null, 2)
                                : null
                        }
                        showFullContext={true}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
