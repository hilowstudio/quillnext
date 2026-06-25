'use client';

import React, { useState, useEffect, memo } from 'react';
import { Warning, House, ForkKnife, Church, Skull, Baby, HeartBreak, Car, Users } from '@phosphor-icons/react/dist/ssr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCountiesForState } from '../missions/actions';
import { z } from 'zod';

// Type definitions — derived from the Zod read-schema below so the validated runtime shape and the
// consumed TS types are one source of truth. The county `data` arrives as an unvalidated Json column,
// so it is validated here at the boundary rather than asserted (`as County[]`).
type ConcernLevel = 'severe' | 'high' | 'moderate' | 'low';

const concernSchema = z.object({
    key: z.string(),
    value: z.number(),
    level: z.enum(['severe', 'high', 'moderate', 'low']),
    percentile: z.number(),
    year: z.number(),
});
type Concern = z.infer<typeof concernSchema>;

// Lenient: only modeled fields are checked, unknown extras pass through (catchall). `abortion_data` —
// whose numbers are rendered with .toFixed/.toLocaleString — is `.catch(undefined)` so a malformed
// block degrades to "section hidden" (the existing `abortion_data &&` guard) instead of crashing the tab.
const countySchema = z.object({
    State: z.string(),
    County: z.string(),
    issues: z.object({
        concerns: z.array(concernSchema).optional(),
        indicators: z.record(z.string(), z.object({ value: z.number(), year: z.number().optional() })).optional(),
        sources: z.array(z.unknown()).optional(),
        scores: z.record(z.string(), z.number()).optional(),
    }).optional(),
    population: z.object({ total: z.number().optional(), year: z.number().optional() }).optional(),
    context: z.object({ rucc_2023: z.number().optional(), uic_2024: z.number().optional() }).optional(),
    ids: z.object({ fips: z.string().optional() }).optional(),
    unemployment_series: z.record(z.string(), z.number()).optional(),
    abortion_data: z.object({ abortion_rate: z.number(), total_abortions: z.number(), year: z.number() }).optional().catch(undefined),
}).catchall(z.unknown());
type County = z.infer<typeof countySchema>;

interface IndicatorDescription {
    title: string;
    description: string;
    interpretation: string;
    christianConcern: string;
}

interface GetInvolvedActions {
    pray: string;
    serve: string;
    support: string;
    engage: string;
}

interface GetInvolvedContent {
    category: string;
    christianResponse: string;
    actions: GetInvolvedActions;
}

interface ConcernCardProps {
    concern: Concern;
    indicatorIcons: Record<string, React.ComponentType<{ className?: string }>>;
    formatValue: (key: string, value: number) => string;
    getConcernColor: (level: ConcernLevel) => string;
}

// Memoized concern card component
const ConcernCard = memo(({ concern, indicatorIcons, formatValue, getConcernColor }: ConcernCardProps) => {
    const Icon = indicatorIcons[concern.key] || Warning;

    return (
        <div className={`p-3 md:p-4 rounded-lg border-l-4 ${getConcernColor(concern.level)} mb-2 bg-white shadow-sm`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0 flex-1">
                    <Icon className="mr-2 md:mr-3 h-5 w-5 flex-shrink-0" />
                    <div className="min-w-0">
                        <div className="text-sm md:text-base font-medium capitalize truncate text-qc-charcoal">
                            {concern.key.replace(/_/g, ' ').replace('per 100k', '').replace('per 10k', '').replace('per 1k', '')}
                        </div>
                        <div className="text-xs md:text-sm text-qc-text-muted">
                            {formatValue(concern.key, concern.value)} ({concern.year})
                        </div>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className={`text-xs md:text-sm font-semibold uppercase`}>
                        {concern.level}
                    </div>
                    <div className="text-xs text-qc-text-muted">
                        {concern.percentile}th percentile
                    </div>
                </div>
            </div>
        </div>
    );
});
ConcernCard.displayName = 'ConcernCard';

// Tabs Component for Grouped Data
interface TabsProps {
    selectedCounty: County;
    indicatorIcons: Record<string, React.ComponentType<{ className?: string }>>;
    indicatorDescriptions: Record<string, IndicatorDescription>;
    formatValue: (key: string, value: number) => string;
    getPercentileColor: (percentile: number) => string;
    onGetInvolvedClick: (key: string) => void;
    hasGetInvolvedContent: (key: string) => boolean;
}

function CountyDataTabs({ selectedCounty, indicatorIcons, indicatorDescriptions, formatValue, getPercentileColor, onGetInvolvedClick, hasGetInvolvedContent }: TabsProps) {
    const [tab, setTab] = useState('church');

    const groups = {
        church: ['evangelical_congregations_per_10k', 'evangelical_adherents_per_1k'],
        environment: ['homelessness_per_10k', 'severe_housing_problems_pct', 'segregation_index_bw', 'pm25_air_pollution', 'injury_death_rate'],
        food: ['food_insecurity_rate', 'free_reduced_lunch_pct', 'drinking_water_violations'],
        income: ['median_household_income', 'overall_poverty_rate', 'unemployment_rate'],
        mental: ['poor_mental_health_days', 'suicide_rate', 'drug_overdose_deaths_per_100k', 'mental_health_providers_per_100k'],
        children: ['disconnected_youth_pct', 'teen_birth_rate', 'child_poverty_rate', 'children_single_parent_pct']
    };

    const tabs = [
        { key: 'church', label: 'The Church' },
        { key: 'environment', label: 'Environment' },
        { key: 'food', label: 'Food' },
        { key: 'income', label: 'Income' },
        { key: 'mental', label: 'Mental Health' },
        { key: 'children', label: 'Children' }
    ];

    const renderGroup = (keys: string[]) => (
        <div className="space-y-6">
            {keys.map((key) => {
                if (!selectedCounty.issues?.indicators) return null;
                const indicator = selectedCounty.issues.indicators[key];
                if (!indicator) return null;

                const Icon = indicatorIcons[key] || Warning;
                const description = indicatorDescriptions[key];
                const percentile = selectedCounty.issues.scores?.[key];

                return (
                    <div key={key} className="p-4 md:p-6 border border-qc-border-subtle/50 rounded-lg bg-white/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3 gap-2">
                            <div className="flex items-center min-w-0 flex-1">
                                <Icon className="mr-3 h-6 w-6 text-qc-text-muted flex-shrink-0" />
                                <div className="font-semibold text-qc-primary text-lg truncate">
                                    {description?.title || key.replace(/_/g, ' ')}
                                </div>
                            </div>
                            {percentile !== undefined && (
                                <div className={`text-xs font-medium px-2 py-1 rounded ${getPercentileColor(percentile)} bg-white border border-black/5`}>
                                    {percentile}th percentile
                                </div>
                            )}
                        </div>

                        <div className="text-3xl font-bold text-qc-primary mb-2">
                            {formatValue(key, indicator.value)}
                        </div>
                        <div className="text-sm text-qc-text-muted mb-4">Data from {indicator.year}</div>

                        {description && (
                            <div className="space-y-3">
                                <div>
                                    <div className="font-medium text-qc-primary mb-1">What this measures:</div>
                                    <div className="text-sm text-qc-text leading-relaxed">{description.description}</div>
                                </div>
                                <div className="bg-qc-warning-bg/50 p-3 rounded-lg border border-qc-warning-border">
                                    <div className="font-medium text-qc-warning-text mb-1">Christian Response:</div>
                                    <div className="text-sm text-qc-warning-text leading-relaxed">{description.christianConcern}</div>
                                </div>
                                {hasGetInvolvedContent(key) && (
                                    <button
                                        onClick={() => onGetInvolvedClick(key)}
                                        className="text-sm font-medium text-qc-secondary hover:text-qc-secondary/80 underline mt-2"
                                    >
                                        Get involved →
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-6">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key
                            ? 'bg-qc-primary text-white shadow-sm'
                            : 'bg-white hover:bg-qc-surface-hover text-qc-text-muted border border-qc-border-subtle'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in duration-300">
                {tab === 'church' && renderGroup(groups.church)}
                {tab === 'environment' && renderGroup(groups.environment)}
                {tab === 'food' && renderGroup(groups.food)}
                {tab === 'income' && renderGroup(groups.income)}
                {tab === 'mental' && renderGroup(groups.mental)}
                {tab === 'children' && (
                    <div className="space-y-6">
                        {renderGroup(groups.children)}
                        {selectedCounty.abortion_data && (
                            <div className="p-6 border border-qc-border-subtle/50 rounded-lg bg-white/50 backdrop-blur-sm">
                                <div className="text-lg font-semibold text-qc-primary mb-4">Abortion (State-Level)</div>
                                <div className="grid gap-6 md:grid-cols-2 mb-4">
                                    <div>
                                        <div className="text-2xl font-bold text-qc-primary">{selectedCounty.abortion_data.abortion_rate.toFixed(1)} <span className="text-base font-normal text-qc-text-muted">per 1,000 women</span></div>
                                        <div className="text-sm text-qc-text-muted">Abortion Rate ({selectedCounty.abortion_data.year})</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-qc-primary">{selectedCounty.abortion_data.total_abortions.toLocaleString()}</div>
                                        <div className="text-sm text-qc-text-muted">Total Abortions ({selectedCounty.abortion_data.year})</div>
                                    </div>
                                </div>
                                <div className="text-sm text-qc-text-muted mb-4 italic">State-level statistics applied to all counties in the state.</div>

                                <button
                                    onClick={() => onGetInvolvedClick('abortion_rate_state')}
                                    className="text-sm font-medium text-qc-secondary hover:text-qc-secondary/80 underline"
                                >
                                    Get involved →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Main Component
interface CountyIssuesLookupProps {
    initialStates: string[];
}

export default function CountyIssuesLookup({ initialStates }: CountyIssuesLookupProps) {
    const [selectedState, setSelectedState] = useState('');
    const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
    const [countiesInState, setCountiesInState] = useState<County[]>([]);
    const [loadingCounties, setLoadingCounties] = useState(false);

    // Modal State
    const [showGetInvolvedModal, setShowGetInvolvedModal] = useState(false);
    const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null);

    // Data Loading
    useEffect(() => {
        if (!selectedState) {
            setCountiesInState([]);
            return;
        }

        const loadCounties = async () => {
            setLoadingCounties(true);
            try {
                const data = await getCountiesForState(selectedState);
                // Validate each unvalidated Json row at the boundary; drop any that don't match.
                setCountiesInState(data.flatMap((d) => {
                    const parsed = countySchema.safeParse(d);
                    return parsed.success ? [parsed.data] : [];
                }));
            } catch (error) {
                console.error('Failed to load counties:', error);
            } finally {
                setLoadingCounties(false);
            }
        };

        loadCounties();
    }, [selectedState]);


    // Icon Mapping
    const indicatorIcons: Record<string, React.ComponentType<{ className?: string }>> = {
        severe_housing_problems_pct: House,
        food_insecurity_rate: ForkKnife,
        evangelical_congregations_per_10k: Church,
        evangelical_adherents_per_1k: Church,
        drug_overdose_deaths_per_100k: Skull,
        teen_birth_rate: Baby,
        suicide_rate: HeartBreak,
        injury_death_rate: Car,
        segregation_index_bw: Users,
        homelessness_per_10k: House,
        overall_poverty_rate: ForkKnife,
        child_poverty_rate: ForkKnife,
        median_household_income: House,
        unemployment_rate: Car,
        drinking_water_violations: Car,
        pm25_air_pollution: Car,
        children_single_parent_pct: Users,
        free_reduced_lunch_pct: ForkKnife,
        disconnected_youth_pct: Users,
        mental_health_providers_per_100k: HeartBreak,
        poor_mental_health_days: HeartBreak,
        abortion_rate_state: Baby,
        total_abortions_state: Baby
    };

    // Descriptions
    const indicatorDescriptions: Record<string, IndicatorDescription> = {
        severe_housing_problems_pct: {
            title: "Severe Housing Problems",
            description: "Percentage of households spending more than 50% of income on housing costs or living in severely inadequate housing.",
            interpretation: "Higher percentages indicate more families struggling with housing affordability.",
            christianConcern: "Housing instability impacts families' ability to thrive. Consider supporting local housing ministries."
        },
        food_insecurity_rate: {
            title: "Food Insecurity Rate",
            description: "Percentage of population limited access to adequate food.",
            interpretation: "Higher rates indicate more families struggling to put food on the table.",
            christianConcern: "Food insecurity is a direct opportunity for service. Consider supporting local food banks."
        },
        evangelical_congregations_per_10k: {
            title: "Evangelical Church Presence",
            description: "Number of Evangelical Protestant congregations per 10,000 residents.",
            interpretation: "Lower numbers may indicate fewer opportunities for gospel-centered community.",
            christianConcern: "Areas with fewer churches may benefit from church planting or supporting existing churches."
        },
        evangelical_adherents_per_1k: {
            title: "Christian Presence",
            description: "Number of people identifying as Bible-believing Christians per 1,000 residents.",
            interpretation: "Consider how many people each Christian would need to reach with the gospel.",
            christianConcern: "A call to personal evangelism and discipleship."
        },
        drug_overdose_deaths_per_100k: {
            title: "Drug Overdose Deaths",
            description: "Annual deaths from drug overdoses per 100,000 population.",
            interpretation: "Higher rates indicate communities struggling with addiction.",
            christianConcern: "Addiction affects many families. Support recovery ministries."
        },
        teen_birth_rate: {
            title: "Teen Birth Rate",
            description: "Number of births to mothers aged 15-19 per 1,000.",
            interpretation: "Higher rates may indicate challenges with youth education and support.",
            christianConcern: "Support youth mentorship and family education."
        },
        suicide_rate: {
            title: "Suicide Rate",
            description: "Annual deaths by suicide per 100,000 population.",
            interpretation: "Higher rates indicate communities struggling with mental health and despair.",
            christianConcern: "Reflects deep spiritual emotional needs. Support mental health ministries."
        },
        injury_death_rate: {
            title: "Injury Death Rate",
            description: "Annual deaths from injuries per 100,000 population.",
            interpretation: "Higher rates may indicate safety concerns or risky behaviors.",
            christianConcern: "Reflects broader community safety issues."
        },
        segregation_index_bw: {
            title: "Racial Segregation Index",
            description: "Measure of residential segregation (0-1).",
            interpretation: "Higher values indicate more segregated neighborhoods.",
            christianConcern: "Segregation limits cross-cultural relationships. Build bridges."
        },
        homelessness_per_10k: {
            title: "Homelessness Rate",
            description: "Number of homeless individuals per 10,000 population.",
            interpretation: "Higher rates indicate more people experiencing homelessness.",
            christianConcern: "Homelessness represents people in crisis needing compassion and help."
        },
        overall_poverty_rate: {
            title: "Poverty Rate (Overall)",
            description: "Percent of people living below the poverty line.",
            interpretation: "Higher rates signal greater economic hardship.",
            christianConcern: "Poverty invites tangible mercy and justice."
        },
        child_poverty_rate: {
            title: "Child Poverty Rate",
            description: "Percent of children living below the poverty line.",
            interpretation: "Higher child poverty harms development.",
            christianConcern: "Support family ministries and schools."
        },
        median_household_income: {
            title: "Median Household Income",
            description: "Median income for households.",
            interpretation: "Lower values indicate fewer opportunities.",
            christianConcern: "Consider job training and benevolence."
        },
        unemployment_rate: {
            title: "Unemployment Rate",
            description: "Share of the labor force unemployed.",
            interpretation: "Higher unemployment stresses families.",
            christianConcern: "Job connections and training can serve the unemployed."
        },
        drinking_water_violations: {
            title: "Drinking Water Violations",
            description: "Presence of EPA-reported violations.",
            interpretation: "Violations indicate health risks.",
            christianConcern: "Advocate for safe water."
        },
        pm25_air_pollution: {
            title: "Air Pollution (PM2.5)",
            description: "Fine particulate matter concentration.",
            interpretation: "Higher PM2.5 increases health risks.",
            christianConcern: "Care for creation and neighbor health."
        },
        children_single_parent_pct: {
            title: "Single-Parent Households",
            description: "Percent of children with a single parent.",
            interpretation: "Higher rates reflect support needs.",
            christianConcern: "Strengthen family support and mentoring."
        },
        free_reduced_lunch_pct: {
            title: "Free/Reduced Lunch",
            description: "Percent of students eligible.",
            interpretation: "Proxy for child poverty.",
            christianConcern: "Support school meals and backpacks."
        },
        disconnected_youth_pct: {
            title: "Disconnected Youth",
            description: "Percent not in school/working (16-19).",
            interpretation: "Risk for long-term hardship.",
            christianConcern: "Invest in mentorship and job pathways."
        },
        mental_health_providers_per_100k: {
            title: "Mental Health Providers",
            description: "Providers per 100,000.",
            interpretation: "Lower availability limits access.",
            christianConcern: "Support counseling access."
        },
        poor_mental_health_days: {
            title: "Poor Mental Health Days",
            description: "Average unhealthy days in past 30.",
            interpretation: "Reflects community strain.",
            christianConcern: "Encourage care and connection."
        },
        abortion_rate_state: {
            title: "State Abortion Rate",
            description: "Number of abortions per 1,000 women (State Level).",
            interpretation: "Higher rates indicate more lives lost.",
            christianConcern: "Support pro-life and pro-love ministries."
        },
        total_abortions_state: {
            title: "Total State Abortions",
            description: "Total annual abortions (State Level).",
            interpretation: "Reflects scale of the issue.",
            christianConcern: "Each number is a life. Support adoption and crisis care."
        }
    };

    // Get Involved Content
    const getInvolvedContent: Record<string, GetInvolvedContent> = {
        evangelical_congregations_per_10k: {
            category: 'The Church',
            christianResponse: 'The Great Commission is local. Low adherence means neighbors are "sheep without a shepherd".',
            actions: {
                pray: 'Pray for local pastors to be bold and neighbors hearts to open.',
                serve: 'Ask your pastor how to support a local church plant.',
                support: 'Send an encouragement card to a local church planter.',
                engage: 'Invite a neighbor to dinner.'
            }
        },
        // Mapped to multiple keys for safety
        evangelical_adherents_per_1k: {
            category: 'The Church',
            christianResponse: 'The Great Commission is local. Low adherence means neighbors are "sheep without a shepherd".',
            actions: {
                pray: 'Pray for local pastors to be bold.',
                serve: 'Support a local church plant.',
                support: 'Encourage a church planter.',
                engage: 'Share the gospel with a neighbor.'
            }
        },
        food_insecurity_rate: {
            category: 'Food',
            christianResponse: 'Feeding the hungry is feeding Jesus (Matthew 25:35).',
            actions: {
                pray: 'Pray for neighbors who are hungry.',
                serve: 'Volunteer at a food pantry.',
                support: 'Organize a food drive.',
                engage: 'Support backpack ministries.'
            }
        },
        free_reduced_lunch_pct: {
            category: 'Food',
            christianResponse: 'Feeding the hungry is feeding Jesus (Matthew 25:35).',
            actions: {
                pray: 'Pray for hungry children daily.',
                serve: 'Volunteer at a food pantry.',
                support: 'Organize a food drive.',
                engage: 'Support backpack ministries.'
            }
        },
        homelessness_per_10k: {
            category: 'Environment',
            christianResponse: 'The unhoused are made in God\'s image. Offer dignity and care.',
            actions: {
                pray: 'Pray for the unhoused by name.',
                serve: 'Make "care kits" for your car.',
                support: 'Volunteer at a shelter.',
                engage: 'Support transitional housing ministries.'
            }
        },
        segregation_index_bw: {
            category: 'Environment',
            christianResponse: 'God\'s Kingdom is every nation and tribe. We are ambassadors of reconciliation.',
            actions: {
                pray: 'Pray for repentance and reconciliation.',
                serve: 'Build friendships across racial lines.',
                support: 'Encourage partnership between diverse churches.',
                engage: 'Learn your community\'s history.'
            }

        },
        abortion_rate_state: {
            category: 'Children',
            christianResponse: 'Every life is precious. We must be pro-life and pro-love.',
            actions: {
                pray: 'Pray for an end to abortion and for women in crisis.',
                serve: 'Volunteer at a Crisis Pregnancy Center.',
                support: 'Support foster care and adoption.',
                engage: 'Throw a baby shower for a mom in need.'
            }
        },
        // Generic fallbacks for others can be added or handled in UI
    };

    // Helpers
    const handleGetInvolvedClick = (indicatorKey: string) => {
        // Fallback mapping if exact key missing
        let key = indicatorKey;
        if (!getInvolvedContent[key]) {
            // Simple fallback logic or default
            if (key.includes('poverty') || key.includes('income')) key = 'food_insecurity_rate'; // Map poverty to food/mercy
            else if (key.includes('mental') || key.includes('suicide') || key.includes('drug')) key = 'homelessness_per_10k'; // Map mental to mercy/care
        }

        setSelectedIndicatorKey(key);
        setShowGetInvolvedModal(true);
    };

    const hasGetInvolvedContent = (_key: string) => {
        // loose check including fallbacks
        return true;
    };

    const formatValue = (key: string, value: number): string => {
        if (typeof value !== 'number') return 'N/A';
        if (key.includes('rate') || key.includes('pct')) {
            if (value < 1 && key !== 'segregation_index_bw') return `${(value * 100).toFixed(1)}%`;
            if (value > 1 && value <= 100) return `${value.toFixed(1)}%`;
        }
        if (key.includes('income')) return `$${Math.round(value).toLocaleString()}`;
        return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    };

    const getConcernColor = (level: ConcernLevel): string => {
        switch (level) {
            case 'severe': return 'border-qc-error bg-qc-error-bg text-qc-error-text';
            case 'high': return 'border-qc-warning bg-qc-warning-bg text-qc-warning-text';
            case 'moderate': return 'border-qc-warning-border bg-qc-warning-bg text-qc-warning-text';
            default: return 'border-qc-border-subtle bg-qc-surface-raised';
        }
    };

    const getPercentileColor = (percentile: number): string => {
        if (percentile >= 90) return 'text-qc-error bg-qc-error-bg border-qc-error-border';
        if (percentile >= 80) return 'text-qc-warning-text bg-qc-warning-bg border-qc-warning-border';
        if (percentile >= 65) return 'text-qc-warning-text bg-qc-warning-bg border-qc-warning-border';
        return 'text-qc-success-text bg-qc-success-bg border-qc-success-border';
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label htmlFor="state-select" className="block text-sm font-medium text-qc-charcoal mb-1">Select State</label>
                    <div className="relative">
                        <select
                            id="state-select"
                            className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none bg-white focus:ring-qc-primary focus:border-qc-primary"
                            value={selectedState}
                            onChange={(e) => {
                                setSelectedState(e.target.value);
                                setSelectedCounty(null);
                            }}
                        >
                            <option value="">Choose a state...</option>
                            {initialStates.map((state) => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-qc-charcoal">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="county-select" className="block text-sm font-medium text-qc-charcoal mb-1">Select County</label>
                    <div className="relative">
                        <select
                            id="county-select"
                            className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none bg-white focus:ring-qc-primary focus:border-qc-primary disabled:bg-qc-surface-raised"
                            value={selectedCounty?.ids?.fips || ''}
                            onChange={(e) => {
                                const county = countiesInState.find(c => c.ids?.fips === e.target.value);
                                setSelectedCounty(county || null);
                            }}
                            disabled={!selectedState || loadingCounties}
                        >
                            <option value="">
                                {loadingCounties ? 'Loading counties...' : selectedState ? 'Choose a county...' : 'Select a state first'}
                            </option>
                            {countiesInState.map((county, idx) => (
                                <option key={`${county.State}-${county.County}-${idx}`} value={county.ids?.fips}>
                                    {county.County}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-qc-charcoal">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {selectedCounty && (
                <div className="bg-white rounded-xl shadow-sm border border-qc-border-subtle p-6 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="mb-8 pb-6 border-b border-qc-border-subtle">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold text-qc-primary font-display text-balance">
                                    {selectedCounty.County}, {selectedCounty.State}
                                </h2>
                                <div className="text-qc-text-muted mt-1 flex items-center gap-4">
                                    <span>Population: {selectedCounty.population?.total?.toLocaleString() || 'N/A'}</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Key Concerns Summary */}
                    {selectedCounty.issues?.concerns && selectedCounty.issues.concerns.length > 0 && (
                        <div className="mb-10">
                            <h3 className="text-lg font-semibold mb-4 flex items-center text-qc-primary">
                                <Warning className="mr-2 text-qc-error" weight="fill" /> Key Concerns
                            </h3>
                            <div className="grid gap-3">
                                {selectedCounty.issues.concerns.map((concern, idx) => (
                                    <ConcernCard
                                        key={concern.key || idx}
                                        concern={concern}
                                        indicatorIcons={indicatorIcons}
                                        formatValue={formatValue}
                                        getConcernColor={getConcernColor}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Data Tabs */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 text-qc-primary">Detailed Data</h3>
                        <CountyDataTabs
                            selectedCounty={selectedCounty}
                            indicatorIcons={indicatorIcons}
                            indicatorDescriptions={indicatorDescriptions}
                            formatValue={formatValue}
                            getPercentileColor={getPercentileColor}
                            onGetInvolvedClick={handleGetInvolvedClick}
                            hasGetInvolvedContent={hasGetInvolvedContent}
                        />
                    </div>
                </div>
            )}

            {/* Get Involved Modal */}
            <Dialog open={showGetInvolvedModal} onOpenChange={setShowGetInvolvedModal}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-serif text-qc-primary">Get Involved</DialogTitle>
                        <DialogDescription>
                            Practical ways to pray and serve your neighbors.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedIndicatorKey && (getInvolvedContent[selectedIndicatorKey] || getInvolvedContent['food_insecurity_rate']) && (
                        <div className="space-y-6 mt-4">
                            {/* Grace Note */}
                            <div className="bg-qc-warning-bg rounded-lg p-4 border border-qc-warning-border">
                                <h4 className="font-serif font-bold text-qc-warning-text mb-2">A Note on Grace</h4>
                                <div className="text-sm text-qc-warning-text space-y-2">
                                    <p>Dear family, you are not the Savior. You <em>have</em> a Savior.</p>
                                    <p>As you look at these needs, do not let your heart be filled with guilt. Let it be softened with compassion. You cannot do everything, but by God&apos;s grace, your family can do <em>something</em>.</p>
                                </div>
                            </div>

                            {/* Christian Response */}
                            <div>
                                <h4 className="font-bold text-qc-primary mb-2">Christian Response</h4>
                                <p className="text-qc-text leading-relaxed">
                                    {(getInvolvedContent[selectedIndicatorKey] || getInvolvedContent['food_insecurity_rate']).christianResponse}
                                </p>
                            </div>

                            {/* Actions Grid */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="p-4 bg-qc-info-bg rounded-lg border border-qc-info-border">
                                    <h5 className="font-bold text-qc-info-text mb-1">Pray</h5>
                                    <p className="text-sm text-qc-info-text">{(getInvolvedContent[selectedIndicatorKey] || getInvolvedContent['food_insecurity_rate']).actions.pray}</p>
                                </div>
                                <div className="p-4 bg-qc-success-bg rounded-lg border border-qc-success-border">
                                    <h5 className="font-bold text-qc-success-text mb-1">Serve</h5>
                                    <p className="text-sm text-qc-success-text">{(getInvolvedContent[selectedIndicatorKey] || getInvolvedContent['food_insecurity_rate']).actions.serve}</p>
                                </div>
                                <div className="p-4 bg-qc-info-bg rounded-lg border border-qc-info-border">
                                    <h5 className="font-bold text-qc-info-text mb-1">Support</h5>
                                    <p className="text-sm text-qc-info-text">{(getInvolvedContent[selectedIndicatorKey] || getInvolvedContent['food_insecurity_rate']).actions.support}</p>
                                </div>
                                <div className="p-4 bg-qc-warning-bg rounded-lg border border-qc-warning-border">
                                    <h5 className="font-bold text-qc-warning-text mb-1">Engage</h5>
                                    <p className="text-sm text-qc-warning-text">{(getInvolvedContent[selectedIndicatorKey] || getInvolvedContent['food_insecurity_rate']).actions.engage}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
