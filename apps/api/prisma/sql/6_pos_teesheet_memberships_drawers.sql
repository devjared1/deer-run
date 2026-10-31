-- 6_pos_teesheet_memberships_drawers
-- POS Phases 5–7: tee sheet check-in and walk-in/phone bookings, memberships sold at the register,
-- and cash drawer sessions.
--
-- Paste into the Supabase SQL Editor and run (after migrations 0–5). Then, from a network that can reach
-- the database, copy this file to prisma/migrations/6_pos_teesheet_memberships_drawers/migration.sql and run
--   npx prisma migrate resolve --applied 6_pos_teesheet_memberships_drawers
-- The schema changes below were generated with `prisma migrate diff` from schema.prisma.

BEGIN;

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'POS', 'PHONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "memberUntil" DATE,
ADD COLUMN     "membershipTier" TEXT,
ADD COLUMN     "renewalReminderKey" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "membershipMonths" INTEGER,
ADD COLUMN     "membershipTier" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "bookingId" TEXT;

-- CreateTable
CREATE TABLE "CashDrawerSession" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloatCents" INTEGER NOT NULL,
    "openNote" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "cashSalesCents" INTEGER,
    "cashRefundsCents" INTEGER,
    "expectedCents" INTEGER,
    "countedCents" INTEGER,
    "overShortCents" INTEGER,
    "closeNote" TEXT,

    CONSTRAINT "CashDrawerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashDrawerSession_registerId_openedAt_idx" ON "CashDrawerSession"("registerId", "openedAt");

-- CreateIndex
CREATE INDEX "SaleItem_bookingId_idx" ON "SaleItem"("bookingId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Not modeled by Prisma: at most one open drawer session per register. A future `migrate diff` will
-- propose dropping this index; delete that line from generated migrations.
CREATE UNIQUE INDEX "CashDrawerSession_one_open_per_register"
  ON "CashDrawerSession"("registerId") WHERE "closedAt" IS NULL;

-- The Functions use the service role, which bypasses RLS; no policies means no anon/authenticated access
ALTER TABLE "CashDrawerSession" ENABLE ROW LEVEL SECURITY;

-- Membership products from seed-pos.sql: how long each makes the customer a member, and the tier
UPDATE "Product" p SET "membershipMonths" = v.months, "membershipTier" = v.tier
FROM (VALUES
  ('Individual Membership — Annual', 12, 'Individual'),
  ('Individual Membership — Monthly', 1, 'Individual'),
  ('Premier Membership — Annual',    12, 'Premier'),
  ('Premier Membership — Monthly',    1, 'Premier'),
  ('Family Membership — Annual',     12, 'Family'),
  ('Family Membership — Monthly',     1, 'Family')
) AS v(name, months, tier)
WHERE p."name" = v.name;

COMMIT;
