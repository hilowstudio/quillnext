"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { confirmOwnerPinReset } from "@/server/profiles/pin-reset";

/** The explicit confirm step for an owner PIN reset — the button click is what actually clears the PIN. */
export function ResetPinConfirm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmOwnerPinReset(token);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-qc-charcoal">
          Your parent PIN has been cleared. Set a new one from Manage Profiles.
        </p>
        <Link href="/select-profile" className="text-qc-primary underline underline-offset-4">
          Back to profiles
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={confirm} disabled={pending}>
        {pending ? "Clearing…" : "Clear my parent PIN"}
      </Button>
      {error && <p className="text-sm text-qc-error">{error}</p>}
    </div>
  );
}
