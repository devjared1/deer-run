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
- [ ] Optional: email employees their schedule when it's published (Resend)

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
- [ ] Optional: let a manager revoke an approved request (today: deny only works on pending requests)

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
- [ ] Member Pro Shop discounts (10% Individual, 15% Premier/Family per `membershipTiers.js`). `User.membershipTier`
      is now stored (set when a membership is sold, editable in Admin → Users); what's left is applying the discount
      to eligible categories in `pricing.js` (register and server)

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
- [ ] Optional: tips on the reader, and a reader "cart" display of the items while the customer pays

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
- [ ] Optional: cancel or move a booking from the tee sheet (today: Admin → Bookings)
- [ ] Optional: unpaid online bookings ("Payment not finished") hold their spots indefinitely; release them after
      e.g. 30 minutes

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
- [ ] Optional: refunding a membership sale doesn't shorten the membership; adjust it in Admin → Users

### Phase 7: Cash management and reporting
- [x] Cash drawer sessions: open with a float, close with a count, over/short (`CashDrawerSession`, one open per
      register). Expected = float + cash payments − cash refunds at that register while the session was open, worked
      out from `Payment`/`SaleRefund` so `create_sale`/`refund_sale` didn't change. Cash sales and cash refunds are
      refused until the drawer is open (409 `DRAWER_CLOSED`; the register opens the drawer form and returns to payment).
      Cashiers count blind (managers see the running expected amount); closing prints a close slip with signature lines.
      Drawers show on the end-of-day report and on **Sales → Drawers**, where an admin can close a stuck drawer
      (`GET/POST /api/staff/register/drawer`, `GET /api/admin/drawer-sessions`, `POST /api/admin/drawer-sessions/:id`)
- [ ] Optional: paid-ins / paid-outs and safe drops during a session (today: note them when closing)
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
- [ ] Run in the Supabase SQL Editor, in order: `migrations/2_timeclock_admin`, `migrations/3_pos_catalog`,
      `prisma/seed-pos.sql`, `migrations/4_pos_sales`, `migrations/5_pos_approvals_refunds`. The admin
      Settings page saves the new pay period and POS fields, so saving settings fails until the migrations
      are applied
- [x] Reference copies of migrations 4 and 5 (`create_sale`, `refund_sale`) are now in `apps/api/prisma/sql/`
- [ ] Then run `apps/api/prisma/sql/6_pos_teesheet_memberships_drawers.sql` (tee sheet, memberships, cash
      drawers). Until it runs, the tee sheet, drawer and membership features fail, **and cash sales are refused**
      because no drawer can be opened. Deploy the code and run the SQL together
- [ ] Run `apps/api/prisma/sql/7_pos_card_payments.sql` (card checkouts; `create_sale`/`refund_sale` store Stripe IDs).
      Card payments fail until it runs; cash sales keep working
- [ ] Stripe webhook: no new events needed (`payment_intent.succeeded` covers register card sales too)
- [ ] Set `CRON_SECRET` in the Pages project (Production), then deploy the cron Worker:
      `cd apps/cron && npx wrangler secret put CRON_SECRET && npm run deploy` (same secret value)
- [ ] Later, from a network that can reach the database:
      `npx prisma migrate resolve --applied <name>` for each migration (copy files from `prisma/sql/` into
      `prisma/migrations/<name>/migration.sql` first)
- [ ] ❓ New sign-ups get `role: MEMBER` (`/api/auth/me` and the Prisma default), so every account gets member
      pricing and members-only tee times. Should new accounts be `GUEST` until they buy a membership?
- [x] Fix `npm run lint` in `apps/web`: now uses the root `.gitignore` and no longer runs `--fix`
      (use `npm run lint:fix --workspace=apps/web` to auto-format). Lint passes with 0 errors; the ~2,700
      warnings are template formatting rules that `lint:fix` would rewrite
- [x] Update `CLAUDE.md`: new models, endpoints and routes, auth helpers, shared libraries, migrations workflow,
      and the PaymentIntents / `payment_intent.succeeded` booking flow (was still describing Stripe Checkout)
