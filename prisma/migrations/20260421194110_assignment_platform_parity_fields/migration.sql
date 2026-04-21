-- RedefineTables
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
    "preferredDate" DATETIME,
    "keyPickup" TEXT,
    "notes" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
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
INSERT INTO "new_assignments" ("address", "areaM2", "calendarAccountEmail", "calendarDate", "cancellationReason", "cancelledAt", "city", "completedAt", "constructionYear", "createdAt", "createdById", "deliveredAt", "discountReason", "discountType", "discountValue", "freelancerId", "googleCalendarEventId", "id", "keyPickup", "notes", "outlookCalendarAccountId", "outlookCalendarEventId", "ownerEmail", "ownerName", "ownerPhone", "postal", "preferredDate", "propertyType", "reference", "status", "teamId", "tenantEmail", "tenantName", "tenantPhone", "updatedAt") SELECT "address", "areaM2", "calendarAccountEmail", "calendarDate", "cancellationReason", "cancelledAt", "city", "completedAt", "constructionYear", "createdAt", "createdById", "deliveredAt", "discountReason", "discountType", "discountValue", "freelancerId", "googleCalendarEventId", "id", "keyPickup", "notes", "outlookCalendarAccountId", "outlookCalendarEventId", "ownerEmail", "ownerName", "ownerPhone", "postal", "preferredDate", "propertyType", "reference", "status", "teamId", "tenantEmail", "tenantName", "tenantPhone", "updatedAt" FROM "assignments";
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
