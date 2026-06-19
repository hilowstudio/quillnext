import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { listOrganizationProfiles } from "@/server/profiles/queries";
import { listStudentsNeedingAssessment } from "@/server/queries/students";
import { ProfilePicker } from "@/components/profile/ProfilePicker";

export default async function SelectProfilePage() {
  let organizationId: string | null;
  try {
    ({ organizationId } = await getCurrentUserOrg());
  } catch {
    redirect("/login");
  }
  if (!organizationId) redirect("/onboarding");

  const profiles = await listOrganizationProfiles();

  if (profiles.length === 0) {
    // Defensive: onboarding now creates the owner profile, so this should be unreachable for an
    // org user. Show a clear path rather than a blank screen.
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-qc-parchment px-4 text-center">
        <h1 className="font-display text-3xl font-medium text-qc-charcoal mb-4">No profiles yet</h1>
        <p className="text-qc-text-muted mb-8">Let&apos;s finish setting up your account.</p>
        <Link href="/onboarding" className="text-qc-primary underline underline-offset-4">
          Continue setup
        </Link>
      </div>
    );
  }

  const pendingAssessments = await listStudentsNeedingAssessment(organizationId);

  return <ProfilePicker profiles={profiles} pendingAssessments={pendingAssessments} />;
}
