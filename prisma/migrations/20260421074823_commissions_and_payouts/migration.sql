-- CreateTable
CREATE TABLE "assignment_commissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "assignmentTotalCents" INTEGER NOT NULL,
    "commissionType" TEXT NOT NULL,
    "commissionValue" INTEGER NOT NULL,
    "commissionAmountCents" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assignment_commissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_commissions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidById" TEXT,
    CONSTRAINT "commission_payouts_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "commission_payouts_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_commissions_assignmentId_key" ON "assignment_commissions"("assignmentId");

-- CreateIndex
CREATE INDEX "assignment_commissions_teamId_computedAt_idx" ON "assignment_commissions"("teamId", "computedAt");

-- CreateIndex
CREATE INDEX "commission_payouts_teamId_year_idx" ON "commission_payouts"("teamId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "commission_payouts_teamId_year_quarter_key" ON "commission_payouts"("teamId", "year", "quarter");
