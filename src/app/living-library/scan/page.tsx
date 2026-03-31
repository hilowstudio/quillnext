import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { BookScanner } from "@/components/library/BookScanner";

export default async function BookScanPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();

  if (!organizationId) {
    redirect("/onboarding");
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Scan Book
        </h1>
        <p className="font-body text-qc-text-muted qc-prose">
          Upload a book cover image or use your camera to automatically extract book information
        </p>
      </div>

      <BookScanner organizationId={organizationId} />
    </div>
  );
}
