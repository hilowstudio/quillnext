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
    if (!session?.user?.id) redirect("/login");

    const resolvedParams = await params;

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
}
