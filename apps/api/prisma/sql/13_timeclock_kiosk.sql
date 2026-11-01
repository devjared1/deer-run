-- 13_timeclock_kiosk
-- Standalone time clock (an iPad at /timeclock): each employee gets a time clock PIN (Employee.clockPin*, same
-- hashing and lockout as the manager PIN), and each kiosk device has a token whose SHA-256 hash is in ClockKiosk.
--
-- Run in the Supabase SQL Editor after 12_pay_at_course. Then, from a network that can reach the database,
-- copy this file to prisma/migrations/13_timeclock_kiosk/migration.sql and run
--   npx prisma migrate resolve --applied 13_timeclock_kiosk

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "clockPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clockPinHash" TEXT,
ADD COLUMN     "clockPinLockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClockKiosk" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "ClockKiosk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClockKiosk_tokenHash_key" ON "ClockKiosk"("tokenHash");

-- ─── RLS (the Functions use the service role, which bypasses it) ────────────

ALTER TABLE "ClockKiosk" ENABLE ROW LEVEL SECURITY;

COMMIT;
