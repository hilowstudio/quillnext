"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CircleNotch, CheckCircle, WarningCircle, FileText, FilePdf, Presentation } from "@phosphor-icons/react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CURRICULUM_KIND_CODES } from "@/lib/constants/curriculum-kinds";

interface Bundle {
    id: string;
    status: string;
    failureReason?: string | null;
    createdAt: Date;
    spec: {
        title: string;
        subject: string;
        topic: string;
    };
    resources: {
        id: string;
        title: string;
        resourceKind: {
            code: string;
            label: string;
        };
    }[];
}

interface BundleViewProps {
    bundles: Bundle[];
}

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { patchCurriculumAction } from "@/app/actions/compile-curriculum-action";
import { Wrench } from "@phosphor-icons/react";

// ... existing interfaces ...

export function BundleView({ bundles }: BundleViewProps) {
    if (bundles.length === 0) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-qc-charcoal flex items-center gap-2">
                <FileText className="text-qc-accent" />
                Recent Compilations
            </h3>
            <div className="grid grid-cols-1 gap-4">
                {bundles.map((bundle) => (
                    <Card key={bundle.id} className="border border-qc-parchment-dark/30 bg-white shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg text-qc-primary flex items-center gap-2">
                                        {bundle.spec.title}
                                        {/* Show Refined badge if this is a patch */}
                                        {/* (We would need to fetch feedback field to show this property, assuming we add it to props later) */}
                                    </CardTitle>
                                    <CardDescription>
                                        Started {formatDistanceToNow(new Date(bundle.createdAt))} ago
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={bundle.status} />
                                    {bundle.status === "COMPLETED" && (
                                        <RefineBundleDialog bundleId={bundle.id} />
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {bundle.status === "FAILED" && bundle.failureReason && (
                                <div className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md p-3">
                                    <span className="font-semibold">Compile failed:</span> {bundle.failureReason}
                                </div>
                            )}
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">Artifacts</span>
                                <div className="flex flex-wrap gap-2">
                                    {bundle.resources.length === 0 && bundle.status === "COMPILING" && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                                            <CircleNotch className="animate-spin" /> Generating artifacts...
                                        </div>
                                    )}
                                    {bundle.resources.map((res) => (
                                        <Link key={res.id} href={`/living-library/resource/${res.id}`} className="group">
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-qc-parchment/30 border border-qc-parchment-dark/20 hover:bg-qc-parchment/60 transition-colors">
                                                <ArtifactIcon code={res.resourceKind.code} />
                                                <span className="text-sm font-medium text-qc-charcoal group-hover:text-qc-primary transition-colors">
                                                    {res.resourceKind.label}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function RefineBundleDialog({ bundleId }: { bundleId: string }) {
    const [open, setOpen] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleRefine = async () => {
        if (!feedback.trim()) return;
        setIsLoading(true);
        try {
            await patchCurriculumAction(bundleId, feedback);
            toast.success("Refinement started! A new bundle is being compiled.");
            setOpen(false);
            setFeedback("");
        } catch (error) {
            toast.error("Failed to start refinement.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-dashed text-qc-charcoal/70 hover:text-qc-primary">
                    <Wrench size={12} />
                    Report Defect / Refine
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Report Defect & Refine</DialogTitle>
                    <DialogDescription>
                        Studio 26 uses a "Patch" workflow. Describe the defect (e.g., "Reading level too high" or "Font is too small") and we will re-compile a new version that attempts to fix it while respecting the original specs.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="feedback">Defect Report</Label>
                        <Textarea
                            id="feedback"
                            placeholder="e.g. The student packet needs more white space, and the reading level is too advanced for 3rd grade."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleRefine} disabled={isLoading || !feedback.trim()}>
                        {isLoading ? <CircleNotch className="animate-spin mr-2" /> : <Wrench className="mr-2" />}
                        Patch & Re-Compile
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === "COMPILING") {
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><CircleNotch className="animate-spin mr-1" /> Building</Badge>;
    }
    if (status === "COMPLETED") {
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="mr-1" /> Ready</Badge>;
    }
    return <Badge variant="secondary" className="bg-red-100 text-red-800"><WarningCircle className="mr-1" /> Failed</Badge>;
}

function ArtifactIcon({ code }: { code: string }) {
    if (code === CURRICULUM_KIND_CODES.TEACHER_GUIDE) return <FileText className="text-blue-500" />;
    if (code === CURRICULUM_KIND_CODES.STUDENT_PACKET) return <FilePdf className="text-red-500" />;
    if (code === CURRICULUM_KIND_CODES.SLIDES) return <Presentation className="text-orange-500" />;
    if (code === CURRICULUM_KIND_CODES.READING_ANTHOLOGY) return <FileText className="text-purple-500" />;
    if (code === CURRICULUM_KIND_CODES.GRAPHIC_ORGANIZERS) return <FileText className="text-teal-500" />;
    return <FileText className="text-qc-text-muted" />;
}
