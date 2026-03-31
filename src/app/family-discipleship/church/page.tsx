
import React from 'react';
import { db } from "@/server/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ChurchNotesClient } from "./ChurchNotesClient";

export default async function ChurchNotesPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const notes = await db.localChurchNotes.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            date: 'desc',
        },
    });

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Local Church</h1>
                <p className="font-body text-lg text-qc-text-muted">Bridge Sunday worship to Monday life.</p>
            </div>
            <ChurchNotesClient initialNotes={notes as any} />
        </div>
    );
}
