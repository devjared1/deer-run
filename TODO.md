# TODO

Roadmap for two large features: **Employee Time Management** and a **Point of Sale (POS)** system.
Employee Time Management comes first. The POS depends on it, because every sale is rung up by an
employee and the register lives in the staff portal.

`[x]` done · `[ ]` to do · ❓ needs a decision from the course before building

---

## Shared decisions

- **Staff access = an `Employee` record linked to a `User` login (matched by email).** No new `Role`
  value. `Role` stays about customers (GUEST/MEMBER) and admins, so an employee can also be a member.
- **Two kinds of "manager":** the **admin panel** (employees, timesheets, settings) is for users with role
  `ADMIN`. **Manager approvals at the register** (No Sale, voids, refunds) are by **job title**: employees
  whose position is in `CourseSettings.managerPositions`, editable in admin Settings. Starting list:
  General Manager, Head Golf Professional, Golf Course Superintendent, Food & Beverage Manager.
- **Staff portal at `/staff`** with its own layout, separate from `/admin`. It holds the time clock, the
  employee's schedule, time off requests, and later the POS register and tee sheet.
- **Conventions:** money in integer cents; clock punches as UTC timestamps; schedules as `DATE` +
  `"HH:MM"` strings (same as `TeeTimeSlot`); everything displayed in `America/Chicago`.
- **Server is the source of truth:** the client never sends timestamps for punches or prices/tax for sales.
- **Migrations:** each phase that changes the schema adds a folder under `apps/api/prisma/migrations/`
  that can be pasted into the Supabase SQL Editor, wrapped in a transaction, with RLS enabled on new tables.

---

## Feature 1: Employee Time Management

### Phase 1: Foundation
- [x] Schema: `Employee`, `TimeEntry`, `TimeBreak`, `Shift`, `TimeOffRequest` and the `EmployeePosition`,
      `TimeOffType`, `TimeOffStatus` enums. Migration `1_employee_time_management` (RLS on)
- [x] Positions list (15 standard roles across Management, Golf Operations, Course Maintenance,
      Food & Beverage) in `src/data/employeePositions.js`
- [x] Admin API: `GET/POST /api/admin/employees`, `PUT/DELETE /api/admin/employees/:id`
      (delete is refused when the employee has time clock history; deactivate instead)
- [x] Admin UI: **Employees** page (search/filter, create/edit, deactivate/reactivate, delete) + sidebar link
- [x] Link employee ↔ login by email, both when the employee is saved and on first sign-in (`/api/auth/me`)
- [x] Fix auth store: `init()` restores the session but never loaded the profile, so after a page reload
      `isAdmin` was false and `/admin` redirected away. `init()` now fetches `/api/auth/me` once per page
      load, and the router guard awaits it before checking roles
- [x] `requireStaff(request, env)` helper → `{ supabase, dbUser, employee }`; 403 unless an active
      employee is linked. Admins need an employee record too, since the clock and schedule are per employee
- [x] `/api/auth/me` also returns the linked `employee` (id, name, position, active)
- [x] Auth store: `employee`, `isStaff`; router `meta.requiresStaff` guard; "Staff" link in `AppNav` for staff
- [x] `StaffLayout.vue` at `/staff` (sidebar: Time Clock, My Timesheet; add My Schedule, Time Off,
      Register and Tee Sheet as those pages are built)

### Phase 2: Clock in / out and breaks
- [x] `GET /api/staff/clock`: current state (off / on the clock / on break), today's entries
- [x] `POST /api/staff/clock` with `action: clock_in | clock_out | break_start | break_end`.
      Validates state transitions, allows one open entry per employee, uses server time,
      and ends any open break on clock out
- [x] Shared hours helper `src/lib/timeclock.js` (used by both the app and Functions): worked =
      (clockOut − clockIn) − breaks, overtime over 40 h/week, course-local dates that handle DST
- [x] Staff **Time Clock** page: big buttons for the current state, live clock and running total,
      today's punches, confirmation before clocking out
- [x] Staff **My Timesheet**: one pay period at a time with previous/next, grouped by workweek,
      regular/overtime totals (`GET /api/staff/timesheet?date=`)
- [x] Pay period: **bi-weekly, Sunday-based, changeable** in admin **Settings → Payroll**
      (`CourseSettings.payPeriodDays` = 7 or 14, `payPeriodAnchor` = any date that starts a period;
      the workweek for overtime starts on that weekday). Migration `2_timeclock_admin`
- [x] Double clock-in protection: partial unique index `TimeEntry_one_open_per_employee` in
      `2_timeclock_admin`. Prisma 5 can't model it, so a future `migrate diff` will propose dropping it;
      delete that line from generated migrations
- [x] Admin **Timesheets** page: pay period navigation, every employee's regular/overtime/total,
      expand an employee to see entries by workweek (`GET /api/admin/timesheets?date=`)
- [x] Admin corrections: add/edit/delete entries and breaks for missed punches, entered as course-local
      times (a clock-out earlier than clock-in counts as the next day). Validates breaks within the shift,
      no overlaps, nothing in the future, max 24 h; records `editedById`/`editedAt`, shown as "Edited"
      (`POST /api/admin/time-entries`, `PUT/DELETE /api/admin/time-entries/:id`)
- [x] Dashboard card: who's on the clock right now, on break, or probably forgot to clock out
      (`GET /api/admin/timeclock`)
- [x] Flag entries still open after 14 h (dashboard, timesheet totals, per entry)
- [x] CSV export for payroll: summary (regular/overtime/total hours, rate, estimated gross with
      overtime at 1.5×) and one row per entry
- [ ] Correcting a time entry isn't one database transaction: the entry is saved, then its breaks are
      replaced. A failure in between leaves the new times with no breaks. Move to a Postgres function
      (`supabase.rpc`) if it ever happens; same pattern as the POS `create_sale`

### Phase 3: Scheduling
- [ ] Admin API: `GET /api/admin/shifts?from=&to=`, `POST`, `PUT/DELETE /:id`
- [ ] Admin **Schedule** builder: week grid (employees × days), add/edit/delete shifts, filter by department
- [ ] Copy last week's schedule into this week
- [ ] Warnings: overlapping shifts, scheduling over approved time off, inactive employees
- [ ] Staff API: `GET /api/staff/schedule?from=&to=` (own shifts; option for the whole team, read-only)
- [ ] Staff **My Schedule** page: week view with previous/next navigation
- [ ] Printable schedule: **weekly, bi-weekly and monthly** views with previous/next (future and past)
      period navigation, a print stylesheet (`@media print`, landscape), and a "Print" button
- [ ] Optional: email employees their schedule when it's published (Resend)

### Phase 4: Time off
- [ ] Staff API: create, list and cancel own requests (cancel only while pending)
- [ ] Staff **Time Off** page: request form (dates, type, reason) + my requests with status
- [ ] Admin API: list (filter by status/date), approve/deny with a note (records `reviewedById`, `reviewedAt`)
- [ ] Admin **Time Off** queue; pending-count badge in the admin sidebar
- [ ] Show approved time off on the schedule grid and the printed schedule
- [ ] Email the employee when a request is approved or denied (Resend)

---

## Feature 2: Point of Sale

### Phase 0: Decisions
- [x] **Card payments:** every in-person card payment goes through **Stripe Terminal**. Online payments
      (tee time booking) stay as they are today
- [x] **Sales tax:** everything is taxable for now, but a category must be able to opt out.
      → Tax-exempt flag per category (product-level override possible later); one course rate in
      `CourseSettings`; the rate and tax amount are stored on every sale line so old receipts never change
- [x] **Member house accounts:** yes, members can charge to an account billed monthly (Phase 4)
- [x] **Apparel inventory:** yes, track sizes/colors as variants with their own stock, SKU and barcode
- [x] **Hardware:** one register to start, room for 2–3 later. Each register is:
      - a **Windows PC** running Chrome with kiosk printing (prints go straight to the default printer, no dialog)
      - an **80 mm thermal receipt printer** installed as a normal Windows printer (e.g. Epson TM-m30 or Star TSP100 series)
      - a **USB barcode scanner** in keyboard mode
      - a **Stripe Reader S700** (or BBPOS WisePOS E). Must be an internet-connected smart reader;
        Bluetooth/USB readers (M2, WisePad 3) need a native app and won't work with a web register
      - a **cash drawer** on the printer's drawer port, with the printer driver set to open it on every print job
- [x] **Cash:** accepted. Cash tender in Phase 2, drawer counts and over/short in Phase 7
- [x] **Receipts:** printed by default, with an option to email instead or as well (prefilled from the
      attached member). Every completed sale prints, so the drawer opens on every sale, cash or card,
      which is normal for this setup
- [x] **Register access:** only certain positions. The allowed positions are a setting
      (`CourseSettings.registerPositions`) that admins can change. Starting list: General Manager,
      Head Golf Professional, Assistant Golf Professional, Pro Shop Attendant, Starter,
      Food & Beverage Manager, Server / Bartender

### Phase 1: Catalog
Categories (answering the "Other?" in the request): Greens Fees, Cart Fees, Driving Range,
Membership Dues, Concessions (food & drink), Apparel, Golf Equipment & Balls, Rentals
(clubs, push carts), Lessons, Tournament Entries, Gift Cards, Misc / Custom amount.

- [x] Schema, migration `3_pos_catalog`:
  - `ProductCategory` **table** (not an enum) so admins can add categories and set `taxExempt`
    (default false), `sortOrder`, `active`
  - `Product`: category, name, description, `priceCents`, `memberPriceCents`, `trackInventory`, `active`, `sortOrder`
  - `ProductVariant`: product, `size`, `color`, `sku`, `barcode` (unique), optional `priceCents` /
    `memberPriceCents` overrides, `stockQty`, `active`. Every product has at least one variant;
    simple products get a single default variant, so stock and barcodes always live on the variant
  - `InventoryAdjustment` log + `adjust_inventory()` Postgres function (locks the row, changes stock and
    logs it in one transaction; callable only by the service role)
  - `CourseSettings.salesTaxBps` (basis points, e.g. 900 = 9%; starts at 0)
  - `CourseSettings.registerPositions` (`EmployeePosition[]`), defaulting to the starting list in Phase 0
  - `CourseSettings.managerPositions` (`EmployeePosition[]`), defaulting to the list in Shared decisions
  - `Register` (name, e.g. "Pro Shop"; `stripeReaderId`; `active`) so 2–3 more registers can be added
    later without code changes. Sales, card payments and cash drawer sessions belong to a register
- [x] Admin API: categories CRUD (`/api/admin/product-categories`, delete only when empty); products CRUD
      with nested variants (`/api/admin/products`): variants sent with an id are updated, new ones created,
      missing ones deleted or deactivated if they have stock history; SKU/barcode conflicts are checked first
- [x] Admin **Products** page: grouped by category, price/member price, active toggle, delete; product form
      with a size × color variant generator, per-variant SKU/barcode/price, starting stock; category manager
      (rename, sort, tax-exempt, active); warning while the sales tax rate is 0%
- [x] Inventory adjustments: **Stock** dialog per product to receive, remove or set a count per variant with
      a reason and note, plus history with who made each change (`/api/admin/inventory/:variantId`)
- [x] Seed (`prisma/seed-pos.sql`): 12 categories, the "Pro Shop" register, and products. Greens fees,
      range, rentals and membership dues use the site's real prices; concessions, apparel and golf supplies
      are **placeholder prices to review**
- [ ] Member Pro Shop discounts (10% Individual, 15% Premier/Family per `membershipTiers.js`) need the
      member's tier, which isn't stored yet. Add `User.membershipTier` and apply the discount to eligible
      categories at the register (Phase 2 or Phase 6)

### Phase 2: Register (cash and no-charge sales)
- [x] Schema, migration `4_pos_sales`: `Sale` (receipt number, status, register, cashier, customer,
      member pricing flag, subtotal/discount/tax/total, change), `SaleItem` (variant or custom, description
      and category snapshot, qty, unit price, discount, `taxRateBps`, tax, totals), `Payment` (method,
      amount, cash tendered, Stripe ID), enums `SaleStatus`, `PaymentMethod`; `SALE` inventory reason.
      Also sets the sales tax to **9%**
- [x] `requireRegister(request, env)`: `requireStaff` + position in `registerPositions` (manager positions
      and admins are always allowed); `/api/auth/me` returns `canUseRegister` and `isRegisterManager`
- [x] Admin **Settings → Point of Sale**: sales tax rate, positions allowed to use the register, and manager positions
- [x] Staff route `/staff/register`, shown in the staff sidebar only when `canUseRegister`
- [x] Register setup: the first time a PC opens the register it picks which `Register` it is (saved in
      `localStorage`, sent with every sale). **Switching** to a different register needs a manager
- [x] Admin **Registers** page: add/rename/deactivate/delete registers, store each one's Stripe reader ID
- [x] Register UI: category tabs, product grid with variant picker (price and stock per option),
      barcode/SKU box that USB scanners type into (exact match adds the item), cart with qty, remove,
      line discount ($ or %), custom-amount item, subtotal/tax/total
- [x] Attach a customer (search by name/email → member pricing; Remove to detach)
- [x] `create_sale` Postgres function: sale, items, payments, stock deduction and `SALE` stock log in one
      transaction. Sales may take stock below zero; callable only by the service role
- [x] `POST /api/staff/sales`: recomputes prices and tax from the database with the same `src/lib/pricing.js`
      the register uses (tax per line, 0 for tax-exempt categories), and refuses the sale (409) if the total
      differs from what the register showed
- [x] Cash tender: quick amounts (exact, next $5/$10/$20…), change due shown large after the sale.
      $0 sales (e.g. member greens fees) complete with no payment
- [ ] Split tender UI: the API already accepts several payments; add the UI with card payments in Phase 3
- [x] Receipt: 80 mm receipt printed automatically when the sale completes (`@page` size applied only while
      printing), "Email receipt" at checkout (prefilled from the customer) or afterwards, reprint from the
      completion screen (`GET /api/staff/sales/:id`, `POST /api/staff/sales/:id { action: 'email' }`)
- [x] **Recent sales** at the register: today's sales for this register or all, find any receipt by number,
      sale detail with refund history, reprint, void, refund (`GET /api/staff/sales?date=&registerId=&number=`)
- [x] **Manager approval** (migration `5_pos_approvals_refunds`): one mechanism for discounts, No Sale,
      voids, refunds and switching registers. A manager is an active employee whose position is in
      `CourseSettings.managerPositions`. A manager at the register approves without a prompt; otherwise a
      manager picks their name and enters their 4–6 digit **manager PIN** (PBKDF2 hash; locked 15 minutes
      after 5 wrong tries). Each approval is logged (`ManagerApproval`: action, approver, cashier, register,
      sale, reason), single-use, and short-lived (discounts 30 min, voids/refunds 10 min)
      (`POST /api/staff/approvals`, `GET /api/staff/register/managers`)
- [x] Managers set their PIN under **Staff → Manager PIN**; admins see PIN status and **Reset PIN** on Employees
- [x] **Discounts are manager-only**: the first discount in a sale asks for approval, which covers the rest of
      that sale; the server refuses a discounted sale without an unused approval, and the register re-asks
      automatically if it expired
- [x] **No Sale** (manager approval): prints a short "No Sale" slip, which opens the drawer
- [x] **Void** (whole sale, same day, no earlier refunds) and **refund** (chosen items and quantities, any
      day, optional restock), both with a reason and manager approval. `refund_sale()` Postgres function
      locks the sale so items can't be refunded twice, prorates partial quantities (the last units refund
      exactly what's left), restocks tracked items (`RETURN` stock log) and sets the status
      (PARTIALLY_REFUNDED / REFUNDED / VOIDED). The register shows "Give the customer $X" and prints a refund
      slip with a signature line (which opens the drawer). Cash only for now; card refunds come in Phase 3
- [ ] Setup guide in the repo (`docs/register-setup.md`): Chrome kiosk-printing shortcut, setting the
      receipt printer as default, paper size, scanner test, reader pairing

### Phase 3: Card payments (Stripe Terminal)
- [ ] Stripe setup: a Terminal Location for the course; register the reader(s) to it
- [ ] Card reader status on the admin **Registers** page (online/offline, from Stripe)
- [ ] Server-driven flow: create the PaymentIntent (`card_present`, metadata `saleId`) →
      `terminal.readers.processPaymentIntent` → poll reader status / handle the webhook → mark the payment
      succeeded and complete the sale. Works from any browser; no reader SDK in the page
- [ ] Register UI: "Waiting for card…" state, cancel on the reader, decline/retry handling
- [ ] Webhook: route POS PaymentIntents (metadata `saleId`) separately from booking PaymentIntents
- [ ] Refunds through Stripe for card sales (full and partial)
- [ ] Test with Stripe's simulated reader before hardware arrives

### Phase 4: Member house accounts
Decisions: members are **invoiced** by default and can **opt in to autopay** themselves; charging to an
account requires the **member's PIN**; statements are generated **automatically on the 1st**, and a
manager can print a statement for any member **on demand**.

- [ ] Schema: `HouseAccount` (user, status, `creditLimitCents`, `pinHash`, failed-PIN count/lockout,
      `autopayEnabled`, `stripeCustomerId`, `stripePaymentMethodId`), `HouseAccountEntry` ledger (charge
      from a sale, payment, adjustment; amount; the balance is the sum of entries), `Statement` (period,
      opening/closing balance, charges, payments, due date, status: OPEN / PAID / AUTOPAY_FAILED)
- [ ] Admin **House Accounts** page: open/suspend accounts, set limits, balances, entry history,
      manual adjustments (with reason), reset a member's PIN
- [ ] Member PIN: member sets/changes a 4–6 digit PIN in **My Account** (stored as a PBKDF2 hash);
      account locks after 5 wrong tries until a manager resets it
- [ ] Register tender "Charge to account": attached member with an active account, under its limit;
      the member enters their PIN on the register; server verifies before the charge is recorded
- [ ] Monthly statements on the 1st: a small **scheduled Worker** (cron trigger, since Pages has no cron)
      calls a protected endpoint (`POST /api/internal/statements/run`, shared secret) that closes the
      previous month for every account with activity, then emails each statement (Resend).
      Safe to re-run: one statement per account per period
- [ ] On-demand statements (manager): from the admin House Accounts page, print or email a statement for
      a member for any date range (default: month to date). Printable letter-size statement page
- [ ] Invoicing (default): the emailed statement shows the balance and due date with a "Pay online" link
      to **My Account**; payments at the register (cash/card) are recorded on the account too
- [ ] Autopay (opt-in by the member): in **My Account**, the member saves a card (Stripe Customer +
      SetupIntent) and turns autopay on. On statement day the balance is charged off-session; a failed
      charge emails the member, marks the statement AUTOPAY_FAILED and falls back to invoicing.
      Member can turn autopay off or replace the card at any time
- [ ] Webhooks: handle autopay PaymentIntent success/failure (metadata `statementId`)
- [ ] Member **My Account**: current balance, recent charges, past statements (view/print), pay balance
      online, PIN, autopay settings

### Phase 5: Tee sheet integration (online bookings flow into the POS)
- [ ] Schema: `Booking.source` (ONLINE / POS / PHONE), `Booking.checkedInAt`, `SaleItem.bookingId`
- [ ] Staff **Tee Sheet**: today's slots with bookings; online bookings show "Paid online"
- [ ] Check-in: sets `checkedInAt` and opens a sale with the prepaid greens fee at $0 so add-ons
      (cart, range, drinks) can be rung up on the same ticket
- [ ] Walk-ins / phone bookings from the POS: create a `CONFIRMED` booking (source POS/PHONE) and the
      greens fee sale together, respecting slot capacity
- [ ] Keep the tee sheet current (poll every ~30 s; Supabase Realtime would need RLS policies)

### Phase 6: Memberships through the POS
- [ ] Selling a membership product requires a linked customer, sets role `MEMBER`, and records
      `User.memberUntil`
- [ ] Expiry: downgrade lapsed members (a scheduled Worker, since Pages has no cron; or check at sign-in)
- [ ] Renewal reminder emails

### Phase 7: Cash management and reporting
- [ ] Cash drawer sessions: open with a float, close with a count, over/short
- [ ] End-of-day (Z) report: sales by category and tender, tax collected, voids/refunds, cash expected
- [ ] Admin **Sales** page: search sales, view/reprint receipts, export CSV
- [ ] Dashboard: today's revenue by category

---

## Housekeeping
- [x] Run in the Supabase SQL Editor, in order: `migrations/0_init`, `prisma/seed.sql`,
      `migrations/1_employee_time_management`
- [ ] Run in the Supabase SQL Editor, in order: `migrations/2_timeclock_admin`, `migrations/3_pos_catalog`,
      `prisma/seed-pos.sql`, `migrations/4_pos_sales`, `migrations/5_pos_approvals_refunds`. The admin
      Settings page saves the new pay period and POS fields, so saving settings fails until the migrations
      are applied
- [ ] Later, from a network that can reach the database:
      `npx prisma migrate resolve --applied <name>` for each migration
- [ ] Fix `npm run lint` in `apps/web`: `--ignore-path .gitignore` points at `apps/web/.gitignore`, which
      doesn't exist. Also, the script runs `--fix`, which rewrites files whenever lint runs
- [ ] Update `CLAUDE.md`: new models, endpoints and routes. It also still describes Stripe Checkout and
      `checkout.session.completed`, but the code uses PaymentIntents and `payment_intent.succeeded`
