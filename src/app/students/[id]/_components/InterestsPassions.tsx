import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { InterestsData } from "@/lib/students/learner-profile";
import {
    CardContent,
    InstructionQuote,
    ProfileCard,
    ProfileEmptyState,
    ProfileHeader,
    StatBlock,
    TraitChip,
} from "./profile-primitives";

interface InterestsPassionsProps {
    interestsData: InterestsData | null;
}

export function InterestsPassions({ interestsData }: InterestsPassionsProps) {
    const hookThemes = interestsData?.hookThemes ?? [];
    const expertTopics = (interestsData?.expertTopics ?? []).filter((t) => t.trim().length > 0);
    const favorites = interestsData?.specificEntities ?? [];

    return (
        <ProfileCard className="lg:col-span-2">
            <ProfileHeader
                icon={<Sparkle weight="fill" size={20} className="text-qc-primary" />}
                title="Interests & Passions"
                description="Contextual hooks for engagement"
            />
            <CardContent>
                {interestsData ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-qc-text-muted">
                                    Hook Themes (Worlds)
                                </p>
                                {hookThemes.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {hookThemes.map((theme) => (
                                            <TraitChip key={theme} tone="gold">
                                                {theme}
                                            </TraitChip>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm italic text-qc-text-muted">
                                        No worlds selected.
                                    </p>
                                )}
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-qc-text-muted">
                                    Specific Favorites
                                </p>
                                {favorites.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {favorites.map((entity, idx) => (
                                            <div
                                                key={`${entity.category}-${idx}`}
                                                className="rounded-qc-sm border border-qc-border-subtle bg-white/60 p-2.5"
                                            >
                                                <p className="text-[11px] uppercase tracking-wide text-qc-text-muted">
                                                    {entity.category}
                                                </p>
                                                <p className="text-sm font-medium text-qc-charcoal">
                                                    {entity.favorite}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm italic text-qc-text-muted">
                                        No favorites listed.
                                    </p>
                                )}
                            </div>
                        </div>

                        {expertTopics.length > 0 && (
                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-qc-text-muted">
                                    Expert Subjects (For Analogies)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {expertTopics.map((topic) => (
                                        <TraitChip key={topic}>{topic}</TraitChip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {interestsData.integrationMode && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <StatBlock
                                    label="Integration Strategy"
                                    value={interestsData.integrationMode}
                                />
                            </div>
                        )}

                        {interestsData.analogyStrategy && (
                            <InstructionQuote label="Analogy Strategy">
                                {interestsData.analogyStrategy}
                            </InstructionQuote>
                        )}
                    </div>
                ) : (
                    <ProfileEmptyState
                        icon={<Sparkle size={22} className="text-qc-text-muted" />}
                        message="Interests assessment not yet completed."
                    />
                )}
            </CardContent>
        </ProfileCard>
    );
}
