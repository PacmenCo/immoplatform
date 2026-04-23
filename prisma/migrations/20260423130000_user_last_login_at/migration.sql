-- Platform parity: `users.last_login_at` (Platform migration
-- 2025_06_19_211159_update_users_table_v1.php) — bumped only on successful
-- password login, distinct from the continuous `lastSeenAt` heartbeat.
-- `isOnline` is derived from `lastSeenAt` (see src/lib/userStatus.ts),
-- but we keep `lastLoginAt` as a separate signal for admin visibility
-- (e.g. "last signed in 3 days ago" vs "last active 2 min ago").
ALTER TABLE "users" ADD COLUMN "lastLoginAt" DATETIME;
