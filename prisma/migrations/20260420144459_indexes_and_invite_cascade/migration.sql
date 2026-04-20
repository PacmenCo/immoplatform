-- DropIndex
DROP INDEX "users_email_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamId" TEXT,
    "teamRole" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "revokedAt" DATETIME,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "lastResentAt" DATETIME,
    CONSTRAINT "invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_invites" ("acceptedAt", "createdAt", "email", "expiresAt", "id", "invitedById", "lastResentAt", "note", "resendCount", "revokedAt", "role", "teamId", "teamRole", "tokenHash") SELECT "acceptedAt", "createdAt", "email", "expiresAt", "id", "invitedById", "lastResentAt", "note", "resendCount", "revokedAt", "role", "teamId", "teamRole", "tokenHash" FROM "invites";
DROP TABLE "invites";
ALTER TABLE "new_invites" RENAME TO "invites";
CREATE UNIQUE INDEX "invites_tokenHash_key" ON "invites"("tokenHash");
CREATE INDEX "invites_email_idx" ON "invites"("email");
CREATE INDEX "invites_tokenHash_idx" ON "invites"("tokenHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");
