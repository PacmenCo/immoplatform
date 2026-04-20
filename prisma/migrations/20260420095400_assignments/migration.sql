-- CreateTable
CREATE TABLE "services" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "user_specialties" (
    "userId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,

    PRIMARY KEY ("userId", "serviceKey"),
    CONSTRAINT "user_specialties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_specialties_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "services" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignments" (
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
    "teamId" TEXT,
    "freelancerId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deliveredAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignment_services" (
    "assignmentId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,

    PRIMARY KEY ("assignmentId", "serviceKey"),
    CONSTRAINT "assignment_services_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_services_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "services" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignment_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorLabel" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignment_comments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "assignments_reference_key" ON "assignments"("reference");

-- CreateIndex
CREATE INDEX "assignments_status_idx" ON "assignments"("status");

-- CreateIndex
CREATE INDEX "assignments_teamId_idx" ON "assignments"("teamId");

-- CreateIndex
CREATE INDEX "assignments_freelancerId_idx" ON "assignments"("freelancerId");

-- CreateIndex
CREATE INDEX "assignments_preferredDate_idx" ON "assignments"("preferredDate");

-- CreateIndex
CREATE INDEX "assignment_comments_assignmentId_createdAt_idx" ON "assignment_comments"("assignmentId", "createdAt");
