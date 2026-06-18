"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    House,
    Users,
    BookOpen,
    Heart,
    Student,
    ChalkboardTeacher,
    X,
    List,
    Lightbulb,
    Sparkle
} from "@phosphor-icons/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SessionTimer } from "@/components/layout/SessionTimer";
import { useState } from "react";

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: House },
    { href: "/students", label: "Students", icon: Student },
    { href: "/courses", label: "Courses", icon: ChalkboardTeacher },
    { href: "/living-library", label: "Living Library", icon: BookOpen },
    { href: "/creation-station", label: "Creation Station", icon: Sparkle },
    { href: "/thinkling", label: "Thinkling Chat", icon: Lightbulb },
    { href: "/family-discipleship", label: "Discipleship", icon: Heart },
];




import { UserNav } from "@/components/navigation/UserNav";
import { User } from "next-auth";
import { switchProfile } from "@/app/select-profile/actions";

interface SidebarProps {
    user?: User;
}

export function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* Mobile Trigger */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <Button variant="outline" size="icon" onClick={() => setMobileOpen(!mobileOpen)} className="bg-white/90 backdrop-blur shadow-sm">
                    {mobileOpen ? <X /> : <List />}
                </Button>
            </div>

            {/* Desktop Sidebar & Mobile Drawer */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 bg-qc-parchment border-r border-qc-border-subtle transform transition-transform duration-300 ease-in-out lg:translate-x-0",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col">
                    {/* Logo Area */}
                    <div className="flex items-center px-4 py-4 border-b border-qc-border-subtle/50">
                        <Link href="/" className="flex items-center gap-2 w-full">
                            <Image
                                src="/assets/branding/Quill-and-Compass.png"
                                alt="Quill & Compass"
                                width={220}
                                height={60}
                                className="w-full h-auto object-contain"
                            />
                        </Link>
                    </div>



                    {/* Nav Items */}
                    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-qc-md text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-qc-primary/10 text-qc-primary"
                                            : "text-qc-text-muted hover:bg-qc-primary/5 hover:text-qc-charcoal"
                                    )}
                                >
                                    <Icon className={cn("w-5 h-5", isActive ? "weight-fill" : "")} weight={isActive ? "fill" : "regular"} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer Area */}
                    <div className="border-t border-qc-border-subtle/50 p-4 space-y-4">
                        <SessionTimer />
                        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-qc-text-muted">
                            <Link href="/about" className="hover:text-qc-primary transition-colors">About</Link>
                            <Link href="/changelog" className="hover:text-qc-primary transition-colors">Changelog</Link>
                            <Link href="/privacy" className="hover:text-qc-primary transition-colors">Privacy</Link>
                            <Link href="/terms" className="hover:text-qc-primary transition-colors">Terms</Link>
                            <a href="mailto:adam@quillandcompass.app" className="hover:text-qc-primary transition-colors">Feedback</a>
                        </div>

                        {user && (
                            <div className="pt-2 border-t border-qc-border-subtle/30">
                                <div className="flex items-center gap-3 px-2">
                                    <UserNav user={user} />
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate text-qc-charcoal">{user.name}</span>
                                        <span className="text-xs text-qc-text-muted truncate">{user.email}</span>
                                    </div>
                                </div>
                                <form action={switchProfile} className="mt-3 px-2">
                                    <button
                                        type="submit"
                                        className="w-full text-left text-sm font-medium text-qc-text-muted hover:text-qc-primary transition-colors"
                                    >
                                        Switch Profile
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/20 lg:hidden backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}
        </>
    );
}
