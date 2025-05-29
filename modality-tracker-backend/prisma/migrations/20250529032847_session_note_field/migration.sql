/*
  Warnings:

  - You are about to drop the column `notes` on the `Session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "notes",
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '';
