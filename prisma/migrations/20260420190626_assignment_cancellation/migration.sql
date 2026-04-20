-- AlterTable
ALTER TABLE "assignments" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "assignments" ADD COLUMN "cancelledAt" DATETIME;
