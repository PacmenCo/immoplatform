/*
  Warnings:

  - You are about to drop the column `odooPricelistId` on the `teams` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "team_service_overrides" ADD COLUMN     "odooPricelistId" INTEGER,
ALTER COLUMN "priceCents" DROP NOT NULL;

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "odooPricelistId";
