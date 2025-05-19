-- DropForeignKey
ALTER TABLE "Station" DROP CONSTRAINT "Station_modalityId_fkey";

-- DropIndex
DROP INDEX "Modality_name_key";

-- AlterTable
ALTER TABLE "Station" ALTER COLUMN "modalityId" DROP NOT NULL,
ALTER COLUMN "index" DROP DEFAULT,
ALTER COLUMN "status" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
