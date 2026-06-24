import type { getParentDashboardData, getStudentDashboardData } from "@/server/queries/dashboard";
import type { getStudentAssignments } from "@/app/actions/student";

// Single source of truth for the dashboards' server→client payloads, derived from the queries
// that actually produce them so the client components can't drift from the server shapes.
export type ParentDashboardData = Awaited<ReturnType<typeof getParentDashboardData>>;
export type StudentDashboardData = NonNullable<Awaited<ReturnType<typeof getStudentDashboardData>>>;
export type StudentAssignmentsData = Awaited<ReturnType<typeof getStudentAssignments>>;
