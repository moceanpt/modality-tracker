/*
  Warnings:

  - The `status` column on the `Station` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `startAt` on table `SessionStep` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('AVAILABLE', 'IN_USE');

-- AlterTable
ALTER TABLE "SessionStep" ALTER COLUMN "startAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'UNKNOWN',
DROP COLUMN "status",
ADD COLUMN     "status" "StationStatus" NOT NULL DEFAULT 'AVAILABLE';

-- CreateIndex
CREATE INDEX "Station_category_label_idx" ON "Station"("category", "label");
