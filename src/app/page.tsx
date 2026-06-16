import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { getParentDashboardData, getStudentDashboardData } from "@/server/queries/dashboard";

export default async function HomePage(
  props: {
    searchParams: Promise<{ studentId?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth();

  // ... (auth checks) ...

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg(session);

  if (!organizationId) {
    redirect("/onboarding");
  }

  // --- STUDENT VIEW ---
  if (searchParams.studentId) {
    const student = await getStudentDashboardData(organizationId, searchParams.studentId);

    if (student) {
      return <StudentDashboard student={student} />;
    }
    // If student not found (invalid ID), fall through to parent dashboard
  }

  // --- PARENT VIEW ---
  const data = await getParentDashboardData(organizationId);

  return (
    <ParentDashboard
      students={data.students}
      recentResources={data.recentResources}
      recentCourses={data.recentCourses}
      completeness={data.completeness}
      suggestions={data.suggestions}
      classroomName={data.classroomName || "My Classroom"}
    />
  );
}
