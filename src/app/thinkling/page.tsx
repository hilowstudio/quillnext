import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { ThinklingClient } from "@/components/thinkling/ThinklingClient";

export const metadata = {
    title: "Thinkling AI | Quill & Compass",
    description: "AI-powered tutor and assistant for students",
};

export default async function ThinklingPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
        return redirect("/onboarding");
    }

    const students = await withTenant((tx) => tx.learner.findMany({
        where: { organizationId },
        select: {
            id: true,
            preferredName: true,
            firstName: true,
            lastName: true,
        },
        orderBy: { createdAt: "asc" }
    }), undefined, { organizationId, userId: null });

    return <ThinklingClient students={students} />;
}
