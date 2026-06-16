import React from 'react';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HeartCheckClient from "./HeartCheckClient";

export default async function HeartCheckPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/family-discipleship/heart-check");
    }

    return (
        <div className="min-h-screen bg-qc-parchment/30">
            <div className="container mx-auto p-4 md:p-6 space-y-8">
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Heart Check</h1>
                    <p className="font-body text-lg text-qc-text-muted qc-prose">Emotions are God-given diagnostics. They are the dashboard lights of the heart.</p>
                </div>
                <HeartCheckClient />
            </div>
        </div>
    );
}
