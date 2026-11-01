-- 11_rates
-- Greens fee and cart rates as tagged POS products (Product.rateKey: WEEKDAY_9, WEEKDAY_18, WEEKEND_9, WEEKEND_18,
-- CART), so online booking and the register charge the same prices; Admin → Settings → Rates edits them.
-- Holiday dates that get weekend rates (CourseSettings.holidayDates); online bookings record whether they paid
-- for carts (Booking.cartIncluded).
--
-- Data: links the existing "Weekday 18 Holes" / "Weekend 18 Holes" greens fee products (or creates the rate
-- products) and sets the starting rates: weekday 9/18 $20/$30, weekend/holiday 9/18 $30/$40, cart $12 per rider.
-- Deer Run has no twilight rate, so the old "Twilight" and "9 Holes" products are deactivated (kept for history).
--
-- Run in the Supabase SQL Editor after 10_on_course_tracking. Then, from a network that can reach the database,
-- copy this file to prisma/migrations/11_rates/migration.sql and run
--   npx prisma migrate resolve --applied 11_rates

BEGIN;

-- ─── Generated from prisma/schema.prisma via `prisma migrate diff` ──────────

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cartIncluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CourseSettings" ADD COLUMN     "holidayDates" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "rateKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_rateKey_key" ON "Product"("rateKey");

-- ─── Rate products ──────────────────────────────────────────────────────────

INSERT INTO "ProductCategory" (id, name, "sortOrder") VALUES
  (gen_random_uuid()::text, 'Greens Fees', 10),
  (gen_random_uuid()::text, 'Cart Fees',   20)
ON CONFLICT (name) DO NOTHING;

-- Tags (or creates) the product for one rate and sets its price; variant price overrides are cleared so the
-- register charges exactly the rate. p_legacy is an existing untagged product name to adopt instead of creating one.
CREATE OR REPLACE FUNCTION pg_temp.seed_rate(
  p_key text, p_category text, p_name text, p_description text, p_price integer, p_member_price integer,
  p_sort integer, p_legacy text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_product text;
BEGIN
  SELECT id INTO v_product FROM "Product" WHERE "rateKey" = p_key;

  IF v_product IS NULL AND p_legacy IS NOT NULL THEN
    SELECT p.id INTO v_product
    FROM "Product" p JOIN "ProductCategory" c ON c.id = p."categoryId"
    WHERE c.name = p_category AND p.name = p_legacy AND p."rateKey" IS NULL
    ORDER BY p."createdAt" LIMIT 1;
  END IF;

  IF v_product IS NULL THEN
    v_product := gen_random_uuid()::text;
    INSERT INTO "Product" (id, "categoryId", name, description, "priceCents", "memberPriceCents", "sortOrder")
    SELECT v_product, c.id, p_name, p_description, p_price, p_member_price, p_sort
    FROM "ProductCategory" c WHERE c.name = p_category;
    INSERT INTO "ProductVariant" (id, "productId") VALUES (gen_random_uuid()::text, v_product);
  END IF;

  UPDATE "Product"
  SET "rateKey" = p_key, name = p_name, description = p_description, "priceCents" = p_price, active = true
  WHERE id = v_product;
  UPDATE "ProductVariant" SET "priceCents" = NULL WHERE "productId" = v_product;
END;
$$;

--                        key           category       name                        description                           price member sort legacy name
SELECT pg_temp.seed_rate('WEEKDAY_9',  'Greens Fees', 'Weekday 9 Holes',          'Mon–Fri. Per player.',               2000, 0,    5);
SELECT pg_temp.seed_rate('WEEKDAY_18', 'Greens Fees', 'Weekday 18 Holes',         'Mon–Fri. Per player.',               3000, 0,   10, 'Weekday 18 Holes');
SELECT pg_temp.seed_rate('WEEKEND_9',  'Greens Fees', 'Weekend/Holiday 9 Holes',  'Sat–Sun and holidays. Per player.',  3000, 0,   15);
SELECT pg_temp.seed_rate('WEEKEND_18', 'Greens Fees', 'Weekend/Holiday 18 Holes', 'Sat–Sun and holidays. Per player.',  4000, 0,   20, 'Weekend 18 Holes');
SELECT pg_temp.seed_rate('CART',       'Cart Fees',   'Cart Fee',                 'Per rider.',                         1200, NULL, 5);

-- No twilight rate at Deer Run; the old flat 9-hole product is replaced by the weekday/weekend 9-hole rates
UPDATE "Product" p SET active = false
FROM "ProductCategory" c
WHERE c.id = p."categoryId" AND c.name = 'Greens Fees' AND p.name IN ('Twilight', '9 Holes') AND p."rateKey" IS NULL;

COMMIT;
