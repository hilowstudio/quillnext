import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/resources/MarkdownContent";

/**
 * Generated-resource detail view. Targeted by "View Resource" links across the
 * app and by the Curriculum Compiler's BundleView artifact chips. Org-scoped:
 * a resource is only viewable by its own organization.
 */
export default async function ResourceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { organizationId } = await getCurrentUserOrg();

    const resource = await withTenant(
        (tx) =>
            tx.resource.findUnique({
                where: { id },
                include: { resourceKind: { select: { label: true } } },
            }),
        undefined,
        { organizationId, userId: null },
    );

    const notFound = !resource || resource.organizationId !== organizationId;

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8">
            <Button variant="outline" asChild className="mb-4">
                <Link href="/living-library">← Back to Library</Link>
            </Button>

            {notFound ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted">Resource not found.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="font-display text-3xl text-qc-charcoal text-balance">{resource!.title}</CardTitle>
                        <CardDescription>
                            {resource!.resourceKind.label}
                            {resource!.description ? ` — ${resource!.description}` : ""}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const content = resource!.content as { markdown?: unknown } | null;
                            const markdown =
                                resource!.storageType === "MARKDOWN" && content && typeof content === "object" && typeof content.markdown === "string"
                                    ? content.markdown
                                    : null;
                            return markdown != null ? (
                                <MarkdownContent content={markdown} />
                            ) : (
                                <pre className="whitespace-pre-wrap break-words rounded-qc-md bg-qc-parchment/40 p-4 font-mono text-sm text-qc-charcoal">
                                    {JSON.stringify(resource!.content, null, 2)}
                                </pre>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
