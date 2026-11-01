# TODO

Roadmap for two large features: **Employee Time Management** and a **Point of Sale (POS)** system, plus
**On-course tracking** built on the tee sheet and a site-wide **UI / UX overhaul** (Feature 4, brief in
`docs/ui-ux-review.md`).
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
- [x] Admin time entry corrections are one database transaction: Postgres function `save_time_entry()` (entry + replace
      its breaks, called with `supabase.rpc`) after the same JS validation. Migration 9

### Phase 3: Scheduling
- [x] Shared schedule helpers `src/lib/schedule.js` (used by both the app and Functions): shift length
      (an end at or before the start runs past midnight), overlap checks, warnings, week / 2-week / month periods
- [x] Admin API: `GET /api/admin/shifts?from=&to=` (or `?view=week|biweek|month&date=`, which resolves the
      period on the server; weeks start on the pay period anchor's weekday and 2-week views line up with pay
      periods), `POST`, `PUT/DELETE /:id`. The GET also returns employees and approved/pending time off
- [x] Admin **Schedule** builder (`/admin/schedule`): week grid (employees × days), click a cell to add a shift
      or a shift to edit/delete it, "working as" position override and notes, per-employee and per-day hour
      totals, filter by department
- [x] Copy last week's schedule into this week (`POST /api/admin/shifts/copy`; 2-week view copies the previous
      2 weeks). Skips inactive employees and exact duplicates, so running it twice is harmless
- [x] Warnings (shown, not enforced): overlapping shifts, shifts on approved time off or a pending request,
      inactive employees. Shown on the grid, as a count, and live in the shift form before saving
- [x] Staff API: `GET /api/staff/schedule?view=&date=[&team=1]` (own shifts; `team=1` for the whole team,
      read-only, names/positions only; coworkers' time off shows as "Off" without the type)
- [x] Staff **My Schedule** page (`/staff/schedule`): week view with previous/next navigation, plus 2-week,
      month and whole-team views
- [x] Printable schedule: **weekly, bi-weekly and monthly** views with previous/next (future and past)
      period navigation, a print stylesheet (`@media print`, landscape `@page` added only while printing),
      and a "Print" button on both the admin and staff pages
- [x] Email the schedule: **Email schedule** on `/admin/schedule` (`POST /api/admin/shifts/email { from, to }`) emails each
      active employee with shifts in the period shown their own shifts, hours and approved time off (Resend, plain text),
      after a confirmation. Reports sent / skipped (no email, inactive) / failed; one failure doesn't stop the rest.
      There's no "published" state and nothing records when it was last sent

### Phase 4: Time off
- [x] Staff API: create, list and cancel own requests (cancel only while pending)
      (`GET/POST /api/staff/time-off`, `PUT /api/staff/time-off/:id { action: 'cancel' }`). Requests can't start in
      the past, are at most 60 days, and can't overlap the employee's own pending/approved requests
- [x] Staff **Time Off** page (`/staff/time-off`): request form (dates, type, reason) + my requests with status and
      the manager's note; after sending, mentions any shifts already scheduled in those days
- [x] Admin API: list (filter by status/date), approve/deny with a note (records `reviewedById`, `reviewedAt`)
      (`GET /api/admin/time-off?status=&from=&to=`, `PUT /api/admin/time-off/:id { action, note }`). Each request
      comes with the shifts scheduled during it. Decisions only apply to pending requests (no double decisions)
- [x] Admin **Time Off** queue (`/admin/time-off`); pending-count badge in the admin sidebar
      (`GET /api/admin/time-off/count`)
- [x] Show approved time off on the schedule grid and the printed schedule (pending requests show too,
      in amber, on the admin schedule)
- [x] Email the employee when a request is approved or denied (Resend; the decision is saved even if the email fails,
      and the admin sees the email error)
- [x] Revoke an approved request that hasn't ended yet: `PUT /api/admin/time-off/:id { action: 'revoke', note }` (note
      required). It becomes DENIED with the note "Approval revoked: …", records who and when, comes off the schedule,
      and the employee is emailed

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
- [x] Member Pro Shop discounts (10% Individual, 15% Premier/Family: `proShopDiscountBps` in `membershipTiers.js`; no
      tier on file = 10%) for active members, in categories marked **Member Discount** (`ProductCategory.memberDiscount`,
      set on Apparel and Golf Equipment & Balls by migration 9). Products with a member price get that price instead.
      Applied in `pricing.js` (register and server); no manager approval. `SaleItem.discountCents` holds member +
      manager discounts and `SaleItem.memberDiscountCents` the member part (written after `create_sale`), so receipts
      show "Member discount" on its own line

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
- [x] Split tender UI: **Split** in the payment dialog puts part on the card and the rest in cash (with change).
      One card per sale; the card part is an exact amount and cash covers the rest
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
- [x] Setup guide in the repo (`docs/register-setup.md`): Chrome kiosk-printing shortcut, setting the
      receipt printer as default, paper size, drawer kick, scanner test, reader pairing

### Phase 3: Card payments (Stripe Terminal)
- [x] Stripe setup: **Admin → Registers → Pair a reader** takes the pairing code from the reader, creates the course's
      Terminal Location the first time, registers the reader to it and assigns it to the register
      (`POST /api/admin/registers/readers`). Test mode: code `simulated-wpe` makes a simulated reader
- [x] Card reader status on the admin **Registers** page (online/offline, simulated, from Stripe;
      `GET /api/admin/registers/readers`)
- [x] Server-driven flow (SQL `apps/api/prisma/sql/7_pos_card_payments.sql`): the sale is priced and validated as usual,
      then saved as a `CardCheckout` with everything `create_sale` needs; a `card_present` PaymentIntent (metadata
      `cardCheckoutId`) goes to the register's reader with `terminal.readers.processPaymentIntent`. The register polls
      `GET /api/staff/card-checkouts/:id`; when Stripe says it succeeded, the sale is saved (claimed with a conditional
      status update so the register and the webhook can't both save it). If saving fails after the charge it stays
      retryable ("Save sale"). `create_sale` now stores `Payment.stripePaymentIntentId` (and `SaleItem.bookingId`).
      Walk-in bookings are held PENDING while the card is on the reader. No reader SDK in the page
- [x] Register UI: "Tap, insert or swipe" state, cancel (cancels on the reader and in Stripe; completes instead if the
      card was already charged), decline message with **Try again**, reader offline/busy messages
- [x] Webhook: `payment_intent.succeeded` with `metadata.cardCheckoutId` saves the register sale (if the register hasn't);
      booking PaymentIntents (`metadata.bookingId`) are handled as before
- [x] Refunds through Stripe for card sales (full and partial, voids too): money goes back the way it was paid. Card
      refunds are capped at what's left of the card payment, cash refunds at what was paid in cash (so a card sale can't
      be refunded from the drawer). Stripe first (idempotent per manager approval; a failure releases the approval),
      then `refund_sale` records it with `SaleRefund.stripeRefundId`. Split sales are refunded in two passes, not voided
- [x] Test with Stripe's simulated reader before hardware arrives: with test keys the card dialog shows **Simulate card**
      and **Simulate decline** (`testHelpers.terminal.readers.presentPaymentMethod`)
- [x] Reader cart display and on-reader tips: before each card payment the reader shows the sale's lines, tax and the
      amount due (`setReaderDisplay`, best effort; the payment screen takes over). Tipping is a course setting, **off by
      default** (Admin → Settings → Point of Sale: 1–3 percentages, pre-tax or not; saving pushes them to the Stripe
      Terminal configuration). The tip is charged on top of the sale and stored as `Payment.tipCents` (`amountCents`
      stays the sale's share), so it isn't sales or tax; it shows on the receipt and email, as "Card tips" on the Z and
      sales reports, and in the sales CSV. POS refunds return at most the sale's share (tips only through the Stripe
      Dashboard). House account card payments never ask for a tip. Test mode: **Card + $5 tip**

### Phase 4: Member house accounts
Decisions: members are **invoiced** by default and can **opt in to autopay** themselves; charging to an
account requires the **member's PIN**; statements are generated **automatically on the 1st**, and a
manager can print a statement for any member **on demand**.

- [x] Schema (SQL `apps/api/prisma/sql/8_pos_house_accounts.sql`): `HouseAccount` (member, status, `creditLimitCents`,
      `pinHash`, failed-PIN count, `pinLockedAt`, `autopayEnabled`, Stripe customer + saved card), `HouseAccountEntry`
      ledger (CHARGE / REFUND / PAYMENT / ADJUSTMENT; the balance is the sum), `Statement` (period, opening, charges,
      credits, closing, due date, OPEN / PAID / AUTOPAY_FAILED). `create_sale()` writes the CHARGE for HOUSE_ACCOUNT
      payments after locking the account and checking it's active and under its limit; `refund_sale()` writes the
      REFUND credit, both in the sale's transaction
- [x] Admin **House Accounts** page (`/admin/house-accounts`): list with balances (owing first), open an account for a
      member, account page with activity, edit limit and status (suspend: no new charges; close: needs $0 balance),
      manual adjustments with a reason, reset PIN (`/api/admin/house-accounts[/:id]`)
- [x] Member PIN: set/change in **My Account** (PBKDF2, changing needs the current PIN); 5 wrong tries (at the register
      or when changing it) lock it until an admin resets it
- [x] Register tender **Account**: attached member with an active account, a PIN and enough available credit; the
      member types their PIN in the payment dialog; the whole sale goes on the account (no splits)
- [x] Monthly statements: `POST /api/internal/statements` (Bearer `CRON_SECRET`) runs daily from `apps/cron`; it creates
      last month's statement for every account with activity or a balance (one per account per period, so it's safe
      to re-run and only acts on the 1st), charges autopay, and emails each statement (Resend)
- [x] On-demand statements (admin): any date range on the account page; printable letter-size statement and
      **Email to member** (nothing is saved)
- [x] Invoicing (default): the emailed statement shows the balance, due date (15 days after the period) and a "Pay online"
      link to **My Account**. Payments at the register: **Account payment** (cash into the drawer, with change and a
      receipt slip, or card through the reader); cash account payments count toward the drawer's expected cash and
      show on the end-of-day report under "Account payments received" (not in sales). Paying the balance off marks
      open statements PAID
- [x] Autopay (opt-in): **Turn on autopay** in My Account saves a card (Stripe Customer + SetupIntent); statements are
      charged off-session for up to the current balance. A failure marks the statement AUTOPAY_FAILED and the email
      says it's due as an invoice. Members can replace the card or turn autopay off (the card is removed from Stripe)
- [x] Webhooks: `payment_intent.succeeded` records online and autopay payments (`metadata.houseAccountId`, idempotent per
      PaymentIntent); `payment_intent.payment_failed` marks a late autopay failure. **Enable `payment_intent.payment_failed`
      on the Stripe webhook**
- [x] Member **My Account**: balance and available credit, billing (autopay card or invoice), recent activity, past
      statements (printable page `/account/statements/:id`), pay balance online (Stripe Payment Element), PIN, autopay
- [x] Overdue statements: the daily statements job emails one reminder the day after the due date for each unpaid
      statement still owing (its closing balance less payments/credits since it closed), and adds the optional late fee
      (Admin → Settings, $0 = off) once as an ADJUSTMENT "Late fee — <month> statement" (`Statement.reminderSentAt` /
      `lateFeeAt`; only statements due in the last 45 days). Every statement email attaches a letter-size PDF
      (`functions/api/admin/_statementPdf.js`, no dependency; sent without it if it fails). Statements covered by later
      payments are marked PAID even while newer charges are owed

### Phase 5: Tee sheet integration (online bookings flow into the POS)
- [x] Schema: `Booking.source` (ONLINE / POS / PHONE), `Booking.checkedInAt`, `SaleItem.bookingId`
      (SQL: `apps/api/prisma/sql/6_pos_teesheet_memberships_drawers.sql`)
- [x] Staff **Tee Sheet** (`/staff/teesheet`, register positions): any day's slots with bookings,
      golfer, players, member badge, "Paid online" / "Walk-in · paid" / "Phone · paid" / "Payment not finished",
      check-in time and the receipts each booking was rung up on (`GET /api/staff/teesheet?date=`)
- [x] Check-in: sets `checkedInAt` (paid bookings only) and opens the register with the prepaid greens fee as a
      $0 line, plus the golfer's account if they have one, so add-ons go on the same ticket
      (`POST /api/staff/teesheet/:bookingId { action: 'check_in' | 'undo_check_in' }`). "Ring up add-ons" reopens it
- [x] Walk-ins / phone bookings from the POS: **+ Book** on an open slot → players, name, walk-in or phone → the
      register gets a $0 "Tee time …" line and the cashier adds the greens fees as normal products. When the sale
      completes the booking is created `CONFIRMED` (source POS/PHONE, `totalCents` 0 since the money is on the sale)
      right before `create_sale` (space re-checked), and deleted again if the sale fails. Members-only slots need an
      active member attached. Like online booking, two bookings in the same instant could still overfill a slot
- [x] Keep the tee sheet current (polls every 30 s while the tab is visible)
- [x] Cancel or move a booking from the tee sheet (register staff): **Move** (paid, not checked in) to any tee time that
      hasn't started, any day, re-checking space and members-only; online golfers are emailed the new time. **Cancel**
      frees the spots; checked-in groups need **Undo** first; an unpaid online booking's PaymentIntent is cancelled first.
      Cancelling never refunds: the dialog says where the money is (online payment → an admin refunds it in Stripe;
      greens fees on receipt #N → refund it from Recent sales with manager approval)
      (`POST /api/staff/teesheet/:bookingId { action: 'cancel' | 'move', teeTimeSlotId }`)
- [x] Unpaid online bookings ("Payment not finished") hold their spots for 30 minutes (`isExpiredHold`/`holdsSpot` in
      `src/lib/teesheet.js`, used everywhere capacity is counted; register card holds never expire). Then they're
      released (PaymentIntent cancelled, booking CANCELLED) in the background when tee times / the tee sheet are viewed
      or a booking is made, and daily (`POST /api/internal/bookings`). A payment that beat the release is kept; one that
      finishes after its hold is confirmed if there's still room, otherwise refunded and the golfer emailed; a payment on
      a cancelled booking is flagged to `CONTACT_EMAIL_TO`. Customer and admin cancels of unpaid bookings also cancel the
      PaymentIntent

### Phase 6: Memberships through the POS
- [x] Selling a membership product requires a linked customer, sets role `MEMBER`, and records
      `User.memberUntil` (+ `membershipTier`). Products get **Membership length (months)** and **Tier** in the product
      form (`Product.membershipMonths`, `membershipTier`; the migration fills them in for the seeded membership
      products). Renewing early extends from the current end date; quantity × months. Admins keep their role.
      The update runs right after `create_sale`; if it fails the sale still stands and the register shows a warning
- [x] Expiry: `isActiveMember()` (`src/lib/membership.js`) is used for member pricing at the register, the customer
      search ("Membership expired" badge) and members-only tee times. Lapsed members drop to GUEST at sign-in
      (`/api/auth/me`) and in the daily job. Members with no `memberUntil` (added by hand) never expire.
      Admin → Users shows and edits the end date and tier
- [x] Renewal reminder emails: 30 and 7 days before the last day, and once when it has passed (each once per end
      date, `User.renewalReminderKey`). Daily job `POST /api/internal/memberships` (Bearer `CRON_SECRET`), called by
      the scheduled Worker in `apps/cron` (Pages has no cron triggers)
- [x] Refunding/voiding a membership line takes the refunded months (quantity × months) back off `memberUntil`
      (`shortenMembership()`), as a follow-up after `refund_sale` (warning at the register if it fails). If it ends before
      today the member drops to GUEST (admins keep their role), without the "membership ended" email

### Phase 7: Cash management and reporting
- [x] Cash drawer sessions: open with a float, close with a count, over/short (`CashDrawerSession`, one open per
      register). Expected = float + cash payments − cash refunds at that register while the session was open, worked
      out from `Payment`/`SaleRefund` so `create_sale`/`refund_sale` didn't change. Cash sales and cash refunds are
      refused until the drawer is open (409 `DRAWER_CLOSED`; the register opens the drawer form and returns to payment).
      Cashiers count blind (managers see the running expected amount); closing prints a close slip with signature lines.
      Drawers show on the end-of-day report and on **Sales → Drawers**, where an admin can close a stuck drawer
      (`GET/POST /api/staff/register/drawer`, `GET /api/admin/drawer-sessions`, `POST /api/admin/drawer-sessions/:id`)
- [x] Paid-ins, paid-outs and safe drops during a session (`CashDrawerMovement`, migration 9): each needs a manager (approval
      actions PAID_IN / PAID_OUT / SAFE_DROP; a manager at the register approves without a prompt) and prints an 80 mm slip
      that opens the drawer (paid-outs have a reason, optional "paid to" and signature lines). Expected = float + cash
      taken − cash refunds + paid in − paid out − safe drops; the totals are stored at close. They show on the close slip,
      Sales → Drawers and the end-of-day report ("Cash left in drawers"). Cashiers still count blind
      (`POST /api/staff/register/drawer { action: 'movement' }`). A wrong movement can't be undone in the app yet
- [x] End-of-day (Z) report: sales by category and tender, tax collected, discounts, voids/refunds, cash expected
      (cash in − cash out; the opening float comes with drawer sessions), No Sale count. Sales count on the day
      they're rung up and returns on the day they happen, so a past day's report never changes. Shared builder in
      `functions/api/admin/sales/_report.js`. Admin: `GET /api/admin/sales/report?date=` or `?from=&to=`
      (`&registerId=`), shown on **Sales → Report** (letter print or 80 mm slip). Register managers: **End of day**
      button at the register prints the 80 mm slip for that register (`GET /api/staff/register/report`)
- [x] Admin **Sales** page (`/admin/sales`): date range / register / status filters, find by receipt number, paged
      list, sale detail with receipt preview and refund history, reprint (80 mm) and email the receipt, CSV export
      (one row per sale or per item) (`GET /api/admin/sales[?format=csv&detail=sales|items]`, `GET/POST /api/admin/sales/:id`)
- [x] Dashboard: today's register sales by category (net, with tax/total and void/refund count)

---

## Housekeeping
- [x] Run in the Supabase SQL Editor, in order: `migrations/0_init`, `prisma/seed.sql`,
      `migrations/1_employee_time_management`
- [x] Run in the Supabase SQL Editor, in order: `migrations/2_timeclock_admin`, `migrations/3_pos_catalog`,
      `prisma/seed-pos.sql`, `migrations/4_pos_sales`, `migrations/5_pos_approvals_refunds`
- [x] Reference copies of migrations 4 and 5 (`create_sale`, `refund_sale`) are now in `apps/api/prisma/sql/`
- [x] Run `apps/api/prisma/sql/6_pos_teesheet_memberships_drawers.sql`, `7_pos_card_payments.sql` and
      `8_pos_house_accounts.sql`
- [x] Stripe webhook: `payment_intent.succeeded` and `payment_intent.payment_failed` enabled
- [x] `CRON_SECRET` set in the Pages project and the cron Worker deployed
- [x] `npx prisma migrate resolve --applied <name>` for each migration
- [ ] Run `apps/api/prisma/sql/9_guest_default_discounts_tips_drawers.sql` together with the deploy that needs it (the
      drawer, drawer close, admin drawer list, sales report and time entry corrections fail until it runs), then
      `prisma migrate resolve --applied 9_guest_default_discounts_tips_drawers`
- [ ] Run `apps/api/prisma/sql/10_on_course_tracking.sql` after 9, together with the deploy that needs it (the tee
      sheet and On Course pages fail until it runs), then `prisma migrate resolve --applied 10_on_course_tracking`
- [ ] Run `apps/api/prisma/sql/11_rates.sql` after 10, together with the deploy that needs it (the tee sheet fails
      until it runs; Settings hides Rates until then), then `prisma migrate resolve --applied 11_rates`. It sets the
      starting rates and deactivates the old Twilight / 9 Holes products; check Admin → Products for other old
      greens fee products (Walking, Junior, Senior Rate) the course no longer sells
- [ ] Redeploy the cron Worker (`cd apps/cron && npm run deploy`): it now also calls `/api/internal/bookings` and
      `/api/internal/pace`
- [x] New sign-ups are `GUEST` (`/api/auth/me` and the Prisma default; migration 9 changes the column default).
      Membership comes from buying a membership product or an admin setting it in Admin → Users. Accounts created
      before this as MEMBER stay members: review them in Admin → Users
- [x] Fix `npm run lint` in `apps/web`: now uses the root `.gitignore` and no longer runs `--fix`
      (use `npm run lint:fix --workspace=apps/web` to auto-format). Lint passes with 0 errors; the ~2,700
      warnings are template formatting rules that `lint:fix` would rewrite
- [x] Update `CLAUDE.md`: new models, endpoints and routes, auth helpers, shared libraries, migrations workflow,
      and the PaymentIntents / `payment_intent.succeeded` booking flow (was still describing Stripe Checkout)


## Feature 3: On-course tracking (pace of play)

Decisions: pace is **information for the pro shop** (call-ins, walk-ins, marshals); it never changes booking or tee
time spacing. Estimates are worked out in the browser from the tee sheet (`src/lib/pace.js`, shared with the
Functions). **Every report is stored** (`PositionReport`) and each hole's time is learned from them nightly; the latest
is also kept on the booking. Ahead / behind is measured against the **booked tee time** and the learned hole times, so
"behind" means slower than the course usually plays (a group that went off late and kept pace still shows behind).
Groups with no tee-off recorded are assumed to have gone off on time.

- [x] Schema (SQL `apps/api/prisma/sql/10_on_course_tracking.sql`): `Booking.cartNumbers` (text, several per group),
      `ownCart` (some or all brought their own / walking), `startHole` (1 or 10), `roundHoles` (9 or 18), `teedOffAt`,
      `positionHole` + `positionStage` (`HoleStage`: TEE / FAIRWAY / GREEN) + `positionAt`, `finishedAt`;
      `CourseSettings.roundMinutes` (expected 18-hole round, default 4 h 15) and `coursePositions`
- [x] Estimation (`src/lib/pace.js`): the round is split across the holes by par (par 3 : 4 : 5 = 10 : 14 : 17; a 9-hole
      round takes that nine's share; a round from 10 plays 10–18 then 1–9). From the latest report (or the tee-off, or
      the tee time) the group is assumed to keep the planned pace. Within 10 minutes counts as on pace. Course pace =
      average of groups reported in the last hour; "first tee late" = average delay of tee-offs in the last 90 minutes;
      open holes between a group and the one ahead
- [x] Check-in on the tee sheet asks for cart numbers, own cart / walking, starting hole and 9 or 18 (warns when a cart
      is still out with another group), then opens the register as before. **Carts** edits them later. Checked-in groups
      show their carts, round and estimated hole / pace; the header shows the course's pace (today)
      (`POST /api/staff/teesheet/:id { action: 'check_in', cartNumbers, ownCart, startHole, roundHoles }`; undo check-in
      clears the tee-off, position and finish)
- [x] Staff **On Course** page (`/staff/oncourse`): course pace, first tee delay, groups / golfers / carts out, when the
      last group should be in, and the **next open tee time with when it'll likely go off and finish** at today's pace
      (for call-ins and walk-ins); a map of the 18 holes with each group's chip (solid = reported in the last 30 min,
      dashed = estimated, coloured by pace); **Up next** (checked in, not off: **Teed off**), **On the course**
      (where, how it's known, ahead / behind, "should be on", open holes ahead, estimated finish: **Update**, **Finished**,
      **Carts**, undo tee-off) and **Finished today** (time, round length, pace; undo)
      (`GET /api/staff/oncourse`, `POST /api/staff/oncourse/:id { action: setup | tee_off | undo_tee_off | position |
      finish | undo_finish }`)
- [x] Access: register staff plus the positions in **Admin → Settings → On Course** (default Starter, Player Assistant /
      Marshal, Outside Services, Beverage Cart), so marshals and cart staff can update groups without the register
      (`requireCourse`, `/api/auth/me` → `canTrackCourse`). The expected round length is set there too
- [x] Position history: every report is a `PositionReport` row (hole, stage, time, employee). A report within 3 minutes
      of the group's previous one replaces it (a correction); undoing the tee-off or the check-in deletes the group's
      reports
- [x] Learned per-hole times: `learnHoleSeconds()` takes the last 60 days of rounds; each stretch between two known
      points (tee-off, reports, finish) says how long those holes took, and an iterative fit finds the hole times that
      explain all the stretches, so a slow hole stands out from its neighbours. Stretches played at under 0.4× or over
      2.5× the plan are dropped as mistakes; each hole is pulled toward the par split by 3 rounds' worth. Saved to
      `CourseSettings.holeSeconds` nightly (`POST /api/internal/pace`, in `apps/cron`) or on **Admin → Settings → On
      Course → Recalculate now** (`POST /api/admin/pace`), which also shows the 18 learned times. Until then the par
      split of the expected round is used
- [x] Demo seed: carts, tee-offs, finishes and marshal reports (about a third of the holes per round, ~75 days, with
      slow holes at 6, 10, 11, 12, 15) for checked-in groups, and groups waiting on the tee. Run **Recalculate now**
      after seeding
- [x] Decision: pace stays information for the pro shop; it doesn't change booking or tee time spacing
- [ ] Pace by time of day / day of week (mornings play faster than a Saturday afternoon), if the single profile isn't
      good enough

---

## Feature 4: UI / UX overhaul

Goal: a public site on par with nationally recognized golf course websites, fast and intuitive staff and admin tools,
**Material Design 3**, mobile-first and responsive at every size, the new logo everywhere, and a real icon library
instead of emoji. The full review, decisions and file:line findings are in **`docs/ui-ux-review.md`**; read it before
starting a phase. One phase per branch/PR. Each phase ends with lint + build passing, a check at 360/412/768/1024/
1280/1920px, a keyboard pass, and axe with 0 serious issues.

Decisions (see the brief §2): stay on Vue + Tailwind with MD3 tokens and in-house components (no Vuetify / Material
Web; `@headlessui/vue` allowed for a11y primitives). Icons are **Material Symbols Rounded** via `unplugin-icons` +
`@iconify-json/material-symbols`. Playfair Display + Lato (drop Libre Baskerville), self-hosted. Color roles come from
seed pine `#1E3D2F`; the brand `amber` token is renamed `gold`. MD3 shape scale: pill buttons, 12dp cards, 28dp
dialogs. Receipts and slips aren't redesigned.

### Phase 0: Quick wins and bugs found in the review
- [x] Move `.btn-*`, `.field`, `.card` in `main.css` into `@layer components` (they currently override Tailwind
      utilities, so every primary button, incl. the register's Charge/Complete Sale, renders at the wrong size) and
      add `:disabled` styles
- [x] Booking wizard full width on mobile (`BookingWizard.vue:2` `w-2/3` → `w-full`; `BookView.vue:16` padding)
- [x] Payment step creates a new PENDING booking + PaymentIntent every time it mounts (Back → Next = a second
      30-minute hold): create once per selection and reuse (`StepPayment.vue:100`)
- [x] Show the API's error message when a booking fails ("slot just filled") instead of "Booking failed"
- [x] Logo visible at every size in `AppNav` (hidden below `sm` today) plus a compact Book button on mobile
- [x] Missing files: `/favicon.svg` (404 in `index.html`), `/images/course-1.jpg` (Tournaments hero 404); remove the
      near-duplicate `course-2-edited.jpg` / `course-5-copy.jpg` (or pick them as the keepers)
      (interim `favicon.svg` until Phase 1's logo mark; the two are landscape crops of the portrait originals, kept
      as `course-2-wide.jpg` / `course-5-wide.jpg` for wide heroes; Tournaments uses `course-2-wide.jpg`)
- [x] Tournament **Register** goes to `/book` (the tee time flow): link to a contact/inquiry with the event name until
      the event page exists (Phase 3)
- [x] Admin Tee Times "today" uses UTC (tomorrow after 7 pm Central): use `localDate()` (`admin/TeeTimesView.vue:124`)
- [x] Customer cancel window counts from UTC midnight of the slot date, not the tee time (`AccountView.vue:148`)
- [x] Booking "Member / Sign In" keeps the flow (`/login?redirect=/book`); don't say "Signed in as member" to guests
- [x] Confirmation page: Processing state that polls while the webhook is pending, handle Stripe
      `redirect_status=failed|processing`, only say "confirmation sent" once CONFIRMED
- [x] `PageHero`: `classes` prop optional with a sensible default, `min-height` instead of a fixed height that clips text
- [x] Define the missing `price-featured` / `price-card` / `event-row` / `event-past` styles (Best Value emphasis, past
      events dimmed); fix the duplicate `id="inquiry-form"`
- [x] Footer dead links (Privacy Policy, Accessibility, City of Moulton) → real pages/links or removed
      (removed; Accessibility comes back with its page in Phase 3)
- [x] Confirm before destructive actions: delete register/category/shift, deactivate employee/product, reset PIN,
      promote to ADMIN, customer booking cancel; relabel admin booking REFUNDED/CANCELLED as "status only, no money moves"
- [x] Dialogs with typed input (Tender, Refund, Cash movement, product/employee/tournament forms) stop closing on a
      backdrop tap
- [x] A failed row action shows a message instead of replacing the whole table (Employees, Products, Registers)
- [x] Wrap the tables that scroll the whole page sideways in `overflow-x-auto` (HouseAccounts, Registers,
      HouseAccountDetail, CategoryManagerModal, SalesReport, Memberships comparison)
- [x] Register scanner: select the search text on a missed scan so the next scan replaces it; scroll to and highlight
      the added line
- [x] Sign out in the admin and staff shells
- [x] ❓ Online price vs rate card: booking always charges $45 (`stores/booking.js:13`, server
      `pricePerPlayerCents`) while Rates shows weekend $50 / twilight $30. Decide what's sold online
      Answer: see if you can find the actual rates for Deer Run online. If you can, add those rates to the Admin portal so they can be changed whenever. In-store and online should pull those rates to charge. If nothing online found default to:
            - Weekday 9/18 Green Fee: $20/$30
            - Weekend/Holiday 9/18 Green Fee: $30/$40
            - Cart: $12
      Done: no rate sheet is published online (the city's page says to call; Golf Digest lists a $45 guide price),
      so the defaults above are used. Rates are the POS products tagged `Product.rateKey` (weekday/weekend × 9/18,
      cart per rider), edited in **Admin → Settings → Rates** with holiday dates; online booking (`/api/rates`,
      `POST /api/bookings` with `roundHoles` + `cart`) and the register charge the same prices. Migration
      `sql/11_rates.sql`. Online, members still pay the regular rate (as before); in-store their greens fee is the
      product's member price ($0)
- [ ] ❓ Copy to confirm with the course: hours (footer vs Contact), twilight / 9-hole / tee-time policies on Rates,
      member events by tier, hole names in `data/holes.js`
      Answer: Deer Run does not have any twilight rates. See above about trying to find actual rates online.
      Done so far: twilight removed everywhere (Rates page, products), 9-hole / walking / junior / senior lines
      replaced by the live rates. Footer and Contact now share one hours list (`src/data/site.js`), still unconfirmed.
      Still open: hours (and "last tee time 5:00 PM" vs closing at 5:00), member events by tier (Family: no "club events"
      in the table but "priority event registration" on its card), carts in membership (table says included, cards
      don't), hole names, tee totals (`teeSets.js` 6,745/6,242/5,612/5,398 vs the hole sums 7,105/6,554/5,952/5,576),
      rating/slope, course coordinates, extra fees and policies on Rates, entry fees per player or per team

### Phase 1: Design system foundation
- [x] Logo assets: ask the course for the original vector file. Meanwhile, export the emblem from
      `deerrunlogo.svg` (534 KB raster in an SVG wrapper) as optimized WebP + PNG at 1x/2x/3x (<30 KB each), plus a
      square **mark** (stag + sun, no text). Generate `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, 192/512
      manifest icons, `site.webmanifest`, `theme-color`
      (done from the embedded raster: emblem 48–480 px tall, 2–47 KB; masters in `docs/brand`. Still to do: **ask the
      course for the vector logo** and regenerate from it; the mark is a round crop of the emblem art)
- [x] `BrandLogo.vue` (`variant="emblem|mark"`, `size`); delete `DeerLogo.vue` once unused
- [x] Tokens: MD3 color roles from seed pine as CSS variables mapped into `tailwind.config.js` (primary/secondary/
      tertiary/error/success/warning, surface + surface-container levels, outline, on-* colors; brand gold/clay/lake as
      extended colors; rename `amber` → `gold`); AA-passing solid text tiers instead of alpha text
- [x] MD3 type scale (display/headline/title/body/label × L/M/S) as `fontSize` tokens; self-host Playfair Display + Lato
      with `@fontsource` (woff2, swap, preload); drop Libre Baskerville and Lato 300
- [x] Shape, elevation (levels 0–5), state-layer, motion (easing/duration) tokens; global `:focus-visible` ring;
      `prefers-reduced-motion` for all animations
- [x] Icons: `unplugin-icons` + `@iconify-json/material-symbols` (Rounded) in `vite.config.js`; size convention;
      custom golf-cart and bunker SVGs in the same style
- [x] Core components in `src/components/ui/` (brief §7): `AppButton`, `IconButton`, `AppDialog` (focus trap, Esc,
      scroll lock, aria, full-screen on phones, `persistent`), `ConfirmDialog` + `useConfirm()`, `BottomSheet`,
      `AppSnackbar` + `useSnackbar()`, `TextField`/`SelectField`/`TextArea`, `MoneyField`, `Checkbox`/`Switch`/
      `RadioGroup`, `SegmentedButton`, `ChipGroup`/`FilterChip`, `Tabs`, `Card`, `StatCard`, `StatusChip` (one status map),
      `EmptyState`, `Skeleton`, `ProgressIndicator`, `ErrorBanner` (Retry), `PageHeader`, `RowActionsMenu`, `Pagination`,
      `DataTable` (cards below md), `DateStepper`, `DateRangeField`, `NumericKeypad`, `ResultDialog`, `CustomerSearch`
- [x] Dev-only component gallery at `/dev/ui` showing every component in every state (also in a build with
      `VITE_UI_GALLERY=true`). Not yet reviewed in a browser: check it at 360–1920px with the keyboard before Phase 2
      pages depend on the components
- [x] Update `CLAUDE.md` → Design System with the tokens, components and icon conventions

### Phase 2: App shells and navigation
- [x] Public `AppNav`: `<header>`, skip link, logo at every size (40–48px), desktop links + Sign in/Account + gold Book
      CTA, mobile full-screen navigation drawer (48dp items, Esc, closes on route change, scroll lock,
      `aria-expanded`), **sticky bottom "Book a tee time" bar** on mobile
- [x] Public `AppFooter`: new logo, contact with icons, hours, directions link, social links, newsletter signup, real
      legal links (social links are empty in `src/data/site.js` until the course confirms its pages; the newsletter
      form saves a contact message, there's no mailing list yet; Privacy/Accessibility links come with Phase 3)
- [x] Router: 404 page, per-route `meta.title`/`description` (`@unhead/vue`), `scrollBehavior` honoring
      `savedPosition` and `#hash`
- [x] Admin shell: top app bar (title, breadcrumbs from route meta, page actions, account menu, sign out),
      **navigation rail at md**, drawer at lg, nav grouped (Overview / Golf / Staff / Pro Shop / Admin) with Material
      Symbols, 56dp items with MD3 active indicator, time-off badge kept, `document.title`
- [x] Staff shell: **bottom navigation bar on phones** (role-based 3–5 destinations + More), rail on tablets, drawer
      on desktop; clock-status chip in the top bar; sign out; **Lock / switch cashier** on the register PC
      (Switch cashier signs out to the same page; a PIN lock screen isn't built. RegisterView's cart still assumes
      the old header offsets: fix in Phase 6)
- [x] Register mode: full-bleed route meta (no sidebar/padding, rail collapsed) for `/staff/register`
- [x] All nav emoji replaced (brief §8)

### Phase 3: Public site redesign (benchmark level)
- [x] Image pipeline: `vite-imagetools` (AVIF/WebP at 640/1280/1920, `srcset`/`sizes`), width/height on every image,
      `loading="lazy"` below the fold, heroes as `<picture fetchpriority="high">` instead of CSS backgrounds
      (pre-generated with `scripts/gen-photos.py` + `ResponsivePicture` instead: vite-imagetools needs a second Vite)
- [x] Home: full-bleed cinematic hero with the emblem and an **instant tee-time search** (date, players, time of day →
      `/book` prefilled); three photo-led cards (Course, Tee Times & Rates, Events); "Plan your visit" strip (address,
      hours, phone, directions, weather); next 3 events from `/api/events`; testimonials/rating; membership teaser;
      responsive gallery with lightbox (snap carousel on mobile); remove dead `quickInfo`
      (testimonials/rating left out: no real ones to show yet)
- [x] Course: standard scorecard (all tees, men's/ladies' handicap, sticky first column, caption/scope, computed par
      totals, printable PDF); hazard icons with visible legend (no `title`-only meaning); `TeeSetSelector` as a radiogroup
- [x] Hole-by-hole pages `/course/hole/:n`: photo, yardage per tee, hole diagram, pro tip, previous/next swipe
      (flyover/drone media when available)
      (tips, photos, doglegs, ladies' handicap render when added to `data/holes.js`; none exist yet)
- [x] Rates: fee notes visible on mobile (stacked), table header/caption, one elevation for the featured card, honest
      Book buttons (per the Phase 0 pricing decision)
- [x] Memberships: per-tier stacked comparison on mobile with sr-only "Included/Not included", Best Value emphasis,
      inquiry as a real `<form>` (labels, `autocomplete`, inline validation, 1-column on mobile), icon success state
- [x] Tournaments: sorted upcoming/past, skeleton loading, empty state with action, event images, **event detail page
      with registration/inquiry form**, Add to calendar, share, `Event` JSON-LD
- [x] Contact: labeled form with `autocomplete` and validation, tappable phone, template links instead of `v-html`,
      **Get directions** (Google/Apple Maps), icon tiles
- [x] Login: compact header, "Sign in" (not "Member Sign In"), forgot password, create account, show/hide password,
      `autocomplete`, friendly errors
- [x] Account: friendly status chips, cancel with confirmation and error feedback, contrast-safe past bookings,
      error state; `HouseAccountPanel` / `StripeElementModal` moved onto the shared components and tokens, one primary
      action + overflow menu
- [x] Statement: Download PDF (server already builds it), Print with icons, 48dp back button, logo on the printed
      statement
- [x] SEO: OG/Twitter tags and share images per page, canonical, `robots.txt`, `sitemap.xml`, `GolfCourse` +
      `LocalBusiness` JSON-LD (address, geo, phone, hours, `ReserveAction` → `/book`), prerender public routes
      (`vite-ssg` or build-time prerender)
      (head-only prerender: `dist/<route>.html` per public route + sitemap; page content still renders client-side;
      geo is approximate and hours aren't in the JSON-LD until confirmed)
- [x] Accessibility statement page (linked from the footer)
- [x] ❓ Professional photography (drone, golden hour, holes 1–18, clubhouse, grill, people playing) and an optional
      muted hero video loop
      Answer: Use the current photography pics where you can. Will need to get professional photos done at a later date.

### Phase 4: Booking flow
- [x] Steps in the URL (`/book?step=` or child routes) so browser Back works; focus moves to each step heading;
      `aria-current="step"`; reduced-motion-aware transitions
- [x] Date: horizontal 7–14 day strip on mobile, month calendar on desktop with grid semantics and arrow keys, 48dp
      days, navigation limited to the booking window, per-day availability hint, no extra "continue" click
- [x] Time: **players first**, then only times that fit; grouped Morning / Midday / Twilight with sticky subheads;
      skeleton loading; empty state with next-day chips; sticky bottom summary (date · time · players · total) with
      Continue
- [x] Details: segmented guest/member control, phone field, inline validation, `autocomplete`, labels tied to inputs
      (no phone field: `Booking` has no phone column; add one with a migration if the course wants it. Arrival tips and
      the cancellation copy live in `components/booking/bookingFlow.js`, to confirm with the course)
- [x] Payment: total from the server's PaymentIntent, terms and cancellation-policy line, busy state, Stripe
      `appearance` from the tokens
- [x] Confirmation: booking reference, Add to calendar (.ics), directions, manage booking, arrival tips, weather for
      the tee date

### Phase 5: Admin panel migration
- [x] Migrate every admin view to the shared components and tokens (removes the copied `.modal-*`, `.btn-*`,
      `.input-field`, `.badge`, `.th` CSS and the raw `gray-*`/`red-*`/`green-*` classes); `apiFetch` everywhere
- [x] `DataTable` everywhere: cards below md, `more_vert` row menus, keyboard-reachable clickable rows (Sales,
      HouseAccounts, Timesheets)
- [x] One filter behavior (reload on change, debounce text), filter chips + `DateRangeField`; Sales filters in a
      bottom sheet on mobile
- [x] Snackbar feedback on every save (Undo for deactivations); confirmations through `useConfirm()`
- [x] Friendly labels everywhere: status chips, 12-hour times, formatted dates, `$1,234.56`
- [x] Settings: tabbed/sectioned cards (Booking / Payroll / Point of Sale / Tipping / On Course / House Accounts),
      sticky save bar, unsaved-changes guard, money in dollars, stacking grids, hole-time grid that fits at 360px
- [x] Dashboard: date-context header, StatCards with trends/sparklines, quick actions
- [x] Tee Times: bulk generate / close slots
- [x] Schedule: agenda list instead of the month grid on phones, keyboard-reachable cells, visible legend
- [x] Time Off: red Deny/Revoke; House account detail: scroll to the shown statement, busy labels on saves

### Phase 6: Staff portal and POS
- [x] Register layout: Total `text-3xl`, Charge as an xl filled button, icon toolbar + overflow for Recent sales / No
      sale / Account payment / End of day / Change register and the drawer actions, scrolling 48dp category chip row,
      48dp qty ± and line icon buttons
- [x] Scanner: document-level scanner buffer (works whenever no input/dialog has focus), scan during "Sale complete"
      starts a new sale with that item, error tone on a miss, `inputmode="none"` on the scan field with a keyboard toggle
- [x] Tender: 64dp quick-cash buttons, Enter on an empty cash field = Exact, split asks for the cash part and
      computes the card remainder, errors above the buttons, Print/Email receipt as a segmented control, defaults to
      Card (or warns) while the drawer is closed
- [ ] Reader status for the register: no staff endpoint reports it yet. The cart chip and TenderModal's `readerOnline`
      read an optional `readerStatus: 'online' | 'offline'` on the catalog's registers; add it to
      `/api/staff/register/catalog` (one Stripe Terminal reader lookup) to light them up
- [x] Card: reader online/offline chip in the cart header (Card disabled when offline), "Pay with cash instead" on a
      decline
- [x] Manager approval with large name buttons + `NumericKeypad` (also house account PIN, drawer counts, Manager PIN
      page); refund reason chips; one `ResultDialog` for sale / refund / drawer / account payment results
- [x] Check-in path: "No add-ons, done" (no $0 sale needed) and "Back to tee sheet" after a check-in sale
- [x] All POS modals on `AppDialog` (consistent z-stack, print-hidden, Esc, no backdrop-close with input); verify only
      the slip prints during refund/approval flows
- [x] Tee Sheet: one card per booking (name + players, one icon status chip, one primary action, overflow menu),
      inline "Open: tap to book" rows, `DateStepper`, help text behind an info icon, AA contrast
- [x] On Course: group cards with one big **Update position** action, bottom-sheet update flow (group → hole → stage,
      56dp+ hole picker in 5–6 columns, full-width stage control), whole hole tile as the map target, pace shown with
      arrows/"+6" text (not color only), estimates as a different fill, compact sticky pace bar
- [x] High-contrast mode for outdoor pages (On Course, Tee Sheet): dark text, 16px minimum, heavier weights
- [x] `RoundSetupFields`: 48dp toggles, MD3 switch for own cart
- [x] Time Clock: action first and full width on phones; My Timesheet: day list below sm; My Schedule: top app bar +
      chip row, agenda list on phones; Time Off: extended FAB + full-screen request dialog, `useConfirm()` for cancel;
      Manager PIN: snackbar
- [x] Remaining emoji (✓ ✕ ⚠ 🖨 🛺 etc.) replaced; `apiFetch` in TimeClock and MyTimesheet

### Phase 7: Quality pass
- [x] Lighthouse ≥ 90 (Performance, Accessibility, Best Practices, SEO) on every public route; LCP < 2.5 s on 4G,
      CLS < 0.1
      (Lighthouse 12 on the built site over HTTP/2 with a mocked API, mobile 4G: Performance 97–99, the other three
      100, CLS 0; desktop 100 across. LCP 2.0–2.4 s, Contact 2.56 s. Fixed: the footer jumping down when the lazy
      page arrived (CLS 0.9 → 0), fonts and the hero photo found late (each page's HTML now preloads its view's
      chunks, hero photo and headline fonts), Supabase in the main bundle (loaded on demand; signed-out visitors
      never wait for it; main chunk 142 → 96 KB gz), Stripe.js loading on /book before the payment step
      (`@stripe/stripe-js/pure`), AVIF at quality 45, phone PageHero photo at the 640 file, logos not `fetchpriority`.
      Still a client-rendered body: a body prerender would be the next step for FCP/LCP.)
- [x] axe: 0 serious/critical issues across public, admin and staff pages; full keyboard-only walkthrough of booking,
      register sale, refund, check-in and On Course update
      (axe-core 4 at 412 and 1280 on every public route and the `/dev/ui` admin/staff/POS previews with dialogs open.
      Fixed: names that didn't contain the visible text (date strip, shift chips, DataTable cards, hole tiles, clock
      chip, "00" key), a `<ul>` holding a `<div>` (My Schedule), a read-only schedule grid that couldn't be scrolled by
      keyboard, the phone Book bar outside any landmark. Keyboard: focus now returns to the trigger when an AppDialog /
      BottomSheet closes (`useFocusReturn.js`; Headless UI's restore ran while the page was still inert), a loading
      AppButton and the refund −/+/All steppers keep focus (`focusableWhenDisabled`), dialogs don't open on an
      aria-disabled control, the newsletter field no longer errors when tabbed past. Left: the disabled TextField's
      helper text (38% by design, exempt as an inactive control); gallery-only landmark/heading notices)
- [x] Contrast audit of every token pairing (WCAG AA; 3:1 for large text and UI components)
      (154 pairs, default and high contrast: all text pairs pass; the only failures are brand gold as a fill or border
      on light surfaces, 2.2–3.0:1, which is fine for the gold CTA (its label identifies it) and no text uses it. The
      two places gold alone marked a state now add a gold-text edge: the booking stepper's current step and the
      highlighted tee on a hole page. No token values changed)
- [x] Device pass: iPhone SE / 14 / Pro Max, Android 412px, iPad portrait/landscape, the register PC at 1366×768
      touch, 1920 desktop; print checks for schedules, statements, Z report and receipts
      (Emulated in headless Chrome with device-width emulation: 10 public routes + register, tee sheet, on course and
      sales previews at 375/390/430/412/768/1024/1366/1920, no horizontal overflow or console errors. Print media:
      admin/staff schedules, statement, letter end-of-day report (drawer table fixed to fit portrait), Z slip,
      scorecard, register receipt/No Sale slip — only the document prints. Still to do on real hardware: an iPhone,
      an Android phone, an iPad, and the register PC with its touchscreen, scanner and receipt printer)
- [x] No emoji icons left (`grep` for emoji ranges in `src`); no `DeerLogo` imports; no inline hex colors outside
      print components
      (audit script: 0 emoji icons, 0 DeerLogo, 0 inline hex/rgba outside print components and tokens; legacy CSS in
      main.css cut from 323 to 97 lines (`.hero-bg`, `.page-enter` still used); SectionLabel removed. Left: the
      physical tee marker colors in `teeSets.js`; raw `fetch` in the auth/booking stores for public calls)
- [x] Update `CLAUDE.md` (Design System, components, routes) and this file
- [ ] Verify on staging with real data: sign in / sign up / password reset (Supabase now loads on demand), a real
      online booking through Stripe, a register sale with the card reader, the PDF statement download
