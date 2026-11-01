-- 12_pay_at_course
-- Pay at course: an online booking can pay only a flat, non-refundable hold fee (CourseSettings.payAtCourseFeeCents,
-- default $10 per booking, 0 = off) and the rest at the pro shop. The booking records the fee it paid
-- (Booking.holdFeeCents, null = paid in full online) and what's still owed (Booking.balanceDueCents), which the
-- register collects at check-in and sets back to 0.
--
-- Run in the Supabase SQL Editor after 11_rates. Then, from a network that can reach the database,
-- copy this file to prisma/migrations/12_pay_at_course/migration.sql and run
--   npx prisma migrate resolve --applied 12_pay_at_course

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "balanceDueCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "holdFeeCents" INTEGER;

-- AlterTable
ALTER TABLE "CourseSettings" ADD COLUMN     "payAtCourseFeeCents" INTEGER NOT NULL DEFAULT 1000;

COMMIT;
