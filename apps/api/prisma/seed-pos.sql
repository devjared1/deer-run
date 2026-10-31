-- POS starter catalog, for the Supabase SQL Editor (run after migrations/3_pos_catalog).
-- Safe to re-run: categories and the register are only added if missing, and products are only
-- added when the Product table is empty.
--
-- Greens fees, range, rentals and membership prices come from apps/web/src/data/rates.js and
-- membershipTiers.js. Concessions, apparel and golf supply prices are PLACEHOLDERS to review
-- in Admin → Products before go-live. Members get $0 greens fees and range balls (unlimited
-- rounds and free range balls are membership benefits).

BEGIN;

INSERT INTO "ProductCategory" (id, name, "sortOrder") VALUES
  (gen_random_uuid()::text, 'Greens Fees',            10),
  (gen_random_uuid()::text, 'Cart Fees',              20),
  (gen_random_uuid()::text, 'Driving Range',          30),
  (gen_random_uuid()::text, 'Membership Dues',        40),
  (gen_random_uuid()::text, 'Concessions',            50),
  (gen_random_uuid()::text, 'Apparel',                60),
  (gen_random_uuid()::text, 'Golf Equipment & Balls', 70),
  (gen_random_uuid()::text, 'Rentals',                80),
  (gen_random_uuid()::text, 'Lessons',                90),
  (gen_random_uuid()::text, 'Tournament Entries',    100),
  (gen_random_uuid()::text, 'Gift Cards',            110),
  (gen_random_uuid()::text, 'Misc',                  120)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "Register" (id, name) VALUES (gen_random_uuid()::text, 'Pro Shop')
ON CONFLICT (name) DO NOTHING;

-- Adds a product with one variant per size × color, or a single default variant if neither is given
CREATE OR REPLACE FUNCTION pg_temp.seed_product(
  p_category     text,
  p_name         text,
  p_price        integer,
  p_member_price integer,
  p_track        boolean,
  p_sort         integer,
  p_description  text   DEFAULT NULL,
  p_sizes        text[] DEFAULT '{}',
  p_colors       text[] DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_product text := gen_random_uuid()::text;
  v_size    text;
  v_color   text;
  v_sort    integer := 0;
BEGIN
  INSERT INTO "Product" (id, "categoryId", name, description, "priceCents", "memberPriceCents", "trackInventory", "sortOrder")
  SELECT v_product, c.id, p_name, p_description, p_price, p_member_price, p_track, p_sort
  FROM "ProductCategory" c WHERE c.name = p_category;

  FOREACH v_color IN ARRAY (CASE WHEN cardinality(p_colors) = 0 THEN ARRAY[NULL]::text[] ELSE p_colors END) LOOP
    FOREACH v_size IN ARRAY (CASE WHEN cardinality(p_sizes) = 0 THEN ARRAY[NULL]::text[] ELSE p_sizes END) LOOP
      INSERT INTO "ProductVariant" (id, "productId", size, color, "sortOrder")
      VALUES (gen_random_uuid()::text, v_product, v_size, v_color, v_sort);
      v_sort := v_sort + 1;
    END LOOP;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product") THEN
    RAISE NOTICE 'Products already exist; skipping product seed';
    RETURN;
  END IF;

  -- Greens fees (rates.js)                                   price  member track sort
  PERFORM pg_temp.seed_product('Greens Fees', 'Weekday 18 Holes', 4500, 0, false, 10, 'Mon–Fri before 2 PM. Cart included.');
  PERFORM pg_temp.seed_product('Greens Fees', 'Weekend 18 Holes', 5000, 0, false, 20, 'Sat–Sun and holidays. Cart included.');
  PERFORM pg_temp.seed_product('Greens Fees', 'Twilight',         3000, 0, false, 30, 'After 2 PM daily. Cart included.');
  PERFORM pg_temp.seed_product('Greens Fees', '9 Holes',          2500, 0, false, 40, 'After 4 PM. Cart included.');
  PERFORM pg_temp.seed_product('Greens Fees', 'Walking Rate',     3000, 0, false, 50, 'Weekday only.');
  PERFORM pg_temp.seed_product('Greens Fees', 'Junior Rate',      2000, 0, false, 60, 'Under 18, weekday only.');
  PERFORM pg_temp.seed_product('Greens Fees', 'Senior Rate',      4000, 0, false, 70, 'Ages 65+, weekday only.');

  -- Range and rentals (rates.js)
  PERFORM pg_temp.seed_product('Driving Range', 'Range Bucket', 500, 0,    false, 10);
  PERFORM pg_temp.seed_product('Rentals',       'Club Rental', 2000, NULL, false, 10, 'Full set.');
  PERFORM pg_temp.seed_product('Rentals',       'Pull Cart',    500, NULL, false, 20, 'Per round.');

  -- Membership dues (membershipTiers.js)
  PERFORM pg_temp.seed_product('Membership Dues', 'Individual Membership — Annual',  75000, NULL, false, 10);
  PERFORM pg_temp.seed_product('Membership Dues', 'Individual Membership — Monthly',  7000, NULL, false, 20);
  PERFORM pg_temp.seed_product('Membership Dues', 'Premier Membership — Annual',    120000, NULL, false, 30);
  PERFORM pg_temp.seed_product('Membership Dues', 'Premier Membership — Monthly',    11000, NULL, false, 40);
  PERFORM pg_temp.seed_product('Membership Dues', 'Family Membership — Annual',     165000, NULL, false, 50);
  PERFORM pg_temp.seed_product('Membership Dues', 'Family Membership — Monthly',     15000, NULL, false, 60);

  -- Concessions (placeholder prices)
  PERFORM pg_temp.seed_product('Concessions', 'Bottled Water', 150, NULL, false, 10);
  PERFORM pg_temp.seed_product('Concessions', 'Soft Drink',    200, NULL, false, 20);
  PERFORM pg_temp.seed_product('Concessions', 'Sports Drink',  250, NULL, false, 30);
  PERFORM pg_temp.seed_product('Concessions', 'Hot Dog',       350, NULL, false, 40);
  PERFORM pg_temp.seed_product('Concessions', 'Snack',         150, NULL, false, 50);

  -- Apparel (placeholder prices; stock starts at 0, receive it in Admin → Products)
  PERFORM pg_temp.seed_product('Apparel', 'Deer Run Polo', 4500, NULL, true, 10, NULL,
    ARRAY['S', 'M', 'L', 'XL', 'XXL'], ARRAY['Navy', 'White']);
  PERFORM pg_temp.seed_product('Apparel', 'Deer Run Cap',  2500, NULL, true, 20, 'One size.',
    '{}', ARRAY['Khaki', 'Navy']);

  -- Golf equipment (placeholder prices)
  PERFORM pg_temp.seed_product('Golf Equipment & Balls', 'Golf Balls (Sleeve of 3)', 1200, NULL, true, 10);
  PERFORM pg_temp.seed_product('Golf Equipment & Balls', 'Golf Glove',               1500, NULL, true, 20, NULL,
    ARRAY['S', 'M', 'L', 'XL']);
  PERFORM pg_temp.seed_product('Golf Equipment & Balls', 'Tees (Bag)',                300, NULL, true, 30);
END;
$$;

COMMIT;

-- Quick check:
-- SELECT c.name, count(DISTINCT p.id) AS products, count(v.id) AS variants
-- FROM "ProductCategory" c LEFT JOIN "Product" p ON p."categoryId" = c.id LEFT JOIN "ProductVariant" v ON v."productId" = p.id
-- GROUP BY c.name, c."sortOrder" ORDER BY c."sortOrder";
