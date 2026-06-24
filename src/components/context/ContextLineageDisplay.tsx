"use client";

import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface ContextLineageDisplayProps {
  student?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    preferredName?: string | null;
  } | null;
  objective?: {
    id: string;
    text: string;
    code: string;
    subtopic: {
      topic: {
        strand: {
          subject: { name: string };
          name: string;
        };
      };
    };
  } | null;
  book?: {
    id: string;
    title: string;
  } | null;
  video?: {
    id: string;
    title: string | null;
  } | null;
  course?: {
    id: string;
    title: string;
    subject: { name: string };
    strand?: { name: string } | null;
  } | null;
  generationContext?: string | null;
  showFullContext?: boolean;
}

export function ContextLineageDisplay({
  student,
  objective,
  book,
  video,
  course,
  generationContext,
  showFullContext = false,
}: ContextLineageDisplayProps) {
  const parts: string[] = [];

  if (student) {
    parts.push(
      `Personalized for ${student.preferredName || student.firstName} ${student.lastName || ""}`.trim(),
    );
  }

  if (objective) {
    parts.push(
      `Aligned to ${objective.subtopic.topic.strand.subject.name} > ${objective.subtopic.topic.strand.name}`,
    );
  }

  if (book) {
    parts.push(`Using ${book.title}`);
  }

  if (video) {
    parts.push(`Using ${video.title || "Video"}`);
  }

  if (course) {
    parts.push(`For ${course.title}`);
  }

  if (generationContext) {
    parts.push("With full Master Context");
  }

  if (parts.length === 0) {
    return (
      <div className="p-3 bg-qc-warm-stone rounded-qc-md border border-qc-border-subtle">
        <p className="font-body text-xs text-qc-text-muted">
          Generated using Family Blueprint only
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {student && (
          <Badge variant="default" className="font-body text-xs">
            <Link href={`/students/${student.id}`} className="hover:underline">
              For: {student.preferredName || student.firstName}
            </Link>
          </Badge>
        )}
        {objective && (
          <Badge variant="secondary" className="font-body text-xs">
            Aligned: {objective.subtopic.topic.strand.subject.name} &gt;{" "}
            {objective.subtopic.topic.strand.name}
          </Badge>
        )}
        {book && (
          <Badge variant="outline" className="font-body text-xs">
            <Link href={`/living-library/${book.id}`} className="hover:underline">
              Book: {book.title}
            </Link>
          </Badge>
        )}
        {video && (
          <Badge variant="outline" className="font-body text-xs">
            Video: {video.title || "Video"}
          </Badge>
        )}
        {course && (
          <Badge variant="outline" className="font-body text-xs">
            <Link href={`/courses/${course.id}`} className="hover:underline">
              Course: {course.title}
            </Link>
          </Badge>
        )}
        {generationContext && (
          <Badge variant="outline" className="font-body text-xs">
            Full Context Used
          </Badge>
        )}
      </div>

      {showFullContext && generationContext && (
        <details className="mt-3">
          <summary className="font-body text-xs font-medium text-qc-text-muted cursor-pointer hover:text-qc-charcoal">
            View Full Generation Context
          </summary>
          <div className="mt-2 p-3 bg-qc-warm-stone rounded-qc-md border border-qc-border-subtle max-h-64 overflow-y-auto">
            <pre className="font-mono text-xs text-qc-charcoal whitespace-pre-wrap">
              {generationContext}
            </pre>
          </div>
        </details>
      )}

      <p className="font-body text-xs text-qc-text-muted">
        Generated with: {parts.join(" • ")}
      </p>
    </div>
  );
}

