"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStudentAvatarUrl } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Trash, Scroll } from "@phosphor-icons/react";
import { deleteStudent } from "@/app/actions/student-actions";
import type { StudentCardData } from "@/server/queries/students";
import { toast } from "sonner";
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
import { useState } from "react";

interface StudentCardProps {
    student: StudentCardData;
}

export function StudentCard({ student }: StudentCardProps) {
    const hasProfile = !!student.learnerProfile;
    const profileComplete = hasProfile && !!student.learnerProfile?.personalityData;
    const enrolledCourses = student.courseEnrollments.length;
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteStudent({ id: student.id });
            if (result.success) {
                toast.success("Student deleted successfully");
            } else {
                toast.error(result.error || "Failed to delete student");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="hover:shadow-lg transition-shadow relative group">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-qc-border-subtle">
                            <AvatarImage
                                src={getStudentAvatarUrl(student.preferredName || student.firstName, student.avatarConfig)}
                                alt={student.preferredName || student.firstName}
                                referrerPolicy="no-referrer"
                            />
                            <AvatarFallback>
                                {student.preferredName?.[0] || student.firstName[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="font-display text-xl">
                                {student.preferredName || student.firstName} {student.lastName}
                            </CardTitle>
                            <CardDescription>
                                Grade {student.currentGrade}
                            </CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Profile Completeness */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-body text-sm text-qc-text-muted">Profile Status</span>
                        <span
                            className={`font-body text-sm font-medium ${profileComplete
                                ? "text-qc-success"
                                : hasProfile
                                    ? "text-qc-warning"
                                    : "text-qc-error"
                                }`}
                        >
                            {profileComplete
                                ? "✓ Complete"
                                : hasProfile
                                    ? "⚠ Partial"
                                    : "✗ Not Started"}
                        </span>
                    </div>
                    {enrolledCourses > 0 && (
                        <div className="flex items-center justify-between">
                            <span className="font-body text-sm text-qc-text-muted">Enrolled Courses</span>
                            <span className="font-body text-sm text-qc-charcoal">{enrolledCourses}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link href={`/students/${student.id}`}>Profile</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="flex-1 text-[#563963] border-[#563963]/20 hover:bg-[#563963]/5">
                            <Link href={`/transcripts/${student.id}`}>
                                <Scroll className="mr-2 h-4 w-4" /> Transcript
                            </Link>
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        {!profileComplete && (
                            <Button variant="default" size="sm" asChild className="flex-1">
                                <Link href={`/students/${student.id}/assessment`}>
                                    {hasProfile ? "Complete Setup" : "Start Setup"}
                                </Link>
                            </Button>
                        )}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className={`flex-1 text-qc-text-muted hover:text-red-500 hover:bg-red-50 ${profileComplete ? "w-full" : ""}`}>
                                    <Trash className="mr-2 h-4 w-4" /> Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Student?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the student profile and all associated data.
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
            </CardContent>
        </Card>
    );
}
