-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('CASH_DRAWER', 'BANK', 'WALLET', 'SAFE', 'RESERVE');

-- CreateTable: onde o dinheiro fica
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "financial_accounts_name_key" ON "financial_accounts"("name");

-- CreateTable: dinheiro mudando de lugar
CREATE TABLE "account_transfers" (
    "id" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "cashTransactionId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_transfers_cashTransactionId_key" ON "account_transfers"("cashTransactionId");
CREATE INDEX "account_transfers_createdAt_idx" ON "account_transfers"("createdAt");

-- CreateTable: retirada da sócia
CREATE TABLE "partner_payouts" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "accountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_payouts_distributionId_userId_key" ON "partner_payouts"("distributionId", "userId");

-- CreateTable: prejuízo que passa para o mês seguinte
CREATE TABLE "distribution_carry_overs" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "settledIn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distribution_carry_overs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "distribution_carry_overs_month_key" ON "distribution_carry_overs"("month");

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "accountId" TEXT;
ALTER TABLE "users" ADD COLUMN "distributionPercent" DECIMAL(5,2);
ALTER TABLE "monthly_distributions" ADD COLUMN "atelierPercent" DECIMAL(5,2),
ADD COLUMN "grossResult" DECIMAL(10,2),
ADD COLUMN "withheldSignals" DECIMAL(10,2),
ADD COLUMN "carryOverUsed" DECIMAL(10,2);
ALTER TABLE "distribution_shares" ADD COLUMN "percent" DECIMAL(5,2);
ALTER TABLE "business_info" ADD COLUMN "atelierPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
ADD COLUMN "reserveTargetMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "excludeUndeliveredSignals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "coverLossWithReserve" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "carryLossToNextMonth" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "monthly_distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contas iniciais. A gaveta e a reserva são do sistema: o caixa lança na gaveta
-- e a divisão credita a reserva, então elas não podem ser removidas.
INSERT INTO "financial_accounts" ("id", "name", "kind", "isSystem", "isDefault", "order", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Gaveta',            'CASH_DRAWER', true,  false, 1, now(), now()),
  (gen_random_uuid()::text, 'Banco',             'BANK',        false, true,  2, now(), now()),
  (gen_random_uuid()::text, 'Reserva do ateliê', 'RESERVE',     true,  false, 9, now(), now())
ON CONFLICT ("name") DO NOTHING;

-- Classifica os pagamentos que já existem: espécie foi para a gaveta, o resto
-- para o banco. Sem isso os saldos nasceriam zerados ignorando o histórico.
UPDATE "payments" SET "accountId" = (SELECT "id" FROM "financial_accounts" WHERE "name" = 'Gaveta')
WHERE "accountId" IS NULL AND "method" = 'CASH';

UPDATE "payments" SET "accountId" = (SELECT "id" FROM "financial_accounts" WHERE "name" = 'Banco')
WHERE "accountId" IS NULL;

-- A divisão em partes iguais vira percentual explícito: com N sócias, cada uma
-- fica com 1/(N+1) e o ateliê com o mesmo. Mantém o que estava valendo até aqui.
UPDATE "users" SET "distributionPercent" = ROUND(100.0 / NULLIF((SELECT COUNT(*) + 1 FROM "users" WHERE "isPartner" = true AND "deletedAt" IS NULL), 0), 2)
WHERE "isPartner" = true AND "deletedAt" IS NULL;

UPDATE "business_info" SET "atelierPercent" = COALESCE(
  (SELECT ROUND(100.0 / NULLIF((SELECT COUNT(*) + 1 FROM "users" WHERE "isPartner" = true AND "deletedAt" IS NULL), 0), 2)),
  20
)
WHERE EXISTS (SELECT 1 FROM "users" WHERE "isPartner" = true AND "deletedAt" IS NULL);
