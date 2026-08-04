-- Despesa do ateliê paga do bolso de uma sócia, a ressarcir no fim do mês.
ALTER TABLE "accounts_payable" ADD COLUMN "advancedById" TEXT;

ALTER TABLE "accounts_payable"
  ADD CONSTRAINT "accounts_payable_advancedById_fkey"
  FOREIGN KEY ("advancedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "accounts_payable_advancedById_status_idx"
  ON "accounts_payable"("advancedById", "status");
