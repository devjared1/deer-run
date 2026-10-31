-- POS sales: sales, sale items, payments, the create_sale() function, and the 9% sales tax rate.
-- Run in the Supabase SQL Editor after 3_pos_catalog (and seed-pos.sql if you want the starter
-- catalog). Once applied there, mark it as applied for Prisma with:
--   npx prisma migrate resolve --applied 4_pos_sales

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD_TERMINAL', 'HOUSE_ACCOUNT', 'PREPAID_ONLINE', 'GIFT_CARD');

-- AlterEnum
ALTER TYPE "InventoryReason" ADD VALUE 'SALE';

-- AlterTable
ALTER TABLE "CourseSettings" ALTER COLUMN "salesTaxBps" SET DEFAULT 900;

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "registerId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "customerId" TEXT,
    "isMemberPricing" BOOLEAN NOT NULL DEFAULT false,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "changeCents" INTEGER NOT NULL DEFAULT 0,
    "receiptEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "variantId" TEXT,
    "description" TEXT NOT NULL,
    "categoryName" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "tenderedCents" INTEGER,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_registerId_createdAt_idx" ON "Sale"("registerId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_variantId_idx" ON "SaleItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- Course sales tax: 9%
UPDATE "CourseSettings" SET "salesTaxBps" = 900 WHERE id = 'singleton' AND "salesTaxBps" = 0;

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access)
ALTER TABLE "Sale"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"  ENABLE ROW LEVEL SECURITY;

-- create_sale: saves a sale, its items and payments, and deducts stock for tracked items
-- (logged as SALE adjustments), all in one transaction. Prices, tax and totals are computed
-- and validated by POST /api/staff/sales before calling this; the function only writes.
-- Sales may take stock below zero (the shelf count wins over the system count at checkout).
--   p_sale:     { registerId, cashierId, customerId, userId, isMemberPricing, subtotalCents,
--                 discountCents, taxCents, totalCents, changeCents, receiptEmail }
--   p_items:    [{ variantId, trackInventory, description, categoryName, quantity, unitPriceCents,
--                  discountCents, taxRateBps, subtotalCents, taxCents, totalCents }]
--   p_payments: [{ method, amountCents, tenderedCents }]
-- Returns { id, number }.
CREATE OR REPLACE FUNCTION create_sale(p_sale jsonb, p_items jsonb, p_payments jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id      text := gen_random_uuid()::text;
  v_number  integer;
  v_item    jsonb;
  v_payment jsonb;
  v_stock   integer;
  v_sort    integer := 0;
BEGIN
  INSERT INTO "Sale" (
    id, "registerId", "cashierId", "customerId", "isMemberPricing", "subtotalCents",
    "discountCents", "taxCents", "totalCents", "changeCents", "receiptEmail"
  ) VALUES (
    v_id,
    p_sale->>'registerId',
    p_sale->>'cashierId',
    p_sale->>'customerId',
    COALESCE((p_sale->>'isMemberPricing')::boolean, false),
    (p_sale->>'subtotalCents')::integer,
    (p_sale->>'discountCents')::integer,
    (p_sale->>'taxCents')::integer,
    (p_sale->>'totalCents')::integer,
    COALESCE((p_sale->>'changeCents')::integer, 0),
    p_sale->>'receiptEmail'
  )
  RETURNING "number" INTO v_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO "SaleItem" (
      id, "saleId", "variantId", description, "categoryName", quantity, "unitPriceCents",
      "discountCents", "taxRateBps", "subtotalCents", "taxCents", "totalCents", "sortOrder"
    ) VALUES (
      gen_random_uuid()::text,
      v_id,
      v_item->>'variantId',
      v_item->>'description',
      v_item->>'categoryName',
      (v_item->>'quantity')::integer,
      (v_item->>'unitPriceCents')::integer,
      COALESCE((v_item->>'discountCents')::integer, 0),
      (v_item->>'taxRateBps')::integer,
      (v_item->>'subtotalCents')::integer,
      (v_item->>'taxCents')::integer,
      (v_item->>'totalCents')::integer,
      v_sort
    );
    v_sort := v_sort + 1;

    IF COALESCE((v_item->>'trackInventory')::boolean, false) AND v_item->>'variantId' IS NOT NULL THEN
      UPDATE "ProductVariant"
      SET "stockQty" = "stockQty" - (v_item->>'quantity')::integer
      WHERE id = v_item->>'variantId'
      RETURNING "stockQty" INTO v_stock;

      INSERT INTO "InventoryAdjustment" (id, "variantId", "quantityChange", "stockAfter", reason, note, "userId")
      VALUES (
        gen_random_uuid()::text,
        v_item->>'variantId',
        -(v_item->>'quantity')::integer,
        v_stock,
        'SALE',
        'Sale #' || v_number,
        p_sale->>'userId'
      );
    END IF;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO "Payment" (id, "saleId", method, "amountCents", "tenderedCents")
    VALUES (
      gen_random_uuid()::text,
      v_id,
      (v_payment->>'method')::"PaymentMethod",
      (v_payment->>'amountCents')::integer,
      (v_payment->>'tenderedCents')::integer
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END;
$$;

-- Only the service role (Pages Functions) may call it; see adjust_inventory in 3_pos_catalog
REVOKE ALL ON FUNCTION create_sale(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sale(jsonb, jsonb, jsonb) TO service_role;

COMMIT;
