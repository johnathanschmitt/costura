-- CreateEnum
CREATE TYPE "SendChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'LINK');

-- AlterTable
ALTER TABLE "business_info" ADD COLUMN     "whatsappTemplate" TEXT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "publicToken" TEXT;

-- CreateTable
CREATE TABLE "quote_sends" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "channel" "SendChannel" NOT NULL,
    "recipient" TEXT,
    "userId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_sends_quoteId_sentAt_idx" ON "quote_sends"("quoteId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_publicToken_key" ON "quotes"("publicToken");

-- AddForeignKey
ALTER TABLE "quote_sends" ADD CONSTRAINT "quote_sends_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_sends" ADD CONSTRAINT "quote_sends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

