-- 16_course_alerts_shift_swaps
-- On Course "behind" alerts (CourseSettings.behindAlertMinutes, 0 = off) and shift swaps / open shifts (ShiftOffer:
-- offered → picked up → approved by a manager). One active (OPEN / CLAIMED) offer per shift: a partial unique index,
-- which Prisma can't model, so delete any DROP INDEX line for it from later generated migrations.
--
-- Run in the Supabase SQL Editor after 15_reminders_waitlist. Then, from a network that can reach the database,
-- copy this file to prisma/migrations/16_course_alerts_shift_swaps/migration.sql and run
--   npx prisma migrate resolve --applied 16_course_alerts_shift_swaps

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "ShiftOfferStatus" AS ENUM ('OPEN', 'CLAIMED', 'APPROVED', 'DENIED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CourseSettings" ADD COLUMN     "behindAlertMinutes" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "ShiftOffer" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "offeredById" TEXT NOT NULL,
    "postedById" TEXT,
    "note" TEXT,
    "status" "ShiftOfferStatus" NOT NULL DEFAULT 'OPEN',
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftOffer_shiftId_idx" ON "ShiftOffer"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftOffer_status_idx" ON "ShiftOffer"("status");

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- One active offer per shift (two coworkers offering / posting the same shift at once can't both win)
CREATE UNIQUE INDEX "ShiftOffer_one_active_per_shift" ON "ShiftOffer"("shiftId") WHERE "status" IN ('OPEN', 'CLAIMED');

ALTER TABLE "ShiftOffer" ENABLE ROW LEVEL SECURITY;

COMMIT;
