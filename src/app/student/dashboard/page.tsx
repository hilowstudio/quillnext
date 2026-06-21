
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getStudentDailySchedule } from "@/server/actions/scheduling";
import { withTenant } from "@/server/db";
import { excludeParentLearners } from "@/server/queries/learner-filters";
import { redirect } from "next/navigation";
import { DailyScheduleList } from "@/components/dashboard/DailyScheduleList";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function StudentDashboardPage({
    searchParams
}: {
    searchParams: Promise<{ studentId?: string, date?: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) redirect("/onboarding");

    const { studentId, date } = await searchParams;

    // 1. Get Students
    const students = await withTenant((tx) => tx.learner.findMany({
        where: { organizationId, ...excludeParentLearners },
        select: { id: true, firstName: true, preferredName: true }
    }), undefined, { organizationId, userId: null });

    if (students.length === 0) {
        return <div className="p-8">No students found. Please add students first.</div>;
    }

    // Default to first student if not specified
    const currentStudentId = studentId || students[0].id;
    const currentStudent = students.find(s => s.id === currentStudentId) || students[0];

    // Determine Date
    const targetDate = date ? new Date(date) : new Date();

    // 2. Get Schedule
    const { items, events } = await getStudentDailySchedule(currentStudentId, targetDate);

    return (
        <div className="container mx-auto max-w-4xl py-8 px-4">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar / Student Selector */}
                <div className="w-full md:w-64 space-y-4 shrink-0">
                    <Card className="p-4 bg-qc-parchment border-qc-border-subtle">
                        <h2 className="font-display text-lg mb-3 text-qc-charcoal text-balance">Students</h2>
                        <div className="space-y-1">
                            {students.map(s => (
                                <Link
                                    key={s.id}
                                    href={`/student/dashboard?studentId=${s.id}`}
                                    className={`block w-full text-left px-3 py-2 rounded-md transition-colors ${s.id === currentStudentId
                                            ? 'bg-qc-primary text-white font-medium shadow-sm'
                                            : 'hover:bg-qc-primary/10 text-qc-charcoal'
                                        }`}
                                >
                                    {s.preferredName || s.firstName}
                                </Link>
                            ))}
                        </div>
                    </Card>

                    <div className="flex gap-2 justify-center">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/planner">View Weekly Planner</Link>
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-6">
                    <div className="bg-qc-surface rounded-qc-xl shadow-sm border p-6 min-h-[500px]">
                        <div className="mb-6 flex items-center gap-2 text-sm text-qc-text-muted">
                            <span>Viewing as:</span>
                            <span className="font-bold text-qc-primary">{currentStudent.preferredName || currentStudent.firstName}</span>
                        </div>

                        <DailyScheduleList
                            date={targetDate}
                            items={items as any}
                            events={events as any}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
