import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import CreationStationClient from "./CreationStationClient";
import { withTenant } from "@/server/db";
import { excludeParentLearners } from "@/server/queries/learner-filters";

export default async function GeneratorsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    redirect("/onboarding");
  }

  const bundles = await withTenant(
    (tx) =>
      tx.curriculumBundle.findMany({
        where: { spec: { organizationId } },
        include: {
          spec: true,
          resources: {
            include: { resourceKind: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
    undefined,
    { organizationId, userId: null }
  );

  // Students for the Generation Target picker (real children only — exclude parent-as-learner rows).
  const students = await withTenant(
    (tx) =>
      tx.learner.findMany({
        where: { organizationId, ...excludeParentLearners },
        select: { id: true, firstName: true, preferredName: true, currentGrade: true },
        orderBy: { firstName: "asc" },
      }),
    undefined,
    { organizationId, userId: null }
  );

  return (
    <CreationStationClient
      organizationId={organizationId}
      initialBundles={bundles}
      students={students}
    />
  );
}
