/*
  Warnings:

  - A unique constraint covering the columns `[symbol,code,country]` on the table `currencies` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "currencies" ADD COLUMN     "currency_change" DECIMAL(20,5) NOT NULL DEFAULT 1,
ADD COLUMN     "is_main" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "currency_rate" DECIMAL(20,5) NOT NULL DEFAULT 1,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_payment" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "currencies_symbol_code_country_key" ON "currencies"("symbol", "code", "country");

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
