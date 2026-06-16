import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewAttemptForm } from "@/components/grading/NewAttemptForm";

export const dynamic = "force-dynamic";

export default async function GradingIndexPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) redirect("/onboarding");

    const [attempts, assessments, students] = await Promise.all([
        db.assessmentAttempt.findMany({
            where: { assessment: { course: { organizationId } } },
            select: {
                id: true,
                status: true,
                scorePoints: true,
                maxPoints: true,
                assessment: { select: { title: true, course: { select: { title: true } } } },
                student: { select: { firstName: true, lastName: true, preferredName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        }),
        db.assessment.findMany({
            where: { course: { organizationId } },
            select: { id: true, title: true, course: { select: { title: true } } },
            orderBy: { createdAt: "desc" },
        }),
        db.student.findMany({
            where: { organizationId },
            select: { id: true, firstName: true, lastName: true, preferredName: true },
            orderBy: { firstName: "asc" },
        }),
    ]);

    const assessmentOpts = assessments.map((a) => ({ id: a.id, label: `${a.title} — ${a.course.title}` }));
    const studentOpts = students.map((s) => ({
        id: s.id,
        label: `${s.preferredName || s.firstName} ${s.lastName || ""}`.trim(),
    }));

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">Grading</h1>
            <p className="font-body text-qc-text-muted mb-8">Record a submission to grade, or pick up an existing one.</p>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="font-display text-xl">Record a submission</CardTitle>
                    <CardDescription>Creates a gradeable attempt for a student on an assessment.</CardDescription>
                </CardHeader>
                <CardContent>
                    <NewAttemptForm assessments={assessmentOpts} students={studentOpts} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-display text-xl">Attempts</CardTitle>
                    <CardDescription>
                        {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {attempts.length === 0 ? (
                        <p className="font-body text-sm text-qc-text-muted text-center py-8">
                            No attempts yet. Record a submission above to start grading.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {attempts.map((a) => {
                                const name = `${a.student.preferredName || a.student.firstName} ${a.student.lastName || ""}`.trim();
                                const graded = a.status === "GRADED" && a.scorePoints != null;
                                return (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between p-3 bg-qc-parchment rounded-qc-md border border-qc-border-subtle"
                                    >
                                        <div>
                                            <p className="font-body font-medium text-qc-charcoal">{a.assessment.title}</p>
                                            <p className="font-body text-xs text-qc-text-muted">
                                                {name} · {a.assessment.course.title}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-body text-xs text-qc-text-muted">
                                                {a.status}
                                                {graded ? ` · ${String(a.scorePoints)}/${a.maxPoints != null ? String(a.maxPoints) : "?"}` : ""}
                                            </span>
                                            <Button size="sm" variant="outline" asChild>
                                                <Link href={`/grading/${a.id}`}>{a.status === "GRADED" ? "Review" : "Grade"}</Link>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
