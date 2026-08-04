-- AlterTable
ALTER TABLE "financial_categories" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "business_info" ADD COLUMN     "targetHourlyRate" DECIMAL(10,2),
ADD COLUMN     "fixedCostMode" TEXT NOT NULL DEFAULT 'AVERAGE_3M',
ADD COLUMN     "fixedCostManual" DECIMAL(10,2);

-- Categorias de despesa fixa que faltavam. O ateliê já tinha "Aluguel"; luz,
-- água e internet eram digitadas à mão e por isso não somavam no custo fixo.
INSERT INTO "financial_categories" ("id", "name", "type", "active", "isSystem", "isFixed", "createdAt")
VALUES
  (gen_random_uuid()::text, 'Luz',      'EXPENSE', true, true, true, now()),
  (gen_random_uuid()::text, 'Água',     'EXPENSE', true, true, true, now()),
  (gen_random_uuid()::text, 'Internet', 'EXPENSE', true, true, true, now())
ON CONFLICT ("name", "type") DO NOTHING;

UPDATE "financial_categories"
SET "isFixed" = true
WHERE "type" = 'EXPENSE' AND "name" IN ('Aluguel', 'Salários');

-- Toda conta a receber criada até aqui ficou sem categoria, porque nenhum dos
-- caminhos de criação preenchia o campo — o DRE mostrava 100% da receita como
-- "Sem categoria". As que vieram de uma OS são serviço prestado: "Costura".
UPDATE "accounts_receivable"
SET "category" = 'Costura'
WHERE "category" IS NULL AND "workOrderId" IS NOT NULL;
