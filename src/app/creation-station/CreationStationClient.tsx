"use client";

import { useState } from "react";
import GeneratorsClient from "./GeneratorsClient";
import { SpecForm } from "./compiler/SpecForm";
import { BundleView } from "./compiler/BundleView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightning, BookOpen } from "@phosphor-icons/react";
import { compileCurriculumAction } from "@/app/actions/compile-curriculum-action";
import { toast } from "sonner";

interface Bundle {
    id: string;
    status: string;
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

interface CreationStationClientProps {
    organizationId: string;
    initialBundles: Bundle[];
}

export default function CreationStationClient({ organizationId, initialBundles }: CreationStationClientProps) {
    const bundles = initialBundles;
    const [isCompiling, setIsCompiling] = useState(false);

    const handleCompile = async (values: Parameters<typeof compileCurriculumAction>[0]) => {
        setIsCompiling(true);
        try {
            // compileCurriculumAction returns {success:true} or throws — there is no failure branch
            // to handle here (errors fall to the catch below).
            await compileCurriculumAction(values);
            toast.success("Compilation Started", {
                description: "Your curriculum bundle is being engineered. Check below for progress."
            });
            // revalidatePath in the action refreshes the server component; reload to pull new data.
            window.location.reload();
        } catch (error) {
            toast.error("Compilation Failed");
            console.error(error);
        } finally {
            setIsCompiling(false);
        }
    };

    return (
        <div className="container mx-auto py-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-qc-charcoal mb-2">Creation Station</h1>
                <p className="text-muted-foreground">
                    Generate high-quality educational materials using AI.
                </p>
            </header>

            <Tabs defaultValue="compiler" className="space-y-6">
                <TabsList className="bg-white border border-qc-parchment-dark/30 shadow-sm p-1">
                    <TabsTrigger value="compiler" className="flex items-center gap-2 data-[state=active]:bg-qc-parchment-dark/10 data-[state=active]:text-qc-primary">
                        <BookOpen weight="fill" />
                        Curriculum Compiler
                    </TabsTrigger>
                    <TabsTrigger value="quick" className="flex items-center gap-2 data-[state=active]:bg-qc-parchment-dark/10 data-[state=active]:text-qc-primary">
                        <Lightning weight="fill" />
                        Quick Create
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="compiler" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <SpecForm onSubmit={handleCompile} isLoading={isCompiling} />
                        <div className="space-y-6">
                            <BundleView bundles={bundles} />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="quick" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <GeneratorsClient organizationId={organizationId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
