
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DynamicCreateStudentForm } from "@/components/students/DynamicCreateStudentForm";

export const metadata = {
  title: "New Student | QuillNext",
};


export default function NewStudentPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* ... Header ... */}
      <div className="mb-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/students">← Back to Students</Link>
        </Button>
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Add New Student
        </h1>
        <p className="font-body text-qc-text-muted qc-prose">
          Add a student to enable personalized content generation
        </p>
      </div>

      <DynamicCreateStudentForm />
    </div>
  );
}
