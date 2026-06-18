"use client";

import { useState, useTransition } from "react";
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
import { selectProfile } from "@/app/select-profile/actions";
import type { ProfileCard } from "@/server/profiles/profile-card";

export function ProfilePicker({ profiles }: { profiles: ProfileCard[] }) {
  const [pending, startTransition] = useTransition();
  const [pinFor, setPinFor] = useState<ProfileCard | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function choose(p: ProfileCard) {
    setError(null);
    if (p.hasPin) {
      setPin("");
      setPinFor(p);
      return;
    }
    startTransition(async () => {
      const res = await selectProfile(p.id); // redirects on success; returns only on failure
      if (res && !res.ok) setError(res.error);
    });
  }

  function submitPin() {
    if (!pinFor || pin.length !== 4) return;
    setError(null);
    const target = pinFor;
    startTransition(async () => {
      const res = await selectProfile(target.id, pin);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-qc-parchment px-4 py-16">
      <h1 className="font-display text-4xl md:text-5xl font-medium text-qc-charcoal mb-12 text-center">
        Who&apos;s learning today?
      </h1>

      <div className="flex flex-wrap justify-center gap-10 max-w-4xl">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p)}
            disabled={pending}
            className="group flex flex-col items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="relative h-28 w-28 rounded-full overflow-hidden ring-4 ring-white shadow-lg group-hover:ring-qc-primary/30 group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
              <Avatar className="h-full w-full">
                <AvatarImage
                  src={getStudentAvatarUrl(p.displayName, p.avatarConfig)}
                  alt={p.displayName}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-4xl font-bold bg-qc-parchment-crumpled text-qc-primary">
                  {p.displayName?.[0] ?? "?"}
                </AvatarFallback>
              </Avatar>
              {p.hasPin && (
                <span className="absolute bottom-1 right-1 rounded-full bg-white/90 p-1 shadow">
                  <LockSimple className="h-4 w-4 text-qc-primary" weight="fill" />
                </span>
              )}
            </div>
            <span className="font-display text-xl font-medium text-qc-charcoal group-hover:text-qc-primary transition-colors">
              {p.displayName}
            </span>
          </button>
        ))}
      </div>

      {error && pinFor == null && <p className="mt-6 text-sm text-qc-error">{error}</p>}

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
            <DialogTitle>Enter {pinFor?.displayName}&apos;s PIN</DialogTitle>
            <DialogDescription>This profile is protected by a 4-digit PIN.</DialogDescription>
          </DialogHeader>
          <Input
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
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
