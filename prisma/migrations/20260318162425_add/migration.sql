/*
  Warnings:

  - You are about to drop the column `amount` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `expenses` table. All the data in the column will be lost.
  - Added the required column `currency_id` to the `expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `expenses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "amount",
DROP COLUMN "description",
DROP COLUMN "type",
ADD COLUMN     "currency_id" INTEGER NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "value" DECIMAL(10,2) NOT NULL;

-- DropEnum
DROP TYPE "ExpenseType";

-- CreateTable
CREATE TABLE "currencies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
