"use client";

import { useState } from "react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStudentAvatarUrl } from "@/lib/utils";
import { ProfileSettingsDialog } from "./ProfileSettingsDialog";
import { switchProfile } from "@/app/select-profile/actions";
import { User } from "next-auth";

export type AccountMenuProfile = {
    displayName: string;
    avatarConfig: unknown;
    type: "PARENT" | "STUDENT";
};

interface AccountMenuProps {
    user: User;
    activeProfile: AccountMenuProfile;
}

/**
 * The sidebar's account section. Shows the ACTIVE PROFILE (avatar + name) and is the single way to
 * switch profiles. PARENT profiles also get Account Settings (which contains Sign Out) + Family
 * Blueprint; a STUDENT profile sees only Switch Profile.
 */
export function AccountMenu({ user, activeProfile }: AccountMenuProps) {
    const [showSettings, setShowSettings] = useState(false);
    const isParent = activeProfile.type === "PARENT";

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 w-full px-2 py-1.5 rounded-qc-md hover:bg-qc-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary">
                    <Avatar className="h-10 w-10 border border-qc-border-subtle shrink-0">
                        <AvatarImage
                            src={getStudentAvatarUrl(activeProfile.displayName, activeProfile.avatarConfig)}
                            alt={activeProfile.displayName}
                            referrerPolicy="no-referrer"
                        />
                        <AvatarFallback className="bg-qc-primary text-white font-medium">
                            {activeProfile.displayName?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden text-left">
                        <span className="text-sm font-medium truncate text-qc-charcoal">{activeProfile.displayName}</span>
                        <span className="text-xs text-qc-text-muted truncate">{isParent ? "Parent" : "Student"}</span>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel className="font-normal truncate">{activeProfile.displayName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void switchProfile()} className="cursor-pointer">
                        Switch Profile
                    </DropdownMenuItem>
                    {isParent && (
                        <>
                            <DropdownMenuItem onClick={() => setShowSettings(true)} className="cursor-pointer">
                                Account Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/context" className="w-full cursor-pointer">
                                    Family Blueprint
                                </Link>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {isParent && (
                <ProfileSettingsDialog user={user} open={showSettings} onOpenChange={setShowSettings} />
            )}
        </>
    );
}
