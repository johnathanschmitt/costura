-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScheduleType" ADD VALUE 'MEASUREMENT';
ALTER TYPE "ScheduleType" ADD VALUE 'QUOTE';

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "quoteId" TEXT;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
