-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isPartner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "monthly_distributions" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "result" DECIMAL(10,2) NOT NULL,
    "parts" INTEGER NOT NULL,
    "valuePerPart" DECIMAL(10,2) NOT NULL,
    "atelierShare" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_shares" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredValue" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "distribution_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_distributions_month_key" ON "monthly_distributions"("month");

-- CreateIndex
CREATE UNIQUE INDEX "distribution_shares_distributionId_userId_key" ON "distribution_shares"("distributionId", "userId");

-- AddForeignKey
ALTER TABLE "distribution_shares" ADD CONSTRAINT "distribution_shares_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "monthly_distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_shares" ADD CONSTRAINT "distribution_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

