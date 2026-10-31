-- 9_guest_default_discounts_tips_drawers
-- New sign-ups default to GUEST; member Pro Shop discounts; on-reader card tips; house account late fees and
-- overdue reminders; cash drawer paid-ins / paid-outs / safe drops; save_time_entry() for atomic time entry
-- corrections.
--
-- Run in the Supabase SQL Editor after 8_pos_house_accounts, together with the deploy that needs it (the drawer,
-- drawer close, admin drawer list, sales report and time entry corrections fail until it runs). Then, from a
-- network that can reach the database, copy this file to
-- prisma/migrations/9_guest_default_discounts_tips_drawers/migration.sql and run
--   npx prisma migrate resolve --applied 9_guest_default_discounts_tips_drawers
--
-- ALTER TYPE ... ADD VALUE is fine inside a transaction on Postgres 12+ (Supabase runs 15) as long as nothing
-- in the same transaction uses the new values, and nothing below does.

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('PAID_IN', 'PAID_OUT', 'SAFE_DROP');

-- AlterEnum
ALTER TYPE "ApprovalAction" ADD VALUE 'PAID_IN';
ALTER TYPE "ApprovalAction" ADD VALUE 'PAID_OUT';
ALTER TYPE "ApprovalAction" ADD VALUE 'SAFE_DROP';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'GUEST';

-- AlterTable
ALTER TABLE "CourseSettings" ADD COLUMN     "lateFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tipPercentages" INTEGER[] DEFAULT ARRAY[15, 18, 20]::INTEGER[],
ADD COLUMN     "tipPreTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tippingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "memberDiscount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "memberDiscountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "tipCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CashDrawerSession" ADD COLUMN     "paidInCents" INTEGER,
ADD COLUMN     "paidOutCents" INTEGER,
ADD COLUMN     "safeDropCents" INTEGER;

-- AlterTable
ALTER TABLE "Statement" ADD COLUMN     "lateFeeAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CashDrawerMovement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "recipient" TEXT,
    "employeeId" TEXT NOT NULL,
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDrawerMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashDrawerMovement_approvalId_key" ON "CashDrawerMovement"("approvalId");

-- CreateIndex
CREATE INDEX "CashDrawerMovement_sessionId_idx" ON "CashDrawerMovement"("sessionId");

-- CreateIndex
CREATE INDEX "CashDrawerMovement_registerId_createdAt_idx" ON "CashDrawerMovement"("registerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CashDrawerMovement" ADD CONSTRAINT "CashDrawerMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashDrawerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerMovement" ADD CONSTRAINT "CashDrawerMovement_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerMovement" ADD CONSTRAINT "CashDrawerMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerMovement" ADD CONSTRAINT "CashDrawerMovement_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ManagerApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- Member Pro Shop discounts start on the merchandise categories (editable in Admin → Products → Categories)
UPDATE "ProductCategory" SET "memberDiscount" = true WHERE name IN ('Apparel', 'Golf Equipment & Balls');

-- Amounts are positive; the type gives the direction (Prisma doesn't model CHECKs, so migrate diff ignores it)
ALTER TABLE "CashDrawerMovement" ADD CONSTRAINT "CashDrawerMovement_amount_positive" CHECK ("amountCents" > 0);

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access)
ALTER TABLE "CashDrawerMovement" ENABLE ROW LEVEL SECURITY;

-- save_time_entry: a manager's time entry correction in one transaction.
-- p_entry:  { id?, employeeId?, clockIn, clockOut?, note?, editedById } — timestamps are UTC ISO strings.
--           Without id: inserts a new entry for employeeId. With id: updates that entry (P0002 if it's gone).
-- p_breaks: [{ startedAt, endedAt? }] — replaces all of the entry's breaks.
-- The one-open-entry index (TimeEntry_one_open_per_employee) raises 23505, which the API maps to a 409.
-- Returns the entry id.
CREATE OR REPLACE FUNCTION save_time_entry(p_entry jsonb, p_breaks jsonb)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id    text := p_entry->>'id';
  v_break jsonb;
BEGIN
  IF v_id IS NULL THEN
    v_id := gen_random_uuid()::text;
    INSERT INTO "TimeEntry" (id, "employeeId", "clockIn", "clockOut", note, "editedById", "editedAt")
    VALUES (
      v_id,
      p_entry->>'employeeId',
      (p_entry->>'clockIn')::timestamptz AT TIME ZONE 'UTC',
      (p_entry->>'clockOut')::timestamptz AT TIME ZONE 'UTC',
      p_entry->>'note',
      p_entry->>'editedById',
      now() AT TIME ZONE 'UTC'
    );
  ELSE
    UPDATE "TimeEntry"
    SET "clockIn"    = (p_entry->>'clockIn')::timestamptz AT TIME ZONE 'UTC',
        "clockOut"   = (p_entry->>'clockOut')::timestamptz AT TIME ZONE 'UTC',
        note         = p_entry->>'note',
        "editedById" = p_entry->>'editedById',
        "editedAt"   = now() AT TIME ZONE 'UTC'
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Time entry not found' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM "TimeBreak" WHERE "timeEntryId" = v_id;
  END IF;

  FOR v_break IN SELECT * FROM jsonb_array_elements(COALESCE(p_breaks, '[]'::jsonb)) LOOP
    INSERT INTO "TimeBreak" (id, "timeEntryId", "startedAt", "endedAt")
    VALUES (
      gen_random_uuid()::text,
      v_id,
      (v_break->>'startedAt')::timestamptz AT TIME ZONE 'UTC',
      (v_break->>'endedAt')::timestamptz AT TIME ZONE 'UTC'
    );
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION save_time_entry(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_time_entry(jsonb, jsonb) TO service_role;

COMMIT;

-- Optional, after reviewing: accounts that became MEMBER only because MEMBER used to be the sign-up default have
-- no memberUntil and no membership sale. List them with
--   SELECT id, email, name, "createdAt" FROM "User" u
--   WHERE role = 'MEMBER' AND "memberUntil" IS NULL
--     AND NOT EXISTS (SELECT 1 FROM "Sale" s WHERE s."customerId" = u.id);
-- and set the ones that aren't real members to GUEST in Admin → Users (or with an UPDATE on those ids).
