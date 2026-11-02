-- 15_reminders_waitlist
-- Day-before reminder emails (Booking.reminderSentAt, so a re-run never sends twice) and the waitlist for full days
-- (WaitlistEntry: emailed once when a time opens up).
--
-- Run in the Supabase SQL Editor after 14_booking_changes. Then, from a network that can reach the database,
-- copy this file to prisma/migrations/15_reminders_waitlist/migration.sql and run
--   npx prisma migrate resolve --applied 15_reminders_waitlist

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "players" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_date_idx" ON "WaitlistEntry"("date");

-- ─── RLS (the Functions use the service role, which bypasses it) ────────────

ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;

COMMIT;
