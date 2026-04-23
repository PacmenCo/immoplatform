/*
  Warnings:

  Replaces the flat `keyPickup` enum with Platform's richer triple
  (`requires_key_pickup` bool + `key_pickup_location_type` enum + text
  `key_pickup_address`). Values are back-filled in-place before the
  table rewrite so no inspection data is lost:

    keyPickup='owner'   → requiresKeyPickup=true,  locationType=NULL,    address='At owner''s address'
    keyPickup='tenant'  → requiresKeyPickup=true,  locationType=NULL,    address='At tenant''s address'
    keyPickup='office'  → requiresKeyPickup=true,  locationType='office'
    keyPickup='lockbox' → requiresKeyPickup=true,  locationType='other', address='Lockbox on-site'
    keyPickup=NULL      → requiresKeyPickup=false (default)

  Platform-parity reference: database/migrations/2025_10_14_174900_add_photographer_contact_and_key_fields_to_assignments_table.php
*/

-- Back-fill into scratch columns, then fold into the table rewrite below.
-- SQLite can't add columns with DEFAULT inside a transaction that later
-- drops the parent column, so we stage the values on the old table.
ALTER TABLE "assignments" ADD COLUMN "requiresKeyPickup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assignments" ADD COLUMN "keyPickupLocationType" TEXT;
ALTER TABLE "assignments" ADD COLUMN "keyPickupAddress" TEXT;

UPDATE "assignments" SET "requiresKeyPickup" = 1, "keyPickupAddress" = 'At owner''s address'   WHERE "keyPickup" = 'owner';
UPDATE "assignments" SET "requiresKeyPickup" = 1, "keyPickupAddress" = 'At tenant''s address'  WHERE "keyPickup" = 'tenant';
UPDATE "assignments" SET "requiresKeyPickup" = 1, "keyPickupLocationType" = 'office'            WHERE "keyPickup" = 'office';
UPDATE "assignments" SET "requiresKeyPickup" = 1, "keyPickupLocationType" = 'other', "keyPickupAddress" = 'Lockbox on-site' WHERE "keyPickup" = 'lockbox';

-- RedefineTables (drops the legacy `keyPickup` column).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postal" TEXT NOT NULL,
    "propertyType" TEXT,
    "constructionYear" INTEGER,
    "areaM2" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "preferredDate" DATETIME,
    "requiresKeyPickup" BOOLEAN NOT NULL DEFAULT false,
    "keyPickupLocationType" TEXT,
    "keyPickupAddress" TEXT,
    "notes" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "ownerAddress" TEXT,
    "ownerPostal" TEXT,
    "ownerCity" TEXT,
    "ownerVatNumber" TEXT,
    "clientType" TEXT,
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "tenantPhone" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "photographerContactPerson" TEXT,
    "isLargeProperty" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "freelancerId" TEXT,
    "createdById" TEXT,
    "discountType" TEXT,
    "discountValue" INTEGER,
    "discountReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deliveredAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "googleCalendarEventId" TEXT,
    "outlookCalendarEventId" TEXT,
    "outlookCalendarAccountId" TEXT,
    "calendarDate" DATETIME,
    "calendarAccountEmail" TEXT,
    CONSTRAINT "assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_outlookCalendarAccountId_fkey" FOREIGN KEY ("outlookCalendarAccountId") REFERENCES "calendar_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assignments" ("address", "areaM2", "quantity", "calendarAccountEmail", "calendarDate", "cancellationReason", "cancelledAt", "city", "clientType", "completedAt", "constructionYear", "contactEmail", "contactPhone", "createdAt", "createdById", "deliveredAt", "discountReason", "discountType", "discountValue", "freelancerId", "googleCalendarEventId", "id", "isLargeProperty", "keyPickupAddress", "keyPickupLocationType", "notes", "outlookCalendarAccountId", "outlookCalendarEventId", "ownerAddress", "ownerCity", "ownerEmail", "ownerName", "ownerPhone", "ownerPostal", "ownerVatNumber", "photographerContactPerson", "postal", "preferredDate", "propertyType", "reference", "requiresKeyPickup", "status", "teamId", "tenantEmail", "tenantName", "tenantPhone", "updatedAt") SELECT "address", "areaM2", "quantity", "calendarAccountEmail", "calendarDate", "cancellationReason", "cancelledAt", "city", "clientType", "completedAt", "constructionYear", "contactEmail", "contactPhone", "createdAt", "createdById", "deliveredAt", "discountReason", "discountType", "discountValue", "freelancerId", "googleCalendarEventId", "id", "isLargeProperty", "keyPickupAddress", "keyPickupLocationType", "notes", "outlookCalendarAccountId", "outlookCalendarEventId", "ownerAddress", "ownerCity", "ownerEmail", "ownerName", "ownerPhone", "ownerPostal", "ownerVatNumber", "photographerContactPerson", "postal", "preferredDate", "propertyType", "reference", "requiresKeyPickup", "status", "teamId", "tenantEmail", "tenantName", "tenantPhone", "updatedAt" FROM "assignments";
DROP TABLE "assignments";
ALTER TABLE "new_assignments" RENAME TO "assignments";
CREATE UNIQUE INDEX "assignments_reference_key" ON "assignments"("reference");
CREATE INDEX "assignments_status_idx" ON "assignments"("status");
CREATE INDEX "assignments_teamId_idx" ON "assignments"("teamId");
CREATE INDEX "assignments_freelancerId_idx" ON "assignments"("freelancerId");
CREATE INDEX "assignments_createdById_idx" ON "assignments"("createdById");
CREATE INDEX "assignments_preferredDate_idx" ON "assignments"("preferredDate");
CREATE INDEX "assignments_outlookCalendarAccountId_idx" ON "assignments"("outlookCalendarAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
