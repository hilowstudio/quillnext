import type { ProfileType } from "@/lib/active-profile-cookie";

export type ProfileViewMode = "STANDARD" | "KID";

/** A profile as shown in the picker. Deliberately has NO pinHash — only `hasPin`. */
export type ProfileCard = {
  id: string;
  type: ProfileType;
  displayName: string;
  avatarConfig: unknown;
  viewMode: ProfileViewMode;
  isOwner: boolean;
  hasPin: boolean;
};

/** Row shape read from the DB (server-side only). */
export type ProfileRow = Omit<ProfileCard, "hasPin"> & { pinHash: string | null };

/** Pure mapper: strip the hash, expose only whether a PIN is set. The hash never leaves the server. */
export function toProfileCard(row: ProfileRow): ProfileCard {
  const { pinHash, ...rest } = row;
  return { ...rest, hasPin: pinHash != null };
}
