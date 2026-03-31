"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useZodForm } from "@/hooks/useZodForm";
import { studentSchema, type StudentFormData } from "@/lib/schemas/students";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SupportProfileWizard } from "@/components/students/SupportProfileWizard";

const GRADE_OPTIONS = [
    "Kindergarten",
    "1st Grade",
    "2nd Grade",
    "3rd Grade",
    "4th Grade",
    "5th Grade",
    "6th Grade",
    "7th Grade",
    "8th Grade",
    "9th Grade",
    "10th Grade",
    "11th Grade",
    "12th Grade",
];

export function CreateStudentForm() {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useZodForm(studentSchema, {
        defaultValues: {
            learningDifficulties: [],
            supportLabels: [],
            supportProfile: {},
        },
    }) as unknown as import("react-hook-form").UseFormReturn<StudentFormData>;

    const onSubmit = async (data: StudentFormData) => {
        setServerError(null);
        setIsCreating(true);
        try {
            const response = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    birthdate: data.birthdate.toISOString().split("T")[0],
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Details:", errorData);
                throw new Error(errorData.details || errorData.error || "Failed to create student");
            }

            const { student } = await response.json();
            router.push(`/students/${student.id}`);
        } catch (error) {
            console.error("Failed to create student:", error);
            setServerError(error instanceof Error ? error.message : "Failed to create student. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-display text-xl">Student Information</CardTitle>
                <CardDescription>
                    This student will be available for personalized content generation once added
                </CardDescription>
            </CardHeader>
            <CardContent>
                {serverError && (
                    <div className="mb-6 p-4 bg-qc-error-bg border border-qc-error-border rounded text-qc-error-text text-sm whitespace-pre-wrap">
                        <p className="font-bold">Server Error:</p>
                        <p>{serverError}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input
                                id="firstName"
                                {...register("firstName")}
                                placeholder="John"
                            />
                            {errors.firstName && (
                                <p className="text-sm font-body text-qc-error">
                                    {errors.firstName.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                                id="lastName"
                                {...register("lastName")}
                                placeholder="Smith"
                            />
                        </div>
                    </div>

                    {/* Preferred Name */}
                    <div className="space-y-2">
                        <Label htmlFor="preferredName">Preferred Name (Optional)</Label>
                        <Input
                            id="preferredName"
                            {...register("preferredName")}
                            placeholder="Johnny"
                        />
                        <p className="text-xs font-body text-qc-text-muted">
                            The name this student prefers to be called
                        </p>
                    </div>

                    {/* Birthdate and Grade */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="birthdate">Birthdate *</Label>
                            <Input
                                id="birthdate"
                                type="date"
                                {...register("birthdate", { valueAsDate: true })}
                            />
                            {errors.birthdate && (
                                <p className="text-sm font-body text-qc-error">
                                    {errors.birthdate.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currentGrade">Current Grade *</Label>
                            <select
                                id="currentGrade"
                                {...register("currentGrade")}
                                className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                            >
                                <option value="">Select grade</option>
                                {GRADE_OPTIONS.map((grade) => (
                                    <option key={grade} value={grade}>
                                        {grade}
                                    </option>
                                ))}
                            </select>
                            {errors.currentGrade && (
                                <p className="text-sm font-body text-qc-error">
                                    {errors.currentGrade.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Sex */}
                    <div className="space-y-2">
                        <Label htmlFor="sex">Sex (Optional)</Label>
                        <select
                            id="sex"
                            {...register("sex", {
                                setValueAs: (value) => (value === "" ? undefined : value),
                            })}
                            className="flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                        >
                            <option value="">Select sex</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                        </select>
                    </div>

                    {/* ----------------------------------------------------------------------- */
          /*  NEURODIVERSE SUPPORT PROFILE WIZARD                                  */
          /* ----------------------------------------------------------------------- */}

                    <SupportProfileWizard
                        register={register}
                        setValue={setValue}
                        watch={watch}
                    />

                    {/* ----------------------------------------------------------------------- */}

                    {/* Context Preview */}
                    <div className="p-4 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                        <p className="font-body text-sm font-medium text-qc-primary mb-2">
                            Context Integration
                        </p>
                        <p className="font-body text-xs text-qc-text-muted">
                            Once created, this student will be available in the Master Context System for
                            personalized content generation. Complete the personality assessment to enable
                            AI personalization.
                        </p>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-2 justify-end pt-4 border-t border-qc-border-subtle">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/students">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create Student"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
