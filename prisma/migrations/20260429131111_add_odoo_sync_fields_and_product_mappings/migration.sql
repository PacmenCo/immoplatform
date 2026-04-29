-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "odooContactId" INTEGER,
ADD COLUMN     "odooLinesSyncedAt" TIMESTAMP(3),
ADD COLUMN     "odooOrderId" INTEGER,
ADD COLUMN     "odooSyncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "odooSyncError" TEXT,
ADD COLUMN     "odooSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "odoo_product_mappings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "serviceKey" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "odooProductName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odoo_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odoo_product_mappings_serviceKey_propertyType_idx" ON "odoo_product_mappings"("serviceKey", "propertyType");

-- CreateIndex
CREATE UNIQUE INDEX "odoo_product_mappings_teamId_serviceKey_propertyType_key" ON "odoo_product_mappings"("teamId", "serviceKey", "propertyType");

-- AddForeignKey
ALTER TABLE "odoo_product_mappings" ADD CONSTRAINT "odoo_product_mappings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odoo_product_mappings" ADD CONSTRAINT "odoo_product_mappings_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "services"("key") ON DELETE CASCADE ON UPDATE CASCADE;
