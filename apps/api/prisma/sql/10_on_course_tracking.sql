-- 10_on_course_tracking
-- On-course tracking: cart numbers, start hole and round length per booking (set at check-in), tee-off, last
-- reported position and finish times; every position report (PositionReport) for learning per-hole times
-- (CourseSettings.holeSeconds, worked out daily); the expected round length and the positions that can update groups.
--
-- Run in the Supabase SQL Editor after 9_guest_default_discounts_tips_drawers, together with the deploy that needs
-- it (the tee sheet and On Course pages fail until it runs). Then, from a network that can reach the database, copy
-- this file to prisma/migrations/10_on_course_tracking/migration.sql and run
--   npx prisma migrate resolve --applied 10_on_course_tracking
--
-- Idempotent: safe to re-run after a partial or complete run (every step skips what already exists).

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff`, made re-runnable ─

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HoleStage') THEN
    CREATE TYPE "HoleStage" AS ENUM ('TEE', 'FAIRWAY', 'GREEN');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cartNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ownCart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "positionAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "positionHole" INTEGER,
ADD COLUMN IF NOT EXISTS "positionStage" "HoleStage",
ADD COLUMN IF NOT EXISTS "roundHoles" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN IF NOT EXISTS "startHole" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "teedOffAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CourseSettings" ADD COLUMN IF NOT EXISTS "coursePositions" "EmployeePosition"[] DEFAULT ARRAY['STARTER', 'PLAYER_ASSISTANT', 'OUTSIDE_SERVICES', 'BEVERAGE_CART_ATTENDANT']::"EmployeePosition"[],
ADD COLUMN IF NOT EXISTS "holeSeconds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN IF NOT EXISTS "holeTimesRounds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "holeTimesUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "roundMinutes" INTEGER NOT NULL DEFAULT 255;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PositionReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hole" INTEGER NOT NULL,
    "stage" "HoleStage" NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,

    CONSTRAINT "PositionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PositionReport_bookingId_idx" ON "PositionReport"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PositionReport_reportedAt_idx" ON "PositionReport"("reportedAt");

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionReport_bookingId_fkey') THEN
    ALTER TABLE "PositionReport" ADD CONSTRAINT "PositionReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionReport_employeeId_fkey') THEN
    ALTER TABLE "PositionReport" ADD CONSTRAINT "PositionReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access; a no-op if already on)
ALTER TABLE "PositionReport" ENABLE ROW LEVEL SECURITY;

COMMIT;
