/**
 * Pure, server-safe helpers for deriving "online" status from a user's
 * last-seen timestamp. No Prisma / DB imports — safe to reuse from
 * Server Components and (if ever needed) client components alike.
 *
 * Platform parity: Platform/app/Models/User.php:67-74 derives `is_online`
 * from `last_login_at.diffInMinutes(now()) < 5`. Immo tracks a continuous
 * `lastSeenAt` heartbeat (see getSession() in src/lib/auth.ts), which is
 * the semantically better signal for "active right now", so we use it
 * here while keeping the same 5-minute threshold.
 */

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Returns true when `lastSeenAt` falls within the last 5 minutes.
 * Pass `now` to keep callers deterministic in tests; defaults to Date.now().
 */
export function isOnline(
  user: { lastSeenAt: Date | null },
  now: number = Date.now(),
): boolean {
  if (!user.lastSeenAt) return false;
  return now - user.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}
