-- 8_pos_house_accounts
-- POS Phase 4: member house accounts (HouseAccount, ledger, statements). create_sale() writes the CHARGE entry for
-- HOUSE_ACCOUNT payments (locking the account and checking its limit) and refund_sale() writes the REFUND credit,
-- each in the same transaction as the sale.
--
-- Run in the Supabase SQL Editor after 7_pos_card_payments. Then, from a network that can reach the database, copy
-- this file to prisma/migrations/8_pos_house_accounts/migration.sql and run
--   npx prisma migrate resolve --applied 8_pos_house_accounts

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- CreateEnum
CREATE TYPE "HouseAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountEntryType" AS ENUM ('CHARGE', 'REFUND', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('OPEN', 'PAID', 'AUTOPAY_FAILED');

-- CreateTable
CREATE TABLE "HouseAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "HouseAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditLimitCents" INTEGER NOT NULL DEFAULT 50000,
    "pinHash" TEXT,
    "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedAt" TIMESTAMP(3),
    "autopayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripePaymentMethodId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseAccountEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "AccountEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "method" TEXT,
    "saleId" TEXT,
    "refundId" TEXT,
    "registerId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseAccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "openingCents" INTEGER NOT NULL,
    "chargesCents" INTEGER NOT NULL,
    "creditsCents" INTEGER NOT NULL,
    "closingCents" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'OPEN',
    "emailedAt" TIMESTAMP(3),
    "autopayPaymentIntentId" TEXT,
    "autopayError" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HouseAccount_userId_key" ON "HouseAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseAccount_stripeCustomerId_key" ON "HouseAccount"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseAccountEntry_stripePaymentIntentId_key" ON "HouseAccountEntry"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "HouseAccountEntry_accountId_createdAt_idx" ON "HouseAccountEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "HouseAccountEntry_registerId_createdAt_idx" ON "HouseAccountEntry"("registerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_autopayPaymentIntentId_key" ON "Statement"("autopayPaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_accountId_periodStart_key" ON "Statement"("accountId", "periodStart");

-- AddForeignKey
ALTER TABLE "HouseAccount" ADD CONSTRAINT "HouseAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountEntry" ADD CONSTRAINT "HouseAccountEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "HouseAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountEntry" ADD CONSTRAINT "HouseAccountEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountEntry" ADD CONSTRAINT "HouseAccountEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "SaleRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseAccountEntry" ADD CONSTRAINT "HouseAccountEntry_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "HouseAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written ───────────────────────────────────────────────────────────

-- EnableRowLevelSecurity (no policies: only the service role and table owner have access)
ALTER TABLE "HouseAccount"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseAccountEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Statement"         ENABLE ROW LEVEL SECURITY;

-- create_sale: same as 7_pos_card_payments, plus HOUSE_ACCOUNT payments (p_sale.houseAccountId):
-- locks the account, refuses if it isn't ACTIVE or the charge would go over creditLimitCents, writes the CHARGE entry
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
  v_account "HouseAccount";
  v_balance integer;
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

    -- Charged to a house account: lock the account so two charges can't both slip under the limit
    IF v_payment->>'method' = 'HOUSE_ACCOUNT' THEN
      SELECT * INTO v_account FROM "HouseAccount" WHERE id = p_sale->>'houseAccountId' FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'House account not found';
      END IF;
      IF v_account.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'This house account is %', lower(v_account.status::text);
      END IF;
      SELECT COALESCE(sum("amountCents"), 0) INTO v_balance FROM "HouseAccountEntry" WHERE "accountId" = v_account.id;
      IF v_balance + (v_payment->>'amountCents')::integer > v_account."creditLimitCents" THEN
        RAISE EXCEPTION 'This would put the account over its limit (% available)',
          to_char(GREATEST(v_account."creditLimitCents" - v_balance, 0) / 100.0, 'FM$999,990.00');
      END IF;
      INSERT INTO "HouseAccountEntry" (id, "accountId", type, "amountCents", description, "saleId", "registerId", "createdById")
      VALUES (
        gen_random_uuid()::text, v_account.id, 'CHARGE', (v_payment->>'amountCents')::integer,
        'Sale #' || v_number, v_id, p_sale->>'registerId', p_sale->>'userId'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END;
$$;

REVOKE ALL ON FUNCTION create_sale(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sale(jsonb, jsonb, jsonb) TO service_role;

-- refund_sale: same as 7_pos_card_payments, plus method HOUSE_ACCOUNT: credits the account the sale was charged to
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
  v_account_id text;
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

  -- Back to the house account the sale was charged to: a credit on the account ledger
  IF p_refund->>'method' = 'HOUSE_ACCOUNT' THEN
    SELECT "accountId" INTO v_account_id FROM "HouseAccountEntry"
    WHERE "saleId" = v_sale.id AND type = 'CHARGE' LIMIT 1;
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Sale #% wasn''t charged to a house account', v_sale.number;
    END IF;
    INSERT INTO "HouseAccountEntry" (id, "accountId", type, "amountCents", description, "saleId", "refundId", "registerId", "createdById")
    VALUES (
      gen_random_uuid()::text, v_account_id, 'REFUND', -v_total,
      CASE WHEN p_refund->>'kind' = 'VOID' THEN 'Void of sale #' ELSE 'Refund on sale #' END || v_sale.number,
      v_sale.id, v_refund_id, p_refund->>'registerId', p_refund->>'userId'
    );
  END IF;

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
