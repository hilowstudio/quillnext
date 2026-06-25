"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/user-actions";
import { exportUserData } from "@/app/actions/data-export";
import { deactivateAccount, deleteAccount } from "@/app/actions/account-actions";
import { signOut } from "next-auth/react";
import { User } from "next-auth";

interface ProfileSettingsDialogProps {
    user: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({
    user,
    open,
    onOpenChange,
}: ProfileSettingsDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(user.name || "");
    const [image, setImage] = useState(user.image || "");
    const [isExporting, setIsExporting] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await updateProfile({ name, image });
            if (result.success) {
                toast.success("Profile updated successfully");
                onOpenChange(false);
            } else {
                toast.error(result.error || "Failed to update profile");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const result = await exportUserData();
            if (result.success && result.data) {
                const blob = new Blob(
                    [JSON.stringify(result.data, null, 2)],
                    { type: "application/json" }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `quillnext-export-${new Date().toISOString().split("T")[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Data exported successfully");
            } else {
                toast.error(result.error || "Failed to export data");
            }
        } catch {
            toast.error("An error occurred during export");
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeactivate = async () => {
        setIsDeactivating(true);
        try {
            const result = await deactivateAccount();
            if (result.success) {
                toast.success("Account deactivated");
                await signOut({ callbackUrl: "/login" });
            } else {
                toast.error(result.error || "Failed to deactivate account");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeactivating(false);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirmText !== "DELETE") return;
        setIsDeleting(true);
        try {
            const result = await deleteAccount();
            if (result.success) {
                toast.success("Account deleted permanently");
                await signOut({ callbackUrl: "/login" });
            } else {
                toast.error(result.error || "Failed to delete account");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Account Settings</DialogTitle>
                    <DialogDescription>
                        Manage your profile, security, and data.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="security">Security</TabsTrigger>
                        <TabsTrigger value="data">Data &amp; Privacy</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-4 py-4">
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Display Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your Name"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="image">Profile Image URL</Label>
                                <Input
                                    id="image"
                                    value={image}
                                    onChange={(e) => setImage(e.target.value)}
                                    placeholder="https://..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste a URL for your profile picture.
                                </p>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-4 py-4">
                        <div className="space-y-4">
                            <div className="rounded-md bg-qc-warning-bg p-4 border border-qc-warning-border">
                                <p className="text-sm text-qc-warning-text">
                                    <strong>Note:</strong> Your account is managed via Google Authentication.
                                    Please change your password through your Google Account settings.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    value={user.email || ""}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Email updates are currently disabled.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    disabled
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="data" className="space-y-6 py-4">
                        {/* Export Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-qc-charcoal">
                                Export Your Data
                            </h3>
                            <p className="text-xs text-qc-text-muted">
                                Download all your data as a JSON file. Includes students,
                                courses, library, journals, transcripts, and settings.
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="w-full"
                            >
                                {isExporting ? "Preparing export..." : "Export All Data (JSON)"}
                            </Button>
                        </div>

                        {/* Deactivation Section */}
                        <div className="space-y-3 border-t border-qc-border-subtle pt-4">
                            <h3 className="text-sm font-semibold text-qc-charcoal">
                                Pause Account
                            </h3>
                            <p className="text-xs text-qc-text-muted">
                                Temporarily deactivate your account. Your data is preserved
                                and you can reactivate at any time by signing back in.
                            </p>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="w-full">
                                        Deactivate Account
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Deactivate your account?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Your account will be paused and your data will be preserved.
                                            You can reactivate by signing back in at any time.
                                            No data will be deleted.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeactivate}
                                            disabled={isDeactivating}
                                        >
                                            {isDeactivating ? "Deactivating..." : "Deactivate"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        {/* Deletion Section */}
                        <div className="space-y-3 border-t border-qc-error-border/30 pt-4">
                            <h3 className="text-sm font-semibold text-qc-error-text">
                                Delete Account
                            </h3>
                            <p className="text-xs text-qc-text-muted">
                                Permanently delete your account and all associated data.
                                This action cannot be undone. We recommend exporting your
                                data first.
                            </p>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="w-full border-qc-error-border text-qc-error-text hover:bg-qc-error-bg">
                                        Delete Account Permanently
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Permanently delete your account?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="space-y-3">
                                                <p>
                                                    This will permanently destroy all your data, including:
                                                </p>
                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                    <li>All students and their learning profiles</li>
                                                    <li>All courses and curriculum</li>
                                                    <li>Library resources (books, videos, documents)</li>
                                                    <li>Prayer journals, Bible memory, devotionals</li>
                                                    <li>Transcripts and assessment records</li>
                                                    <li>Your account and organization</li>
                                                </ul>
                                                <p>
                                                    Deletion is immediate and permanent. Data will be fully
                                                    purged from backups within 30 days.
                                                </p>
                                                <div className="pt-2">
                                                    <Label htmlFor="delete-confirm" className="text-sm font-medium">
                                                        Type DELETE to confirm
                                                    </Label>
                                                    <Input
                                                        id="delete-confirm"
                                                        value={deleteConfirmText}
                                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                        placeholder="DELETE"
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            disabled={isDeleting || deleteConfirmText !== "DELETE"}
                                            className="bg-qc-error-text hover:bg-qc-error-text/90"
                                        >
                                            {isDeleting ? "Deleting..." : "Delete Forever"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </TabsContent>
                </Tabs>
                <div className="mt-2 pt-4 border-t border-qc-border-subtle flex justify-end">
                    <Button
                        variant="outline"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="border-qc-error-border text-qc-error-text hover:bg-qc-error-bg"
                    >
                        Sign Out
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
