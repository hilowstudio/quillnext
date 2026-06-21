import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { excludeParentLearners } from "@/server/queries/learner-filters";
import { Learner, Transcript } from "@/generated/client";
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, FileText, Plus, Clock } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function TranscriptsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    try {
        const { organizationId } = await getCurrentUserOrg(session);

        if (!organizationId) {
            return (
                <div className="container mx-auto py-12 text-center text-qc-error">
                    <h3 className="text-lg font-bold">Organization Not Found</h3>
                    <p>Please complete onboarding to set up your organization.</p>
                    <Link href="/onboarding">
                        <Button variant="outline" className="mt-4">Go to Onboarding</Button>
                    </Link>
                </div>
            );
        }

        const students = await withTenant(
            (tx) => (tx as any).learner.findMany({
                where: { organizationId, ...excludeParentLearners },
                include: {
                    transcripts: {
                        orderBy: { updatedAt: "desc" },
                        take: 1
                    }
                }
            }),
            undefined,
            { organizationId, userId: null }
        ) as (Learner & { transcripts: Transcript[] })[];

        return (
            <div className="container mx-auto py-8 max-w-5xl">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-[#383A57] font-display text-balance">Transcripts</h1>
                        <p className="text-qc-text-muted mt-1 qc-prose">Manage and generate official transcripts for your students.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {students.map((student) => (
                        <Card key={student.id} className="hover:shadow-md transition-shadow border-t-4 border-t-[#563963]">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="h-10 w-10 rounded-full bg-[#563963]/10 flex items-center justify-center text-[#563963]">
                                        <GraduationCap size={20} />
                                    </div>
                                    {student.transcripts.length > 0 && (
                                        <span className="text-xs bg-qc-success-bg text-qc-success-text px-2 py-1 rounded-full font-medium flex items-center">
                                            <FileText size={12} className="mr-1" />
                                            {student.transcripts.length} Saved
                                        </span>
                                    )}
                                </div>
                                <CardTitle className="mt-4 text-[#383A57]">{student.firstName} {student.lastName}</CardTitle>
                                <CardDescription>
                                    Grade {student.currentGrade || "N/A"} • {student.birthdate ? format(student.birthdate, "MMM d, yyyy") : "No DOB"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {student.transcripts.length > 0 ? (
                                        <div className="text-sm text-qc-text-muted flex items-center bg-qc-surface-raised p-2 rounded">
                                            <Clock size={12} className="mr-2" />
                                            Last updated {format(student.transcripts[0].updatedAt, "MMM d, yyyy")}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-qc-text-muted italic py-2">No transcripts generated yet.</p>
                                    )}

                                    <Link href={`/transcripts/${student.id}`} className="block">
                                        <Button className="w-full bg-[#383A57] hover:bg-[#383A57]/90 group">
                                            <Plus size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                                            {student.transcripts.length > 0 ? "Edit Transcript" : "Create Transcript"}
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {students.length === 0 && (
                        <div className="col-span-full py-12 text-center bg-qc-surface-raised rounded-lg border border-dashed">
                            <GraduationCap size={48} className="text-qc-text-muted mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-qc-charcoal">No students found</h3>
                            <p className="text-qc-text-muted mt-1">Add students to your organization to generate transcripts.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    } catch (error) {
        console.error("Transcripts Page Error:", error);
        return (
            <div className="container mx-auto py-12 text-center text-qc-error">
                <h3 className="text-lg font-bold">Error Loading Students</h3>
                <p>Please ensure you have set up your organization.</p>
                <Link href="/">
                    <Button variant="outline" className="mt-4">Go Home</Button>
                </Link>
            </div>
        );
    }
}
