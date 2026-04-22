-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDismissible" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "announcement_dismissals" (
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("announcementId", "userId"),
    CONSTRAINT "announcement_dismissals_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "announcement_dismissals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "announcements_isActive_startsAt_endsAt_idx" ON "announcements"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "announcement_dismissals_userId_idx" ON "announcement_dismissals"("userId");
