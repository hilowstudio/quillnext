import { redirect } from "next/navigation";
import { getActiveProfile } from "@/server/profiles/active-profile";
import { listOrganizationProfiles } from "@/server/profiles/queries";
import { ManageProfiles } from "@/components/profile/ManageProfiles";

export default async function ManageProfilesPage() {
  // Defense in depth: the proxy already PARENT-gates this route, but re-check here.
  const active = await getActiveProfile();
  if (active?.type !== "PARENT") redirect("/select-profile");

  const profiles = await listOrganizationProfiles();
  return <ManageProfiles profiles={profiles} />;
}
