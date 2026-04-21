-- AlterTable
ALTER TABLE "assignments" ADD COLUMN "discountReason" TEXT;
ALTER TABLE "assignments" ADD COLUMN "discountType" TEXT;
ALTER TABLE "assignments" ADD COLUMN "discountValue" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assignment_services" (
    "assignmentId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("assignmentId", "serviceKey"),
    CONSTRAINT "assignment_services_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_services_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "services" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_assignment_services" ("assignmentId", "serviceKey") SELECT "assignmentId", "serviceKey" FROM "assignment_services";

-- Backfill price snapshot: prefer team-specific override, fall back to
-- the service's base unit price. Skips rows where the assignment has no
-- team (admin-created unlinked) — those fall back to base price only.
UPDATE "new_assignment_services"
SET "unitPriceCents" = COALESCE(
  (
    SELECT tso."priceCents"
    FROM "team_service_overrides" tso
    JOIN "assignments" a ON a."id" = "new_assignment_services"."assignmentId"
    WHERE tso."serviceKey" = "new_assignment_services"."serviceKey"
      AND tso."teamId" = a."teamId"
  ),
  (
    SELECT s."unitPrice"
    FROM "services" s
    WHERE s."key" = "new_assignment_services"."serviceKey"
  ),
  0
);

DROP TABLE "assignment_services";
ALTER TABLE "new_assignment_services" RENAME TO "assignment_services";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
