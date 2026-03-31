import { getAllStates } from '../missions/actions';
import CountyIssuesLookup from './CountyIssuesLookup';
import { Card, CardContent } from "@/components/ui/card";

export default async function NeighborLovePage() {
    const states = await getAllStates();

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold text-qc-primary text-balance">Neighbor Love</h1>
                <p className="font-body text-lg text-qc-text-muted qc-prose">
                    &quot;And who is my neighbor?&quot; (Luke 10:29)
                </p>
            </div>

            <div className="max-w-4xl mx-auto">
                <Card className="bg-white/50 backdrop-blur-sm border-2">
                    <CardContent className="p-6">
                        <CountyIssuesLookup initialStates={states} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
