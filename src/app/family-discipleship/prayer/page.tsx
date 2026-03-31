import React from 'react';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PrayerJournalClient from "./PrayerJournalClient";
import { getPrayerEntries, getPrayerCategories } from "@/server/actions/prayer-journal";

export default async function PrayerJournalPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    // Fetch data in parallel
    const [entries, categories] = await Promise.all([
        getPrayerEntries(),
        getPrayerCategories()
    ]);

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Prayer Journal</h1>
                <p className="font-body text-lg text-qc-text-muted qc-prose">A dedicated space to organize and track your prayers.</p>
            </div>
            <React.Suspense fallback={<div className="h-96 flex items-center justify-center">Loading Prayer Journal...</div>}>
                <PrayerJournalClient
                    initialEntries={entries}
                    initialCategories={categories}
                />
            </React.Suspense>
        </div>
    );
}
