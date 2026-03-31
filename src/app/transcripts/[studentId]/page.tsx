import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TranscriptBuilder } from "@/components/transcript/TranscriptBuilder";
import { generateTranscriptData, getTranscripts } from "@/server/actions/transcript";

interface PageProps {
    params: Promise<{
        studentId: string;
    }>;
}

export default async function TranscriptBuilderPage({ params }: PageProps) {
    const session = await auth();
    if (!session?.user?.id) redirect("/api/auth/signin");

    const resolvedParams = await params;

    try {
        // Check if a saved transcript exists
        const savedTranscripts = await getTranscripts(resolvedParams.studentId);
        let initialData;

        if (savedTranscripts.length > 0) {
            initialData = savedTranscripts[0].data;
            // Inject the ID so updates modify this record
            initialData.id = savedTranscripts[0].id;
        } else {
            // Generate fresh data from database
            initialData = await generateTranscriptData(resolvedParams.studentId);
        }

        return (
            <div className="min-h-screen bg-qc-surface-raised/50">
                <TranscriptBuilder
                    initialData={initialData}
                    studentId={resolvedParams.studentId}
                />
            </div>
        );
    } catch (error) {
        console.error("Transcript Builder Error:", error);
        return (
            <div className="container mx-auto py-12 text-center">
                <h3 className="text-lg font-bold text-qc-error">Error Loading Transcript</h3>
                <p className="text-qc-text-muted mb-4">Could not load the student data. Please try again.</p>
                <p className="text-sm text-qc-text-muted">{(error as Error).message}</p>
            </div>
        );
    }
}
