-- v1 parity: drop the v2-only `delivered` lifecycle node. Any row currently in
-- `delivered` is promoted to `completed` (carrying delivered_at as completedAt
-- when completedAt is null), then the enum value and column are dropped.
-- Pre-production, but the migration is written defensively for any envs that
-- already have data.

-- 1. Re-home any delivered rows to completed first so the enum swap below
--    doesn't fail to cast.
UPDATE "assignments"
SET
  "status" = 'completed',
  "completedAt" = COALESCE("completedAt", "deliveredAt")
WHERE "status" = 'delivered';

-- 2. Drop the `delivered` value by swapping the enum (Postgres doesn't allow
--    DROP VALUE).
BEGIN;
CREATE TYPE "AssignmentStatus_new" AS ENUM ('draft', 'awaiting', 'scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold');
ALTER TABLE "assignments" ALTER COLUMN "status" TYPE "AssignmentStatus_new" USING ("status"::text::"AssignmentStatus_new");
ALTER TYPE "AssignmentStatus" RENAME TO "AssignmentStatus_old";
ALTER TYPE "AssignmentStatus_new" RENAME TO "AssignmentStatus";
DROP TYPE "AssignmentStatus_old";
COMMIT;

-- 3. Now-orphan timestamp column.
ALTER TABLE "assignments" DROP COLUMN "deliveredAt";
