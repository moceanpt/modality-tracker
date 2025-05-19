-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('MT', 'OP', 'UNSPEC');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "mode" "Mode" NOT NULL DEFAULT 'UNSPEC';
