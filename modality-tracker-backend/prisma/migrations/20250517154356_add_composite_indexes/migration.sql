/*
  Warnings:

  - A unique constraint covering the columns `[clientId,date]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sessionId,modalityId]` on the table `SessionStep` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "SessionStep" DROP CONSTRAINT "SessionStep_stationId_fkey";

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "date" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SessionStep" ALTER COLUMN "stationId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_clientId_date_key" ON "Session"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SessionStep_sessionId_modalityId_key" ON "SessionStep"("sessionId", "modalityId");

-- AddForeignKey
ALTER TABLE "SessionStep" ADD CONSTRAINT "SessionStep_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
