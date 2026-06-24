
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"; // Assuming these exist or similar
import { distributeCourse } from "@/server/actions/scheduling";
import { format } from "date-fns";
import { toast } from "sonner"; // Assuming sonner is used

export function CourseDistributor({
    courseId,
    students
}: {
    courseId: string,
    students: {
        studentId: string,
        student: { firstName: string, lastName: string | null } // Updated type match
    }[]
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");
    const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDistribute = async () => {
        if (!selectedStudentId) {
            toast.error("Please select a student.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await distributeCourse(courseId, selectedStudentId, new Date(startDate));
            if (result.success) {
                toast.success(`Successfully scheduled ${result.count} lessons!`);
                setIsOpen(false);
            } else {
                toast.error(result.error || "Failed to schedule lessons.");
            }
        } catch (error: unknown) {
            toast.error("An unexpected network error occurred.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsOpen(true)}
            >
                Distribute Course to Student
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Distribute Course</DialogTitle>
                        <DialogDescription>
                            Automatically schedule all lessons for this course effectively immediately.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Student</label>
                            <select
                                className="w-full p-2 border rounded-md"
                                value={selectedStudentId}
                                onChange={(e) => setSelectedStudentId(e.target.value)}
                            >
                                <option value="">-- Choose Student --</option>
                                {students.map(s => (
                                    <option key={s.studentId} value={s.studentId}>
                                        {s.student.firstName} {s.student.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Date</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-md"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button onClick={handleDistribute} disabled={isSubmitting}>
                            {isSubmitting ? "Scheduling..." : "Distribute Lessons"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
