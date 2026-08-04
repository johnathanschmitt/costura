-- AlterTable: cancelamento da OS quando a cliente desiste
ALTER TABLE "work_orders" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OS que já estavam canceladas ganham a data do último toque, para o histórico
-- não ficar com cancelamento sem quando.
UPDATE "work_orders" SET "cancelledAt" = "updatedAt" WHERE "status" = 'CANCELLED' AND "cancelledAt" IS NULL;

-- Categoria da devolução de sinal, para a saída aparecer no DRE.
INSERT INTO "financial_categories" ("id", "name", "type", "active", "isSystem", "isFixed", "createdAt")
VALUES (gen_random_uuid()::text, 'Devolução de sinal', 'EXPENSE', true, true, false, now())
ON CONFLICT ("name", "type") DO NOTHING;
