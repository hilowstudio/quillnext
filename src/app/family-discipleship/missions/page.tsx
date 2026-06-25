
import React from 'react';
import { getUnreachedOfTheDayAction, getOperationWorldStats } from './actions';
import { UnreachedOfTheDay } from './UnreachedOfTheDay';
import { Card, CardContent } from "@/components/ui/card";
import MissionsClient from './MissionsClient';

export default async function MissionsPage() {
    const unreachedData = await getUnreachedOfTheDayAction();
    const worldStats = await getOperationWorldStats();

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Missions & Global Prayer</h1>
                <p className="font-body text-lg text-qc-text-muted qc-prose">
                    &quot;Ask of me, and I will make the nations your heritage, and the ends of the earth your possession.&quot; (Psalm 2:8)
                </p>
            </div>

            {/* Featured Unreached Group */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Unreached People Group of the Day</h2>
                <UnreachedOfTheDay data={unreachedData} />
            </section>

            {/* Operation World Explorer */}
            <section>
                <div className="mb-4">
                    <h2 className="text-xl font-semibold">Operation World Explorer</h2>
                    <p className="text-sm text-muted-foreground">Explore prayer needs for every nation.</p>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <MissionsClient stats={worldStats} />
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
