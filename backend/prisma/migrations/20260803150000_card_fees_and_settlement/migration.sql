-- AlterTable: o que a maquininha retém e quando o dinheiro cai
ALTER TABLE "payments" ADD COLUMN     "feeAmount" DECIMAL(10,2),
ADD COLUMN     "netAmount" DECIMAL(10,2),
ADD COLUMN     "availableAt" TIMESTAMP(3);

-- AlterTable: taxa e prazo por tipo de cartão
ALTER TABLE "business_info" ADD COLUMN     "cardDebitFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cardCreditFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cardDebitDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cardCreditDays" INTEGER NOT NULL DEFAULT 0;

-- As vendas no cartão que já existem ficam como estão: valor cheio, disponível
-- na data do pagamento. Não dá para inventar a taxa de uma venda passada.
UPDATE "payments" SET "availableAt" = "paidAt" WHERE "availableAt" IS NULL;

-- Categoria da taxa, para ela aparecer no DRE como despesa.
INSERT INTO "financial_categories" ("id", "name", "type", "active", "isSystem", "isFixed", "createdAt")
VALUES (gen_random_uuid()::text, 'Taxas de cartão', 'EXPENSE', true, true, false, now())
ON CONFLICT ("name", "type") DO NOTHING;
