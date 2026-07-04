import { BookOpen } from "@phosphor-icons/react/dist/ssr";
import type { LearningStyleData } from "@/lib/students/learner-profile";
import {
    CardContent,
    ProfileCard,
    ProfileEmptyState,
    ProfileHeader,
    StatBlock,
} from "./profile-primitives";

interface LearningStyleProps {
    learningStyleData: LearningStyleData | null;
}

export function LearningStyle({ learningStyleData }: LearningStyleProps) {
    const stats: { label: string; value: string }[] = learningStyleData
        ? [
              { label: "Input Mode", value: learningStyleData.inputMode },
              { label: "Output Mode", value: learningStyleData.outputMode },
              { label: "Processing Style", value: learningStyleData.processingMode },
              { label: "Content Density", value: learningStyleData.contentDensity },
          ].filter((s): s is { label: string; value: string } => Boolean(s.value))
        : [];

    return (
        <ProfileCard>
            <ProfileHeader
                icon={<BookOpen weight="fill" size={20} className="text-qc-primary" />}
                title="Learning Style"
                description="Cognitive preferences and input modes"
            />
            <CardContent className="space-y-5">
                {learningStyleData ? (
                    <>
                        {stats.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                {stats.map((s) => (
                                    <StatBlock key={s.label} label={s.label} value={s.value} />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <ProfileEmptyState
                        icon={<BookOpen size={22} className="text-qc-text-muted" />}
                        message="Learning style assessment not yet completed."
                    />
                )}
            </CardContent>
        </ProfileCard>
    );
}
