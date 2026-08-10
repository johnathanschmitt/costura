-- AlterEnum
ALTER TYPE "AttachmentKind" ADD VALUE 'GARMENT';

-- DropIndex
DROP INDEX "attachments_accountPayableId_idx";

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "garmentId" TEXT;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
