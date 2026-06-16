"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAssessmentAttempt } from "@/app/actions/assessment-actions";
import { Button } from "@/components/ui/button";

interface Option {
    id: string;
    label: string;
}

export function NewAttemptForm({ assessments, students }: { assessments: Option[]; students: Option[] }) {
    const router = useRouter();
    const [assessmentId, setAssessmentId] = useState("");
    const [studentId, setStudentId] = useState("");
    const [pending, startTransition] = useTransition();

    if (assessments.length === 0 || students.length === 0) {
        return (
            <p className="font-body text-sm text-qc-text-muted">
                {assessments.length === 0
                    ? "No assessments yet — create one from a course's Assessments page first."
                    : "No students yet — add a student first."}
            </p>
        );
    }

    const onCreate = () => {
        if (!assessmentId || !studentId) {
            toast.error("Pick an assessment and a student.");
            return;
        }
        startTransition(async () => {
            try {
                const res = await createAssessmentAttempt(assessmentId, studentId);
                if (res.success) {
                    toast.success("Attempt created.");
                    router.push(`/grading/${res.attemptId}`);
                }
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to create attempt.");
            }
        });
    };

    const selectCls =
        "h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary";

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
                <label className="mb-1 block font-body text-xs text-qc-text-muted">Assessment</label>
                <select className={selectCls} value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
                    <option value="">Select…</option>
                    {assessments.map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                </select>
            </div>
            <div className="flex-1">
                <label className="mb-1 block font-body text-xs text-qc-text-muted">Student</label>
                <select className={selectCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">Select…</option>
                    {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                </select>
            </div>
            <Button onClick={onCreate} disabled={pending}>
                {pending ? "Creating…" : "Create & grade"}
            </Button>
        </div>
    );
}
