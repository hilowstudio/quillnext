"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkle, Hammer, Books, ArrowRight, Lightbulb } from "@phosphor-icons/react";

const navItems = [
    {
        href: "/creation-station",
        label: "Creation Station",
        description: "Generate lesson plans, activities, and quizzes instantly.",
        icon: Sparkle,
    },
    {
        href: "/courses",
        label: "Course Constructor",
        description: "Build comprehensive courses and organize curriculum.",
        icon: Hammer,
    },
    {
        href: "/thinkling",
        label: "Thinkling Chat",
        description: "Interact with Inkling directly as a subject tutor, research assistant, or college and career explorer.",
        icon: Lightbulb,
    },
    {
        href: "/living-library",
        label: "Living Library",
        description: "Manage books, videos, and educational resources.",
        icon: Books,
    },
];

export function InklingToolkit() {
    const pathname = usePathname();

    return (
        <div className="w-full">
            <div className="flex flex-col items-center justify-center gap-8 py-2">
                {/* Branding */}
                <div className="flex flex-col items-center justify-center gap-4">
                    <Image
                        src="/assets/branding/Inkling.png"
                        alt="Inkling Logo"
                        width={100}
                        height={100}
                        className="w-auto h-24 object-contain"
                    />
                    <span className="text-3xl font-display font-bold text-qc-charcoal">Inkling Toolkit</span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl px-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                        return (
                            <Link href={item.href} key={item.href} className="w-full">
                                <motion.div
                                    whileHover={{ y: -5 }}
                                    className={`
                                        h-full p-6 rounded-xl border-2 transition-all duration-300
                                        flex flex-col items-center text-center gap-4
                                        bg-white border-qc-border-subtle
                                        hover:shadow-lg hover:border-qc-primary/50
                                        ${isActive ? 'ring-2 ring-qc-primary ring-offset-2' : ''}
                                    `}
                                >
                                    <div className="p-4 rounded-full bg-qc-parchment shadow-sm text-qc-primary">
                                        <Icon size={32} />
                                    </div>

                                    <div>
                                        <h3 className="font-display text-lg font-bold text-qc-charcoal mb-2 text-balance">
                                            {item.label}
                                        </h3>
                                        <p className="text-sm text-qc-text-muted leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>

                                    <div className="mt-auto pt-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-qc-primary">
                                        Open Tool <ArrowRight size={12} />
                                    </div>
                                </motion.div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
