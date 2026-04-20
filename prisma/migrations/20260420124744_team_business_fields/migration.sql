-- CreateTable
CREATE TABLE "team_service_overrides" (
    "teamId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,

    PRIMARY KEY ("teamId", "serviceKey"),
    CONSTRAINT "team_service_overrides_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_service_overrides_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "services" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "logo" TEXT,
    "logoColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "description" TEXT,
    "legalName" TEXT,
    "vatNumber" TEXT,
    "kboNumber" TEXT,
    "iban" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "billingAddress" TEXT,
    "billingPostal" TEXT,
    "billingCity" TEXT,
    "billingCountry" TEXT DEFAULT 'Belgium',
    "logoUrl" TEXT,
    "signatureUrl" TEXT,
    "prefersLogoOnPhotos" BOOLEAN NOT NULL DEFAULT false,
    "defaultClientType" TEXT,
    "commissionType" TEXT,
    "commissionValue" INTEGER
);
INSERT INTO "new_teams" ("city", "createdAt", "id", "logo", "logoColor", "name") SELECT "city", "createdAt", "id", "logo", "logoColor", "name" FROM "teams";
DROP TABLE "teams";
ALTER TABLE "new_teams" RENAME TO "teams";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
