"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GeneratedResourceCard } from "@/components/resources/GeneratedResourceCard";
import { useRouter, useSearchParams } from "next/navigation";

interface ResourceListProps {
    resources: any[];
    students: any[];
    courses: any[];
    books: any[];
}

export function ResourceList({ resources, students, courses, books }: ResourceListProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleFilterChange = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const params = new URLSearchParams(searchParams);

        // Update params
        if (formData.get("studentId")) params.set("studentId", formData.get("studentId") as string);
        else params.delete("studentId");

        if (formData.get("courseId")) params.set("courseId", formData.get("courseId") as string);
        else params.delete("courseId");

        if (formData.get("bookId")) params.set("bookId", formData.get("bookId") as string);
        else params.delete("bookId");

        if (formData.get("toolType")) params.set("toolType", formData.get("toolType") as string);
        else params.delete("toolType");

        // Preserve tab
        params.set("tab", "resources");

        router.push(`/living-library?${params.toString()}`);
    };

    return (
        <div className="space-y-8">
            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-display text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleFilterChange} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="filter-student" className="font-body text-sm font-medium text-qc-text-muted mb-2 block">
                                Student
                            </label>
                            <select
                                id="filter-student"
                                name="studentId"
                                defaultValue={searchParams.get("studentId") || ""}
                                className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm"
                            >
                                <option value="">All Students</option>
                                {students.map((student) => (
                                    <option key={student.id} value={student.id}>
                                        {student.preferredName || student.firstName} {student.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="filter-course" className="font-body text-sm font-medium text-qc-text-muted mb-2 block">
                                Course
                            </label>
                            <select
                                id="filter-course"
                                name="courseId"
                                defaultValue={searchParams.get("courseId") || ""}
                                className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm"
                            >
                                <option value="">All Courses</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="filter-book" className="font-body text-sm font-medium text-qc-text-muted mb-2 block">
                                Book
                            </label>
                            <select
                                id="filter-book"
                                name="bookId"
                                defaultValue={searchParams.get("bookId") || ""}
                                className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm"
                            >
                                <option value="">All Books</option>
                                {books.map((book) => (
                                    <option key={book.id} value={book.id}>
                                        {book.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="filter-tool" className="font-body text-sm font-medium text-qc-text-muted mb-2 block">
                                Tool Type
                            </label>
                            <select
                                id="filter-tool"
                                name="toolType"
                                defaultValue={searchParams.get("toolType") || ""}
                                className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm"
                            >
                                <option value="">All Types</option>
                                <option value="quiz">Quiz</option>
                                <option value="worksheet">Worksheet</option>
                                <option value="lesson-plan">Lesson Plan</option>
                                <option value="rubric">Rubric</option>
                            </select>
                        </div>

                        <div className="md:col-span-4">
                            <Button type="submit">Apply Filters</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Resources List */}
            {resources.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No resources found. Generate some content to get started.
                        </p>
                        <Button asChild>
                            <Link href="/creation-station">Go to Creation Station</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {resources.map((resource) => (
                        <GeneratedResourceCard key={resource.id} resource={resource} />
                    ))}
                </div>
            )}
        </div>
    );
}
