import React from 'react';
import Link from "next/link";
import {
    BookOpen,
    HandsPraying,
    GraduationCap,
    Quotes,
    UsersThree,
    GlobeHemisphereWest,
    HandHeart,
    Heartbeat,
    MagnifyingGlass
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface DiscipleshipDashboardProps {
    studentId?: string;
}

export const DiscipleshipDashboard = ({ studentId }: DiscipleshipDashboardProps) => {
    const baseRoute = '/family-discipleship';
    const querySuffix = studentId ? `?studentId=${studentId}` : '';

    const features = [
        {
            title: "Daily Devotionals",
            icon: BookOpen,
            href: `${baseRoute}/devotionals${querySuffix}`,
            description: "Morning & Evening readings",
            color: "text-qc-primary"
        },
        {
            title: "Prayer Journal",
            icon: HandsPraying,
            href: `${baseRoute}/prayer${querySuffix}`,
            description: "Track prayers and answers",
            color: "text-qc-primary"
        },
        {
            title: "Catechism",
            icon: GraduationCap,
            href: `${baseRoute}/catechism${querySuffix}`,
            description: "Foundational truths",
            color: "text-qc-primary"
        },
        {
            title: "Scripture Memory",
            icon: Quotes,
            href: `${baseRoute}/bible-memory${querySuffix}`,
            description: "Hide God's Word in your heart",
            color: "text-qc-primary"
        },
        {
            title: "Local Church",
            icon: UsersThree,
            href: `${baseRoute}/church${querySuffix}`,
            description: "Engage the body of Christ",
            color: "text-qc-primary"
        },
        {
            title: "Missions",
            icon: GlobeHemisphereWest,
            href: `${baseRoute}/missions${querySuffix}`,
            description: "Unreached peoples & nations",
            color: "text-qc-primary"
        },
        {
            title: "Neighbor Love",
            icon: HandHeart,
            href: `${baseRoute}/neighbor${querySuffix}`,
            description: "Engage with your community",
            color: "text-qc-primary"
        },
        {
            title: "Heart Check",
            icon: Heartbeat,
            href: `${baseRoute}/heart-check${querySuffix}`,
            description: "Bring your inner life outward",
            color: "text-qc-primary"
        },
        {
            title: "Bible Study",
            icon: MagnifyingGlass,
            href: `${baseRoute}/bible-study${querySuffix}`,
            description: "ESV Search & Classic Commentary",
            color: "text-qc-primary"
        }
    ];

    return (
        <section aria-label="Family discipleship suite" className="space-y-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
                <h1 className="text-4xl font-bold text-qc-primary font-display mb-3 text-balance">
                    Family Discipleship Suite
                    {studentId && <span className="block text-xl font-normal text-qc-text-muted mt-2">Student View</span>}
                </h1>
                <p className="text-lg text-qc-text-muted font-body qc-prose">
                    Tools to nurture faith, deepen understanding, and live out the Gospel at home.
                </p>
            </div>

            <nav aria-label="Discipleship tools" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature) => (
                    <Link
                        key={feature.title}
                        href={feature.href}
                        className="group relative bg-white rounded-xl border border-qc-border-subtle p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center overflow-hidden"
                    >
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                            <feature.icon className="w-32 h-32" />
                        </div>

                        <div className="mb-4 p-4 rounded-full bg-qc-parchment group-hover:bg-qc-secondary/10 transition-colors">
                            <feature.icon className={cn("w-8 h-8", feature.color)} weight="duotone" />
                        </div>

                        <h2 className="text-xl font-bold text-qc-primary font-display mb-2 group-hover:text-qc-secondary transition-colors text-balance">
                            {feature.title}
                        </h2>

                        <p className="text-sm text-qc-text-muted font-body leading-relaxed max-w-[200px]">
                            {feature.description}
                        </p>
                    </Link>
                ))}
            </nav>
        </section>
    );
};
