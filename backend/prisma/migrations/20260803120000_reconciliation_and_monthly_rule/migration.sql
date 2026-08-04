-- AlterTable: conferência contra o extrato do banco
ALTER TABLE "financial_accounts" ADD COLUMN     "reconciledUntil" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN     "reconciledAt" TIMESTAMP(3);
ALTER TABLE "account_transfers" ADD COLUMN     "reconciledAt" TIMESTAMP(3);

-- CreateTable: regra de divisão válida só para um mês
CREATE TABLE "monthly_distribution_rules" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "atelierPercent" DECIMAL(5,2) NOT NULL,
    "shares" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_distribution_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "monthly_distribution_rules_month_key" ON "monthly_distribution_rules"("month");
