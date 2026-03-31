"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseBlockSchema, type CourseBlockFormData } from "@/lib/schemas/courses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create";
import { getCourseBooks, getBookChapters } from "@/app/actions/curriculum-actions";

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
  strandId: string;
}

interface Subtopic {
  id: string;
  name: string;
  code: string;
  topicId: string;
}

interface CourseBlock {
  id: string;
  kind: string;
  title: string;
  position: number;
  parentBlockId: string | null;
}

export default function NewCourseBlockPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [isCreating, setIsCreating] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [existingBlocks, setExistingBlocks] = useState<CourseBlock[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [books, setBooks] = useState<{ id: string; title: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: string; label: string }[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");

  const searchParams = useSearchParams();
  const initialParentId = searchParams.get("parentId");
  const initialPosition = searchParams.get("position");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CourseBlockFormData>({
    resolver: zodResolver(courseBlockSchema) as any,
    defaultValues: {
      position: initialPosition ? parseInt(initialPosition) : 1,
      parentBlockId: initialParentId || "",
    },
  });

  const blockKind = watch("kind");

  useEffect(() => {
    // Load course and existing blocks
    Promise.all([
      fetch(`/api/courses/${courseId}`)
        .then((r) => r.json())
        .then((data) => setCourse(data.course)),
      fetch(`/api/courses/${courseId}/blocks`)
        .then((r) => r.json())
        .then((data) => setExistingBlocks(data.blocks || [])),
    ]).catch(console.error);
  }, [courseId]);

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
      // Check if custom or actual ID
      if (selectedTopicId.startsWith("new:")) {
        setSubtopics([]);
      } else {
        fetch(`/api/curriculum/subtopics?topicId=${selectedTopicId}`)
          .then((r) => r.json())
          .then((data) => setSubtopics(data.subtopics || []))
          .catch(console.error);
      }
    } else {
      setSubtopics([]);
    }
  }, [selectedTopicId]);

  useEffect(() => {
    // Load books for course
    if (courseId) {
      getCourseBooks(courseId).then(data => setBooks(data.books || []));
    }
  }, [courseId]);

  useEffect(() => {
    // Load chapters for book
    if (selectedBookId) {
      getBookChapters(selectedBookId).then(data => setChapters(data.chapters || []));
    } else {
      setChapters([]);
    }
  }, [selectedBookId]);

  // Auto-calculate position
  useEffect(() => {
    const parentBlockId = watch("parentBlockId");
    if (parentBlockId) {
      // Position should be after last child of parent
      const parentChildren = existingBlocks.filter(
        (b) => b.parentBlockId === parentBlockId,
      );
      const maxPosition = parentChildren.length > 0
        ? Math.max(...parentChildren.map((b) => b.position))
        : 0;
      setValue("position", maxPosition + 1);
    } else {
      // Position should be after last top-level block
      const topLevelBlocks = existingBlocks.filter((b) => !b.parentBlockId);
      const maxPosition = topLevelBlocks.length > 0
        ? Math.max(...topLevelBlocks.map((b) => b.position))
        : 0;
      setValue("position", maxPosition + 1);
    }
  }, [existingBlocks, watch("parentBlockId"), setValue]);

  const onSubmit = async (data: CourseBlockFormData) => {
    setIsCreating(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          parentBlockId: data.parentBlockId || undefined,
          topicId: data.topicId?.startsWith("new:") ? undefined : data.topicId || undefined, // Todo: Handle custom topic creation backend side
          subtopicId: data.subtopicId?.startsWith("new:") ? undefined : data.subtopicId || undefined,
          // @ts-ignore - Schema might not have these yet, but we sent them
          bookId: selectedBookId || undefined,
          bookChapterId: selectedChapterId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create block");
      }

      router.push(`/courses/${courseId}/builder`);
    } catch (error) {
      console.error("Failed to create block:", error);
      alert(error instanceof Error ? error.message : "Failed to create block. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Filter parent blocks based on kind hierarchy
  const getAvailableParentBlocks = () => {
    if (!blockKind) return [];

    // Units can't have parents
    if (blockKind === "UNIT") return [];

    // Modules can be under units
    if (blockKind === "MODULE") {
      return existingBlocks.filter((b) => b.kind === "UNIT");
    }

    // Sections can be under modules or units
    if (blockKind === "SECTION") {
      return existingBlocks.filter((b) => b.kind === "UNIT" || b.kind === "MODULE");
    }

    // Chapters can be under sections, modules, or units
    if (blockKind === "CHAPTER") {
      return existingBlocks.filter(
        (b) => b.kind === "UNIT" || b.kind === "MODULE" || b.kind === "SECTION",
      );
    }

    // Lessons can be under anything
    return existingBlocks;
  };

  const availableParents = getAvailableParentBlocks();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href={`/courses/${courseId}/builder`}>← Back to Course Builder</Link>
        </Button>
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Add Course Block
        </h1>
        <p className="font-body text-qc-text-muted">
          {course && `Add a block to ${course.title}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Block Information</CardTitle>
          <CardDescription>
            This block will use course context: {course?.subject.name}
            {course?.strand && ` > ${course.strand.name}`}
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
                <option value="">Select type</option>
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
                  {availableParents.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.title} ({block.kind})
                    </option>
                  ))}
                </select>
                <p className="text-xs font-body text-qc-text-muted">
                  Organize blocks hierarchically (e.g., Lessons under Modules)
                </p>
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
              <p className="text-xs font-body text-qc-text-muted">
                Position in the sequence (auto-calculated, but can be adjusted)
              </p>
            </div>

            {/* Dynamic Content Fields based on Block Kind */}
            {blockKind && blockKind !== "LESSON" && blockKind !== "CHAPTER" && (
              <div className="space-y-4 p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                <div className="space-y-2">
                  <Label className="font-body text-sm font-medium text-qc-charcoal">Topic</Label>
                  <ComboboxWithCreate
                    options={topics.map(t => ({ label: t.name, value: t.id }))}
                    value={selectedTopicId}
                    onSelect={(val) => {
                      setSelectedTopicId(val);
                      setValue("topicId", val);
                    }}
                    onCreate={(val) => {
                      const tempId = `new:${val}`;
                      setTopics([...topics, { id: tempId, name: val, code: "CUSTOM", strandId: "" }]);
                      setSelectedTopicId(tempId);
                      setValue("topicId", tempId);
                    }}
                    placeholder="Select or create a topic"
                  />
                  <p className="text-xs font-body text-qc-text-muted">
                    Link this {blockKind.toLowerCase()} to a curriculum topic
                  </p>
                </div>
              </div>
            )}

            {blockKind === "CHAPTER" && (
              <div className="space-y-4 p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                <div className="space-y-2">
                  <Label>Select Book</Label>
                  <ComboboxWithCreate
                    options={books.map(b => ({ label: b.title, value: b.id }))}
                    value={selectedBookId}
                    onSelect={setSelectedBookId}
                    placeholder="Select a book..."
                  // No create for books here, usually added via Library
                  // But we could allow it if needed. For now restrict to existing.
                  />
                </div>
                {selectedBookId && (
                  <div className="space-y-2">
                    <Label>Select Chapter</Label>
                    <ComboboxWithCreate
                      options={chapters.map(c => ({ label: c.label, value: c.id }))}
                      value={selectedChapterId}
                      onSelect={setSelectedChapterId}
                      placeholder="Select a chapter..."
                    />
                  </div>
                )}
              </div>
            )}

            {blockKind === "LESSON" && (
              <div className="space-y-4 p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                {/* We need Topic first to filter subtopics? 
                        Usually Lesson belongs to a Section/Module which has a Topic.
                        But here we might want to override or select if not inherited.
                        For simplicity, let's assume we pick parent's implied topic OR select one.
                        Actually, request said "dropdown of available Subtopics for the assigned Topic".
                        Meaning we need a Topic context. 
                        Let's allow picking Topic then Subtopic if no parent context,
                        OR just flatten it if that's too complex. 
                        Let's stick to: Select Topic -> Select Subtopic.
                    */}
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <ComboboxWithCreate
                    options={topics.map(t => ({ label: t.name, value: t.id }))}
                    value={selectedTopicId}
                    onSelect={(val) => {
                      setSelectedTopicId(val);
                      setValue("topicId", val);
                    }}
                    onCreate={(val) => {
                      const tempId = `new:${val}`;
                      setTopics([...topics, { id: tempId, name: val, code: "", strandId: "" }]);
                      setSelectedTopicId(tempId);
                      setValue("topicId", tempId);
                    }}
                    placeholder="Select topic..."
                  />
                </div>
                {selectedTopicId && (
                  <div className="space-y-2">
                    <Label>Subtopic</Label>
                    <ComboboxWithCreate
                      options={subtopics.map(s => ({ label: s.name, value: s.id }))}
                      value={watch("subtopicId") || ""}
                      onSelect={(val) => setValue("subtopicId", val)}
                      onCreate={(val) => {
                        const tempId = `new:${val}`;
                        setSubtopics([...subtopics, { id: tempId, name: val, code: "", topicId: selectedTopicId }]);
                        setValue("subtopicId", tempId);
                      }}
                      placeholder="Select or create subtopic..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Context Preview */}
            <div className="p-4 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
              <p className="font-body text-sm font-medium text-qc-primary mb-2">
                Context Integration
              </p>
              <p className="font-body text-xs text-qc-text-muted">
                This block will automatically use context from: {course?.subject.name}
                {course?.strand && ` > ${course.strand.name}`}, enrolled students, and relevant
                books from your library.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t border-qc-border-subtle">
              <Button type="button" variant="outline" asChild>
                <Link href={`/courses/${courseId}/builder`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Block"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

