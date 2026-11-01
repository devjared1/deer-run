-- Demo data for showing off the site, admin panel, staff portal and register, for the Supabase SQL Editor.
--
-- DEMO / STAGING DATABASES ONLY. It creates sign-in accounts, employees, ~75 days of tee time bookings and sales,
-- drawer sessions, timesheets, schedules, time off, house accounts with statements, inquiries and events.
--
-- Run after migrations 0–10, prisma/seed.sql and prisma/seed-pos.sql. Everything is dated relative to the day it
-- runs (course-local time, America/Chicago), so "today" has a tee sheet, people on the clock and an open drawer.
-- Safe to re-run: it does nothing if the demo GM (gm@example.com) already exists.
--
-- Sign-ins (password for all: DeerRun2026!)
--   gm@example.com      Dale Whitfield   General Manager, admin panel + staff portal, manager PIN 1234
--   pro@example.com     Marcus Bell      Head Golf Professional, register manager, manager PIN 1234
--   shop@example.com    Emma Carter      Pro Shop Attendant (register, no manager rights)
--   crew@example.com    Luis Ramirez     Grounds Crew (time clock, schedule, time off only)
--   member@example.com  Bob Parker       Premier member with a house account (member PIN 1234)
--   guest@example.com   Kevin Ramsey     Regular guest golfer with bookings
-- Other managers (Hank Foster, Sherry Moss) and member James Holloway also use PIN 1234.
--
-- Everything uses @example.com addresses, so no email reaches a real person. Seeded card payments and online
-- bookings have no real Stripe charge behind them: demo refunds on cash or house account sales, not card sales.

BEGIN;

-- ─── Helpers (temporary: dropped when the session ends) ─────────────────────

-- Course-local date + "HH:MM" → UTC timestamp, the way TIMESTAMP(3) columns are stored
CREATE OR REPLACE FUNCTION pg_temp.demo_ts(p_date date, p_time text)
RETURNS timestamp LANGUAGE sql AS $fn$
  SELECT ((p_date + p_time::time) AT TIME ZONE 'America/Chicago') AT TIME ZONE 'UTC'
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.demo_local_hour(p_ts timestamp)
RETURNS integer LANGUAGE sql AS $fn$
  SELECT extract(hour FROM (p_ts AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago')::integer
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.demo_rand(p_lo integer, p_hi integer)
RETURNS integer LANGUAGE sql AS $fn$
  SELECT p_lo + floor(random() * (p_hi - p_lo + 1))::integer
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.demo_pick(p_items text[])
RETURNS text LANGUAGE sql AS $fn$
  SELECT p_items[1 + floor(random() * cardinality(p_items))::integer]
$fn$;

-- A variant by product name (and size/color), or null if the product was renamed or removed
CREATE OR REPLACE FUNCTION pg_temp.demo_vid(p_product text, p_size text DEFAULT NULL, p_color text DEFAULT NULL)
RETURNS text LANGUAGE sql AS $fn$
  SELECT v.id FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
  WHERE p.name = p_product AND v.size IS NOT DISTINCT FROM p_size AND v.color IS NOT DISTINCT FROM p_color
  ORDER BY v."sortOrder" LIMIT 1
$fn$;

-- A confirmed Supabase Auth email/password user (reused if the email already exists). Returns auth.users.id.
CREATE OR REPLACE FUNCTION pg_temp.demo_auth_user(p_email text, p_name text, p_password text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', p_name), now(), now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;
  RETURN v_id::text;
END;
$fn$;

-- A User row (with a sign-in when p_login). Returns User.id.
CREATE OR REPLACE FUNCTION pg_temp.demo_user(
  p_email text, p_name text, p_role text, p_login boolean, p_password text,
  p_tier text DEFAULT NULL, p_until date DEFAULT NULL, p_reminder text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_id   text;
  v_auth text;
BEGIN
  IF p_login THEN
    v_auth := pg_temp.demo_auth_user(p_email, p_name, p_password);
  END IF;
  SELECT id INTO v_id FROM "User" WHERE email = p_email;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid()::text;
    INSERT INTO "User" (id, email, name, role, "supabaseId", "membershipTier", "memberUntil", "renewalReminderKey", "createdAt")
    VALUES (v_id, p_email, p_name, p_role::"Role", v_auth, p_tier, p_until, p_reminder, now() - interval '150 days');
  ELSE
    UPDATE "User"
    SET name = p_name, role = p_role::"Role", "supabaseId" = COALESCE("supabaseId", v_auth),
        "membershipTier" = p_tier, "memberUntil" = p_until, "renewalReminderKey" = p_reminder
    WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$fn$;

-- An employee; managers get PIN 1234 (same PBKDF2 format as functions/api/staff/_pin.js)
CREATE OR REPLACE FUNCTION pg_temp.demo_employee(
  p_first text, p_last text, p_email text, p_phone text, p_position text, p_rate integer, p_hired date,
  p_user text DEFAULT NULL, p_pin boolean DEFAULT false, p_active boolean DEFAULT true
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_id text := gen_random_uuid()::text;
BEGIN
  INSERT INTO "Employee" (id, "userId", "firstName", "lastName", email, phone, position, "hourlyRateCents", "hireDate", active, "managerPinHash", "createdAt")
  VALUES (
    v_id, p_user, p_first, p_last, p_email, p_phone, p_position::"EmployeePosition", p_rate, p_hired, p_active,
    CASE WHEN p_pin THEN 'pbkdf2$10000$ZGVlcnJ1bi1kZW1vLXBpbg==$QW3KVZ6osZtVY2XbLyuLbEvQ9EoLDQvfQmFy7nwHleM=' END,
    p_hired
  );
  RETURN v_id;
END;
$fn$;

-- A used manager approval (approved a minute before p_at)
CREATE OR REPLACE FUNCTION pg_temp.demo_approval(
  p_action text, p_approver text, p_cashier text, p_register text, p_sale text, p_reason text, p_at timestamp
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_id text := gen_random_uuid()::text;
BEGIN
  INSERT INTO "ManagerApproval" (id, action, "approverId", "cashierId", "registerId", "saleId", reason, "expiresAt", "usedAt", "createdAt")
  VALUES (v_id, p_action::"ApprovalAction", p_approver, p_cashier, p_register, p_sale, p_reason,
          p_at + interval '4 minutes', p_at, p_at - interval '1 minute');
  RETURN v_id;
END;
$fn$;

-- A sale priced the way src/lib/pricing.js does it (member price, member Pro Shop discount, per-line tax),
-- dated p_at. p_lines: [{ "v": variantId, "q": quantity, "b": bookingId? }]. Returns Sale.id.
CREATE OR REPLACE FUNCTION pg_temp.demo_sale(
  p_register text, p_cashier text, p_customer text, p_at timestamp, p_lines jsonb, p_method text
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_id       text := gen_random_uuid()::text;
  v_number   integer;
  v_tax_bps  integer;
  v_member   boolean := false;
  v_tier     text;
  v_line     jsonb;
  r          record;
  v_qty      integer;
  v_unit     integer;
  v_bps      integer;
  v_md       integer;
  v_sub      integer;
  v_rate     integer;
  v_tax      integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_taxes    integer := 0;
  v_total    integer;
  v_tendered integer;
  v_sort     integer := 0;
  v_stock    integer;
  v_account  text;
BEGIN
  SELECT "salesTaxBps" INTO v_tax_bps FROM "CourseSettings" WHERE id = 'singleton';
  IF p_customer IS NOT NULL THEN
    SELECT role = 'MEMBER' AND ("memberUntil" IS NULL OR "memberUntil" >= p_at::date), "membershipTier"
    INTO v_member, v_tier FROM "User" WHERE id = p_customer;
  END IF;

  INSERT INTO "Sale" (id, "registerId", "cashierId", "customerId", "isMemberPricing", "subtotalCents", "discountCents", "taxCents", "totalCents", "createdAt")
  VALUES (v_id, p_register, p_cashier, p_customer, COALESCE(v_member, false), 0, 0, 0, 0, p_at)
  RETURNING "number" INTO v_number;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT v.id AS vid, v.size, v.color, v."priceCents" AS vprice, v."memberPriceCents" AS vmprice,
           p.name AS pname, p."priceCents" AS pprice, p."memberPriceCents" AS pmprice, p."trackInventory" AS track,
           c.name AS cname, c."taxExempt" AS exempt, c."memberDiscount" AS mdisc
    INTO r
    FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" JOIN "ProductCategory" c ON c.id = p."categoryId"
    WHERE v.id = v_line->>'v';
    CONTINUE WHEN NOT FOUND;

    v_qty  := (v_line->>'q')::integer;
    v_unit := COALESCE(r.vprice, r.pprice);
    IF v_member THEN
      v_unit := COALESCE(r.vmprice, r.pmprice, v_unit);
    END IF;
    v_bps := CASE
      WHEN v_member AND r.mdisc AND COALESCE(r.vmprice, r.pmprice) IS NULL
        THEN CASE lower(COALESCE(v_tier, '')) WHEN 'premier' THEN 1500 WHEN 'family' THEN 1500 ELSE 1000 END
      ELSE 0 END;
    v_md   := round(v_unit * v_qty * v_bps / 10000.0);
    v_sub  := v_unit * v_qty - v_md;
    v_rate := CASE WHEN r.exempt THEN 0 ELSE v_tax_bps END;
    v_tax  := round(v_sub * v_rate / 10000.0);

    INSERT INTO "SaleItem" (
      id, "saleId", "variantId", "bookingId", description, "categoryName", quantity, "unitPriceCents",
      "discountCents", "memberDiscountCents", "taxRateBps", "subtotalCents", "taxCents", "totalCents", "sortOrder"
    ) VALUES (
      gen_random_uuid()::text, v_id, r.vid, v_line->>'b',
      r.pname || COALESCE(' — ' || NULLIF(concat_ws(' / ', r.size, r.color), ''), ''),
      r.cname, v_qty, v_unit, v_md, v_md, v_rate, v_sub, v_tax, v_sub + v_tax, v_sort
    );
    v_sort     := v_sort + 1;
    v_subtotal := v_subtotal + v_sub;
    v_discount := v_discount + v_md;
    v_taxes    := v_taxes + v_tax;

    IF r.track THEN
      UPDATE "ProductVariant" SET "stockQty" = "stockQty" - v_qty WHERE id = r.vid RETURNING "stockQty" INTO v_stock;
      INSERT INTO "InventoryAdjustment" (id, "variantId", "quantityChange", "stockAfter", reason, note, "createdAt")
      VALUES (gen_random_uuid()::text, r.vid, -v_qty, v_stock, 'SALE', 'Sale #' || v_number, p_at);
    END IF;
  END LOOP;

  IF v_sort = 0 THEN
    DELETE FROM "Sale" WHERE id = v_id;
    RETURN NULL;
  END IF;

  v_total := v_subtotal + v_taxes;
  IF p_method = 'CASH' THEN
    -- Exact change sometimes, otherwise the next $20
    v_tendered := CASE WHEN random() < 0.4 THEN v_total ELSE (ceil(v_total / 2000.0) * 2000)::integer END;
  END IF;

  UPDATE "Sale"
  SET "subtotalCents" = v_subtotal, "discountCents" = v_discount, "taxCents" = v_taxes, "totalCents" = v_total,
      "changeCents" = COALESCE(v_tendered - v_total, 0)
  WHERE id = v_id;

  IF v_total > 0 THEN
    INSERT INTO "Payment" (id, "saleId", method, "amountCents", "tenderedCents", "createdAt")
    VALUES (gen_random_uuid()::text, v_id, p_method::"PaymentMethod", v_total, v_tendered, p_at);

    IF p_method = 'HOUSE_ACCOUNT' THEN
      SELECT id INTO v_account FROM "HouseAccount" WHERE "userId" = p_customer;
      INSERT INTO "HouseAccountEntry" (id, "accountId", type, "amountCents", description, "saleId", "registerId", "createdAt")
      VALUES (gen_random_uuid()::text, v_account, 'CHARGE', v_total, 'Sale #' || v_number, v_id, p_register, p_at);
    END IF;
  END IF;

  RETURN v_id;
END;
$fn$;

-- A statement worked out from the ledger like buildStatement() in functions/api/admin/_houseAccounts.js
CREATE OR REPLACE FUNCTION pg_temp.demo_statement(p_account text, p_start date, p_end date)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  v_id      text := gen_random_uuid()::text;
  v_from    timestamp := pg_temp.demo_ts(p_start, '00:00');
  v_to      timestamp := pg_temp.demo_ts(p_end + 1, '00:00');
  v_opening integer;
  v_charges integer;
  v_credits integer;
BEGIN
  SELECT COALESCE(sum("amountCents"), 0) INTO v_opening
  FROM "HouseAccountEntry" WHERE "accountId" = p_account AND "createdAt" < v_from;
  SELECT COALESCE(sum("amountCents") FILTER (WHERE "amountCents" > 0), 0),
         COALESCE(sum("amountCents") FILTER (WHERE "amountCents" < 0), 0)
  INTO v_charges, v_credits
  FROM "HouseAccountEntry" WHERE "accountId" = p_account AND "createdAt" >= v_from AND "createdAt" < v_to;

  INSERT INTO "Statement" (
    id, "accountId", "periodStart", "periodEnd", "openingCents", "chargesCents", "creditsCents", "closingCents",
    "dueDate", status, "emailedAt", "createdAt"
  ) VALUES (
    v_id, p_account, p_start, p_end, v_opening, v_charges, v_credits, v_opening + v_charges + v_credits,
    p_end + 15,
    (CASE WHEN v_opening + v_charges + v_credits <= 0 THEN 'PAID' ELSE 'OPEN' END)::"StatementStatus",
    pg_temp.demo_ts(p_end + 1, '06:15'), pg_temp.demo_ts(p_end + 1, '06:15')
  );
  RETURN v_id;
END;
$fn$;

-- ─── The demo ───────────────────────────────────────────────────────────────

DO $demo$
DECLARE
  c_days     constant integer := 75;   -- days of booking and sales history
  c_staff    constant integer := 28;   -- days of timesheet history
  c_password constant text := 'DeerRun2026!';

  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_now   timestamp := now() AT TIME ZONE 'UTC';
  v_price integer;

  d         date;
  v_d       date;
  v_dow     integer;
  v_weekend boolean;
  i         integer;
  j         integer;
  v_n       integer;

  v_reg_shop  text;
  v_reg_grill text;

  v_u_gm text; v_u_pro text; v_u_shop text; v_u_crew text;
  v_u_parker text; v_u_holloway text; v_u_mitchell text; v_u_turner text; v_u_jennings text; v_u_guest text;
  v_guest_users text[];
  v_members     text[];

  e_gm text; e_pro text; e_asst text; e_emma text; e_jake text; e_walt text; e_ruby text; e_caleb text;
  e_hank text; e_luis text; e_danny text; e_pete text; e_sherry text; e_andre text; e_kayla text; e_morgan text;

  v_names text[] := ARRAY[
    'Tom Baker', 'Mike Dunn', 'Amy Cole', 'Ray Holcomb', 'Jenny Shelton', 'Wade Burleson', 'Terry Gant',
    'Carl Pruitt', 'Dana Lovell', 'Rick Sizemore', 'Bubba Hatcher', 'Gary Lindsey', 'Stacy Kimbrough',
    'Doug Terry', 'Phil McCutcheon', 'Ben Ricks', 'Lori Abernathy', 'Tim Gargis', 'Josh Kilpatrick',
    'Will Blankenship', 'Hal Tidwell', 'Shane Copeland', 'Mark Ezell', 'Randy Steele'];

  v_vid_weekday  text; v_vid_weekend text; v_vid_twilight text; v_vid_range text; v_vid_water text;
  v_vid_membership text;
  v_shop_items  text[];
  v_apparel     text[];
  v_grill_items text[];

  v_acc_parker   text;
  v_acc_holloway text;

  v_turkey date; v_toydrive date; v_memberguest date;

  v_slot_id   text;
  v_slot_time text;
  v_slot_at   timestamp;
  v_players   integer;
  v_user      text;
  v_gname     text;
  v_gemail    text;
  v_created   timestamp;
  v_status    text;
  v_checked   timestamp;
  v_is_member boolean;
  v_booking   text;
  v_lines     jsonb;
  v_sale_at   timestamp;
  v_greens    text;
  v_unit      integer;
  v_customer  text;
  v_method    text;
  v_pick      text;
  v_cashier   text;

  v_sess_shop  text;
  v_sess_grill text;
  v_open_at    timestamp;
  v_cash       integer;
  v_appr       text;
  v_amt        integer;

  r       record;
  v_in    timestamp;
  v_out   timestamp;
  v_bs    timestamp;
  v_be    timestamp;
  v_entry text;

  v_sale_id   text;
  v_item_id   text;
  v_number    integer;
  v_res       jsonb;
  v_at        timestamp;

  v_m1s date; v_m1e date; v_m2s date; v_m2e date;
  v_stmt    text;
  v_closing integer;
BEGIN
  IF EXISTS (SELECT 1 FROM "Employee" WHERE email = 'gm@example.com') THEN
    RAISE NOTICE 'Demo data is already loaded (gm@example.com exists); nothing to do';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "CourseSettings" WHERE id = 'singleton')
     OR NOT EXISTS (SELECT 1 FROM "Register" WHERE name = 'Pro Shop')
     OR NOT EXISTS (SELECT 1 FROM "Product") THEN
    RAISE EXCEPTION 'Run prisma/seed.sql and prisma/seed-pos.sql first';
  END IF;

  PERFORM setseed(0.2026); -- same "random" demo every time

  -- ── Settings and registers ──
  UPDATE "CourseSettings" SET "lateFeeCents" = 1500 WHERE id = 'singleton' AND "lateFeeCents" = 0;
  SELECT "pricePerPlayerCents" INTO v_price FROM "CourseSettings" WHERE id = 'singleton';

  SELECT id INTO v_reg_shop FROM "Register" WHERE name = 'Pro Shop';
  INSERT INTO "Register" (id, name) VALUES (gen_random_uuid()::text, 'Grill') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_reg_grill FROM "Register" WHERE name = 'Grill';

  -- ── Sign-ins, members and guests ──
  v_u_gm   := pg_temp.demo_user('gm@example.com',   'Dale Whitfield', 'ADMIN', true, c_password);
  v_u_pro  := pg_temp.demo_user('pro@example.com',  'Marcus Bell',    'GUEST', true, c_password);
  v_u_shop := pg_temp.demo_user('shop@example.com', 'Emma Carter',    'GUEST', true, c_password);
  v_u_crew := pg_temp.demo_user('crew@example.com', 'Luis Ramirez',   'GUEST', true, c_password);

  v_u_parker   := pg_temp.demo_user('member@example.com', 'Bob Parker', 'MEMBER', true, c_password, 'Premier', v_today + 240);
  v_u_holloway := pg_temp.demo_user('james.holloway@example.com', 'James Holloway', 'MEMBER', false, NULL, 'Family', v_today + 150);
  -- Renews in 20 days; the 30-day reminder already went out
  v_u_mitchell := pg_temp.demo_user('sarah.mitchell@example.com', 'Sarah Mitchell', 'MEMBER', false, NULL, 'Individual',
                                    v_today + 20, (v_today + 20)::text || ':30');
  -- Joined at the register 20 days ago (annual membership sale below)
  v_u_turner   := pg_temp.demo_user('grace.turner@example.com', 'Grace Turner', 'MEMBER', false, NULL, 'Individual',
                                    ((v_today - 20) + interval '12 months')::date - 1);
  -- Lapsed last month and dropped to GUEST
  v_u_jennings := pg_temp.demo_user('carol.jennings@example.com', 'Carol Jennings', 'GUEST', false, NULL, 'Individual',
                                    v_today - 25, (v_today - 25)::text || ':expired');

  v_u_guest := pg_temp.demo_user('guest@example.com', 'Kevin Ramsey', 'GUEST', true, c_password);
  v_guest_users := ARRAY[
    v_u_guest,
    pg_temp.demo_user('tom.baker@example.com', 'Tom Baker', 'GUEST', false, NULL),
    pg_temp.demo_user('amy.cole@example.com', 'Amy Cole', 'GUEST', false, NULL),
    pg_temp.demo_user('ray.holcomb@example.com', 'Ray Holcomb', 'GUEST', false, NULL),
    v_u_jennings
  ];
  v_members := ARRAY[v_u_parker, v_u_holloway, v_u_mitchell];

  -- ── Employees ──
  e_gm     := pg_temp.demo_employee('Dale',   'Whitfield', 'gm@example.com',              '(256) 555-0101', 'GENERAL_MANAGER',             NULL, v_today - 2900, v_u_gm, true);
  e_pro    := pg_temp.demo_employee('Marcus', 'Bell',      'pro@example.com',             '(256) 555-0102', 'HEAD_GOLF_PROFESSIONAL',      2800, v_today - 1800, v_u_pro, true);
  e_asst   := pg_temp.demo_employee('Tyler',  'Hughes',    'tyler.hughes@example.com',    '(256) 555-0103', 'ASSISTANT_GOLF_PROFESSIONAL', 1900, v_today - 700);
  e_emma   := pg_temp.demo_employee('Emma',   'Carter',    'shop@example.com',            '(256) 555-0104', 'PRO_SHOP_ATTENDANT',          1300, v_today - 420, v_u_shop);
  e_jake   := pg_temp.demo_employee('Jake',   'Morrison',  'jake.morrison@example.com',   '(256) 555-0105', 'PRO_SHOP_ATTENDANT',          1250, v_today - 260);
  e_walt   := pg_temp.demo_employee('Walt',   'Denton',    'walt.denton@example.com',     '(256) 555-0106', 'STARTER',                     1200, v_today - 1500);
  e_ruby   := pg_temp.demo_employee('Ruby',   'Sanders',   'ruby.sanders@example.com',    '(256) 555-0107', 'PLAYER_ASSISTANT',            1100, v_today - 300);
  e_caleb  := pg_temp.demo_employee('Caleb',  'Price',     'caleb.price@example.com',     '(256) 555-0108', 'OUTSIDE_SERVICES',            1050, v_today - 150);
  e_hank   := pg_temp.demo_employee('Hank',   'Foster',    'hank.foster@example.com',     '(256) 555-0109', 'SUPERINTENDENT',              3000, v_today - 3300, NULL, true);
  e_luis   := pg_temp.demo_employee('Luis',   'Ramirez',   'crew@example.com',            '(256) 555-0110', 'GROUNDS_CREW',                1500, v_today - 1100, v_u_crew);
  e_danny  := pg_temp.demo_employee('Danny',  'Oakes',     'danny.oakes@example.com',     '(256) 555-0111', 'GROUNDS_CREW',                1450, v_today - 500);
  e_pete   := pg_temp.demo_employee('Pete',   'Lyle',      'pete.lyle@example.com',       '(256) 555-0112', 'EQUIPMENT_TECHNICIAN',        2000, v_today - 2100);
  e_sherry := pg_temp.demo_employee('Sherry', 'Moss',      'sherry.moss@example.com',     '(256) 555-0113', 'FOOD_BEVERAGE_MANAGER',       2100, v_today - 1300, NULL, true);
  e_andre  := pg_temp.demo_employee('Andre',  'Collins',   'andre.collins@example.com',   '(256) 555-0114', 'COOK',                        1500, v_today - 650);
  e_kayla  := pg_temp.demo_employee('Kayla',  'Brooks',    'kayla.brooks@example.com',    '(256) 555-0115', 'SERVER',                       900, v_today - 200);
  e_morgan := pg_temp.demo_employee('Morgan', 'Tate',      'morgan.tate@example.com',     '(256) 555-0116', 'BEVERAGE_CART_ATTENDANT',      900, v_today - 120);
  PERFORM pg_temp.demo_employee('Brian', 'Kessler', 'brian.kessler@example.com', '(256) 555-0117', 'PRO_SHOP_ATTENDANT', 1200, v_today - 900, NULL, false, false);

  -- ── Tournaments (dated around today; seed.sql has the 2025/2027 ones) ──
  v_turkey      := (v_today + 14) + ((6 - extract(dow FROM v_today + 14)::integer + 7) % 7);
  v_toydrive    := (v_today + 35) + ((6 - extract(dow FROM v_today + 35)::integer + 7) % 7);
  v_memberguest := (v_today - 10) - ((extract(dow FROM v_today - 10)::integer + 1) % 7);
  INSERT INTO "TournamentEvent" (id, name, description, "eventDate", "startTime", format, entry, "spotsTotal", "memberOnly", featured, past)
  SELECT gen_random_uuid()::text, e.* FROM (VALUES
    ('Turkey Shoot Scramble',
     'Our annual pre-Thanksgiving scramble. Four-person teams, shotgun start, closest-to-the-pin on every par 3 and a turkey for each member of the winning team.',
     v_turkey::timestamp, '8:00 AM', '4-Person Scramble', 6000, 72, false, true, false),
    ('Holiday Toy Drive Scramble',
     'Bring a new, unwrapped toy for the Lawrence County toy drive and get $10 off your entry. Two-person teams, chili lunch after the round.',
     v_toydrive::timestamp, '10:00 AM', '2-Person Scramble', 4000, 48, false, true, false),
    ('Fall Member-Guest',
     '36 teams played two days of better-ball. Champions: Bob Parker and guest Ray Holcomb at 12 under.',
     v_memberguest::timestamp, '8:30 AM', 'Better Ball', 15000, 72, true, false, true)
  ) AS e(name, description, event_date, start_time, format, entry, spots_total, member_only, featured, past)
  WHERE NOT EXISTS (SELECT 1 FROM "TournamentEvent" t WHERE t.name = e.name);

  -- ── Time off (before shifts: approved days off get no shifts) ──
  v_d := v_today + 4;
  WHILE extract(dow FROM v_d) IN (0, 6) LOOP v_d := v_d + 1; END LOOP; -- a weekday Luis works

  INSERT INTO "TimeOffRequest" (id, "employeeId", "startDate", "endDate", type, reason, status, "reviewedById", "reviewedAt", "reviewNote", "createdAt") VALUES
    (gen_random_uuid()::text, e_jake,   v_today + 6,  v_today + 8,  'VACATION', 'Family trip to Gulf Shores', 'APPROVED', v_u_gm, v_now - interval '2 days', 'Have fun! Ruby is covering the shop.', v_now - interval '9 days'),
    (gen_random_uuid()::text, e_asst,   v_today - 12, v_today - 10, 'VACATION', 'PGA education seminar in Birmingham', 'APPROVED', v_u_gm, v_now - interval '30 days', NULL, v_now - interval '35 days'),
    (gen_random_uuid()::text, e_kayla,  v_today + 10, v_today + 10, 'PERSONAL', 'My sister''s wedding', 'PENDING', NULL, NULL, NULL, v_now - interval '1 day'),
    (gen_random_uuid()::text, e_luis,   v_d,          v_d,          'PERSONAL', 'Doctor appointment in Decatur', 'PENDING', NULL, NULL, NULL, v_now - interval '5 hours'),
    (gen_random_uuid()::text, e_morgan, v_today + 20, v_today + 24, 'VACATION', 'Thanksgiving with family in Tennessee', 'PENDING', NULL, NULL, NULL, v_now - interval '3 days'),
    (gen_random_uuid()::text, e_ruby,   v_turkey,     v_turkey,     'PERSONAL', 'Football game in Tuscaloosa', 'DENIED', v_u_gm, v_now - interval '4 days', 'Turkey Shoot weekend: we need every marshal on the course. Sorry!', v_now - interval '6 days'),
    (gen_random_uuid()::text, e_danny,  v_today - 6,  v_today - 6,  'SICK',     'Stomach bug', 'CANCELLED', NULL, NULL, NULL, v_now - interval '7 days');

  -- ── Schedule: weekly pattern, 4 weeks back to 3 weeks ahead ──
  CREATE TEMP TABLE demo_pattern (emp text, dows integer[], start_time text, end_time text) ON COMMIT DROP;
  INSERT INTO demo_pattern VALUES
    (e_gm,     '{1,2,3,4,5}', '08:00', '17:00'),
    (e_pro,    '{2,3,4,5,6}', '07:00', '15:30'),
    (e_asst,   '{0}',         '06:45', '14:45'),
    (e_asst,   '{2,3}',       '12:00', '18:30'),
    (e_emma,   '{1,2,3,4,5}', '06:45', '14:45'),
    (e_jake,   '{4,5,6,0,1}', '12:00', '18:30'),
    (e_walt,   '{3,5,6,0}',   '07:00', '13:00'),
    (e_ruby,   '{5}',         '12:00', '17:00'),
    (e_ruby,   '{6,0}',       '08:00', '14:00'),
    (e_caleb,  '{2,3,4,5,6}', '06:30', '14:30'),
    (e_hank,   '{1,2,3,4,5}', '05:30', '14:00'),
    (e_luis,   '{1,2,3,4,5}', '05:30', '13:30'),
    (e_danny,  '{2,3,4,5,6}', '05:30', '13:30'),
    (e_pete,   '{1,2,3,4}',   '06:00', '16:30'),
    (e_sherry, '{2,3,4,5,6}', '09:00', '17:00'),
    (e_andre,  '{3,4,5,6,0}', '10:00', '16:00'),
    (e_kayla,  '{5,6,0}',     '10:00', '17:00'),
    (e_kayla,  '{4}',         '11:00', '15:00'),
    (e_morgan, '{6,0}',       '09:00', '15:00');

  INSERT INTO "Shift" (id, "employeeId", date, "startTime", "endTime", "createdAt")
  SELECT gen_random_uuid()::text, p.emp, g.day, p.start_time, p.end_time, v_now - interval '35 days'
  FROM demo_pattern p
  CROSS JOIN LATERAL (SELECT generate_series(v_today - c_staff, v_today + 20, interval '1 day')::date AS day) g
  WHERE extract(dow FROM g.day)::integer = ANY(p.dows)
    AND NOT EXISTS (
      SELECT 1 FROM "TimeOffRequest" t
      WHERE t."employeeId" = p.emp AND t.status = 'APPROVED' AND g.day BETWEEN t."startDate" AND t."endDate");

  -- Ruby covers the shop while Jake is away
  INSERT INTO "Shift" (id, "employeeId", date, "startTime", "endTime", position, notes)
  SELECT gen_random_uuid()::text, e_ruby, g.day, '12:00', '18:30', 'PRO_SHOP_ATTENDANT', 'Covering for Jake'
  FROM (SELECT generate_series(v_today + 6, v_today + 8, interval '1 day')::date AS day) g
  WHERE extract(dow FROM g.day)::integer IN (4, 5, 6, 0, 1);

  UPDATE "Shift" SET notes = 'Turkey Shoot Scramble: shotgun start at 8:00, be here by 6:30'
  WHERE date = v_turkey AND "employeeId" IN (e_pro, e_walt, e_ruby, e_caleb, e_morgan);

  -- ── Timesheets: punches for the scheduled shifts so far ──
  FOR r IN
    SELECT s."employeeId", s.date, s."startTime", s."endTime"
    FROM "Shift" s JOIN "Employee" e ON e.id = s."employeeId"
    WHERE s.date BETWEEN v_today - c_staff AND v_today AND e."hourlyRateCents" IS NOT NULL AND e.email LIKE '%@example.com'
    ORDER BY s.date, s."startTime"
  LOOP
    v_in := pg_temp.demo_ts(r.date, r."startTime") + make_interval(mins => pg_temp.demo_rand(-7, 6));
    CONTINUE WHEN v_in > v_now OR random() < 0.03; -- not started yet, or called out
    v_out := pg_temp.demo_ts(r.date, r."endTime") + make_interval(mins => pg_temp.demo_rand(-4, 12));
    IF v_out > v_now THEN v_out := NULL; END IF; -- still on the clock
    v_entry := gen_random_uuid()::text;
    INSERT INTO "TimeEntry" (id, "employeeId", "clockIn", "clockOut", "createdAt") VALUES (v_entry, r."employeeId", v_in, v_out, v_in);

    IF extract(epoch FROM (r."endTime"::time - r."startTime"::time)) >= 6 * 3600 THEN
      v_bs := v_in + make_interval(mins => pg_temp.demo_rand(200, 260));
      v_be := v_bs + make_interval(mins => pg_temp.demo_rand(25, 40));
      IF v_bs < v_now THEN
        INSERT INTO "TimeBreak" (id, "timeEntryId", "startedAt", "endedAt")
        VALUES (gen_random_uuid()::text, v_entry, v_bs, CASE WHEN v_be < v_now THEN v_be END);
      END IF;
    END IF;
  END LOOP;

  -- Caleb forgot to clock out on his last shift (shows on Admin → Timesheets / time clock)
  DELETE FROM "TimeEntry" WHERE "employeeId" = e_caleb AND "clockIn" >= pg_temp.demo_ts(v_today, '00:00');
  UPDATE "TimeEntry" SET "clockOut" = NULL
  WHERE id = (SELECT id FROM "TimeEntry" WHERE "employeeId" = e_caleb ORDER BY "clockIn" DESC LIMIT 1);
  -- A manager correction on one of Emma's punches
  UPDATE "TimeEntry"
  SET "editedById" = v_u_gm, "editedAt" = "clockIn" + interval '26 hours', note = 'Forgot to clock in; start time entered by manager'
  WHERE id = (SELECT id FROM "TimeEntry" WHERE "employeeId" = e_emma AND "clockIn" < pg_temp.demo_ts(v_today - 3, '00:00') ORDER BY "clockIn" DESC LIMIT 1);

  -- ── Catalog extras and opening stock ──
  INSERT INTO "Product" (id, "categoryId", name, description, "priceCents", "sortOrder")
  SELECT gen_random_uuid()::text, c.id, x.name, x.description, x.price, x.sort
  FROM (VALUES
    ('Lessons',            'Private Lesson (30 min)',  'With Marcus or Tyler.',      5000, 10),
    ('Lessons',            'Playing Lesson (9 holes)', 'On-course instruction.',     9000, 20),
    ('Cart Fees',          'Cart Fee (Members)',       'Per rider, 18 holes.',       1500, 10),
    ('Tournament Entries', 'Turkey Shoot Entry',       'Per player.',                6000, 10)
  ) AS x(category, name, description, price, sort)
  JOIN "ProductCategory" c ON c.name = x.category
  WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.name = x.name);
  INSERT INTO "ProductVariant" (id, "productId")
  SELECT gen_random_uuid()::text, p.id FROM "Product" p
  WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id);

  FOR r IN
    SELECT v.id, p.name FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p."trackInventory"
  LOOP
    v_amt := CASE
      WHEN r.name LIKE 'Golf Balls%' THEN 300
      WHEN r.name LIKE 'Tees%'       THEN 220
      WHEN r.name LIKE 'Golf Glove%' THEN 40
      WHEN r.name LIKE '%Cap%'       THEN 36
      WHEN r.name LIKE '%Polo%'      THEN 18
      ELSE 25 END;
    UPDATE "ProductVariant" SET "stockQty" = "stockQty" + v_amt WHERE id = r.id RETURNING "stockQty" INTO v_n;
    INSERT INTO "InventoryAdjustment" (id, "variantId", "quantityChange", "stockAfter", reason, note, "userId", "createdAt")
    VALUES (gen_random_uuid()::text, r.id, v_amt, v_n, 'RECEIVED', 'Fall order from the distributor', v_u_pro,
            pg_temp.demo_ts(v_today - c_days - 3, '10:00'));
  END LOOP;
  -- One low-stock item to show on Admin → Products
  v_pick := pg_temp.demo_vid('Deer Run Polo', 'XXL', 'White');
  IF v_pick IS NOT NULL THEN
    SELECT "stockQty" INTO v_n FROM "ProductVariant" WHERE id = v_pick;
    IF v_n > 2 THEN
      UPDATE "ProductVariant" SET "stockQty" = 2 WHERE id = v_pick;
      INSERT INTO "InventoryAdjustment" (id, "variantId", "quantityChange", "stockAfter", reason, note, "userId", "createdAt")
      VALUES (gen_random_uuid()::text, v_pick, 2 - v_n, 2, 'COUNT_CORRECTION', 'Shelf count', v_u_pro,
              pg_temp.demo_ts(v_today - c_days - 2, '16:00'));
    END IF;
  END IF;

  v_vid_weekday    := pg_temp.demo_vid('Weekday 18 Holes');
  v_vid_weekend    := pg_temp.demo_vid('Weekend/Holiday 18 Holes');
  v_vid_twilight   := pg_temp.demo_vid('Weekday 9 Holes'); -- late weekday rounds play 9 (no twilight rate)
  v_vid_range      := pg_temp.demo_vid('Range Bucket');
  v_vid_water      := pg_temp.demo_vid('Bottled Water');
  v_vid_membership := pg_temp.demo_vid('Individual Membership — Annual');
  v_grill_items := array_remove(ARRAY[
    pg_temp.demo_vid('Hot Dog'), pg_temp.demo_vid('Hot Dog'), pg_temp.demo_vid('Hot Dog'),
    pg_temp.demo_vid('Soft Drink'), pg_temp.demo_vid('Soft Drink'), pg_temp.demo_vid('Soft Drink'),
    v_vid_water, v_vid_water, pg_temp.demo_vid('Sports Drink'), pg_temp.demo_vid('Snack'), pg_temp.demo_vid('Snack')
  ], NULL);
  v_shop_items := array_remove(ARRAY[
    v_vid_water, v_vid_water, v_vid_water, pg_temp.demo_vid('Soft Drink'), pg_temp.demo_vid('Soft Drink'),
    pg_temp.demo_vid('Sports Drink'), pg_temp.demo_vid('Sports Drink'), pg_temp.demo_vid('Snack'), pg_temp.demo_vid('Snack'),
    pg_temp.demo_vid('Golf Balls (Sleeve of 3)'), pg_temp.demo_vid('Golf Balls (Sleeve of 3)'),
    pg_temp.demo_vid('Golf Balls (Sleeve of 3)'), pg_temp.demo_vid('Golf Balls (Sleeve of 3)'),
    pg_temp.demo_vid('Tees (Bag)'), pg_temp.demo_vid('Tees (Bag)'), pg_temp.demo_vid('Tees (Bag)'),
    v_vid_range, v_vid_range, v_vid_range, v_vid_range
  ], NULL);
  -- Apparel and gloves: added to about one sale in eight
  v_apparel := array_remove(ARRAY[
    pg_temp.demo_vid('Golf Glove', 'M'), pg_temp.demo_vid('Golf Glove', 'L'), pg_temp.demo_vid('Golf Glove', 'L'),
    pg_temp.demo_vid('Deer Run Cap', NULL, 'Khaki'), pg_temp.demo_vid('Deer Run Cap', NULL, 'Navy'),
    pg_temp.demo_vid('Deer Run Polo', 'M', 'Navy'), pg_temp.demo_vid('Deer Run Polo', 'L', 'Navy'),
    pg_temp.demo_vid('Deer Run Polo', 'XL', 'White')
  ], NULL);

  -- ── House accounts ──
  v_acc_parker := gen_random_uuid()::text;
  v_acc_holloway := gen_random_uuid()::text;
  INSERT INTO "HouseAccount" (id, "userId", status, "creditLimitCents", "pinHash", "createdAt") VALUES
    (v_acc_parker,   v_u_parker,   'ACTIVE', 150000, 'pbkdf2$10000$ZGVlcnJ1bi1kZW1vLXBpbg==$QW3KVZ6osZtVY2XbLyuLbEvQ9EoLDQvfQmFy7nwHleM=', v_now - interval '140 days'),
    (v_acc_holloway, v_u_holloway, 'ACTIVE', 150000, 'pbkdf2$10000$ZGVlcnJ1bi1kZW1vLXBpbg==$QW3KVZ6osZtVY2XbLyuLbEvQ9EoLDQvfQmFy7nwHleM=', v_now - interval '140 days');

  -- ── Tee time slots for the history (seed.sql covers today + 29) ──
  INSERT INTO "TeeTimeSlot" (id, date, "startTime", "maxPlayers", "memberOnly")
  SELECT gen_random_uuid()::text, g.day, to_char(t.slot, 'HH24:MI'), 4, false
  FROM "CourseSettings" s
  CROSS JOIN LATERAL (SELECT generate_series(v_today - c_days, v_today + 29, interval '1 day')::date AS day) g
  CROSS JOIN LATERAL generate_series(g.day + s."firstTeeTime"::time, g.day + s."lastTeeTime"::time,
                                     make_interval(mins => s."intervalMinutes")) AS t(slot)
  WHERE s.id = 'singleton'
  ON CONFLICT (date, "startTime") DO NOTHING;
  -- Weekend early tee times are member-only from today on
  UPDATE "TeeTimeSlot" s SET "memberOnly" = true
  WHERE s.date >= v_today AND extract(dow FROM s.date) IN (0, 6) AND s."startTime" < '08:30'
    AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."teeTimeSlotId" = s.id);

  -- ── Day by day: drawers, online bookings, walk-ins, Pro Shop and Grill sales ──
  FOR d IN SELECT generate_series(v_today - c_days, v_today + 13, interval '1 day')::date LOOP
    v_dow := extract(dow FROM d)::integer;
    v_weekend := v_dow IN (0, 6);

    -- Drawer sessions (closed ones get their totals after the refunds, at the end)
    v_sess_shop := NULL;
    v_sess_grill := NULL;
    IF d = v_today THEN -- keep a Pro Shop drawer someone already opened today (one open drawer per register)
      SELECT id INTO v_sess_shop FROM "CashDrawerSession" WHERE "registerId" = v_reg_shop AND "closedAt" IS NULL;
    END IF;
    IF d <= v_today AND v_sess_shop IS NULL THEN
      v_sess_shop := gen_random_uuid()::text;
      v_open_at := LEAST(pg_temp.demo_ts(d, '07:00'), v_now - interval '30 minutes');
      INSERT INTO "CashDrawerSession" (id, "registerId", "openedById", "openedAt", "openingFloatCents", "closedById", "closedAt")
      VALUES (v_sess_shop, v_reg_shop,
              CASE v_dow WHEN 6 THEN e_pro WHEN 0 THEN e_asst ELSE e_emma END, v_open_at, 20000,
              CASE WHEN d < v_today THEN CASE WHEN v_dow IN (2, 3) THEN e_asst ELSE e_jake END END,
              CASE WHEN d < v_today THEN pg_temp.demo_ts(d, '18:00') END);
    END IF;
    IF d <= v_today THEN
      IF v_dow <> 1 THEN -- the Grill is closed on Mondays
        v_sess_grill := gen_random_uuid()::text;
        v_open_at := LEAST(pg_temp.demo_ts(d, '09:30'), v_now - interval '20 minutes');
        INSERT INTO "CashDrawerSession" (id, "registerId", "openedById", "openedAt", "openingFloatCents", "closedById", "closedAt")
        VALUES (v_sess_grill, v_reg_grill, CASE WHEN v_dow IN (4, 5, 6, 0) THEN e_kayla ELSE e_sherry END, v_open_at, 15000,
                CASE WHEN d < v_today THEN CASE WHEN v_dow IN (4, 5, 6, 0) THEN e_kayla ELSE e_sherry END END,
                CASE WHEN d < v_today THEN pg_temp.demo_ts(d, '17:00') END);
      END IF;
    END IF;

    -- Online bookings (more on weekends; past the public 7-day window only members can book)
    v_n := CASE WHEN v_weekend THEN pg_temp.demo_rand(10, 16) ELSE pg_temp.demo_rand(5, 10) END;
    IF d > v_today + 7 THEN v_n := pg_temp.demo_rand(1, 3); END IF;
    FOR i IN 1..v_n LOOP
      v_is_member := d > v_today + 7 OR random() < 0.3;
      SELECT s.id, s."startTime" INTO v_slot_id, v_slot_time
      FROM "TeeTimeSlot" s
      WHERE s.date = d AND (v_is_member OR NOT s."memberOnly")
        AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."teeTimeSlotId" = s.id AND b.status <> 'CANCELLED')
      ORDER BY random() LIMIT 1;
      EXIT WHEN v_slot_id IS NULL;

      v_slot_at := pg_temp.demo_ts(d, v_slot_time);
      v_players := (ARRAY[1, 2, 2, 3, 4, 4, 4, 4])[pg_temp.demo_rand(1, 8)];
      v_user := NULL; v_gname := NULL; v_gemail := NULL;
      IF v_is_member THEN
        v_user := pg_temp.demo_pick(CASE WHEN d >= v_today - 20 THEN v_members || v_u_turner ELSE v_members END);
      ELSIF random() < 0.2 THEN
        v_user := pg_temp.demo_pick(v_guest_users);
      ELSE
        v_gname := pg_temp.demo_pick(v_names);
        v_gemail := lower(replace(v_gname, ' ', '.')) || '@example.com';
      END IF;
      v_created := LEAST(v_slot_at - make_interval(days => pg_temp.demo_rand(1, 6), mins => pg_temp.demo_rand(0, 600)),
                         v_now - interval '2 hours');
      v_status := CASE WHEN random() < 0.04 THEN 'CANCELLED' ELSE 'CONFIRMED' END;
      v_checked := CASE WHEN v_status = 'CONFIRMED' AND v_slot_at < v_now AND random() > 0.05
                        THEN v_slot_at - interval '12 minutes' END;
      INSERT INTO "Booking" (id, "teeTimeSlotId", "userId", "guestName", "guestEmail", players, "totalCents", status,
                             "stripePaymentId", source, "checkedInAt", "createdAt")
      VALUES (gen_random_uuid()::text, v_slot_id, v_user, v_gname, v_gemail, v_players, v_players * v_price,
              v_status::"BookingStatus", 'pi_demo_' || substr(md5(random()::text), 1, 24), 'ONLINE', v_checked, v_created);
    END LOOP;

    CONTINUE WHEN d > v_today; -- nothing has been rung up yet

    -- Walk-ins and phone bookings paid at the register
    v_n := CASE WHEN v_weekend THEN pg_temp.demo_rand(4, 7) ELSE pg_temp.demo_rand(2, 4) END;
    FOR i IN 1..v_n LOOP
      EXIT WHEN v_vid_weekday IS NULL OR v_vid_weekend IS NULL OR v_vid_twilight IS NULL;
      SELECT s.id, s."startTime" INTO v_slot_id, v_slot_time
      FROM "TeeTimeSlot" s
      WHERE s.date = d AND NOT s."memberOnly" AND s."startTime" <= '15:30'
        AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."teeTimeSlotId" = s.id AND b.status <> 'CANCELLED')
      ORDER BY random() LIMIT 1;
      EXIT WHEN v_slot_id IS NULL;
      v_slot_at := pg_temp.demo_ts(d, v_slot_time);
      v_sale_at := v_slot_at - make_interval(mins => pg_temp.demo_rand(12, 25));
      CONTINUE WHEN v_sale_at > v_now;

      v_players := (ARRAY[1, 2, 2, 3, 4, 4])[pg_temp.demo_rand(1, 6)];
      v_gname := pg_temp.demo_pick(v_names);
      v_greens := CASE WHEN v_weekend THEN v_vid_weekend WHEN v_slot_time >= '15:00' THEN v_vid_twilight ELSE v_vid_weekday END;
      SELECT COALESCE(v."priceCents", p."priceCents") INTO v_unit
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE v.id = v_greens;

      v_booking := gen_random_uuid()::text;
      INSERT INTO "Booking" (id, "teeTimeSlotId", "guestName", players, "totalCents", status, source, "checkedInAt", "createdAt")
      VALUES (v_booking, v_slot_id, v_gname, v_players, v_unit * v_players, 'CONFIRMED',
              (CASE WHEN random() < 0.15 THEN 'PHONE' ELSE 'POS' END)::"BookingSource",
              v_sale_at + interval '2 minutes', v_sale_at);

      v_lines := jsonb_build_array(jsonb_build_object('v', v_greens, 'q', v_players, 'b', v_booking));
      IF v_vid_range IS NOT NULL AND random() < 0.4 THEN
        v_lines := v_lines || jsonb_build_object('v', v_vid_range, 'q', 1);
      END IF;
      IF v_vid_water IS NOT NULL AND random() < 0.3 THEN
        v_lines := v_lines || jsonb_build_object('v', v_vid_water, 'q', v_players);
      END IF;
      v_cashier := CASE
        WHEN pg_temp.demo_local_hour(v_sale_at) < 12 THEN CASE v_dow WHEN 6 THEN e_pro WHEN 0 THEN e_asst ELSE e_emma END
        WHEN v_dow IN (2, 3) THEN e_asst ELSE e_jake END;
      PERFORM pg_temp.demo_sale(v_reg_shop, v_cashier, NULL, v_sale_at, v_lines,
                                CASE WHEN random() < 0.65 THEN 'CARD_TERMINAL' ELSE 'CASH' END);
    END LOOP;

    -- Pro Shop counter sales
    v_n := CASE WHEN v_weekend THEN pg_temp.demo_rand(12, 18) ELSE pg_temp.demo_rand(6, 11) END;
    FOR i IN 1..v_n LOOP
      v_sale_at := pg_temp.demo_ts(d, '07:15') + make_interval(mins => pg_temp.demo_rand(0, 630));
      CONTINUE WHEN v_sale_at > v_now;
      v_customer := NULL;
      v_pick := NULL;
      IF random() < 0.22 THEN
        v_customer := pg_temp.demo_pick(CASE WHEN d >= v_today - 20 THEN v_members || v_u_turner ELSE v_members END);
      ELSIF random() < 0.06 THEN
        v_customer := pg_temp.demo_pick(v_guest_users);
      END IF;
      v_lines := '[]'::jsonb;
      FOR j IN 1..pg_temp.demo_rand(1, 2) LOOP
        v_pick := pg_temp.demo_pick(v_shop_items);
        -- Drinks and snacks sometimes come in twos
        v_lines := v_lines || jsonb_build_object('v', v_pick, 'q',
          1 + CASE WHEN v_pick = ANY(v_grill_items) AND random() < 0.4 THEN 1 ELSE 0 END);
      END LOOP;
      IF cardinality(v_apparel) > 0 AND random() < 0.12 THEN
        v_lines := v_lines || jsonb_build_object('v', pg_temp.demo_pick(v_apparel), 'q', 1);
      END IF;
      v_method := CASE
        WHEN v_customer IN (v_u_parker, v_u_holloway) AND random() < 0.55 THEN 'HOUSE_ACCOUNT'
        WHEN random() < 0.6 THEN 'CARD_TERMINAL' ELSE 'CASH' END;
      v_cashier := CASE
        WHEN pg_temp.demo_local_hour(v_sale_at) < 12 THEN CASE v_dow WHEN 6 THEN e_pro WHEN 0 THEN e_asst ELSE e_emma END
        WHEN v_dow IN (2, 3) THEN e_asst ELSE e_jake END;
      PERFORM pg_temp.demo_sale(v_reg_shop, v_cashier, v_customer, v_sale_at, v_lines, v_method);
    END LOOP;

    -- Grill sales
    IF v_sess_grill IS NOT NULL AND cardinality(v_grill_items) > 0 THEN
      v_n := CASE WHEN v_weekend THEN pg_temp.demo_rand(8, 13) ELSE pg_temp.demo_rand(4, 7) END;
      FOR i IN 1..v_n LOOP
        v_sale_at := pg_temp.demo_ts(d, '10:00') + make_interval(mins => pg_temp.demo_rand(0, 380));
        CONTINUE WHEN v_sale_at > v_now;
        v_lines := '[]'::jsonb;
        FOR j IN 1..pg_temp.demo_rand(1, 3) LOOP
          v_lines := v_lines || jsonb_build_object('v', pg_temp.demo_pick(v_grill_items), 'q', pg_temp.demo_rand(1, 2));
        END LOOP;
        PERFORM pg_temp.demo_sale(v_reg_grill, CASE WHEN v_dow IN (4, 5, 6, 0) THEN e_kayla ELSE e_sherry END, NULL,
                                  v_sale_at, v_lines, CASE WHEN random() < 0.5 THEN 'CASH' ELSE 'CARD_TERMINAL' END);
      END LOOP;
    END IF;

    -- Paid-ins, paid-outs and safe drops on the Pro Shop drawer (each with a manager approval)
    v_cashier := CASE v_dow WHEN 6 THEN e_pro WHEN 0 THEN e_asst ELSE e_emma END;
    v_at := pg_temp.demo_ts(d, '09:40');
    IF random() < 0.12 AND v_at < v_now THEN
      v_appr := pg_temp.demo_approval('PAID_OUT', e_pro, v_cashier, v_reg_shop, NULL, 'Ice for the coolers', v_at);
      INSERT INTO "CashDrawerMovement" (id, "sessionId", "registerId", type, "amountCents", reason, recipient, "employeeId", "approvalId", "createdAt")
      VALUES (gen_random_uuid()::text, v_sess_shop, v_reg_shop, 'PAID_OUT', 1850, 'Ice for the coolers', 'Moulton Ice Co.', v_cashier, v_appr, v_at);
    END IF;
    v_at := pg_temp.demo_ts(d, '11:05');
    IF random() < 0.06 AND v_at < v_now THEN
      v_appr := pg_temp.demo_approval('PAID_IN', e_pro, v_cashier, v_reg_shop, NULL, 'More change from the safe', v_at);
      INSERT INTO "CashDrawerMovement" (id, "sessionId", "registerId", type, "amountCents", reason, "employeeId", "approvalId", "createdAt")
      VALUES (gen_random_uuid()::text, v_sess_shop, v_reg_shop, 'PAID_IN', 5000, 'More change from the safe', v_cashier, v_appr, v_at);
    END IF;
    v_at := pg_temp.demo_ts(d, '15:00');
    IF v_weekend AND v_at < v_now THEN
      SELECT COALESCE(sum(p."amountCents"), 0) INTO v_cash
      FROM "Payment" p JOIN "Sale" s ON s.id = p."saleId"
      WHERE p.method = 'CASH' AND s."registerId" = v_reg_shop AND p."createdAt" >= pg_temp.demo_ts(d, '07:00') AND p."createdAt" < v_at;
      v_amt := floor(v_cash / 10000.0)::integer * 10000; -- drop the cash taken so far, in $100s
      IF v_amt > 0 THEN
        v_appr := pg_temp.demo_approval('SAFE_DROP', e_pro, e_jake, v_reg_shop, NULL, NULL, v_at);
        INSERT INTO "CashDrawerMovement" (id, "sessionId", "registerId", type, "amountCents", "employeeId", "approvalId", "createdAt")
        VALUES (gen_random_uuid()::text, v_sess_shop, v_reg_shop, 'SAFE_DROP', v_amt, e_jake, v_appr, v_at);
      END IF;
    END IF;
  END LOOP;

  -- Bookings the demo accounts can show on My Account
  FOR r IN SELECT * FROM (VALUES (v_u_guest, v_today + 2, 2), (v_u_guest, v_today - 9, 4), (v_u_parker, v_today + 3, 4), (v_u_parker, v_today + 10, 2)) AS x(uid, day, players)
  LOOP
    SELECT s.id INTO v_slot_id FROM "TeeTimeSlot" s
    WHERE s.date = r.day AND NOT s."memberOnly" AND s."startTime" BETWEEN '08:30' AND '13:00'
      AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."teeTimeSlotId" = s.id AND b.status <> 'CANCELLED')
    ORDER BY s."startTime" LIMIT 1;
    CONTINUE WHEN v_slot_id IS NULL;
    INSERT INTO "Booking" (id, "teeTimeSlotId", "userId", players, "totalCents", status, "stripePaymentId", source, "checkedInAt", "createdAt")
    SELECT gen_random_uuid()::text, v_slot_id, r.uid, r.players, r.players * v_price, 'CONFIRMED',
           'pi_demo_' || substr(md5(random()::text), 1, 24), 'ONLINE',
           CASE WHEN r.day < v_today THEN pg_temp.demo_ts(r.day, s."startTime") - interval '10 minutes' END,
           LEAST(pg_temp.demo_ts(r.day, '00:00') - interval '3 days', v_now - interval '1 day')
    FROM "TeeTimeSlot" s WHERE s.id = v_slot_id;
  END LOOP;
  -- One refunded online booking (rained out)
  UPDATE "Booking" SET status = 'REFUNDED', "checkedInAt" = NULL
  WHERE id = (SELECT b.id FROM "Booking" b JOIN "TeeTimeSlot" s ON s.id = b."teeTimeSlotId"
              WHERE b.source = 'ONLINE' AND b.status = 'CONFIRMED' AND s.date = v_today - 16 ORDER BY s."startTime" DESC LIMIT 1);

  -- On-course tracking: carts for every checked-in group (numbers 1–40 reused through the day; a few bring their
  -- own), the starter's tee-off a few minutes either side of the tee time, finishes for the rounds that are over,
  -- and the marshal's position reports (about a third of the holes per round, kept in PositionReport; the latest is
  -- also on the booking). Rounds take 3 h 50 to 5 h 10, so some groups are behind. Holes play at their own pace: the
  -- par 5s at 6 and 11 (up the ridge) and the island 12th are slow, and 10 includes the stop at the turn, which
  -- Admin → Settings → On Course → "Recalculate now" (or the nightly job) learns from the reports. The groups teeing
  -- off in the next 25 minutes are checked in and waiting.
  UPDATE "Booking" b SET "checkedInAt" = v_now - interval '6 minutes'
  FROM "TeeTimeSlot" s
  WHERE s.id = b."teeTimeSlotId" AND s.date = v_today AND b.status = 'CONFIRMED' AND b."checkedInAt" IS NULL
    AND pg_temp.demo_ts(s.date, s."startTime") BETWEEN v_now AND v_now + interval '25 minutes';
  DECLARE
    r_g     record;
    v_cart  integer := 0;
    v_day   date;
    v_carts text[];
    v_own   boolean;
    v_off   timestamp;
    v_len   integer;
    v_rep   timestamp;
    v_hole  integer;
    v_stage text;
    v_last  text; -- stage of the latest report saved
    -- Each hole's share of a round (minutes in a 4 h 31 round), hole 1 first, and the course's pars
    v_par   integer[] := ARRAY[4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 4];
    v_base  numeric[] := ARRAY[14, 17, 11, 15.5, 14, 20.5, 11, 14, 14, 18, 20.5, 15, 14, 14, 19.5, 11, 14, 14];
    v_cum   numeric[];
    v_dur   numeric;
    v_frac  numeric;
    v_at    timestamp;
  BEGIN
    FOR r_g IN
      SELECT b.id, b.players, s.date, pg_temp.demo_ts(s.date, s."startTime") AS tee_at
      FROM "Booking" b JOIN "TeeTimeSlot" s ON s.id = b."teeTimeSlotId"
      WHERE b.status = 'CONFIRMED' AND b."checkedInAt" IS NOT NULL
      ORDER BY s.date, s."startTime"
    LOOP
      IF v_day IS DISTINCT FROM r_g.date THEN v_day := r_g.date; v_cart := 0; END IF;
      v_own := random() < 0.12;
      v_carts := ARRAY[]::text[];
      FOR k IN 1..(CASE WHEN v_own THEN (r_g.players - 1) / 2 ELSE (r_g.players + 1) / 2 END) LOOP
        v_carts := v_carts || ((v_cart % 40) + 1)::text;
        v_cart := v_cart + 1;
      END LOOP;

      v_off := r_g.tee_at + make_interval(mins => pg_temp.demo_rand(-3, 9));
      IF r_g.tee_at > v_now OR v_off >= v_now THEN v_off := NULL; END IF;
      v_len := CASE WHEN random() < 0.15 THEN pg_temp.demo_rand(285, 310) ELSE pg_temp.demo_rand(230, 280) END;
      v_rep := NULL; v_hole := NULL; v_last := NULL;

      IF v_off IS NOT NULL THEN
        -- This round's hole times: the course's profile scaled to the round's length, each hole ±15%
        v_cum := ARRAY[0]::numeric[];
        FOR h IN 1..18 LOOP
          v_cum := v_cum || (v_cum[h] + v_base[h] * v_len / 271.0 * (0.85 + random() * 0.3));
        END LOOP;
        v_len := round(v_cum[19]);

        -- The marshal reports about a third of the holes, a minute or so either side of when the group got there
        FOR h IN 1..18 LOOP
          CONTINUE WHEN random() > 0.33;
          v_stage := CASE WHEN v_par[h] = 3 THEN (ARRAY['TEE', 'GREEN'])[pg_temp.demo_rand(1, 2)]
                          ELSE (ARRAY['TEE', 'FAIRWAY', 'GREEN'])[pg_temp.demo_rand(1, 3)] END;
          v_frac := CASE v_stage WHEN 'TEE' THEN 0
                                 WHEN 'FAIRWAY' THEN CASE WHEN v_par[h] = 5 THEN 0.25 ELSE 0.3 END
                                 ELSE CASE v_par[h] WHEN 3 THEN 0.55 WHEN 4 THEN 0.7 ELSE 0.75 END END;
          v_dur := v_cum[h + 1] - v_cum[h];
          v_at := v_off + make_interval(secs => ((v_cum[h] + v_frac * v_dur) * 60 + (random() * 120 - 60))::double precision);
          EXIT WHEN v_at >= v_now;
          INSERT INTO "PositionReport" (id, "bookingId", hole, stage, "reportedAt", "employeeId")
          VALUES (gen_random_uuid()::text, r_g.id, h, v_stage::"HoleStage", v_at, CASE WHEN h = 1 THEN e_walt ELSE e_ruby END);
          v_rep := v_at; v_hole := h; v_last := v_stage;
        END LOOP;
      END IF;

      UPDATE "Booking" SET
        "cartNumbers" = v_carts,
        "ownCart" = v_own,
        "teedOffAt" = v_off,
        "finishedAt" = CASE WHEN v_off + make_interval(mins => v_len) < v_now THEN v_off + make_interval(mins => v_len) END,
        "positionHole" = v_hole,
        "positionStage" = v_last::"HoleStage",
        "positionAt" = v_rep
      WHERE id = r_g.id;
    END LOOP;
  END;

  -- Grace Turner bought her membership at the register 20 days ago
  IF v_vid_membership IS NOT NULL THEN
    PERFORM pg_temp.demo_sale(v_reg_shop, e_emma, v_u_turner, pg_temp.demo_ts(v_today - 20, '10:30'),
                              jsonb_build_array(jsonb_build_object('v', v_vid_membership, 'q', 1)), 'CARD_TERMINAL');
  END IF;

  -- ── Refunds and a void (through refund_sale(), then back-dated) ──
  -- 1. A glove or polo returned for cash
  SELECT si.id, s.id, s."createdAt", s."cashierId", s."number" INTO v_item_id, v_sale_id, v_at, v_cashier, v_number
  FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
  WHERE s."registerId" = v_reg_shop AND s.status = 'COMPLETED'
    AND (si.description LIKE 'Golf Glove%' OR si.description LIKE 'Deer Run Polo%')
    AND s."createdAt" BETWEEN pg_temp.demo_ts(v_today - 12, '00:00') AND pg_temp.demo_ts(v_today - 3, '00:00')
    AND pg_temp.demo_local_hour(s."createdAt") < 15
    AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."saleId" = s.id AND p.method = 'CASH')
  ORDER BY s."createdAt" DESC LIMIT 1;
  IF v_sale_id IS NOT NULL THEN
    v_at := v_at + interval '2 hours';
    v_appr := pg_temp.demo_approval('REFUND', e_pro, v_cashier, v_reg_shop, v_sale_id, 'Didn''t fit', v_at);
    v_res := refund_sale(
      jsonb_build_object('saleId', v_sale_id, 'kind', 'REFUND', 'method', 'CASH', 'restock', true,
                         'reason', 'Didn''t fit; customer brought it back unworn', 'approvalId', v_appr,
                         'cashierId', v_cashier, 'registerId', v_reg_shop),
      jsonb_build_array(jsonb_build_object('saleItemId', v_item_id, 'quantity', 1)));
    UPDATE "SaleRefund" SET "createdAt" = v_at WHERE id = v_res->>'id';
    UPDATE "InventoryAdjustment" SET "createdAt" = v_at WHERE reason = 'RETURN' AND note = 'Refund on sale #' || v_number;
  END IF;

  -- 2. A Grill sale rung up twice and voided
  v_sale_id := NULL;
  SELECT s.id, s."createdAt", s."cashierId" INTO v_sale_id, v_at, v_cashier
  FROM "Sale" s
  WHERE s."registerId" = v_reg_grill AND s.status = 'COMPLETED'
    AND s."createdAt" BETWEEN pg_temp.demo_ts(v_today - 6, '00:00') AND pg_temp.demo_ts(v_today - 1, '00:00')
    AND pg_temp.demo_local_hour(s."createdAt") < 16
    AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."saleId" = s.id AND p.method = 'CASH')
  ORDER BY s."createdAt" DESC LIMIT 1;
  IF v_sale_id IS NOT NULL THEN
    v_at := v_at + interval '4 minutes';
    v_appr := pg_temp.demo_approval('VOID', e_sherry, v_cashier, v_reg_grill, v_sale_id, 'Rung up twice', v_at);
    v_res := refund_sale(
      jsonb_build_object('saleId', v_sale_id, 'kind', 'VOID', 'method', 'CASH', 'restock', false,
                         'reason', 'Rung up twice', 'approvalId', v_appr, 'cashierId', v_cashier, 'registerId', v_reg_grill),
      (SELECT jsonb_agg(jsonb_build_object('saleItemId', id, 'quantity', quantity)) FROM "SaleItem" WHERE "saleId" = v_sale_id));
    UPDATE "SaleRefund" SET "createdAt" = v_at WHERE id = v_res->>'id';
  END IF;

  -- 3. A house account charge returned to Bob Parker's account
  v_sale_id := NULL;
  SELECT si.id, s.id, s."createdAt", s."cashierId", s."number" INTO v_item_id, v_sale_id, v_at, v_cashier, v_number
  FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
  WHERE s."customerId" = v_u_parker AND s.status = 'COMPLETED' AND si."variantId" IS NOT NULL
    AND si."categoryName" IN ('Apparel', 'Golf Equipment & Balls')
    AND s."createdAt" BETWEEN pg_temp.demo_ts(v_today - 25, '00:00') AND pg_temp.demo_ts(v_today - 4, '00:00')
    AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."saleId" = s.id AND p.method = 'HOUSE_ACCOUNT')
  ORDER BY s."createdAt" DESC LIMIT 1;
  IF v_sale_id IS NOT NULL THEN
    v_at := v_at + interval '1 day';
    v_appr := pg_temp.demo_approval('REFUND', e_pro, v_cashier, v_reg_shop, v_sale_id, 'Returned unopened', v_at);
    v_res := refund_sale(
      jsonb_build_object('saleId', v_sale_id, 'kind', 'REFUND', 'method', 'HOUSE_ACCOUNT', 'restock', true,
                         'reason', 'Returned unopened', 'approvalId', v_appr, 'cashierId', v_cashier, 'registerId', v_reg_shop),
      jsonb_build_array(jsonb_build_object('saleItemId', v_item_id, 'quantity', 1)));
    UPDATE "SaleRefund" SET "createdAt" = v_at WHERE id = v_res->>'id';
    UPDATE "HouseAccountEntry" SET "createdAt" = v_at WHERE "refundId" = v_res->>'id';
    UPDATE "InventoryAdjustment" SET "createdAt" = v_at WHERE reason = 'RETURN' AND note = 'Refund on sale #' || v_number;
  END IF;

  -- ── House account statements for the last two months ──
  v_m1s := (date_trunc('month', v_today) - interval '1 month')::date;
  v_m1e := (date_trunc('month', v_today) - interval '1 day')::date;
  v_m2s := (v_m1s - interval '1 month')::date;
  v_m2e := v_m1s - 1;

  -- Bob Parker: paid two months ago's statement online; last month's is open
  v_stmt := pg_temp.demo_statement(v_acc_parker, v_m2s, v_m2e);
  SELECT "closingCents" INTO v_closing FROM "Statement" WHERE id = v_stmt;
  IF v_closing > 0 THEN
    v_at := pg_temp.demo_ts(v_m1s + 9, '20:15');
    INSERT INTO "HouseAccountEntry" (id, "accountId", type, "amountCents", description, method, "createdAt")
    VALUES (gen_random_uuid()::text, v_acc_parker, 'PAYMENT', -v_closing, 'Online payment', 'ONLINE', v_at);
    UPDATE "Statement" SET status = 'PAID', "paidAt" = v_at WHERE id = v_stmt;
  END IF;
  -- ...and paid part of his balance in cash at the Pro Shop three days ago (in $10s)
  v_at := pg_temp.demo_ts(v_today - 3, '11:20');
  SELECT floor(COALESCE(sum("amountCents"), 0) / 2 / 1000.0)::integer * 1000 INTO v_amt
  FROM "HouseAccountEntry" WHERE "accountId" = v_acc_parker AND "createdAt" < v_at;
  IF v_amt > 0 THEN
    INSERT INTO "HouseAccountEntry" (id, "accountId", type, "amountCents", description, method, "registerId", "createdById", "createdAt")
    VALUES (gen_random_uuid()::text, v_acc_parker, 'PAYMENT', -v_amt, 'Cash payment', 'CASH', v_reg_shop, v_u_shop, v_at);
  END IF;
  PERFORM pg_temp.demo_statement(v_acc_parker, v_m1s, v_m1e);

  -- James Holloway: two months ago's statement is overdue (reminder sent, late fee added); last month's is open
  v_stmt := pg_temp.demo_statement(v_acc_holloway, v_m2s, v_m2e);
  SELECT "closingCents" INTO v_closing FROM "Statement" WHERE id = v_stmt;
  IF v_closing > 0 THEN
    v_at := pg_temp.demo_ts(v_m2e + 16, '06:15');
    INSERT INTO "HouseAccountEntry" (id, "accountId", type, "amountCents", description, "createdAt")
    VALUES (gen_random_uuid()::text, v_acc_holloway, 'ADJUSTMENT', 1500,
            'Late fee — ' || to_char(v_m2s, 'FMMonth YYYY') || ' statement', v_at);
    UPDATE "Statement" SET "reminderSentAt" = v_at, "lateFeeAt" = v_at WHERE id = v_stmt;
  END IF;
  PERFORM pg_temp.demo_statement(v_acc_holloway, v_m1s, v_m1e);

  -- ── Close the past drawers: totals the way closeDrawer() works them out, mostly even, a few over/short ──
  UPDATE "CashDrawerSession" s
  SET "cashSalesCents"   = x.sales,
      "cashRefundsCents" = x.refunds,
      "paidInCents"      = x.paid_in,
      "paidOutCents"     = x.paid_out,
      "safeDropCents"    = x.drops,
      "expectedCents"    = s."openingFloatCents" + x.sales - x.refunds + x.paid_in - x.paid_out - x.drops,
      "countedCents"     = s."openingFloatCents" + x.sales - x.refunds + x.paid_in - x.paid_out - x.drops + x.over_short,
      "overShortCents"   = x.over_short,
      "closeNote"        = CASE WHEN x.over_short <> 0 THEN 'Counted twice' END
  FROM (
    SELECT s2.id,
      COALESCE((SELECT sum(p."amountCents") FROM "Payment" p JOIN "Sale" sa ON sa.id = p."saleId"
                WHERE p.method = 'CASH' AND sa."registerId" = s2."registerId"
                  AND p."createdAt" >= s2."openedAt" AND p."createdAt" < s2."closedAt"), 0)
      + COALESCE((SELECT -sum(e."amountCents") FROM "HouseAccountEntry" e
                  WHERE e.type = 'PAYMENT' AND e.method = 'CASH' AND e."registerId" = s2."registerId"
                    AND e."createdAt" >= s2."openedAt" AND e."createdAt" < s2."closedAt"), 0) AS sales,
      COALESCE((SELECT sum(f."amountCents") FROM "SaleRefund" f
                WHERE f.method = 'CASH' AND f."registerId" = s2."registerId"
                  AND f."createdAt" >= s2."openedAt" AND f."createdAt" < s2."closedAt"), 0) AS refunds,
      COALESCE((SELECT sum(m."amountCents") FROM "CashDrawerMovement" m WHERE m."sessionId" = s2.id AND m.type = 'PAID_IN'), 0) AS paid_in,
      COALESCE((SELECT sum(m."amountCents") FROM "CashDrawerMovement" m WHERE m."sessionId" = s2.id AND m.type = 'PAID_OUT'), 0) AS paid_out,
      COALESCE((SELECT sum(m."amountCents") FROM "CashDrawerMovement" m WHERE m."sessionId" = s2.id AND m.type = 'SAFE_DROP'), 0) AS drops,
      CASE WHEN random() < 0.8 THEN 0 ELSE (ARRAY[-500, -200, -100, -25, 50, 100, 300])[1 + floor(random() * 7)::integer] END AS over_short
    FROM "CashDrawerSession" s2
    WHERE s2."closedAt" IS NOT NULL AND s2."cashSalesCents" IS NULL
  ) x
  WHERE s.id = x.id;
  UPDATE "CashDrawerSession" SET "countedCents" = 0, "overShortCents" = -"expectedCents"
  WHERE "countedCents" < 0;

  -- ── Website inquiries and messages ──
  INSERT INTO "Inquiry" (id, "firstName", "lastName", email, phone, tier, message, "createdAt") VALUES
    (gen_random_uuid()::text, 'Brandon', 'Hale',    'brandon.hale@example.com',    '(256) 555-0144', 'Premier',    'My wife and I just moved to Moulton. Do you offer a trial round before we join?', v_now - interval '2 days'),
    (gen_random_uuid()::text, 'Melissa', 'Grubbs',  'melissa.grubbs@example.com',  '(256) 555-0161', 'Family',     'Two kids, 11 and 14. Is there a junior clinic in the summer?', v_now - interval '5 days'),
    (gen_random_uuid()::text, 'Ron',     'Pickett', 'ron.pickett@example.com',     NULL,             'Individual', 'Retired and looking to play 3–4 times a week. Monthly or annual?', v_now - interval '9 days'),
    (gen_random_uuid()::text, 'Alicia',  'Vance',   'alicia.vance@example.com',    '(256) 555-0178', 'Premier',    NULL, v_now - interval '16 days');
  INSERT INTO "ContactMessage" (id, name, email, phone, subject, message, "createdAt") VALUES
    (gen_random_uuid()::text, 'Coach Dennis Wright', 'dwright@example.com', '(256) 555-0190', 'High school team practice',
     'Lawrence County High would like to use the range on weekday afternoons in the spring. Can we talk rates?', v_now - interval '1 day'),
    (gen_random_uuid()::text, 'Patty Owens', 'patty.owens@example.com', NULL, 'Lost and found',
     'I think I left a blue umbrella and a rangefinder in cart #14 on Saturday.', v_now - interval '3 days'),
    (gen_random_uuid()::text, 'First Baptist Moulton', 'events@example.com', '(256) 555-0133', 'Church outing',
     'Looking to book a 60-player scramble on a Saturday in April with lunch afterwards.', v_now - interval '8 days'),
    (gen_random_uuid()::text, 'Greg Simmons', 'greg.simmons@example.com', '(256) 555-0122', 'Gift cards',
     'Do you sell gift cards online? I''d like to get one for my dad for Christmas.', v_now - interval '12 days');

  RAISE NOTICE 'Demo data loaded. Sign in as gm@example.com / % (see the top of this file for the others)', c_password;
END;
$demo$;

COMMIT;

-- Quick check after running:
-- SELECT (SELECT count(*) FROM "Employee")          AS employees,
--        (SELECT count(*) FROM "Shift")             AS shifts,
--        (SELECT count(*) FROM "TimeEntry")         AS punches,
--        (SELECT count(*) FROM "Booking")           AS bookings,
--        (SELECT count(*) FROM "Sale")              AS sales,
--        (SELECT count(*) FROM "CashDrawerSession") AS drawers,
--        (SELECT count(*) FROM "Statement")         AS statements;
