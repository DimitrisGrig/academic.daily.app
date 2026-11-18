/**
 * Parse the comma-separated blocked user IDs from the VITE_BLOCKED_CLERK_USER_IDS
 * environment variable into a Set for O(1) lookups.
 *
 * To block a new user simply add their clerk_id to the env variable, comma-separated.
 */
const raw = import.meta.env.VITE_BLOCKED_CLERK_USER_IDS ?? "";

export const BLOCKED_USER_IDS: ReadonlySet<string> = new Set(
  raw
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean)
);

export const isBlockedUser = (userId: string | null | undefined): boolean => {
  if (!userId) return false;
  return BLOCKED_USER_IDS.has(userId);
};
