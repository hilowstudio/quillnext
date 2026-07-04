import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Target } from "@phosphor-icons/react/dist/ssr";
import type { PersonalityData } from "@/lib/students/learner-profile";
import {
    CardContent,
    ProfileCard,
    ProfileEmptyState,
    ProfileHeader,
    StatBlock,
    TraitChip,
} from "./profile-primitives";

interface PersonalityProfileProps {
    studentId: string;
    personalityData: PersonalityData | null;
}

export function PersonalityProfile({ studentId, personalityData }: PersonalityProfileProps) {
    const stats: { label: string; value: string }[] = personalityData
        ? [
              { label: "Feedback Style", value: personalityData.feedbackStyle },
              { label: "Scaffolding", value: personalityData.scaffoldingLevel },
              { label: "Work Style", value: personalityData.workStyle },
              { label: "Creativity", value: personalityData.creativityPreference },
              { label: "On Mistakes", value: personalityData.frustrationResponse },
          ].filter((s): s is { label: string; value: string } => Boolean(s.value))
        : [];

    return (
        <ProfileCard>
            <ProfileHeader
                icon={<Target weight="fill" size={20} className="text-qc-primary" />}
                title="Personality Profile"
                description="Inkling-generated learning profile"
            />
            <CardContent className="space-y-5">
                {personalityData ? (
                    <>
                        {personalityData.motivationalDriver && (
                            <div>
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-qc-text-muted">
                                    Motivational Driver
                                </p>
                                <TraitChip tone="gold">
                                    {personalityData.motivationalDriver}
                                </TraitChip>
                            </div>
                        )}

                        {stats.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                {stats.map((s) => (
                                    <StatBlock key={s.label} label={s.label} value={s.value} />
                                ))}
                            </div>
                        )}

                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/students/${studentId}/assessment`}>Update Assessment</Link>
                        </Button>
                    </>
                ) : (
                    <ProfileEmptyState
                        icon={<Target size={22} className="text-qc-text-muted" />}
                        message="No personality profile yet. Complete the assessment to enable Inkling personalization."
                        action={
                            <Button asChild size="sm">
                                <Link href={`/students/${studentId}/assessment`}>
                                    Start Assessment
                                </Link>
                            </Button>
                        }
                    />
                )}
            </CardContent>
        </ProfileCard>
    );
}
