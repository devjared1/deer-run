-- POS manager approvals (manager PIN, approval log), voids and refunds, and refund_sale().
-- Run in the Supabase SQL Editor after 4_pos_sales. Once applied there, mark it as applied for
-- Prisma with:
--   npx prisma migrate resolve --applied 5_pos_approvals_refunds

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('DISCOUNT', 'NO_SALE', 'VOID', 'REFUND', 'CHANGE_REGISTER');

-- CreateEnum
CREATE TYPE "RefundKind" AS ENUM ('VOID', 'REFUND');

-- AlterEnum
ALTER TYPE "InventoryReason" ADD VALUE 'RETURN';

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "managerPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "managerPinHash" TEXT,
ADD COLUMN     "managerPinLockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "refundedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "refundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedTaxCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ManagerApproval" (
    "id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "approverId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "registerId" TEXT,
    "saleId" TEXT,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRefund" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "kind" "RefundKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRefundItem" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,

    CONSTRAINT "SaleRefundItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerApproval_createdAt_idx" ON "ManagerApproval"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRefund_approvalId_key" ON "SaleRefund"("approvalId");

-- CreateIndex
CREATE INDEX "SaleRefund_saleId_idx" ON "SaleRefund"("saleId");

-- CreateIndex
CREATE INDEX "SaleRefund_createdAt_idx" ON "SaleRefund"("createdAt");

-- CreateIndex
CREATE INDEX "SaleRefundItem_refundId_idx" ON "SaleRefundItem"("refundId");

-- AddForeignKey
ALTER TABLE "ManagerApproval" ADD CONSTRAINT "ManagerApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerApproval" ADD CONSTRAINT "ManagerApproval_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerApproval" ADD CONSTRAINT "ManagerApproval_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerApproval" ADD CONSTRAINT "ManagerApproval_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ManagerApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRefundItem" ADD CONSTRAINT "SaleRefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "SaleRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRefundItem" ADD CONSTRAINT "SaleRefundItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access)
ALTER TABLE "ManagerApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleRefund"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleRefundItem"  ENABLE ROW LEVEL SECURITY;

-- refund_sale: records a void or refund in one transaction. Locks the sale and its lines so the
-- same items can't be refunded twice, works out the money per line, returns tracked items to
-- stock (if p_refund.restock), and updates the sale's status and refunded total.
-- Same-day and manager-approval rules are checked by the API before calling.
--   p_refund: { saleId, kind (VOID|REFUND), method, reason, restock, approvalId, cashierId, registerId, userId }
--   p_items:  [{ saleItemId, quantity }]
-- Per line: refunding the last remaining units returns exactly what's left of the line total, so
-- rounding never refunds more or less than was paid; partial quantities are prorated and rounded.
-- Returns { id, amountCents, taxCents, status }.
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

  INSERT INTO "SaleRefund" (id, "saleId", kind, method, "amountCents", "taxCents", restocked, reason, "approvalId", "cashierId", "registerId")
  VALUES (
    v_refund_id, v_sale.id, (p_refund->>'kind')::"RefundKind", (p_refund->>'method')::"PaymentMethod", 0, 0,
    COALESCE((p_refund->>'restock')::boolean, false), p_refund->>'reason', p_refund->>'approvalId',
    p_refund->>'cashierId', p_refund->>'registerId'
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

-- Only the service role (Pages Functions) may call it; see adjust_inventory in 3_pos_catalog
REVOKE ALL ON FUNCTION refund_sale(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_sale(jsonb, jsonb) TO service_role;

COMMIT;
