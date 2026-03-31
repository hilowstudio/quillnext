import React from 'react';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BibleStudyClient from "./BibleStudyClient";

export default async function BibleStudyPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/family-discipleship/bible-study");
    }

    return (
        <div className="min-h-screen bg-qc-parchment/30 pb-20">
            <div className="container mx-auto p-4 md:p-6 space-y-8">
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Bible Study</h1>
                    <p className="font-body text-lg text-qc-text-muted">Search the scriptures and read commentary.</p>
                </div>
                <BibleStudyClient />
            </div>
        </div>
    );
}
