-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'ACTIVE', 'DONE');

-- AlterTable
ALTER TABLE "SessionStep" ADD COLUMN     "status" "StepStatus" NOT NULL DEFAULT 'PENDING';
