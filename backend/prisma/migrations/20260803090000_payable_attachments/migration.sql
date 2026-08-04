-- AlterTable: comprovante e nota fiscal da despesa
ALTER TABLE "attachments" ADD COLUMN     "accountPayableId" TEXT;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_accountPayableId_fkey" FOREIGN KEY ("accountPayableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "attachments_accountPayableId_idx" ON "attachments"("accountPayableId");
