"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create";
import { getSubtopicObjectives } from "@/app/actions/curriculum-actions";

// Schema for Activity
const activitySchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    activityType: z.enum(["READING", "WRITING", "DISCUSSION", "PROJECT", "LAB", "WORKSHEET", "OTHER"]),
    objectiveId: z.string().optional(),
    estimatedMinutes: z.coerce.number().int().positive().optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

export default function NewActivityPage() {
    const router = useRouter();
    const params = useParams();
    const courseId = params.id as string;
    const blockId = params.blockId as string;
    const [isCreating, setIsCreating] = useState(false);

    // State for objectives
    const [objectives, setObjectives] = useState<{ id: string; text: string; code?: string }[]>([]);
    const [blockSubtopicId, setBlockSubtopicId] = useState<string | null>(null);
    const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>("");

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
    } = useForm<ActivityFormData>({
        resolver: zodResolver(activitySchema) as any,
        defaultValues: {
            activityType: "OTHER",
        },
    });

    useEffect(() => {
        // 1. Fetch Block to get subtopicId
        // 2. Fetch Objectives if subtopicId exists
        async function loadContext() {
            try {
                const blockRes = await fetch(`/api/courses/${courseId}/blocks/${blockId}`);
                const blockData = await blockRes.json();

                if (blockData.block?.subtopicId) {
                    setBlockSubtopicId(blockData.block.subtopicId);
                    // Check if it's a custom UUID (assuming standard UUID format for real ones)
                    // or just fetch and see
                    if (!blockData.block.subtopicId.startsWith("new:")) {
                        const objs = await getSubtopicObjectives(blockData.block.subtopicId);
                        setObjectives(objs.objectives);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }
        loadContext();
    }, [courseId, blockId]);

    const onSubmit = async (data: ActivityFormData) => {
        setIsCreating(true);
        try {
            // POST to the activities collection route for this lesson block.
            const response = await fetch(`/api/courses/${courseId}/blocks/${blockId}/activities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    objectiveId: selectedObjectiveId.startsWith("new:") ? undefined : selectedObjectiveId || undefined,
                    // If custom objective handling is needed on backend, pass it differently or handle null
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to create activity");
            }

            router.push(`/courses/${courseId}/blocks/${blockId}`);
        } catch (error) {
            console.error("Failed to create activity:", error);
            alert("Failed to create activity. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8">
            <div className="mb-8">
                <Button variant="outline" asChild className="mb-4">
                    <Link href={`/courses/${courseId}/blocks/${blockId}`}>← Back to Lesson</Link>
                </Button>
                <h1 className="font-display text-3xl font-bold text-qc-charcoal mb-2 text-balance">
                    Add Activity
                </h1>
                <p className="font-body text-qc-text-muted">
                    Add a learning activity to this lesson
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Activity Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title *</Label>
                            <Input id="title" {...register("title")} placeholder="e.g. Read Chapter 5" />
                            {errors.title && <p className="text-sm text-qc-error">{errors.title.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <select
                                id="type"
                                {...register("activityType")}
                                className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                            >
                                <option value="READING">Reading</option>
                                <option value="WRITING">Writing</option>
                                <option value="DISCUSSION">Discussion</option>
                                <option value="PROJECT">Project</option>
                                <option value="LAB">Lab</option>
                                <option value="WORKSHEET">Worksheet</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Learning Objective</Label>
                            <ComboboxWithCreate
                                options={objectives.map(o => ({ label: `${o.code ? o.code + ' ' : ''}${o.text}`, value: o.id }))}
                                value={selectedObjectiveId}
                                onSelect={setSelectedObjectiveId}
                                onCreate={(val) => {
                                    const tempId = `new:${val}`;
                                    setObjectives([...objectives, { id: tempId, text: val, code: "CUSTOM" }]);
                                    setSelectedObjectiveId(tempId);
                                }}
                                placeholder={blockSubtopicId ? "Select objective from subtopic..." : "Select or create objective..."}
                                emptyText="No objectives found."
                            />
                            {!blockSubtopicId && (
                                <p className="text-xs text-qc-text-muted">
                                    No subtopic linked to this lesson. You can create custom objectives.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="minutes">Estimated Minutes</Label>
                            <Input
                                id="minutes"
                                type="number"
                                {...register("estimatedMinutes")}
                                placeholder="e.g. 30"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Instructions / Description</Label>
                            <textarea
                                id="description"
                                {...register("description")}
                                className="w-full min-h-[100px] rounded-qc-md border border-qc-border-subtle px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                                placeholder="Instructions for the student..."
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" asChild>
                                <Link href={`/courses/${courseId}/blocks/${blockId}`}>Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? "Adding..." : "Add Activity"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
