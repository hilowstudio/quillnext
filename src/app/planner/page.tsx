
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getWeeklySchedule } from "@/server/actions/scheduling";
import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PlannerGrid } from "@/components/planner/PlannerGrid";

export default async function PlannerPage({
    searchParams
}: {
    searchParams: Promise<{ start?: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) redirect("/dashboard");

    const { start } = await searchParams;

    // Determine date range
    const today = new Date();
    const startDate = start ? new Date(start) : startOfWeek(today, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(startDate, { weekStartsOn: 1 });

    // Fetch Data
    const { students, items, events } = await getWeeklySchedule(organizationId, startDate, endDate);

    // Navigation Links
    const prevWeek = format(addDays(startDate, -7), "yyyy-MM-dd");
    const nextWeek = format(addDays(startDate, 7), "yyyy-MM-dd");

    return (
        <div className="container mx-auto max-w-[95%] py-6 h-[calc(100vh-4rem)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-3xl font-bold text-qc-charcoal text-balance">Weekly Planner</h1>
                    <p className="text-qc-text-muted">Manage your family's schedule</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-qc-surface rounded-md border shadow-sm">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={`/planner?start=${prevWeek}`}><ArrowLeft size={16} /></Link>
                        </Button>
                        <span className="px-4 font-medium min-w-[200px] text-center">
                            {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
                        </span>
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={`/planner?start=${nextWeek}`}><ArrowRight size={16} /></Link>
                        </Button>
                    </div>
                    <Button>Auto-Reschedule</Button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 bg-qc-surface border rounded-qc-lg shadow-sm overflow-hidden flex flex-col">
                <PlannerGrid
                    startDate={startDate}
                    students={students}
                    items={items}
                    events={events}
                    organizationId={organizationId}
                />
            </div>
        </div>
    );
}
