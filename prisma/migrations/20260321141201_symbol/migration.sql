/*
  Warnings:

  - You are about to drop the column `created_by` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `expenses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `currencies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[symbol]` on the table `currencies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[country]` on the table `currencies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `expenses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `symbol` to the `currencies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `currencies` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_created_by_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_group_id_fkey";

-- AlterTable
ALTER TABLE "currencies" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "symbol" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "created_by",
DROP COLUMN "group_id";

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "currency_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_symbol_key" ON "currencies"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_country_key" ON "currencies"("country");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_name_key" ON "expenses"("name");

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
