import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getLibraryVideos, getLibrarySubjects } from "@/server/queries/library";
import VideosClient from "./VideosClient";
import { redirect } from "next/navigation";

export default async function VideosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    return <div>User has no organization</div>;
  }

  // Parallel fetch
  const [videos, subjects] = await Promise.all([
    getLibraryVideos(organizationId),
    getLibrarySubjects(),
  ]);

  // Type assertion needed at Server/Client boundary
  return (
    <VideosClient
      initialVideos={videos as any}
      initialSubjects={subjects as any}
    />
  );
}
