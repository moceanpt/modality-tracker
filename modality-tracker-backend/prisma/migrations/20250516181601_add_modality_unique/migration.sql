/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Modality` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Modality_name_key" ON "Modality"("name");
