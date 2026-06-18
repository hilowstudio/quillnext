"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { enrollSelfInCourse } from "@/app/actions/my-learning";
import type { MyLearning } from "@/server/profiles/my-learning";

export function MyLearningCard({ myLearning }: { myLearning: MyLearning }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function enroll(courseId: string) {
    startTransition(async () => {
      const res = await enrollSelfInCourse(courseId);
      if (res.ok) {
        toast.success("Enrolled — happy learning!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="mb-8 bg-gradient-to-br from-white to-qc-parchment">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap size={22} className="text-qc-primary" />
            <div>
              <CardTitle className="font-display text-xl">My Learning</CardTitle>
              <CardDescription>Courses you&apos;re taking yourself</CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="bg-white"
            onClick={() => setOpen(true)}
            disabled={myLearning.availableCourses.length === 0}
          >
            Enroll in a course
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {myLearning.enrollments.length === 0 ? (
          <p className="font-body text-sm text-qc-text-muted py-2">
            You haven&apos;t enrolled yourself in any courses yet.
            {myLearning.availableCourses.length === 0 && " Create a course first to enroll."}
          </p>
        ) : (
          <ul className="space-y-2">
            {myLearning.enrollments.map((e) => (
              <li
                key={e.courseId}
                className="p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle flex items-center justify-between"
              >
                <div>
                  <p className="font-body text-sm font-medium text-qc-charcoal">{e.title}</p>
                  {e.subjectName && <p className="text-xs text-qc-text-muted">{e.subjectName}</p>}
                </div>
                <span className="text-xs font-medium text-qc-text-muted">{e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll yourself in a course</DialogTitle>
            <DialogDescription>Pick a course to add to your own learning.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {myLearning.availableCourses.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full justify-start bg-white"
                onClick={() => enroll(c.id)}
                disabled={pending}
              >
                <span className="truncate">
                  {c.title}
                  {c.subjectName && <span className="text-qc-text-muted"> · {c.subjectName}</span>}
                </span>
              </Button>
            ))}
            {myLearning.availableCourses.length === 0 && (
              <p className="text-sm text-qc-text-muted">No courses available to enroll in.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
