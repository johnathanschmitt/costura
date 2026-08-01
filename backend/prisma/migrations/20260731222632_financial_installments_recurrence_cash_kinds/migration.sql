-- CreateEnum
CREATE TYPE "CashMovementKind" AS ENUM ('SALE', 'EXPENSE', 'WITHDRAWAL', 'SUPPLY', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('NONE', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "accounts_payable" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "recurrence" "Recurrence" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "accounts_receivable" ADD COLUMN     "installmentGroupId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentTotal" INTEGER,
ADD COLUMN     "isDownPayment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cash_transactions" ADD COLUMN     "kind" "CashMovementKind" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "amountTendered" DECIMAL(10,2),
ADD COLUMN     "changeGiven" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
