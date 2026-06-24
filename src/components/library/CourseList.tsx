"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Trash } from "@phosphor-icons/react";
import { deleteCourse } from "@/app/actions/course-actions";
import type { LibraryCourse } from "@/components/library/library-types";
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

interface CourseListProps {
    courses: LibraryCourse[];
}

export function CourseList({ courses }: CourseListProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button asChild>
                    <Link href="/courses/new">Create Course</Link>
                </Button>
            </div>

            {courses.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No courses yet. Create one to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                        <CourseCard key={course.id} course={course} />
                    ))}
                </div>
            )}
        </div>
    );
}

import { useRouter } from "next/navigation";

// ... (existing imports)

function CourseCard({ course }: { course: LibraryCourse }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteCourse({ id: course.id });
            if (result.success) {
                toast.success("Course deleted successfully");
                router.refresh();
            }
            // No else needed, deleteCourse throws on error now
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="hover:shadow-lg transition-shadow relative group">
            <CardHeader>
                <CardTitle className="font-display text-lg line-clamp-2">
                    {course.title}
                </CardTitle>
                <CardDescription>
                    Created Course
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/courses/${course.id}`}>View</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/creation-station?sourceType=COURSE&sourceId=${course.id}`}>Use</Link>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-qc-text-muted hover:text-red-500">
                                <Trash size={18} />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Course?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{course.title}&quot;? This action cannot be undone.
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
            </CardContent>
        </Card>
    );
}
