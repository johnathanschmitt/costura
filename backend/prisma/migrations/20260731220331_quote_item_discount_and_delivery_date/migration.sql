-- AlterTable
ALTER TABLE "business_info" ADD COLUMN     "quoteValidityDays" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "deliveryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_order_items" ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
