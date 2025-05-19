/*
  Warnings:

  - The `status` column on the `Station` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[firstName,lastInitial]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[category,index]` on the table `Station` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('AVAILABLE', 'IN_USE');

-- DropIndex
DROP INDEX "Station_category_label_idx";

-- AlterTable
ALTER TABLE "SessionStep" ALTER COLUMN "startAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "index" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "category" DROP DEFAULT,
DROP COLUMN "status",
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'AVAILABLE';

-- DropEnum
DROP TYPE "StationStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Client_firstName_lastInitial_key" ON "Client"("firstName", "lastInitial");

-- CreateIndex
CREATE UNIQUE INDEX "Station_category_index_key" ON "Station"("category", "index");
