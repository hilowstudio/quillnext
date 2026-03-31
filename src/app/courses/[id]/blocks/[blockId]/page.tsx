"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseBlockSchema, type CourseBlockFormData } from "@/lib/schemas/courses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface CourseBlock {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  position: number;
  parentBlockId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  activities: Array<{
    id: string;
    title: string;
    activityType: string;
    position: number;
  }>;
  childBlocks: Array<{
    id: string;
    title: string;
    kind: string;
  }>;
  topic: {
    id: string;
    name: string;
    code: string;
  } | null;
  subtopic: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface Course {
  id: string;
  title: string;
  subject: { id: string; name: string };
  strand: { id: string; name: string } | null;
}

interface Topic {
  id: string;
  name: string;
  code: string;
}

interface Subtopic {
  id: string;
  name: string;
  code: string;
}

interface CourseBlockParent {
  id: string;
  kind: string;
  title: string;
  position: number;
  parentBlockId: string | null;
}

export default function EditCourseBlockPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const blockId = params.blockId as string;
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [block, setBlock] = useState<CourseBlock | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [existingBlocks, setExistingBlocks] = useState<CourseBlockParent[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CourseBlockFormData>({
    resolver: zodResolver(courseBlockSchema.partial()) as any,
  });

  const blockKind = watch("kind") || block?.kind;

  useEffect(() => {
    // Load block, course, and existing blocks
    Promise.all([
      fetch(`/api/courses/${courseId}/blocks/${blockId}`)
        .then((r) => r.json())
        .then((data) => {
          setBlock(data.block);
          if (data.block) {
            setValue("kind", data.block.kind);
            setValue("title", data.block.title);
            setValue("description", data.block.description || "");
            setValue("position", data.block.position);
            setValue("parentBlockId", data.block.parentBlockId || undefined);
            setValue("topicId", data.block.topicId || undefined);
            setValue("subtopicId", data.block.subtopicId || undefined);
            setSelectedTopicId(data.block.topicId || "");
          }
        }),
      fetch(`/api/courses/${courseId}`)
        .then((r) => r.json())
        .then((data) => setCourse(data.course)),
      fetch(`/api/courses/${courseId}/blocks`)
        .then((r) => r.json())
        .then((data) => setExistingBlocks(data.blocks || [])),
    ]).catch(console.error);
  }, [courseId, blockId, setValue]);

  useEffect(() => {
    // Load topics for course's strand
    if (course?.strand?.id) {
      fetch(`/api/curriculum/topics?strandId=${course.strand.id}`)
        .then((r) => r.json())
        .then((data) => setTopics(data.topics || []))
        .catch(console.error);
    }
  }, [course]);

  useEffect(() => {
    // Load subtopics when topic selected
    if (selectedTopicId) {
      fetch(`/api/curriculum/subtopics?topicId=${selectedTopicId}`)
        .then((r) => r.json())
        .then((data) => setSubtopics(data.subtopics || []))
        .catch(console.error);
    } else {
      setSubtopics([]);
    }
  }, [selectedTopicId]);

  const onSubmit = async (data: CourseBlockFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          parentBlockId: data.parentBlockId || undefined,
          topicId: data.topicId || undefined,
          subtopicId: data.subtopicId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update block");
      }

      router.push(`/courses/${courseId}/builder`);
    } catch (error) {
      console.error("Failed to update block:", error);
      alert(error instanceof Error ? error.message : "Failed to update block. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this block? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/blocks/${blockId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.hasChildren) {
          alert("Cannot delete block with child blocks. Delete child blocks first.");
        } else {
          throw new Error(error.error || "Failed to delete block");
        }
      } else {
        router.push(`/courses/${courseId}/builder`);
      }
    } catch (error) {
      console.error("Failed to delete block:", error);
      alert(error instanceof Error ? error.message : "Failed to delete block. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter parent blocks based on kind hierarchy
  const getAvailableParentBlocks = () => {
    if (!blockKind) return [];

    // Units can't have parents
    if (blockKind === "UNIT") return [];

    // Modules can be under units
    if (blockKind === "MODULE") {
      return existingBlocks.filter((b) => b.kind === "UNIT" && b.id !== blockId);
    }

    // Sections can be under modules or units
    if (blockKind === "SECTION") {
      return existingBlocks.filter(
        (b) => (b.kind === "UNIT" || b.kind === "MODULE") && b.id !== blockId,
      );
    }

    // Chapters can be under sections, modules, or units
    if (blockKind === "CHAPTER") {
      return existingBlocks.filter(
        (b) =>
          (b.kind === "UNIT" || b.kind === "MODULE" || b.kind === "SECTION") && b.id !== blockId,
      );
    }

    // Lessons can be under anything
    return existingBlocks.filter((b) => b.id !== blockId);
  };

  const availableParents = getAvailableParentBlocks();

  if (!block) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <p className="font-body text-qc-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href={`/courses/${courseId}/builder`}>← Back to Course Builder</Link>
        </Button>
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Edit Block: {block.title}
        </h1>
        <p className="font-body text-qc-text-muted">
          {course && `Editing block in ${course.title}`}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Block Information</CardTitle>
            <CardDescription>
              Update block details and alignment to Academic Spine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Block Kind */}
              <div className="space-y-2">
                <Label htmlFor="kind">Block Type *</Label>
                <select
                  id="kind"
                  {...register("kind")}
                  className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                >
                  <option value="UNIT">Unit</option>
                  <option value="MODULE">Module</option>
                  <option value="SECTION">Section</option>
                  <option value="CHAPTER">Chapter</option>
                  <option value="LESSON">Lesson</option>
                </select>
                {errors.kind && (
                  <p className="text-sm font-body text-qc-error">{errors.kind.message}</p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="e.g., Introduction to Fractions"
                />
                {errors.title && (
                  <p className="text-sm font-body text-qc-error">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <textarea
                  id="description"
                  {...register("description")}
                  placeholder="Brief description of this block"
                  className="w-full min-h-[100px] rounded-qc-md border border-qc-border-subtle px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                />
              </div>

              {/* Parent Block */}
              {availableParents.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="parentBlockId">Parent Block (Optional)</Label>
                  <select
                    id="parentBlockId"
                    {...register("parentBlockId")}
                    className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                  >
                    <option value="">None (Top Level)</option>
                    {availableParents.map((parentBlock) => (
                      <option key={parentBlock.id} value={parentBlock.id}>
                        {parentBlock.title} ({parentBlock.kind})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Position */}
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <Input
                  id="position"
                  type="number"
                  min="1"
                  {...register("position", { valueAsNumber: true })}
                />
                {errors.position && (
                  <p className="text-sm font-body text-qc-error">{errors.position.message}</p>
                )}
              </div>

              {/* Academic Spine Alignment */}
              {course?.strand && topics.length > 0 && (
                <div className="space-y-4 p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                  <p className="font-body text-sm font-medium text-qc-charcoal">
                    Link to Academic Spine (Optional)
                  </p>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="topicId">Topic (Optional)</Label>
                      <select
                        id="topicId"
                        {...register("topicId")}
                        value={selectedTopicId}
                        onChange={(e) => {
                          setSelectedTopicId(e.target.value);
                          setValue("topicId", e.target.value || undefined);
                          setValue("subtopicId", undefined);
                        }}
                        className="mt-2 flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                      >
                        <option value="">Select a topic</option>
                        {topics.map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.name} ({topic.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTopicId && subtopics.length > 0 && (
                      <div>
                        <Label htmlFor="subtopicId">Subtopic (Optional)</Label>
                        <select
                          id="subtopicId"
                          {...register("subtopicId")}
                          className="mt-2 flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                        >
                          <option value="">Select a subtopic</option>
                          {subtopics.map((subtopic) => (
                            <option key={subtopic.id} value={subtopic.id}>
                              {subtopic.name} ({subtopic.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Context Preview */}
              <div className="p-4 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                <p className="font-body text-sm font-medium text-qc-primary mb-2">
                  Context Integration
                </p>
                <p className="font-body text-xs text-qc-text-muted">
                  This block uses context from: {course?.subject.name}
                  {course?.strand && ` > ${course.strand.name}`}
                  {block.topic && ` > ${block.topic.name}`}
                  {block.subtopic && ` > ${block.subtopic.name}`}
                  , enrolled students, and relevant books from your library.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-between pt-4 border-t border-qc-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-qc-error hover:text-qc-error hover:bg-qc-error/10"
                >
                  {isDeleting ? "Deleting..." : "Delete Block"}
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/courses/${courseId}/builder`}>Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Activities Section (only for LESSON blocks) */}
        {block.kind === "LESSON" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl">Activities</CardTitle>
                  <CardDescription>
                    Activities for this lesson (coming soon)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/courses/${courseId}/blocks/${block.id}/activities/new`}>
                    Add Activity
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {block.activities.length === 0 ? (
                <p className="font-body text-sm text-qc-text-muted text-center py-8">
                  No activities yet. Activity management coming soon.
                </p>
              ) : (
                <div className="space-y-2">
                  {block.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-3 bg-qc-warm-stone rounded-qc-md border border-qc-border-subtle"
                    >
                      <p className="font-body font-medium text-qc-charcoal">
                        {activity.title}
                      </p>
                      <p className="font-body text-xs text-qc-text-muted mt-1">
                        {activity.activityType}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Child Blocks */}
        {block.childBlocks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Child Blocks</CardTitle>
              <CardDescription>Blocks nested under this one</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {block.childBlocks.map((child) => (
                  <div
                    key={child.id}
                    className="p-3 bg-qc-warm-stone rounded-qc-md border border-qc-border-subtle"
                  >
                    <p className="font-body font-medium text-qc-charcoal">{child.title}</p>
                    <p className="font-body text-xs text-qc-text-muted mt-1">{child.kind}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

