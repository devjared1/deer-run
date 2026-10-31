-- 7_pos_card_payments
-- POS Phase 3: card payments through Stripe Terminal (CardCheckout), card refunds (SaleRefund.stripeRefundId),
-- and create_sale() / refund_sale() updated to store the new links.
--
-- Run in the Supabase SQL Editor after 6_pos_teesheet_memberships_drawers. Then, from a network that can reach
-- the database, copy this file to prisma/migrations/7_pos_card_payments/migration.sql and run
--   npx prisma migrate resolve --applied 7_pos_card_payments

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "CardCheckoutStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'COMPLETING', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "SaleRefund" ADD COLUMN     "stripeRefundId" TEXT;

-- CreateTable
CREATE TABLE "CardCheckout" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "CardCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeReaderId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "saleId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardCheckout_stripePaymentIntentId_key" ON "CardCheckout"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "CardCheckout_saleId_key" ON "CardCheckout"("saleId");

-- CreateIndex
CREATE INDEX "CardCheckout_registerId_createdAt_idx" ON "CardCheckout"("registerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRefund_stripeRefundId_key" ON "SaleRefund"("stripeRefundId");

-- AddForeignKey
ALTER TABLE "CardCheckout" ADD CONSTRAINT "CardCheckout_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCheckout" ADD CONSTRAINT "CardCheckout_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCheckout" ADD CONSTRAINT "CardCheckout_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access)
ALTER TABLE "CardCheckout" ENABLE ROW LEVEL SECURITY;

-- create_sale: same as 4_pos_sales, plus two optional fields it now stores:
--   p_items[].bookingId               tee time the line is for (POS Phase 5; was linked after the sale before)
--   p_payments[].stripePaymentIntentId card payments (POS Phase 3)
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
      "discountCents", "taxRateBps", "subtotalCents", "taxCents", "totalCents", "sortOrder", "bookingId"
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
      v_sort,
      v_item->>'bookingId'
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
    INSERT INTO "Payment" (id, "saleId", method, "amountCents", "tenderedCents", "stripePaymentIntentId")
    VALUES (
      gen_random_uuid()::text,
      v_id,
      (v_payment->>'method')::"PaymentMethod",
      (v_payment->>'amountCents')::integer,
      (v_payment->>'tenderedCents')::integer,
      v_payment->>'stripePaymentIntentId'
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END;
$$;

REVOKE ALL ON FUNCTION create_sale(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sale(jsonb, jsonb, jsonb) TO service_role;

-- refund_sale: same as 5_pos_approvals_refunds, plus p_refund.stripeRefundId for card refunds
CREATE OR REPLACE FUNCTION refund_sale(p_refund jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sale       "Sale";
  v_item       jsonb;
  v_line       "SaleItem";
  v_refund_id  text := gen_random_uuid()::text;
  v_qty        integer;
  v_remaining  integer;
  v_amount     integer;
  v_tax        integer;
  v_total      integer := 0;
  v_total_tax  integer := 0;
  v_track      boolean;
  v_stock      integer;
  v_open_lines integer;
  v_status     "SaleStatus";
BEGIN
  SELECT * INTO v_sale FROM "Sale" WHERE id = p_refund->>'saleId' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF v_sale.status IN ('VOIDED', 'REFUNDED') THEN
    RAISE EXCEPTION 'Sale #% has already been fully refunded', v_sale.number;
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Choose at least one item to refund';
  END IF;

  INSERT INTO "SaleRefund" (id, "saleId", kind, method, "amountCents", "taxCents", restocked, reason, "approvalId", "cashierId", "registerId", "stripeRefundId")
  VALUES (
    v_refund_id, v_sale.id, (p_refund->>'kind')::"RefundKind", (p_refund->>'method')::"PaymentMethod", 0, 0,
    COALESCE((p_refund->>'restock')::boolean, false), p_refund->>'reason', p_refund->>'approvalId',
    p_refund->>'cashierId', p_refund->>'registerId', p_refund->>'stripeRefundId'
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_line FROM "SaleItem" WHERE id = v_item->>'saleItemId' AND "saleId" = v_sale.id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That item is not part of sale #%', v_sale.number;
    END IF;

    v_qty := (v_item->>'quantity')::integer;
    v_remaining := v_line.quantity - v_line."refundedQuantity";
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > v_remaining THEN
      RAISE EXCEPTION '%: only % can still be refunded', v_line.description, v_remaining;
    END IF;

    IF v_qty = v_remaining THEN
      v_amount := v_line."totalCents" - v_line."refundedCents";
      v_tax    := v_line."taxCents" - v_line."refundedTaxCents";
    ELSE
      v_amount := round(v_line."totalCents"::numeric * v_qty / v_line.quantity);
      v_tax    := round(v_line."taxCents"::numeric * v_qty / v_line.quantity);
    END IF;

    INSERT INTO "SaleRefundItem" (id, "refundId", "saleItemId", quantity, "amountCents", "taxCents")
    VALUES (gen_random_uuid()::text, v_refund_id, v_line.id, v_qty, v_amount, v_tax);

    UPDATE "SaleItem"
    SET "refundedQuantity" = "refundedQuantity" + v_qty,
        "refundedCents"    = "refundedCents" + v_amount,
        "refundedTaxCents" = "refundedTaxCents" + v_tax
    WHERE id = v_line.id;

    IF COALESCE((p_refund->>'restock')::boolean, false) AND v_line."variantId" IS NOT NULL THEN
      SELECT p."trackInventory" INTO v_track
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE v.id = v_line."variantId";

      IF v_track THEN
        UPDATE "ProductVariant" SET "stockQty" = "stockQty" + v_qty
        WHERE id = v_line."variantId"
        RETURNING "stockQty" INTO v_stock;

        INSERT INTO "InventoryAdjustment" (id, "variantId", "quantityChange", "stockAfter", reason, note, "userId")
        VALUES (
          gen_random_uuid()::text, v_line."variantId", v_qty, v_stock, 'RETURN',
          CASE WHEN p_refund->>'kind' = 'VOID' THEN 'Void of sale #' ELSE 'Refund on sale #' END || v_sale.number,
          p_refund->>'userId'
        );
      END IF;
    END IF;

    v_total     := v_total + v_amount;
    v_total_tax := v_total_tax + v_tax;
  END LOOP;

  UPDATE "SaleRefund" SET "amountCents" = v_total, "taxCents" = v_total_tax WHERE id = v_refund_id;

  SELECT count(*) INTO v_open_lines FROM "SaleItem" WHERE "saleId" = v_sale.id AND "refundedQuantity" < quantity;
  v_status := CASE
    WHEN v_open_lines > 0 THEN 'PARTIALLY_REFUNDED'
    WHEN p_refund->>'kind' = 'VOID' THEN 'VOIDED'
    ELSE 'REFUNDED'
  END;

  UPDATE "Sale" SET status = v_status, "refundedCents" = "refundedCents" + v_total WHERE id = v_sale.id;

  RETURN jsonb_build_object('id', v_refund_id, 'amountCents', v_total, 'taxCents', v_total_tax, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION refund_sale(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_sale(jsonb, jsonb) TO service_role;

COMMIT;
