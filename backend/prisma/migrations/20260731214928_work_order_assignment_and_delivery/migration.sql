-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('DOCUMENT', 'REFERENCE', 'FABRIC', 'PROGRESS');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "kind" "AttachmentKind" NOT NULL DEFAULT 'DOCUMENT';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "deliveredById" TEXT,
ADD COLUMN     "measurements" JSONB,
ADD COLUMN     "receivedBy" TEXT;

-- CreateIndex
CREATE INDEX "attachments_workOrderId_kind_idx" ON "attachments"("workOrderId", "kind");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
