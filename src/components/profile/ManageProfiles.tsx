"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockSimple } from "@phosphor-icons/react";
import { getStudentAvatarUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setProfilePin, removeProfilePin } from "@/server/profiles/pin-actions";
import type { ProfileCard } from "@/server/profiles/profile-card";

export function ManageProfiles({ profiles }: { profiles: ProfileCard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pinFor, setPinFor] = useState<ProfileCard | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openSetPin(p: ProfileCard) {
    setPin("");
    setError(null);
    setPinFor(p);
  }

  function submitPin() {
    if (!pinFor || pin.length !== 4) return;
    setError(null);
    const target = pinFor;
    startTransition(async () => {
      const res = await setProfilePin(target.id, pin);
      if (res.ok) {
        setPinFor(null);
        toast.success(`PIN ${target.hasPin ? "changed" : "set"} for ${target.displayName}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(p: ProfileCard) {
    startTransition(async () => {
      const res = await removeProfilePin(p.id);
      if (res.ok) {
        toast.success(`PIN removed for ${p.displayName}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-qc-parchment px-4 py-16">
      <h1 className="font-display text-4xl font-medium text-qc-charcoal mb-2 text-center">Manage Profiles</h1>
      <p className="text-qc-text-muted mb-10 text-center">Set, change, or remove a profile&apos;s 4-digit PIN.</p>

      <div className="w-full max-w-xl space-y-3">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-qc-lg border border-qc-border-subtle bg-qc-surface px-4 py-3 shadow-qc-sm"
          >
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={getStudentAvatarUrl(p.displayName, p.avatarConfig)} alt={p.displayName} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-qc-parchment-crumpled text-qc-primary font-bold">
                {p.displayName?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-medium text-qc-charcoal truncate">{p.displayName}</div>
              <div className="text-xs text-qc-text-muted flex items-center gap-1">
                {p.type}
                {p.hasPin && (
                  <span className="inline-flex items-center gap-1 text-qc-primary">
                    · <LockSimple className="h-3 w-3" weight="fill" /> PIN set
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => openSetPin(p)} disabled={pending}>
                {p.hasPin ? "Change PIN" : "Set PIN"}
              </Button>
              {p.hasPin && (
                <Button variant="ghost" size="sm" onClick={() => remove(p)} disabled={pending} className="text-qc-error">
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link href="/" className="mt-10 text-qc-primary underline underline-offset-4">
        Done
      </Link>

      <Dialog
        open={pinFor != null}
        onOpenChange={(open) => {
          if (!open) {
            setPinFor(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pinFor?.hasPin ? "Change" : "Set"} PIN for {pinFor?.displayName}</DialogTitle>
            <DialogDescription>Enter a 4-digit PIN. They&apos;ll need it to select this profile.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPin();
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-qc-error">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPinFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitPin} disabled={pending || pin.length !== 4}>
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
