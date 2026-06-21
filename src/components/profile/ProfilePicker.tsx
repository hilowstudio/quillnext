"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockSimple, PencilSimple } from "@phosphor-icons/react";
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
import { AvatarCustomizer } from "@/components/profile/AvatarCustomizer";
import { selectProfile, enterProfileManagement, enterAssessment } from "@/app/select-profile/actions";
import { verifyProfilePin } from "@/server/profiles/pin-actions";
import { requestOwnerPinReset, resetChildPinWithParentPin } from "@/server/profiles/pin-reset";
import { setProfileAvatar } from "@/server/profiles/avatar-actions";
import type { ProfileCard } from "@/server/profiles/profile-card";
import type { PendingAssessments } from "@/server/queries/students";

export function ProfilePicker({
  profiles,
  pendingAssessments,
}: {
  profiles: ProfileCard[];
  pendingAssessments: PendingAssessments;
}) {
  const [pending, startTransition] = useTransition();
  const [pinFor, setPinFor] = useState<ProfileCard | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [managePin, setManagePin] = useState("");
  const [manageError, setManageError] = useState<string | null>(null);
  const [avatarFor, setAvatarFor] = useState<ProfileCard | null>(null);
  const [avatarPinFor, setAvatarPinFor] = useState<ProfileCard | null>(null);
  const [avatarPin, setAvatarPin] = useState("");
  const [avatarPinError, setAvatarPinError] = useState<string | null>(null);
  const [assessFor, setAssessFor] = useState<{ id: string; name: string } | null>(null);
  const [assessPin, setAssessPin] = useState("");
  const [assessError, setAssessError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [childResetFor, setChildResetFor] = useState<ProfileCard | null>(null);
  const [childResetPin, setChildResetPin] = useState("");
  const [childResetError, setChildResetError] = useState<string | null>(null);
  const router = useRouter();
  const owner = profiles.find((p) => p.isOwner);

  // Emails the owner a single-use link to clear a forgotten parent PIN (Q-05-010). Recovery is
  // gated by the owner's own inbox, since the shared family login can't prove owner-vs-student.
  function requestReset() {
    setResetError(null);
    startTransition(async () => {
      const res = await requestOwnerPinReset();
      if (res.ok) setResetSent(true);
      else setResetError(res.error);
    });
  }

  // A locked-out CHILD: the parent clears the child's PIN by entering the parent PIN (the parent is the
  // authority above the child — no email needed). If the owner has no PIN, reset directly.
  function startChildReset(child: ProfileCard) {
    setError(null);
    setPinFor(null); // close the child's PIN prompt
    setChildResetError(null);
    if (owner?.hasPin) {
      setChildResetPin("");
      setChildResetFor(child);
      return;
    }
    startTransition(async () => {
      const res = await resetChildPinWithParentPin(child.id);
      if (res.ok) {
        toast.success(`PIN reset for ${child.displayName}.`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function submitChildReset() {
    if (!childResetFor || childResetPin.length !== 4) return;
    setChildResetError(null);
    const target = childResetFor;
    startTransition(async () => {
      const res = await resetChildPinWithParentPin(target.id, childResetPin);
      if (res.ok) {
        setChildResetFor(null);
        toast.success(`PIN reset for ${target.displayName}. They can select their profile now.`);
        router.refresh();
      } else {
        setChildResetError(res.error);
      }
    });
  }

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

  function startManage() {
    setManageError(null);
    if (owner?.hasPin) {
      setManagePin("");
      setManageOpen(true);
      return;
    }
    startTransition(async () => {
      const res = await enterProfileManagement(); // redirects to /manage-profiles on success
      if (res && !res.ok) setManageError(res.error);
    });
  }

  function submitManage() {
    if (managePin.length !== 4) return;
    setManageError(null);
    startTransition(async () => {
      const res = await enterProfileManagement(managePin);
      if (res && !res.ok) setManageError(res.error);
    });
  }

  // "Assess …" is a PARENT action, but the picker has no active profile — so gate into the owner
  // PARENT (PIN if set) first, then enterAssessment redirects to the assessment page.
  function startAssess(s: { id: string; firstName: string; preferredName: string | null }) {
    setAssessError(null);
    const target = { id: s.id, name: s.preferredName || s.firstName };
    if (owner?.hasPin) {
      setAssessPin("");
      setAssessFor(target);
      return;
    }
    startTransition(async () => {
      const res = await enterAssessment(target.id);
      if (res && !res.ok) setAssessError(res.error);
    });
  }

  function submitAssess() {
    if (!assessFor || assessPin.length !== 4) return;
    setAssessError(null);
    const target = assessFor;
    startTransition(async () => {
      const res = await enterAssessment(target.id, assessPin);
      if (res && !res.ok) setAssessError(res.error);
    });
  }

  function startAvatarEdit(p: ProfileCard) {
    setAvatarPinError(null);
    if (p.hasPin) {
      setAvatarPin("");
      setAvatarPinFor(p);
    } else {
      setAvatarFor(p);
    }
  }

  function submitAvatarPin() {
    if (!avatarPinFor || avatarPin.length !== 4) return;
    const target = avatarPinFor;
    startTransition(async () => {
      const res = await verifyProfilePin(target.id, avatarPin);
      if (res.ok) {
        setAvatarPinFor(null);
        setAvatarFor(target); // open the customizer; avatarPin is held for the save
      } else {
        setAvatarPinError(res.error);
      }
    });
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-qc-parchment px-4 py-16">
      <h1 className="font-display text-4xl md:text-5xl font-medium text-qc-charcoal mb-12 text-center">
        Select a profile
      </h1>

      <div className="flex flex-wrap justify-center gap-10 max-w-4xl">
        {profiles.map((p) => (
          <div key={p.id} className="group relative flex flex-col items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => choose(p)}
                disabled={pending}
                aria-label={`Select ${p.displayName}`}
                className="block h-28 w-28 rounded-full overflow-hidden ring-4 ring-white shadow-lg group-hover:ring-qc-primary/30 group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
              >
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
              </button>
              {/* Lock badge — sibling of the clipped circle so it overflows uncut. */}
              {p.hasPin && (
                <span className="absolute -bottom-1 -right-1 z-10 rounded-full bg-white p-1.5 shadow ring-1 ring-qc-border-subtle">
                  <LockSimple className="h-4 w-4 text-qc-primary" weight="fill" />
                </span>
              )}
              {/* Edit this profile's avatar */}
              <button
                type="button"
                onClick={() => startAvatarEdit(p)}
                disabled={pending}
                aria-label={`Edit ${p.displayName}'s avatar`}
                className="absolute -top-1 -right-1 z-10 rounded-full bg-white p-1.5 shadow ring-1 ring-qc-border-subtle text-qc-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-qc-primary"
              >
                <PencilSimple className="h-4 w-4" />
              </button>
            </div>
            <span className="font-display text-xl font-medium text-qc-charcoal group-hover:text-qc-primary transition-colors">
              {p.displayName}
            </span>
          </div>
        ))}
      </div>

      {error && pinFor == null && <p className="mt-6 text-sm text-qc-error">{error}</p>}

      <button
        type="button"
        onClick={startManage}
        disabled={pending}
        className="mt-10 text-sm font-medium text-qc-text-muted hover:text-qc-primary transition-colors disabled:opacity-60"
      >
        Manage Profiles
      </button>
      {manageError && !manageOpen && <p className="mt-2 text-sm text-qc-error">{manageError}</p>}

      {owner?.hasPin && (
        <div className="mt-3 text-center">
          {resetSent ? (
            <p className="text-sm text-qc-text-muted">
              Check your email for a link to reset your parent PIN.
            </p>
          ) : (
            <button
              type="button"
              onClick={requestReset}
              disabled={pending}
              className="text-xs font-medium text-qc-text-muted hover:text-qc-primary transition-colors disabled:opacity-60"
            >
              Forgot your parent PIN?
            </button>
          )}
          {resetError && <p className="mt-1 text-sm text-qc-error">{resetError}</p>}
        </div>
      )}

      {pendingAssessments.total > 0 && (
        <div className="mt-10 w-full max-w-2xl rounded-qc-md border border-qc-warning-border bg-qc-warning-bg/80 p-4 text-center shadow-qc-sm backdrop-blur-sm">
          <p className="font-body text-sm font-medium text-qc-warning-text mb-1">Pending Assessments</p>
          <p className="font-body text-xs text-qc-warning-text mb-3">
            {pendingAssessments.total} student{pendingAssessments.total !== 1 ? "s need" : " needs"} personality assessment.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {pendingAssessments.students.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-white"
                disabled={pending}
                onClick={() => startAssess(s)}
              >
                Assess {s.preferredName || s.firstName}
              </Button>
            ))}
          </div>
          {assessError && assessFor == null && (
            <p className="mt-3 text-sm text-qc-error">{assessError}</p>
          )}
        </div>
      )}

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
          {pinFor?.type === "STUDENT" && (
            <button
              type="button"
              onClick={() => pinFor && startChildReset(pinFor)}
              disabled={pending}
              className="self-start text-xs font-medium text-qc-text-muted hover:text-qc-primary transition-colors disabled:opacity-60"
            >
              Forgot PIN? A parent can reset it.
            </button>
          )}
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

      {/* Parent-PIN-gated reset of a locked-out child's PIN (clears it). */}
      <Dialog
        open={childResetFor != null}
        onOpenChange={(open) => {
          if (!open) {
            setChildResetFor(null);
            setChildResetError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset {childResetFor?.displayName}&apos;s PIN</DialogTitle>
            <DialogDescription>
              Enter your parent PIN to clear {childResetFor?.displayName}&apos;s PIN. They&apos;ll be able to select their
              profile without one, and you can set a new PIN later in Manage Profiles.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={childResetPin}
            onChange={(e) => setChildResetPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitChildReset();
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {childResetError && <p className="text-sm text-qc-error">{childResetError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChildResetFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitChildReset} disabled={pending || childResetPin.length !== 4}>
              Reset PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageOpen}
        onOpenChange={(open) => {
          if (!open) {
            setManageOpen(false);
            setManageError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter your parent PIN</DialogTitle>
            <DialogDescription>Manage Profiles is protected by your parent profile&apos;s PIN.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={managePin}
            onChange={(e) => setManagePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManage();
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {manageError && <p className="text-sm text-qc-error">{manageError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitManage} disabled={pending || managePin.length !== 4}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assessFor != null}
        onOpenChange={(open) => {
          if (!open) {
            setAssessFor(null);
            setAssessError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter your parent PIN</DialogTitle>
            <DialogDescription>Completing {assessFor?.name}&apos;s assessment is a parent action.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={assessPin}
            onChange={(e) => setAssessPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAssess();
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {assessError && <p className="text-sm text-qc-error">{assessError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssessFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitAssess} disabled={pending || assessPin.length !== 4}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar edit — opens after the (optional) PIN check; avatarPin is held for the save. */}
      <AvatarCustomizer
        studentId={avatarFor?.id ?? ""}
        initialName={avatarFor?.displayName ?? "profile"}
        initialConfig={avatarFor?.avatarConfig}
        open={avatarFor != null}
        onOpenChange={(o) => {
          if (!o) setAvatarFor(null);
        }}
        onSave={async (config) => {
          if (!avatarFor) return { ok: false, error: "No profile selected." };
          const res = await setProfileAvatar(avatarFor.id, config, avatarFor.hasPin ? avatarPin : undefined);
          if (res.ok) router.refresh();
          return res;
        }}
      />

      <Dialog
        open={avatarPinFor != null}
        onOpenChange={(open) => {
          if (!open) {
            setAvatarPinFor(null);
            setAvatarPinError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter {avatarPinFor?.displayName}&apos;s PIN</DialogTitle>
            <DialogDescription>This profile is PIN-protected — enter the PIN to edit its avatar.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={avatarPin}
            onChange={(e) => setAvatarPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAvatarPin();
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {avatarPinError && <p className="text-sm text-qc-error">{avatarPinError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAvatarPinFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitAvatarPin} disabled={pending || avatarPin.length !== 4}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
