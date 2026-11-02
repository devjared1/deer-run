-- 14_booking_changes
-- Golfers change their own online bookings from My Account (another time and/or a different number of players).
-- Each change is a BookingChange: the price difference at today's rates is charged online or refunded to the card,
-- or, on a pay-at-course booking, added to / taken off the balance due at the register.
--
-- Run in the Supabase SQL Editor after 13_timeclock_kiosk. Then, from a network that can reach the database,
-- copy this file to prisma/migrations/14_booking_changes/migration.sql and run
--   npx prisma migrate resolve --applied 14_booking_changes

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "BookingChangeStatus" AS ENUM ('PENDING_PAYMENT', 'APPLYING', 'APPLIED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BookingChange" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT,
    "fromSlotId" TEXT NOT NULL,
    "toSlotId" TEXT NOT NULL,
    "fromPlayers" INTEGER NOT NULL,
    "toPlayers" INTEGER NOT NULL,
    "fromTotalCents" INTEGER NOT NULL,
    "toTotalCents" INTEGER NOT NULL,
    "chargeCents" INTEGER NOT NULL DEFAULT 0,
    "refundCents" INTEGER NOT NULL DEFAULT 0,
    "balanceChangeCents" INTEGER NOT NULL DEFAULT 0,
    "stripePaymentIntentId" TEXT,
    "status" "BookingChangeStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "BookingChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingChange_stripePaymentIntentId_key" ON "BookingChange"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "BookingChange_bookingId_idx" ON "BookingChange"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingChange" ADD CONSTRAINT "BookingChange_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── RLS (the Functions use the service role, which bypasses it) ────────────

ALTER TABLE "BookingChange" ENABLE ROW LEVEL SECURITY;

COMMIT;
