import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getActiveProfile } from "@/server/profiles/active-profile";
import { getLearnerIdForProfile } from "@/server/profiles/queries";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { getParentDashboardData, getStudentDashboardData } from "@/server/queries/dashboard";

export default async function HomePage(props: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { organizationId } = await getCurrentUserOrg(session);
  if (!organizationId) redirect("/onboarding");

  // Profile gate: no active profile -> pick one first.
  const active = await getActiveProfile();
  if (!active) redirect("/select-profile");

  // STUDENT profile -> that learner's dashboard (its own linked learner; ignore ?studentId).
  if (active.type === "STUDENT") {
    const learnerId = await getLearnerIdForProfile(active.id, organizationId);
    if (learnerId) {
      const student = await getStudentDashboardData(organizationId, learnerId);
      if (student) return <StudentDashboard student={student} viewMode={active.viewMode} />;
    }
    // STUDENT profile with no usable learner -> back to the picker (fail-safe).
    redirect("/select-profile");
  }

  // PARENT profile -> full dashboard, with the existing ?studentId parent-peek preserved.
  if (searchParams.studentId) {
    const student = await getStudentDashboardData(organizationId, searchParams.studentId);
    if (student) return <StudentDashboard student={student} />;
  }

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
