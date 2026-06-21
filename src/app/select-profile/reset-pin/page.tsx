import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { verifyPinResetToken } from "@/lib/profile-pin-reset-token";
import { ResetPinConfirm } from "./ResetPinConfirm";

function authSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not set");
  return s;
}

/** Verify the token + bind it to the current login/org. Kept out of the component render body so the
 *  `Date.now()` read isn't an impure call during render. */
async function isResetTokenValid(
  token: string | undefined,
  userId: string,
  organizationId: string | null,
): Promise<boolean> {
  if (!token) return false;
  const claims = await verifyPinResetToken(token, authSecret(), Date.now());
  return !!claims && claims.uid === userId && claims.org === organizationId;
}

/**
 * Owner-PIN reset landing page (the link emailed by `requestOwnerPinReset`). Nested under
 * `/select-profile` so the proxy lets a profile-less (locked-out) owner reach it — `isSelectProfilePath`
 * allows `/select-profile/*` with no active profile. This page only VALIDATES the token; the actual
 * PIN clear happens via the explicit button (a server action), so an email prefetch/scanner GET can't
 * consume it.
 */
export default async function ResetPinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  let userId: string;
  let organizationId: string | null;
  try {
    ({ userId, organizationId } = await getCurrentUserOrg());
  } catch {
    redirect("/login");
  }

  const { token } = await searchParams;
  const valid = await isResetTokenValid(token, userId, organizationId);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-qc-parchment px-4 text-center">
      <div className="w-full max-w-md rounded-qc-md border border-qc-border-subtle bg-white p-8 shadow-qc-sm">
        <h1 className="font-display text-3xl font-medium text-qc-charcoal mb-3">Reset parent PIN</h1>
        {valid ? (
          <>
            <p className="text-qc-text-muted mb-6">
              This clears your parent profile&apos;s PIN. You can set a new one from Manage Profiles afterward.
            </p>
            <ResetPinConfirm token={token as string} />
          </>
        ) : (
          <>
            <p className="text-qc-text-muted mb-6">
              This reset link is invalid or has expired. Reset links are valid for 15 minutes — request a new
              one from the profile picker.
            </p>
            <Link href="/select-profile" className="text-qc-primary underline underline-offset-4">
              Back to profiles
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
