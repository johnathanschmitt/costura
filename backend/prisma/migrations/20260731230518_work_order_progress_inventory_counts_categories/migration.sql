-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterTable
ALTER TABLE "accounts_receivable" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "workOrderUpdateId" TEXT;

-- AlterTable
ALTER TABLE "business_info" ADD COLUMN     "queueAlertDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "inventoryCountId" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "estimatedHours" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyCapacityHours" DECIMAL(4,2) NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "estimatedHours" DECIMAL(6,2),
ADD COLUMN     "progressPct" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "userId" TEXT,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_updates" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "progressPct" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_updates_workOrderId_createdAt_idx" ON "work_order_updates"("workOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_name_type_key" ON "financial_categories"("name", "type");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "inventory_counts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workOrderUpdateId_fkey" FOREIGN KEY ("workOrderUpdateId") REFERENCES "work_order_updates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
