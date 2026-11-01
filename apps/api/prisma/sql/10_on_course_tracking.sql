-- 10_on_course_tracking
-- On-course tracking: cart numbers, start hole and round length per booking (set at check-in), tee-off, last
-- reported position and finish times; every position report (PositionReport) for learning per-hole times
-- (CourseSettings.holeSeconds, worked out daily); the expected round length and the positions that can update groups.
--
-- Run in the Supabase SQL Editor after 9_guest_default_discounts_tips_drawers, together with the deploy that needs
-- it (the tee sheet and On Course pages fail until it runs). Then, from a network that can reach the database, copy
-- this file to prisma/migrations/10_on_course_tracking/migration.sql and run
--   npx prisma migrate resolve --applied 10_on_course_tracking

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "HoleStage" AS ENUM ('TEE', 'FAIRWAY', 'GREEN');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cartNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "ownCart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "positionAt" TIMESTAMP(3),
ADD COLUMN     "positionHole" INTEGER,
ADD COLUMN     "positionStage" "HoleStage",
ADD COLUMN     "roundHoles" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "startHole" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "teedOffAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CourseSettings" ADD COLUMN     "coursePositions" "EmployeePosition"[] DEFAULT ARRAY['STARTER', 'PLAYER_ASSISTANT', 'OUTSIDE_SERVICES', 'BEVERAGE_CART_ATTENDANT']::"EmployeePosition"[],
ADD COLUMN     "holeSeconds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "holeTimesRounds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "holeTimesUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "roundMinutes" INTEGER NOT NULL DEFAULT 255;

-- CreateTable
CREATE TABLE "PositionReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hole" INTEGER NOT NULL,
    "stage" "HoleStage" NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,

    CONSTRAINT "PositionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PositionReport_bookingId_idx" ON "PositionReport"("bookingId");

-- CreateIndex
CREATE INDEX "PositionReport_reportedAt_idx" ON "PositionReport"("reportedAt");

-- AddForeignKey
ALTER TABLE "PositionReport" ADD CONSTRAINT "PositionReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionReport" ADD CONSTRAINT "PositionReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access)
ALTER TABLE "PositionReport" ENABLE ROW LEVEL SECURITY;

COMMIT;
