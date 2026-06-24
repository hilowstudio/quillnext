import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import CreationStationClient from "./CreationStationClient";
import { withTenant } from "@/server/db";

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

  return <CreationStationClient organizationId={organizationId} initialBundles={bundles} />;
}
