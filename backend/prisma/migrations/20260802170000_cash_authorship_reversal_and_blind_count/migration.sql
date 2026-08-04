-- AlterEnum
ALTER TYPE "CashMovementKind" ADD VALUE 'REVERSAL';

-- AlterTable: quem abriu, quem fechou e a contagem por cédula
ALTER TABLE "cash_registers" ADD COLUMN     "openedById" TEXT,
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "countBreakdown" JSONB;

-- AlterTable: quem lançou e para onde foi a sangria
ALTER TABLE "cash_transactions" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "counterpart" TEXT;

-- AlterTable: estorno de baixa
ALTER TABLE "payments" ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedReason" TEXT,
ADD COLUMN     "reversedById" TEXT;

-- AlterTable: conferência às cegas
ALTER TABLE "business_info" ADD COLUMN     "blindCashCount" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
