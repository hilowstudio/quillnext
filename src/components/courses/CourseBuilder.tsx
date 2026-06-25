"use client";

import { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderBlocks, deleteBlock, updateBlock } from "@/app/actions/course-actions";
import {
    attachBookToBlock, attachVideoToBlock, detachResourceFromBlock,
    attachArticleToBlock,
    attachDocumentToBlock,
    attachResourceToBlock,
} from "@/app/actions/course-resource-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DotsSixVertical, Plus, Trash, PencilSimple, Check, X, Sparkle as SparkleIcon, Book as BookIcon, Video as VideoIcon, FileText as FileTextIcon, File as FileIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ResourcePicker } from "./ResourcePicker";
import { GeneratorForm } from "@/components/generators/GeneratorForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ResourceKind, Book, VideoResource as Video, Article, DocumentResource } from "@/generated/client";
import { SpecForm } from "@/app/creation-station/compiler/SpecForm";
import { compileCurriculumAction } from "@/app/actions/compile-curriculum-action";
import { z } from "zod";
import { curriculumSpecSchema } from "@/lib/validation/curriculum-spec";

import { toast } from "sonner";

interface Block {
    id: string;
    title: string;
    kind: string; // UNIT, MODULE, LESSON
    position: number;
    parentBlockId: string | null;
    bookId?: string | null;
    videoId?: string | null;
    articleId?: string | null;
    documentId?: string | null;
    resourceId?: string | null;
    children?: Block[];
    activities: unknown[]; // only .length is read in the UI
    courseId?: string;
}



// Separate component for sortable item to allow clean drag overlay
function SortableBlockItem({
    block,
    depth = 0,
    onDelete,
    onUpdate,
    onAttachResource,
    onDetachResource,
    onGenerate,
    courseId,
}: {
    block: Block;
    depth?: number;
    onDelete: (id: string) => void;
    onUpdate: (id: string, data: { title: string }) => Promise<void>;
    onAttachResource: (blockId: string) => void;
    onDetachResource: (id: string, type: "BOOK" | "VIDEO" | "ARTICLE" | "DOCUMENT" | "RESOURCE") => void;
    onGenerate: (id: string) => void;
    courseId: string;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id, data: { block } });

    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(block.title);
    const [isSaving, setIsSaving] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: `${depth * 24}px`, // Visual indentation
        opacity: isDragging ? 0.5 : 1,
    };

    const getBadges = (kind: string) => {
        switch (kind) {
            case "UNIT": return "bg-qc-primary/10 text-qc-primary border-qc-primary/20";
            case "MODULE": return "bg-qc-secondary/10 text-qc-secondary-dark border-qc-secondary/20";
            case "LESSON": return "bg-qc-parchment text-qc-text-muted border-qc-border-subtle";
            default: return "bg-qc-surface-raised text-qc-text-muted";
        }
    };

    const handleSave = async () => {
        if (!title.trim() || title === block.title) {
            setIsEditing(false);
            setTitle(block.title);
            return;
        }

        setIsSaving(true);
        try {
            await onUpdate(block.id, { title });
            setIsEditing(false);
        } catch {
            toast.error("Failed to update title");
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
            setIsEditing(false);
            setTitle(block.title);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className={cn("mb-2 touch-none")}>
            <div
                className={cn(
                    "flex items-center gap-3 p-3 bg-white rounded-qc-md border border-qc-border-subtle shadow-sm group hover:border-qc-primary/30 transition-colors",
                    isDragging && "shadow-lg ring-2 ring-qc-primary/20 bg-qc-parchment"
                )}
            >
                <div {...attributes} {...listeners} className="cursor-grab hover:text-qc-primary text-qc-border-strong">
                    <DotsSixVertical size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border", getBadges(block.kind))}>
                            {block.kind}
                        </span>

                        {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="h-7 text-sm font-medium"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-qc-success hover:text-qc-success-text hover:bg-qc-success-bg"
                                    onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                    disabled={isSaving}
                                >
                                    <Check size={16} />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-qc-error hover:text-qc-error-text hover:bg-qc-error-bg"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditing(false);
                                        setTitle(block.title);
                                    }}
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        ) : (
                            <span
                                className="font-display font-medium text-qc-charcoal truncate cursor-pointer hover:text-qc-primary hover:underline decoration-dashed underline-offset-4"
                                onClick={() => setIsEditing(true)}
                            >
                                {block.title}
                            </span>
                        )}
                    </div>
                    {!isEditing && (
                        <div className="flex items-center gap-2 text-xs text-qc-text-muted">
                            {block.activities.length > 0 && (
                                <span>{block.activities.length} activities</span>
                            )}

                            {/* Resource Indicators (Badge Style) */}
                            {block.bookId && (
                                <div className="mt-2 flex items-center justify-between rounded-md border border-qc-warning-border bg-qc-warning-bg p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-qc-warning-border/30 p-1">
                                            <BookIcon className="h-4 w-4 text-qc-warning-text" />
                                        </div>
                                        <span className="text-sm font-medium text-qc-warning-text">Book Attached</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDetachResource(block.id, "BOOK")}
                                        className="h-6 w-6 p-0 text-qc-warning hover:text-qc-warning-text hover:bg-qc-warning-border/30"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {block.videoId && (
                                <div className="mt-2 flex items-center justify-between rounded-md border border-qc-error-border bg-qc-error-bg p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-qc-error-border/30 p-1">
                                            <VideoIcon className="h-4 w-4 text-qc-error-text" />
                                        </div>
                                        <span className="text-sm font-medium text-qc-error-text">Video Attached</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDetachResource(block.id, "VIDEO")}
                                        className="h-6 w-6 p-0 text-qc-error hover:text-qc-error-text hover:bg-qc-error-border/30"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {block.articleId && (
                                <div className="mt-2 flex items-center justify-between rounded-md border border-qc-info-border bg-qc-info-bg p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-qc-info-border/30 p-1">
                                            <FileTextIcon className="h-4 w-4 text-qc-info-text" />
                                        </div>
                                        <span className="text-sm font-medium text-qc-info-text">Article Attached</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDetachResource(block.id, "ARTICLE")}
                                        className="h-6 w-6 p-0 text-qc-info-text hover:text-qc-info-text hover:bg-qc-info-border/30"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {block.documentId && (
                                <div className="mt-2 flex items-center justify-between rounded-md border border-qc-border-subtle bg-qc-surface-raised p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-qc-surface-muted p-1">
                                            <FileIcon className="h-4 w-4 text-qc-text-muted" />
                                        </div>
                                        <span className="text-sm font-medium text-qc-charcoal">Document Attached</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDetachResource(block.id, "DOCUMENT")}
                                        className="h-6 w-6 p-0 text-qc-text-muted hover:text-qc-charcoal hover:bg-qc-surface-muted"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Generic Resource Attached State */}
                            {block.resourceId && (
                                <div className="mt-2 flex items-center justify-between rounded-md border border-qc-primary/20 bg-qc-primary/5 p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-qc-primary/10 p-1">
                                            <SparkleIcon className="h-4 w-4 text-qc-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-qc-charcoal">Generated Resource Attached</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDetachResource(block.id, "RESOURCE")}
                                        className="h-6 w-6 p-0 text-qc-text-muted hover:text-qc-destructive"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-3 flex items-center gap-2">
                                {!block.bookId && !block.videoId && !block.articleId && !block.documentId && !block.resourceId && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); onAttachResource(block.id); }}
                                        className="h-8 gap-2 text-xs"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add Resource
                                    </Button>
                                )}

                                {(block.bookId || block.videoId || block.articleId || block.documentId || block.resourceId) && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onGenerate(block.id);
                                        }}
                                        className="h-8 gap-2 text-xs"
                                    >
                                        <SparkleIcon className="h-3 w-3 mr-1" />
                                        Generate
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {!isEditing && (
                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-qc-text-muted hover:text-qc-primary"
                            onClick={() => setIsEditing(true)}
                        >
                            <PencilSimple size={16} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-qc-text-muted hover:text-qc-error"
                            onClick={() => onDelete(block.id)}
                        >
                            <Trash size={16} />
                        </Button>
                    </div>
                )}
            </div>

            {/* Smart Slot - Insert Zone */}
            <div className="h-4 -mt-2 -mb-2 z-10 relative flex justify-center opacity-0 hover:opacity-100 transition-opacity group/slot">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-qc-primary/20 group-hover/slot:bg-qc-primary/50 transition-colors"></div>
                <Button
                    asChild
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6 rounded-full shadow-sm bg-white border border-qc-primary text-qc-primary hover:bg-qc-primary hover:text-white relative z-20"
                    title="Insert block here"
                >
                    <Link href={`/courses/${courseId}/blocks/new?parentId=${block.parentBlockId || ''}&position=${block.position + 1}`}>
                        <Plus size={12} weight="bold" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}

interface CourseBuilderProps {
    courseId: string;
    organizationId: string;
    initialBlocks: Block[];
    availableTools: ResourceKind[];
    initialContext?: {
        subject?: string;
        topic?: string;
        readingLevel?: string;
    };
}

export function CourseBuilder({ courseId, organizationId, initialBlocks, availableTools, initialContext }: CourseBuilderProps) {
    const [blocks, setBlocks] = useState(initialBlocks);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Resource Picker State
    const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
    const [activeBlockForResource, setActiveBlockForResource] = useState<string | null>(null);

    // Generator State
    const [generatorOpen, setGeneratorOpen] = useState(false);
    const [activeBlockForGeneration, setActiveBlockForGeneration] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<ResourceKind | null>(null);

    // Compiler State
    const [compilerOpen, setCompilerOpen] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Helper to maintain strict hierarchy: Unit > Module > Lesson
    // For now, we implemented a flat sortable to verify tech, 
    // but logically we should enforce parent-child updates if we want Drag-to-Nest.
    // For this MVP "Endgame", we will stick to Reorder-Only within same level or flattened list.
    // We will assume "Pre-Order Traversal" flat list.

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (active.id !== over?.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);

                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Optimistic UI updated
                // Background Save
                saveOrder(newOrder);

                return newOrder;
            });
        }
    };

    const saveOrder = async (newBlocks: Block[]) => {
        setIsSaving(true);
        try {
            // Create updates payload
            const updates = newBlocks.map((block, index) => ({
                id: block.id,
                position: index, // Simple index-based position for now
                parentBlockId: block.parentBlockId, // Preserving parent for now (no nesting changes yet)
            }));

            const result = await reorderBlocks(courseId, updates);
            if (!result.success) {
                toast.error("Failed to save order");
            }
        } catch {
            toast.error("Error saving course structure");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (blockId: string) => {
        if (!confirm("Are you sure you want to delete this block?")) return;

        setBlocks(blocks.filter(b => b.id !== blockId));
        const result = await deleteBlock({ id: blockId, courseId });
        if (!result.success) {
            toast.error("Failed to delete block");
            // Revert if needed (fetching from server or using previous state)
        } else {
            toast.success("Block deleted");
        }
    };

    const handleUpdate = async (blockId: string, data: { title: string }) => {
        // Optimistic update
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, ...data } : b));

        const result = await updateBlock({ id: blockId, courseId, ...data });
        if (!result.success) {
            toast.error("Failed to update block");
            // Revert could be here
        } else {
            toast.success("Block updated");
        }
    };

    const handleAttachResourceClick = (blockId: string) => {
        setActiveBlockForResource(blockId);
        setResourcePickerOpen(true);
    };

    const handleDetachResource = async (blockId: string, type: "BOOK" | "VIDEO" | "ARTICLE" | "DOCUMENT" | "RESOURCE") => {
        // Optimistic
        setBlocks(blocks.map(b => {
            if (b.id !== blockId) return b;
            return {
                ...b,
                bookId: type === "BOOK" ? null : b.bookId,
                videoId: type === "VIDEO" ? null : b.videoId,
                articleId: type === "ARTICLE" ? null : b.articleId,
                documentId: type === "DOCUMENT" ? null : b.documentId,
                resourceId: type === "RESOURCE" ? null : b.resourceId,
            };
        }));

        await detachResourceFromBlock({ blockId, resourceType: type, courseId });
        toast.success(`${type === "BOOK" ? "Book" : type === "VIDEO" ? "Video" : type === "ARTICLE" ? "Article" : type === "DOCUMENT" ? "Document" : "Resource"} removed`);
    };

    const handleResourceSelected = async (
        type: "BOOK" | "VIDEO" | "ARTICLE" | "DOCUMENT" | "RESOURCE",
        book?: Book,
        video?: Video,
        article?: Article,
        doc?: DocumentResource,
        resource?: { id: string; title: string, resourceKind: { label: string } }
    ) => {
        if (!activeBlockForResource) return;

        const blockId = activeBlockForResource;

        // Optimistic
        setBlocks(blocks.map(b => {
            if (b.id !== blockId) return b;
            return {
                ...b,
                bookId: type === "BOOK" && book ? book.id : b.bookId,
                videoId: type === "VIDEO" && video ? video.id : b.videoId,
                articleId: type === "ARTICLE" && article ? article.id : b.articleId,
                documentId: type === "DOCUMENT" && doc ? doc.id : b.documentId,
                resourceId: type === "RESOURCE" && resource ? resource.id : b.resourceId,
            };
        }));

        if (type === "BOOK" && book) {
            await attachBookToBlock({ blockId, bookId: book.id, courseId });
        } else if (type === "VIDEO" && video) {
            await attachVideoToBlock({ blockId, videoId: video.id, courseId });
        } else if (type === "ARTICLE" && article) {
            await attachArticleToBlock({ blockId, articleId: article.id, courseId });
        } else if (type === "DOCUMENT" && doc) {
            await attachDocumentToBlock({ blockId, documentId: doc.id, courseId });
        } else if (type === "RESOURCE" && resource) {
            await attachResourceToBlock({ blockId, resourceId: resource.id, courseId });
        }

        toast.success(`${type === "BOOK" ? "Book" : type === "VIDEO" ? "Video" : type === "ARTICLE" ? "Article" : type === "DOCUMENT" ? "Document" : "Resource"} attached`);
    };

    const handleAiSuggest = async () => {
        setIsSaving(true);
        try {
            toast.success("Generating suggestions... this may take a moment");
            const { suggestCourseBlocks } = await import("@/app/actions/suggest-blocks");
            const result = await suggestCourseBlocks(courseId);

            if (result.success && result.blocks) {
                setBlocks([...blocks, ...result.blocks]);
                toast.success(`Added ${result.blocks.length} suggested blocks`);
            }
        } catch (error) {
            toast.error("Failed to generate suggestions");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePickerGenerate = (kindId: string, _kindLabel: string) => {
        if (kindId === "COMPILER") {
            setCompilerOpen(true);
            // Context comes from activeBlockForResource
        } else {
            // Find tool in availableTools
            const tool = availableTools.find(t => t.id === kindId);
            if (tool) {
                setSelectedTool(tool);
                setActiveBlockForGeneration(activeBlockForResource);
                setGeneratorOpen(true);
            }
        }
    };

    const handleCompilerSubmit = async (values: z.infer<typeof curriculumSpecSchema>) => {
        setIsCompiling(true);
        try {
            const result = await compileCurriculumAction({
                ...values,
            });

            if (result.success) {
                toast.success("Curriculum compilation started! It will appear here shortly.");
                setCompilerOpen(false);
            } else {
                toast.error("Failed to start compilation");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsCompiling(false);
        }
    };

    const handleGenerateClick = (blockId: string) => {
        setActiveBlockForGeneration(blockId);
        setSelectedTool(null);
        setGeneratorOpen(true);
    };

    // Find active block for overlay
    const activeBlock = blocks.find(b => b.id === activeId);

    // Find active block for generation to get context
    const generationBlock = blocks.find(b => b.id === activeBlockForGeneration);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-qc-text-muted" aria-live="polite">
                    {blocks.length} items • {isSaving ? "Saving..." : "Saved"}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleAiSuggest}
                        disabled={isSaving}
                        className="gap-2 text-qc-primary border-qc-primary/20 hover:bg-qc-primary/5"
                    >
                        <SparkleIcon size={16} weight="fill" />
                        Inkling Assist
                    </Button>
                    <Button asChild className="gap-2">
                        <Link href={`/courses/${courseId}/blocks/new`}>
                            <Plus size={16} /> Add Block
                        </Link>
                    </Button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={blocks.map(b => b.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-1">
                        {blocks.map((block) => (
                            <SortableBlockItem
                                key={block.id}
                                block={block}
                                depth={block.kind === "LESSON" ? 2 : block.kind === "MODULE" ? 1 : 0}
                                onDelete={handleDelete}
                                onUpdate={handleUpdate}
                                onAttachResource={handleAttachResourceClick}
                                onDetachResource={handleDetachResource}
                                onGenerate={handleGenerateClick}
                                courseId={courseId}
                            />
                        ))}
                    </div>
                </SortableContext>

                <DragOverlay>
                    {activeBlock ? (
                        <div className="flex items-center gap-3 p-3 bg-white rounded-qc-md border border-qc-primary shadow-xl opacity-90 cursor-grabbing">
                            <DotsSixVertical size={20} className="text-qc-primary" />
                            <span className="font-display font-medium text-qc-charcoal">
                                {activeBlock.title}
                            </span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <ResourcePicker
                organizationId={organizationId}
                open={resourcePickerOpen}
                mode="universal"
                onOpenChange={setResourcePickerOpen}
                onGenerate={handlePickerGenerate}
                onSelectBundle={async (bundleId) => {
                    if (!confirm("This will create a new Unit with lessons from this bundle. Continue?")) return;
                    setIsSaving(true);
                    try {
                        const { explodeCurriculumBundle } = await import("@/app/actions/explode-bundle");
                        const result = await explodeCurriculumBundle(bundleId, courseId);
                        if (result.success) {
                            toast.success("Curriculum Unit created!");
                            // Ideally we refresh blocks but we rely on server revalidate?
                            // We might need to refresh local state if we want instant feedback without reload
                            window.location.reload(); // Simple brute force for now to fetch new blocks
                        }
                    } catch (e) {
                        console.error(e);
                        toast.error(e instanceof Error ? e.message : "Failed to add unit");
                    } finally {
                        setIsSaving(false);
                    }
                }}
                onSelectBook={(book) => handleResourceSelected("BOOK", book)}
                onSelectVideo={(video) => handleResourceSelected("VIDEO", undefined, video)}
                onSelectArticle={(article) => handleResourceSelected("ARTICLE", undefined, undefined, article)}
                onSelectDocument={(doc) => handleResourceSelected("DOCUMENT", undefined, undefined, undefined, doc)}
                onSelectResource={(resource) => handleResourceSelected("RESOURCE", undefined, undefined, undefined, undefined, resource)}
            />

            <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
                <DialogContent className="max-w-4xl h-[85vh] overflow-y-auto">
                    {!selectedTool ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Generate Content</DialogTitle>
                                <DialogDescription>Select a tool to generate content for this lesson.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                {availableTools?.map(tool => (
                                    <Card
                                        key={tool.id}
                                        className="p-4 cursor-pointer hover:border-qc-primary hover:bg-qc-primary/5 transition-all flex flex-col gap-2"
                                        onClick={() => setSelectedTool(tool)}
                                    >
                                        <div className="p-2 bg-qc-primary/10 w-fit rounded-lg text-qc-primary mb-1">
                                            <SparkleIcon size={24} weight="fill" />
                                        </div>
                                        <h3 className="font-semibold font-display text-balance">{tool.label}</h3>
                                        <p className="text-sm text-qc-text-muted line-clamp-2">{tool.description}</p>
                                    </Card>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-4">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedTool(null)} className="mb-2">
                                    ← Back to Tools
                                </Button>
                                <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
                                    <SparkleIcon className="text-qc-primary" weight="fill" />
                                    {selectedTool.label}
                                </DialogTitle>
                            </div>

                            {generationBlock && (
                                <GeneratorForm
                                    resourceKindId={selectedTool.id}
                                    resourceKindCode={selectedTool.code}
                                    resourceKindLabel={selectedTool.label}
                                    contentType={selectedTool.contentType}
                                    contextParams={{
                                        organizationId,
                                        courseId,
                                        courseBlockId: generationBlock.id,
                                        bookId: generationBlock.bookId || undefined,
                                        videoId: generationBlock.videoId || undefined,
                                        articleId: generationBlock.articleId || undefined,
                                        documentId: generationBlock.documentId || undefined,
                                        // Pass initial context to generators too if they support it
                                        subject: initialContext?.subject,
                                        readingLevel: initialContext?.readingLevel,
                                    }}
                                />
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={compilerOpen} onOpenChange={setCompilerOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogTitle className="sr-only">Curriculum Compiler</DialogTitle>
                    <SpecForm
                        onSubmit={handleCompilerSubmit}
                        isLoading={isCompiling}
                        initialContext={initialContext}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
