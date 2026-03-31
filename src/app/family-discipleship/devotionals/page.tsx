
import React from 'react';
import { db } from "@/server/db";
import { DevotionalDisplay } from "./DevotionalDisplay";
import { format } from "date-fns";

export default async function DevotionalsPage() {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth is 0-indexed
    const day = today.getDate();

    const devotionals = await db.devotional.findMany({
        where: {
            month: month,
            day: day,
        },
    });





    const formattedDate = format(today, "EEEE, MMMM do, yyyy");

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Daily Devotional</h1>
                <p className="font-body text-lg text-qc-text-muted">Daily readings from C.H. Spurgeon</p>
            </div>
            <DevotionalDisplay devotionals={devotionals as any} date={formattedDate} />
        </div>
    );
}
