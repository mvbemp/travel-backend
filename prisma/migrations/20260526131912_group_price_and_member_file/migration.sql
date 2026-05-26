-- AlterTable
ALTER TABLE "groups"
ADD COLUMN "price" DECIMAL(10,2),
ADD COLUMN "currency_id" INTEGER;

-- AlterTable
ALTER TABLE "group_members"
ADD COLUMN "file_path" TEXT;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
