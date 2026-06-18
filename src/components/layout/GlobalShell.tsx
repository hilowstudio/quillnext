"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { User } from "next-auth";

interface GlobalShellProps {
    children: React.ReactNode;
    user?: User;
}

/** Routes that render their OWN full-screen shell (no app sidebar). */
const CHROMELESS_PREFIXES = ["/select-profile"];

export function GlobalShell({ children, user }: GlobalShellProps) {
    const pathname = usePathname();
    const chromeless = CHROMELESS_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
    );

    if (chromeless) {
        return <div className="min-h-screen">{children}</div>;
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar user={user} />
            <main className="flex-1 lg:ml-64 transition-all duration-300">
                <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
