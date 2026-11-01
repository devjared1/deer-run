# CLAUDE.md — Deer Run Golf Course

## Project Overview

Production Vue 3 + Cloudflare Pages monorepo for [deerrun.golf](https://deerrun.golf) — an 18-hole public/semi-private golf course in Lawrence County, Alabama. The public site handles tee time booking, membership inquiries, tournament listings, scorecards, rates, and course contact.
Behind it are an **admin panel** (`/admin`) and a **staff portal** (`/staff`) for employee time management
(time clock, timesheets, scheduling, time off) and an in-house **point of sale** (register, receipts, refunds).

`TODO.md` at the repo root is the roadmap for the employee time management and POS features: what's done,
what's next, and the decisions behind them. Keep it current when you finish or change an item.

---

## Repository Structure

```
deer-run/
├── apps/
│   ├── web/                   # Vue 3 frontend + Cloudflare Pages Functions
│   │   ├── functions/api/     # Pages Functions — all served under /api/* (see API section)
│   │   │   ├── auth/me.js     # Profile + linked employee + register access
│   │   │   ├── teetimes.js, events.js, bookings/, inquiries/   # public site
│   │   │   ├── webhooks/stripe.js
│   │   │   ├── admin/         # Admin panel APIs (requireAdmin); _auth.js holds the shared auth helpers,
│   │   │   │                  #   _db.js (fetchAll), _csv.js, _membership.js (expiry + reminder emails),
│   │   │   │                  #   _houseAccounts.js / _statements.js (house accounts)
│   │   │   ├── account/       # The signed-in member's own data (house account, statements)
│   │   │   ├── staff/         # Staff portal APIs (requireStaff / requireRegister); _auth.js, _timesheet.js,
│   │   │   │                  #   _timeoff.js, _approvals.js, _pin.js, _drawer.js; register/, sales/, teesheet/ for the POS
│   │   │   └── internal/      # Scheduled jobs (Bearer CRON_SECRET), called by apps/cron
│   │   ├── public/_redirects  # SPA fallback: /* → /index.html 200
│   │   ├── scripts/dev-pages.mjs  # `npm run dev:pages` (wrangler + vite together)
│   │   ├── src/
│   │   │   ├── assets/        # tokens.css (MD3 tokens), main.css, icons/ (custom SVG icons)
│   │   │   ├── components/
│   │   │   │   ├── admin/products/  # Product form, category manager, stock dialog
│   │   │   │   ├── booking/   # BookingWizard + 4 step components
│   │   │   │   ├── layout/    # AppNav, AppFooter, PageHero
│   │   │   │   ├── membership/# MembershipInquiryForm, MembershipTierCard
│   │   │   │   ├── oncourse/  # RoundSetupFields (carts, start hole, 9/18) + roundSetup.js helpers
│   │   │   │   ├── pos/       # Register modals, receipts/slips (incl. ZReportSlip), SalesReport
│   │   │   │   ├── schedule/  # ScheduleGrid, ScheduleMonth, schedule/time off display helpers
│   │   │   │   ├── scorecard/ # CourseStatBar, ScorecardTable, TeeSetSelector
│   │   │   │   ├── tournament/# EventCard, EventFilterBar
│   │   │   │   └── ui/        # MD3 component set (see Design System) + SectionLabel, ResponsivePicture
│   │   │   ├── composables/   # usePendingTimeOff (admin sidebar badge), useConfirm, useSnackbar
│   │   │   ├── data/          # Static JS data (holes, rates, membershipTiers, teeSets, employeePositions)
│   │   │   ├── lib/           # supabase.js, api.js, and shared logic (see "Shared libraries")
│   │   │   ├── router/        # Vue Router (index.js)
│   │   │   ├── stores/        # Pinia stores (auth.js, booking.js)
│   │   │   ├── views/         # One per route; admin/ and staff/ hold the two portals
│   │   │   ├── App.vue        # Root component — calls auth.init() on mount
│   │   │   └── main.js        # App entry point
│   │   ├── index.html, vite.config.js, wrangler.toml, tailwind.config.js, postcss.config.js
│   │   ├── .eslintrc.cjs
│   │   └── .env.example       # Both VITE_* (build-time) and server-side vars
│   ├── cron/                  # Cloudflare Worker with a cron trigger: calls /api/internal/* daily (wrangler.toml)
│   └── api/                   # DB management only — no running server
│       ├── prisma/
│       │   ├── schema.prisma  # DB schema (source of truth for the data model)
│       │   ├── seed.js        # Prisma seed: course settings, tee time slots, events
│       │   ├── seed.sql       # Same base seed as SQL, for the Supabase SQL Editor
│       │   ├── seed-pos.sql   # POS seed: categories, "Pro Shop" register, products
│       │   ├── migrations/    # Gitignored — kept locally (see "Database migrations")
│       │   └── sql/           # Committed SQL for the Supabase SQL Editor (6_… and later)
│       ├── package.json       # Prisma devDep only
│       └── .env.example       # DATABASE_URL only
├── docs/register-setup.md     # How to set up a POS register PC (printer, kiosk Chrome, scanner, reader)
├── docs/ui-ux-review.md       # UI/UX review + redesign brief (MD3, icons, logo); phases in TODO.md → Feature 4
├── TODO.md                    # Roadmap: employee time management + POS
└── package.json               # Workspace root (npm workspaces)
```

---

## Tech Stack

| Layer      | Technology                                                |
|------------|-----------------------------------------------------------|
| Frontend   | Vue 3, Vite 5, Pinia 2, Vue Router 4, Tailwind CSS 3      |
| API        | Cloudflare Pages Functions (edge, ES modules)             |
| Database   | Supabase (PostgreSQL) — accessed via `@supabase/supabase-js` |
| Auth       | Supabase Auth (JWT via `supabase.auth.getUser(token)`)    |
| Payments   | Stripe v14 (API version 2023-10-16): PaymentIntents + Payment Element online; Stripe Terminal (server-driven, smart readers) at the register |
| Email      | Resend v3                                                 |
| DB Mgmt    | Prisma 5 (migrations + seed only, not used at runtime)    |
| Dev tools  | Wrangler 3, ESLint (vue3-recommended)                     |
| Deploy     | Cloudflare Pages (static + Functions, single deployment)  |

---

## Development Setup

### Prerequisites
- Node.js (LTS)
- Supabase project (provides PostgreSQL + Auth)
- Stripe account
- Resend account
- Cloudflare account + `wrangler login` (for local Pages dev and deployment)

### First-time setup
```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure environment variables
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
# Fill in values — see Environment Variables section

# 3. Run database migrations and seed
npm run db:migrate
npm run db:seed
```

### Running the dev servers

```bash
# Frontend only (Vite on :5173). API calls fail with a proxy error without wrangler.
npm run dev

# Full local dev: Vite + Cloudflare Pages Functions via wrangler — open http://localhost:5173
npm run dev:pages
# ↳ Runs apps/web/scripts/dev-pages.mjs: `wrangler pages dev --port 8788` (Functions) and `vite` (:5173)
# ↳ Vite proxies /api/* to wrangler on :8788 (server.proxy in vite.config.js)
# ↳ Not `wrangler pages dev --proxy 5173 -- vite`: with pages_build_output_dir in wrangler.toml,
#   Wrangler 4 refuses a proxy command ("Specify either a directory OR a proxy command, not both")
# ↳ Server-side secrets are read from apps/web/.dev.vars, or apps/web/.env if there's no .dev.vars
```

### `.dev.vars` for local Functions
Create `apps/web/.dev.vars` (gitignored, same format as `.env`) with the server-side secrets:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
CONTACT_EMAIL_TO=proshop@deerrun.golf
```

### Other scripts
```bash
npm run build               # Vite production build → apps/web/dist/
npm run deploy              # Build + wrangler pages deploy
npm run lint                # ESLint all workspaces (report only; 0 errors expected, many formatting warnings)
npm run lint:fix --workspace=apps/web   # ESLint with --fix (rewrites files)
npm run db:migrate          # Prisma migrate dev (schema changes)
npm run db:migrate:deploy   # Prisma migrate deploy (CI/CD)
npm run db:seed             # Seed the database
npm run db:studio           # Open Prisma Studio GUI
```

---

## Environment Variables

### `apps/web/.env` — client-side (Vite build-time)

Prefixed with `VITE_`, inlined at build time, bundled into the JS. Set in the Cloudflare Pages
dashboard under **Settings → Environment Variables → Build** tab. Never use for secrets.

| Variable                  | Description                          |
|---------------------------|--------------------------------------|
| `VITE_SUPABASE_URL`       | Supabase project URL                 |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon/public key             |
| `VITE_GOOGLE_MAPS_API_KEY`| Google Maps embed key                |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_...`) for the Payment Element |

### `apps/web/.dev.vars` / Cloudflare dashboard — server-side (Functions runtime)

**Never** bundled into the frontend. Set via `wrangler secret put <NAME>` or in the
Cloudflare Pages dashboard under **Settings → Environment Variables → Production** tab.
Accessed in Functions via `context.env.<NAME>`.

| Variable                  | Description                                       |
|---------------------------|---------------------------------------------------|
| `SUPABASE_URL`            | Supabase project URL (same value as VITE_ one)    |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — bypasses RLS        |
| `STRIPE_SECRET_KEY`       | Stripe secret key (`sk_test_...` or `sk_live_...`)|
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook signing secret (`whsec_...`)       |
| `RESEND_API_KEY`          | Resend API key                                    |
| `CONTACT_EMAIL_TO`        | Recipient for inquiry notification emails         |
| `CRON_SECRET`             | Shared secret for `/api/internal/*`; the `apps/cron` Worker has the same value |

Emails (inquiries, booking confirmations, receipts, time off decisions) are skipped silently when
`RESEND_API_KEY` isn't set, so local dev works without it.

### `apps/api/.env` — DB management only

| Variable       | Description                                          |
|----------------|------------------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string for Prisma CLI commands |

---

## API — Cloudflare Pages Functions

Functions live in `apps/web/functions/` and are co-deployed with the static site.
Each file path maps to a URL under `/api/`. The `_redirects` SPA fallback does **not**
intercept `/api/*` — Functions always take priority over redirect rules.

### Function anatomy
```javascript
// Export named HTTP method handlers:
export async function onRequestGet({ request, env }) { ... }
export async function onRequestPost({ request, env }) { ... }
// Or handle all methods:
export async function onRequest({ request, env }) { ... }

// context properties:
// request — standard Web API Request object
// env     — Cloudflare bindings (secrets, vars set in dashboard)
// params  — URL path params for [slug] routes
```

### Endpoints

Each handler file starts with a comment giving its exact request/response shape; read it before changing a call.
Files starting with `_` (e.g. `_auth.js`, `_validate.js`, `_csv.js`) are shared modules, not routes. Static files win over
`[id].js` in the same folder (e.g. `shifts/copy.js`, `time-off/count.js`).

**Public site**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/me` | Required | Upsert + return DB user, linked `employee`, `canUseRegister`, `isRegisterManager` |
| GET | `/api/teetimes?date=YYYY-MM-DD` | Optional | Available slots (member-only slots hidden from guests) |
| GET | `/api/teetimes?from=&to=` | Optional | Per-day availability `[{ date, open, spots }]` (≤ 31 days; booking calendar hints) |
| GET | `/api/rates` | Public | `{ rates: { WEEKDAY_9, WEEKDAY_18, WEEKEND_9, WEEKEND_18, CART }, holidayDates }` (cents, from the rate products) |
| POST | `/api/bookings` | Optional | `{ teeTimeSlotId, players, roundHoles?, cart?, guestName?, guestEmail? }`: priced from the rates; create PENDING booking + Stripe PaymentIntent → `{ bookingId, clientSecret }` |
| GET/DELETE | `/api/bookings/:id` | Public / owner | Booking details (confirmation page) / cancel |
| GET | `/api/bookings/my` | Required | Signed-in user's bookings |
| GET | `/api/bookings/by-session/:sessionId` | Public | Legacy lookup by `stripeSessionId` (Checkout era) |
| GET | `/api/events[?past=true\|false]` | Public | Tournament events list |
| GET | `/api/events/:id` | Public | One event (404 if missing) |
| POST | `/api/inquiries/membership`, `/api/inquiries/contact` | Public | Save inquiry/message + email `CONTACT_EMAIL_TO` |
| POST | `/api/webhooks/stripe` | Stripe signature | `payment_intent.succeeded` → booking CONFIRMED + confirmation email (`metadata.bookingId`), saves a register card sale (`metadata.cardCheckoutId`), or records a house account payment (`metadata.houseAccountId`); `payment_intent.payment_failed` → autopay failed |

**Admin panel** (all `requireAdmin`, i.e. `User.role = ADMIN`)

| Path | Methods | Description |
|------|---------|-------------|
| `/api/admin/dashboard` | GET | Dashboard stats (course-local today, same day last week, 7-day `series`) |
| `/api/admin/teetimes[/:id]` | GET, POST / PUT, DELETE | Tee time slots; POST `{ action: 'generate' \| 'close' \| 'members', from, to, … , dryRun? }` for bulk generate / delete open slots / members-only (returns counts) |
| `/api/admin/bookings[/:id]` | GET / PUT | Bookings list (`from`, `to`, `search`, `status` comma list, paged), status changes |
| `/api/admin/events[/:id]` | GET, POST / PUT, DELETE | Tournaments |
| `/api/admin/users[/:id]` | GET / PUT | Users, role changes |
| `/api/admin/settings` | GET, PUT | `CourseSettings` (booking, payroll, POS, tipping, late fee) + `rates` (saved onto the rate products) and `holidayDates`; PUT returns `warning` if the tip percentages didn't reach Stripe |
| `/api/admin/employees[/:id]` | GET, POST / PUT, DELETE | Employees (`resetManagerPin`; delete refused with clock history) |
| `/api/admin/timeclock` | GET | Who's on the clock / on break / forgot to clock out |
| `/api/admin/timesheets?date=` | GET | All employees' hours for a pay period |
| `/api/admin/time-entries[/:id]` | POST / PUT, DELETE | Manager corrections to punches |
| `/api/admin/shifts?view=week\|biweek\|month&date=` (or `?from=&to=`) | GET, POST | Schedule: shifts, employees, time off |
| `/api/admin/shifts/:id` | PUT, DELETE | Edit / delete a shift |
| `/api/admin/shifts/copy` | POST | Copy the previous 7/14 days of shifts forward (skips duplicates, inactive) |
| `/api/admin/shifts/email` | POST | `{ from, to }`: email each active employee their own shifts for the period (sent/skipped/failed; 503 `EMAIL_NOT_CONFIGURED`) |
| `/api/admin/time-off?status=&from=&to=` | GET | Time off requests + shifts scheduled during each |
| `/api/admin/time-off/:id` | PUT | `{ action: approve\|deny, note }` (pending only) or `revoke` (approved, not yet ended; note required → DENIED "Approval revoked: …") + email the employee |
| `/api/admin/time-off/count` | GET | `{ pending }` for the sidebar badge |
| `/api/admin/product-categories[/:id]` | GET, POST / PUT, DELETE | POS categories (`taxExempt`) |
| `/api/admin/products[/:id]` | GET, POST / PUT, DELETE | Products with nested variants |
| `/api/admin/inventory/:variantId` | GET, POST | Stock history / adjust (`adjust_inventory()`) |
| `/api/admin/registers[/:id]` | GET, POST / PUT, DELETE | Registers (Stripe reader ID) |
| `/api/admin/registers/readers` | GET, POST | Stripe Terminal readers + online status; pair a reader `{ registrationCode, label, registerId }` |
| `/api/admin/sales?from=&to=&registerId=&status=&number=&page=` | GET | Sales list (paged); `&format=csv&detail=sales\|items` exports the range |
| `/api/admin/sales/:id` | GET, POST | Sale detail; `{ action: 'email', email }` |
| `/api/admin/sales/report?date=` (or `?from=&to=`, `&registerId=`) | GET | Sales / end-of-day (Z) report (`_report.js` → `buildReport`), incl. drawer sessions |
| `/api/admin/drawer-sessions?from=&to=&registerId=` | GET | Cash drawer sessions in a range (open ones with running totals) |
| `/api/admin/drawer-sessions/:id` | POST | `{ action: 'close', countedCents, note }` — close a stuck drawer |
| `/api/admin/users/:id` | PUT | `{ role?, memberUntil?, membershipTier? }` |
| `/api/admin/pace` | POST | Recalculate the learned per-hole times now (`_pace.js` → `recalculateHoleTimes`) |
| `/api/admin/house-accounts` | GET, POST | Accounts with balances; open one `{ userId, creditLimitCents }` |
| `/api/admin/house-accounts/:id[?from=&to=]` | GET, PUT, POST | Account, entries, statements (+ on-demand statement); PUT `{ status, creditLimitCents, resetPin }`; POST `adjust` / `email_statement` |

**Staff portal** (`requireStaff`: an active `Employee` linked to the login; register endpoints use `requireRegister`)

| Path | Methods | Description |
|------|---------|-------------|
| `/api/staff/clock` | GET, POST | Clock state / `clock_in\|clock_out\|break_start\|break_end` (server time) |
| `/api/staff/timesheet?date=` | GET | Own timesheet for a pay period |
| `/api/staff/schedule?view=&date=[&team=1]` | GET | Own shifts (or the whole team, read-only) + approved time off |
| `/api/staff/time-off[/:id]` | GET, POST / PUT | Own requests; create; `{ action: 'cancel' }` while pending |
| `/api/staff/pin` | GET, PUT | Register manager's own PIN |
| `/api/staff/approvals` | POST | Manager approval for discounts, No Sale, voids, refunds, register switch, paid-ins/outs, safe drops |
| `/api/staff/register/catalog`, `/customers?search=`, `/managers` | GET | Register screen data |
| `/api/staff/register/report?registerId=&date=` | GET | Z report for one register and day (register managers only) |
| `/api/staff/register/drawer?registerId=` | GET, POST | Drawer session + its paid-ins/outs (expected only for managers); `open` with a float / `close` with a count / `movement` (`PAID_IN\|PAID_OUT\|SAFE_DROP`, manager approval) |
| `/api/staff/teesheet?date=` | GET | Tee sheet: slots, bookings, check-in, receipts |
| `/api/staff/teesheet/:bookingId` | POST | `{ action: 'check_in' \| 'undo_check_in' \| 'cancel' \| 'move', teeTimeSlotId? }` (check-in: paid only, also takes `cartNumbers`, `ownCart`, `startHole`, `roundHoles`; cancel/move: not checked in; no money moves) |
| `/api/staff/oncourse` | GET | Today's tee sheet (same shape) for the On Course page (`requireCourse`) |
| `/api/staff/oncourse/:bookingId` | POST | `{ action: 'setup' \| 'tee_off' \| 'undo_tee_off' \| 'position' \| 'finish' \| 'undo_finish', hole?, stage? }` for a checked-in group (`requireCourse`); `position` also adds a `PositionReport` |
| `/api/staff/sales` | GET, POST | Today's/searched sales; create a sale (`create_sale()`). With a `CARD_TERMINAL` payment it charges the card first → 202 `{ cardCheckout }`. Items can be products, custom amounts, a checked-in `booking` ($0) or a `newBooking` (walk-in/phone, created with the sale). Cash needs an open drawer (409 `DRAWER_CLOSED`); membership products need a customer |
| `/api/staff/sales/:id` | GET, POST | Sale detail; `email`, `void`, `refund` actions (`refund_sale()`; `method` CARD_TERMINAL refunds through Stripe, CASH needs an open drawer) |
| `/api/staff/account-payments` | POST | A member pays toward their house account: CASH (drawer) → 201, CARD → 202 `{ cardCheckout }` |
| `/api/staff/card-checkouts/:id` | GET, POST | Poll a card payment (saves the sale once Stripe confirms); `retry` / `cancel` / `simulate` (test mode) / `complete` |

**Internal** (`Authorization: Bearer <CRON_SECRET>`)

| Path | Methods | Description |
|------|---------|-------------|
| `/api/internal/memberships` | POST | Daily: renewal reminders (30/7 days, ended) + lapsed members → GUEST |
| `/api/internal/statements` | POST | Daily: last month's house account statements (only creates missing ones) + autopay + emails with PDF, then overdue statements: one reminder + optional late fee each |
| `/api/internal/bookings` | POST | Daily: release unpaid online bookings past their 30-minute hold (cancel PaymentIntent → CANCELLED) |
| `/api/internal/pace` | POST | Daily: learn per-hole times from the last 60 days of position reports → `CourseSettings.holeSeconds` |

**Member** (`authenticate`: any signed-in user, their own data only)

| Path | Methods | Description |
|------|---------|-------------|
| `/api/account/house-account` | GET, POST | Own account, activity, statements; `set_pin`, `pay` / `confirm_payment`, `autopay_setup` / `autopay_confirm` / `autopay_disable` |
| `/api/account/statements/:id[?format=pdf]` | GET | One own statement with its entries (printable); `format=pdf` downloads the PDF |

### Auth helpers in Functions
`functions/api/admin/_auth.js` and `functions/api/staff/_auth.js` hold the helpers. Each returns either a
`Response` (401/403 — return it as-is) or the context object:
```javascript
import { requireAdmin, json } from '../_auth.js'

export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)   // or authenticate / requireStaff / requireRegister
  if (result instanceof Response) return result
  const { supabase, dbUser } = result               // requireStaff adds `employee`; requireRegister adds access flags
  ...
}
```
- `authenticate` — any signed-in user → `{ supabase, dbUser }`
- `requireAdmin` — `dbUser.role === 'ADMIN'`
- `requireStaff` — active `Employee` linked to the user → adds `employee` (admins need one too)
- `requireRegister` — `requireStaff` + position in `CourseSettings.registerPositions` (managers and admins always allowed)
- `requireCourse` — `requireStaff` + register access or a position in `CourseSettings.coursePositions` (On Course page)

Public endpoints with optional auth use a local `getOptionalUser(request, supabase)` that returns the DB user or null.

### Supabase client in Functions
Always use the **service role key** (bypasses RLS, full admin access). Create a fresh client
per request — Functions are stateless:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },  // required in edge environments
})
```

### ID generation in Functions
The Prisma schema uses `@id @default(cuid())` — a Prisma-level default, **not** a PostgreSQL
default. When inserting records via the Supabase JS client, always provide an `id` explicitly:
```javascript
// crypto.randomUUID() is available natively in all Cloudflare Workers
await supabase.from('User').insert({ id: crypto.randomUUID(), ... })
```

---

## Database Schema (Prisma)

Schema in `apps/api/prisma/schema.prisma`. The running application uses the Supabase JS client to access
the same PostgreSQL database — **Prisma is not used at runtime**.

### Models

| Area | Model | Key fields |
|------|-------|------------|
| Site | `User` | `id`, `email`, `name`, `role` (GUEST/MEMBER/ADMIN), `supabaseId`, `memberUntil?` (last day; null = no expiry), `membershipTier?`, `renewalReminderKey?` |
| | `TeeTimeSlot` | `date` (Date), `startTime` ("HH:MM"), `maxPlayers`, `memberOnly` |
| | `Booking` | `teeTimeSlotId`, `userId?`, `players`, `totalCents`, `status`, `source` (ONLINE/POS/PHONE), `checkedInAt?`, `stripePaymentId?` (PaymentIntent id), `stripeSessionId?` (legacy), `roundHoles`, `cartIncluded` (online booking paid the cart fee); on-course: `cartNumbers`, `ownCart`, `startHole`, `roundHoles`, `teedOffAt?`, `positionHole?`/`positionStage?` (`HoleStage`)/`positionAt?` (latest report), `finishedAt?` |
| | `PositionReport` | Every on-course report: `bookingId`, `hole`, `stage`, `reportedAt`, `employeeId?` (history the hole times are learned from) |
| | `CourseSettings` | Singleton (`id = "singleton"`): booking window, `holidayDates` (weekend rates), tee time range (`pricePerPlayerCents` is unused since migration 11), pay period (`payPeriodDays`, `payPeriodAnchor`), POS (`salesTaxBps`, `registerPositions`, `managerPositions`, `tippingEnabled`/`tipPercentages`/`tipPreTax`), house accounts (`lateFeeCents`, 0 = off), on-course (`roundMinutes`, `coursePositions`, learned `holeSeconds`/`holeTimesUpdatedAt`/`holeTimesRounds`) |
| | `TournamentEvent`, `Inquiry`, `ContactMessage` | Events and form submissions |
| Staff | `Employee` | `userId?` (linked by email), names, `email`, `position` (`EmployeePosition`), `hourlyRateCents`, `active`, manager PIN hash/lockout |
| | `TimeEntry` / `TimeBreak` | Clock punches (UTC); `editedById`/`editedAt` for manager corrections |
| | `Shift` | `employeeId`, `date`, `startTime`/`endTime` ("HH:MM"; end ≤ start = overnight), `position?` override, `notes?` |
| | `TimeOffRequest` | `startDate`/`endDate` (inclusive), `type`, `reason?`, `status` (PENDING/APPROVED/DENIED/CANCELLED), `reviewedById` (User.id), `reviewedAt`, `reviewNote` |
| POS | `ProductCategory`, `Product`, `ProductVariant` | Catalog; stock, SKU and barcode live on the variant; `Product.rateKey?` marks the greens fee / cart rate products (`src/lib/rates.js`; online booking charges their prices too); `Product.membershipMonths?`/`membershipTier?` mark membership products; `ProductCategory.memberDiscount` gets the member Pro Shop discount |
| | `InventoryAdjustment` | Stock change log (`InventoryReason`) |
| | `Register` | Physical register; `stripeReaderId` |
| | `Sale`, `SaleItem`, `Payment` | Sales with tax/discount snapshots per line; `SaleItem.bookingId?` links tee time lines; `SaleItem.discountCents` = member + manager, `memberDiscountCents` = member part; `Payment.tipCents` (on-reader tip, on top of `amountCents`) |
| | `CashDrawerSession` | Drawer float, count, expected and over/short per register (one open at a time); paid-in/out/safe-drop totals stored at close |
| | `CashDrawerMovement` | Paid in / paid out / safe drop on an open session (type, amount, reason, recipient, employee, approval) |
| | `HouseAccount`, `HouseAccountEntry`, `Statement` | Member charge accounts: ledger (balance = sum, + owed), monthly statements, PIN, autopay card |
| | `CardCheckout` | A sale waiting on a card: PaymentIntent, reader, status (PENDING → COMPLETING → COMPLETED / SUCCEEDED / CANCELED), `payload` (create_sale args) |
| | `ManagerApproval` | Single-use, short-lived manager sign-offs |
| | `SaleRefund`, `SaleRefundItem` | Voids and refunds |

Postgres functions (in the migrations, callable only by the service role): `adjust_inventory()`,
`create_sale()`, `refund_sale()`, `save_time_entry()` (admin time entry corrections, migration 9). The partial unique index `TimeEntry_one_open_per_employee` allows one open
time entry per employee, and `CashDrawerSession_one_open_per_register` one open drawer per register; Prisma can't
model partial indexes, so delete any `DROP INDEX` line for them from generated migrations.

The source of `create_sale()` / `refund_sale()` is in `apps/api/prisma/sql/` (reference copies of 4 and 5; the latest
versions are in `8_pos_house_accounts.sql`). To change one, copy the latest and `CREATE OR REPLACE` it in a new
migration. Follow-up writes after a sale (membership dates, links) run in `saveSale()` (`staff/sales/_save.js`) and
report a warning instead of failing a sale that's already saved.

### Database migrations
`apps/api/prisma/migrations/` is **gitignored** — migration folders are kept locally, and migrations written in
cloud sessions are committed to `apps/api/prisma/sql/` instead (see its README). Generate the SQL with
`npx prisma migrate diff --from-schema-datamodel <old schema> --to-schema-datamodel prisma/schema.prisma --script`.
Each phase that changes the
schema adds a folder (`0_init`, `1_employee_time_management`, `2_timeclock_admin`, `3_pos_catalog`, `4_pos_sales`,
`5_pos_approvals_refunds`, …) whose SQL is written to be pasted into the **Supabase SQL Editor**: wrapped in a
transaction, with RLS enabled on new tables (the Functions use the service role, which bypasses RLS). When a
migration is applied that way, mark it with `npx prisma migrate resolve --applied <name>` from a network that can
reach the database. `TODO.md` → Housekeeping tracks which migrations still need running.

### Seed data
`npm run db:seed` (or `prisma/seed.sql` in the SQL Editor) creates:
- A singleton `CourseSettings` record (7-day public / 14-day member booking window, 07:30–17:00 tee times at 10-min intervals)
- `TeeTimeSlot` records for the next 30 days
- 8 `TournamentEvent` records (6 upcoming, 2 past) — only if none exist yet

`prisma/seed-pos.sql` adds 12 product categories, the "Pro Shop" register and starter products (some placeholder prices).
The greens fee / cart rate products come from `prisma/sql/11_rates.sql` (weekday 9/18 $20/$30, weekend/holiday
$30/$40, cart $12 per rider), priced afterwards in Admin → Settings → Rates.

`prisma/seed-demo.sql` (demo/staging databases only, after the two above) adds a full demo dated relative to the day
it runs: Supabase Auth sign-ins (`gm@`, `pro@`, `shop@`, `crew@`, `member@`, `guest@example.com`, password and PINs in
the file header), 17 employees, schedules, punches, time off, ~75 days of bookings, sales, drawers and refunds, a Grill
register, house accounts with statements, events and inquiries. It skips itself if `gm@example.com` already exists.

---

## Frontend Routes & Views

| Path            | View                  | Guard |
|-----------------|-----------------------|---------------|
| `/`             | `HomeView.vue`        | — |
| `/scorecard`, `/rates`, `/memberships`, `/tournaments`, `/contact`, `/accessibility` | matching `*View.vue` | — |
| `/course/hole/:n` (1–18) | `HoleView.vue` (`/course` → `/scorecard`) | — |
| `/tournaments/:id` | `EventView.vue` (details, registration inquiry, .ics, `Event` JSON-LD) | — |
| `/book`         | `BookView.vue`        | — |
| `/confirmation` | `ConfirmationView.vue` (`?booking_id=`) | — |
| `/login`        | `LoginView.vue`       | — |
| `/account`      | `AccountView.vue` (+ `HouseAccountPanel`) | `requiresAuth` |
| `/account/statements/:id` | `StatementView.vue` (printable) | `requiresAuth` |
| `/admin/*`      | `admin/AdminLayout.vue` + children: Dashboard, `teetimes`, `bookings`, `tournaments`, `settings`, `users`, `employees`, `timesheets`, `schedule`, `time-off`, `products`, `sales`, `house-accounts` (+ `/:id`), `registers` | `requiresAdmin` |
| `/staff`        | `staff/StaffLayout.vue` + `TimeClockView` | `requiresStaff` |
| `/staff/timesheet`, `/staff/schedule`, `/staff/time-off` | `MyTimesheetView`, `MyScheduleView`, `TimeOffView` | `requiresStaff` |
| `/staff/register`, `/staff/teesheet` | `RegisterView.vue`, `TeeSheetView.vue` | `requiresStaff` + `requiresRegister` |
| `/staff/oncourse` | `OnCourseView.vue`  | `requiresStaff` + `requiresCourse` |
| `/staff/pin`    | `ManagerPinView.vue`  | `requiresStaff` + `requiresRegisterManager` |

The router guard awaits `auth.init()` (session + profile) before checking roles, so a page reload doesn't look
signed out. Failing a guard redirects to `/login?redirect=<path>` (not signed in), `/` (wrong role) or `/staff`
(no register access). All routes are lazy-loaded via `() => import('@/views/...')`.

When adding a page to a portal, also add it to the layout's `navItems` and `titles` (`AdminLayout.vue` /
`StaffLayout.vue`), and give the route a `meta.title`.

Every route has `meta.title` (public ones also `meta.description`): `App.vue` sets `<title>` ("<title> · Deer Run
Golf Course"), the description and `robots` with `@unhead/vue` (`meta.noindex` and the portals are noindex). Other
route meta: `breadcrumbs` (admin top bar, `[{ label, to }]`), `registerMode` (`/staff/register`: full-bleed, collapsed
rail), `bare` (no public nav/footer, e.g. `/dev/ui`). Unknown URLs go to `NotFoundView` (catch-all route, last).
`scrollBehavior` restores the saved position on back/forward and scrolls to `#hash` targets.

Shells: the public site has `AppNav` (skip link, full-screen menu drawer on phones, a sticky "Book a tee time" bar
below md that sets `--bottom-bar-height` / `--snackbar-offset`) and `AppFooter`; course facts (address, phone, hours,
map links, social) live in `src/data/site.js`. The admin shell is a top app bar + modal drawer (phones) / rail (md) /
drawer (lg); pages put their primary action in the bar with `<Teleport to="#admin-page-actions" defer>`. The staff
shell is a bottom nav bar by role (phones) / rail (md) / drawer (lg) with a clock-status chip and **Switch cashier**
(signs out to `/login?redirect=<page>`). Both portals have gallery previews at `/dev/ui`.

---

## State Management (Pinia)

### `useAuthStore` (`stores/auth.js`)
- `session` — raw Supabase session object
- `profile` — User record from `GET /api/auth/me`
- `isLoggedIn` — computed boolean
- `isMember` — computed, true if `profile.role === 'MEMBER'`
- `isAdmin` — computed, `profile.role === 'ADMIN'`
- `employee`, `isStaff` — linked employee record (from `/api/auth/me`) and whether it's active
- `canUseRegister`, `isRegisterManager` — POS access flags from `/api/auth/me`
- `canTrackCourse` — On Course page access from `/api/auth/me`
- `maxBookDays` — 14 for members/admins, 7 for public
- `init()` — restores the session and fetches the profile once per page load (memoized; App.vue and the router guard both await it)
- `login(email, password)` — Supabase sign-in + fetches profile from `/api/auth/me`
- `logout()` — Supabase sign-out + clears state
- `getToken()` — returns current `access_token` or null

### `useBookingStore` (`stores/booking.js`)
- `selectedDate`, `selectedSlot`, `players`, `roundHoles` (9/18), `cart` (riding), `guestName`, `guestEmail` — booking state
- `rates`, `holidayDates`, `loadRates()` — from GET `/api/rates` (defaults until loaded)
- `price` / `totalPrice` — computed with `bookingPrice()` (display only; the server prices the booking from the rates)
- `fetchAvailableSlots(date)` — GET `/api/teetimes?date=<date>`
- `createBooking()` — POST `/api/bookings` → returns `{ bookingId, clientSecret }`; reuses the booking already made for
  the same selection (within 25 min), so Back → Payment doesn't place a second hold; throws the API's error message
- `reset()` — clears all booking state

API calls use **relative paths** (`/api/...`) — same origin as the static site on Cloudflare
Pages. No `VITE_API_URL` env var is used. Authenticated calls in new code should use `apiFetch(url, { method, body })`
from `src/lib/api.js`: it adds the bearer token and JSON body, and throws an `Error` carrying the API's `error`
message (plus `status` and optional `code`).

---

## Shared libraries (`src/lib/`)

`timeclock.js`, `schedule.js`, `pricing.js`, `membership.js`, `teesheet.js`, `pace.js` and `rates.js` are imported by **both** the Vue app and the Functions (by relative
path, e.g. `../../../src/lib/timeclock.js`), so they must not use `@/` imports or browser-only APIs.

| File | Contents |
|------|----------|
| `timeclock.js` | `COURSE_TZ` (America/Chicago), course-local date helpers (`localDate`, `addDays`, `localDateTimeToUtc`…), worked/overtime minutes, pay periods, display formatting |
| `schedule.js` | Shift length (overnight wrap), overlaps, `scheduleWarnings()`, week/2-week/month `schedulePeriod()` |
| `membership.js` | `isActiveMember()`, `isLapsedMember()`, `extendMembership()`, `shortenMembership()` (shared: register pricing, tee times, sales, refunds) |
| `teesheet.js` | Tee time labels (`teeTime`, `teeTimeLabel`) used on the tee sheet and on receipt lines, and the unpaid-hold rule (`UNPAID_HOLD_MINUTES`, `isExpiredHold`, `holdsSpot`, `bookedPlayers`, `HOLD_COLUMNS`) used wherever slot capacity is counted |
| `pace.js` | On-course estimates: round plan from the pace profile `{ roundMinutes, holeSeconds }` (learned hole times, else split by par: `paceProfile`, `perHoleMinutes`, `roundPlan`, `holeOrder`, `stagesFor`), `learnHoleSeconds()` (fit from past rounds), `trackGroup()` (where a checked-in group probably is, ahead/behind its tee time), `trackedGroups`, `coursePace`, `openHolesAhead`, `cartsInUse` (imports `../data/holes.js`) |
| `rates.js` | Greens fee / cart rates: `RATE_KEYS`, `DEFAULT_RATES`, `isWeekendRate()` (Sat/Sun or a holiday), `greensRateKey()`, `bookingPrice()` (greens + cart per rider × players). Server side, `functions/api/_rates.js` → `loadRates()` reads the rate products |
| `registerHandoff.js` | Frontend only: passes a tee time from the Tee Sheet page to the register (sessionStorage) |
| `pricing.js` | Register line/tax/total math incl. the member Pro Shop discount (`memberDiscountBps`; imports `../data/membershipTiers.js`), shared so the server recomputes exactly what the register showed |
| `money.js` | Cents ↔ dollars helpers |
| `api.js` | `apiFetch()` (see above), `apiDownload(url, fallbackName)` (authenticated file downloads: CSV, PDF) |
| `printReceipt.js`, `print.js` | `printReceipt()` (80 mm `@page`) and `printLandscape()`; each adds its `@page` rule only while printing |
| `supabase.js` | Anon client singleton (frontend only) |

---

## Booking Flow

4-step wizard in `components/booking/BookingWizard.vue`; the step is in the URL (`/book?step=time|details|payment`, so
browser Back works; a step whose prerequisites are missing falls back to the first missing one). `/book?date=&players=&time=`
(the Home search) prefills and opens on the Time step. Steps, time-of-day groups and editable copy (cancellation line,
arrival tips) are in `components/booking/bookingFlow.js`.

1. **StepDate** — day strip on phones (`DateStrip`), month grid on md+ (`BookingCalendar`), with per-day availability
   from `/api/teetimes?from=&to=`; picking a day continues
2. **StepTime** — players first, then only slots with room (`/api/teetimes?date=...`), grouped Morning / Midday /
   Afternoon, with a sticky summary bar
3. **StepDetails** — 9/18 holes, riding/walking and the price breakdown; guest name/email if not logged in (Sign In
   returns to this step via `/book?resume=details`)
4. **StepPayment** — calls `/api/bookings`, which creates a PENDING booking and a Stripe PaymentIntent
   (`metadata.bookingId`), then mounts the Stripe **Payment Element** with the returned `clientSecret` and
   confirms the payment on the page, returning to `/confirmation?booking_id=…`

Stripe then sends `payment_intent.succeeded` to `/api/webhooks/stripe`, which sets the booking `status` to
`CONFIRMED`, stores the PaymentIntent id in `stripePaymentId`, and emails a confirmation.

An unpaid booking holds its spots for 30 minutes; then it's released (`functions/api/bookings/_holds.js`: PaymentIntent
cancelled, booking CANCELLED). The webhook re-confirms a late payment if there's room, otherwise refunds it.

New accounts are `GUEST` (`/api/auth/me` and the Prisma default); membership comes from a membership sale or Admin → Users.

Steps communicate via `@next` / `@back` events. Animated with `step-fade` CSS transition.

---

## Staff features (overview)

- **Employees ↔ logins** are linked by email (when the employee is saved, and on first sign-in in `/api/auth/me`).
  Staff access comes from an active `Employee` record, not a `Role`; register managers are employees whose
  position is in `CourseSettings.managerPositions`.
- **Time clock**: punches use server time; one open entry per employee; overtime over 40 h per workweek, which starts
  on the pay period anchor's weekday. Everything is displayed in `America/Chicago`.
- **Scheduling**: admins build the schedule on `/admin/schedule`; warnings (overlaps, time off, inactive employees)
  are shown, not enforced. Staff see theirs on `/staff/schedule`. Both print in landscape. **Email schedule** sends
  each employee their shifts for the period shown.
- **Time off**: staff request on `/staff/time-off`; admins approve/deny on `/admin/time-off` (sidebar badge shows
  the pending count) and the employee is emailed. Approved and pending time off shows on the schedule. An approved
  request can be revoked (becomes Denied with the note) until it ends.
- **POS**: see `TODO.md` → Feature 2 for the register, manager approvals, receipts, voids and refunds.
  The **tee sheet** (`/staff/teesheet`) checks paid bookings in (register opens with a $0 prepaid line) and books
  walk-ins/phone bookings that are paid at the register. **Membership products** (`Product.membershipMonths`) need a
  customer and extend `User.memberUntil`. **Cash drawers** must be open (counted float) before cash moves; closing
  records the count and over/short. **Card payments** run through `staff/_cardCheckout.js`: charge on the reader
  first, save the sale on success (register poll or webhook, whichever first). Refunds go back the way they were paid.
  **House accounts**: members charge with their PIN (tender Account); `create_sale()` writes the ledger CHARGE.
  Payments: register **Account payment** (cash/card), My Account (online, autopay). Statements on the 1st via
  `apps/cron` → `/api/internal/statements`, emailed with a PDF (`functions/api/admin/_statementPdf.js`, no dependency);
  an unpaid statement still owing the day after its due date gets one reminder and the optional late fee.
  **Member discounts**: active members get their tier's Pro Shop discount automatically in Member Discount categories
  (not on products with a member price); manager discounts still need approval. **Tips** (setting, off by default) are
  asked for on the reader, stored on the card payment (`Payment.tipCents`) and kept out of sales and tax; POS refunds
  never return them. **Paid-ins, paid-outs and safe drops** need a manager and print a slip.
  **On-course tracking**: check-in records cart numbers, own cart, start hole and 9/18; the starter and marshals record
  tee-offs, positions (hole + tee/fairway/green; every report kept in `PositionReport`) and finishes on `/staff/oncourse`,
  and `src/lib/pace.js` estimates where every group is and whether it's ahead of or behind its tee time, using per-hole
  times learned nightly from the reports. Information only: it never changes booking (see `TODO.md` → Feature 3).
  Reporting lives on `/admin/sales` (sales list, receipts, CSV, end-of-day report, drawers) and the dashboard; managers print
  the end-of-day (Z) slip from the register. Sales count on the day they're rung up and voids/refunds on the day they
  happen. Supabase returns at most 1,000 rows per request, so reports and exports page through with `fetchAll()`.

---

## Design System (Material Design 3 on Tailwind)

The UI/UX overhaul (`docs/ui-ux-review.md`, `TODO.md` → Feature 4) moves every page onto MD3 tokens and the
components in `src/components/ui/`. New code uses them; older pages are migrated phase by phase. See every component
in every state at **`/dev/ui`** (dev server, or a build with `VITE_UI_GALLERY=true`).

### Tokens (`src/assets/tokens.css` → `tailwind.config.js`)
- **Color roles** as RGB-channel CSS variables (`--md-sys-color-*`), so opacity modifiers work (`bg-primary/10`):
  `primary` (pine `#1E3D2F`), `secondary` (lake), `tertiary` (clay), `error`, `success`, `warning`, each with
  `on-*`, `*-container` and `on-*-container`; `surface` + `surface-container-lowest/low/(default)/high/highest`
  (warm parchment), `on-surface`, `on-surface-variant`, `outline`, `outline-variant`, `inverse-*`, `scrim`.
  Text: `text-on-surface` (primary) and `text-on-surface-variant` (secondary) pass AA on every surface; never alpha
  text. Palettes come from `scripts/gen-theme.mjs` (Material color utilities).
- **Gold** (`gold`, `on-gold`, `gold-container`, `gold-text`) is the brand accent: fills and the primary call to
  action. Use `text-gold-text` for gold text on light surfaces; `text-gold` fails AA. (The old `amber` token was
  renamed `gold`.) Legacy brand hexes `pine`, `clay`, `lake`, `bark`, `parch` stay until pages are migrated.
- **Type scale**: `text-display-l/m/s`, `text-headline-l/m/s` (with `font-display`, Playfair Display),
  `text-title-l/m/s`, `text-body-l/m/s`, `text-label-l/m/s` (Lato, the default `font-body`). Fonts are self-hosted
  with `@fontsource` (imported in `main.js`; Playfair 700 and Lato 400 preloaded by a plugin in `vite.config.js`).
- **Shape** `rounded-shape-xs` (4, text fields) / `-sm` (8, chips, menus) / `-md` (12, cards) / `-lg` (16) /
  `-xl` (28, dialogs, sheets) / `rounded-full` (buttons). **Elevation** `shadow-elevation-1…5`. **Motion**
  `ease-emphasized`, `ease-standard` (+ `-decelerate`/`-accelerate`), `duration-short-2/short-4/medium-2/medium-4/long-2`.
  **z-index** `z-app-bar` < `z-drawer` < `z-dialog` < `z-snackbar`.
- **States**: `.state-layer` (hover 8%, focus 10%, pressed 10%, dragged 16%) on interactive elements; `.touch-target`
  gives a smaller control a 48px hit area; one global `:focus-visible` ring (`--focus-ring`, light gold on `.on-dark`,
  `bg-primary`, `bg-pine`, `.hero-bg`); every animation is off under `prefers-reduced-motion`.
- **High contrast**: `data-contrast="high"` on a container darkens text and outlines (On Course, Tee Sheet outdoors).
- Light theme only. Tailwind class names must be literal strings (no `` `text-${x}` ``), or they aren't generated.

### Icons
Material Symbols Rounded via `unplugin-icons` (inline SVG components, tree-shaken, offline):
`import IconGolf from '~icons/material-symbols/golf-course-rounded'`. Custom icons in the same style live in
`src/assets/icons` (`~icons/deer/golf-cart`, `~icons/deer/bunker`). Icons are 1em by default; size with `w-5 h-5`
(20) or `w-6 h-6` (24). Decorative icons get `aria-hidden="true"`; icon-only buttons use `IconButton` (required
`label`). No emoji as icons.

### Logo
`BrandLogo` (`variant="emblem"` full logo, or `"mark"` round stag-and-sun badge; `size` = height in px; `eager` above
the fold). Optimized WebP/PNG files are in `public/images/logo`; masters and the original SVG in `docs/brand`.
Favicons, `apple-touch-icon.png`, `icon-192/512.png` and `site.webmanifest` are in `public/`.

### Photos and SEO
- Course photos: originals in `apps/web/photos-src` (not deployed). `python scripts/gen-photos.py` (from
  `apps/web`, needs Pillow) writes AVIF/WebP/JPEG at 640/1280/1920 to `public/images/photos` and the manifest
  `src/data/photos.js` (size, widths, alt text). Render with `ResponsivePicture` (`name`, `sizes`, `priority` for the
  LCP image); `PageHero` takes `photo="<name>"`. Only course photos; a professional shoot is planned.
- Course facts (address, phone, email, hours by day, map links, social, city page) are in `src/data/site.js`; the
  footer, Contact, Home and JSON-LD all read it.
- Head tags: `src/lib/seo.js` builds title, description, canonical, Open Graph/Twitter (`meta.ogImage` = a photo
  name) and the GolfCourse/LocalBusiness JSON-LD; `App.vue` applies them with `useHead`, and the `deer-run:prerender`
  Vite plugin (`scripts/prerender.mjs`) writes one HTML file per public route (`dist/rates.html`, head only) plus
  `dist/sitemap.xml` at build time. `public/robots.txt`, `public/_headers` (caching, basic security headers).

### Components (`src/components/ui/`, each file starts with a usage comment)
| Area | Components |
|------|------------|
| Actions | `AppButton` (filled / gold / tonal / outlined / text / danger; md 40, lg 48, xl 64; `loading`, `icon`, `to`), `IconButton` (48dp, `label`, standard / filled / tonal / outlined / inherit), `RowActionsMenu` (`more_vert` menu) |
| Dialogs | `AppDialog` (`v-model:open`, `persistent`, `fullscreenOnMobile`), `BottomSheet`, `ResultDialog` (POS results), `ConfirmDialog` + `useConfirm()` (`await confirm({ title, message, destructive })`) |
| Feedback | `AppSnackbar` + `useSnackbar()` (`snackbar.show({ message, actionLabel: 'Undo', onAction })`), `ErrorBanner` (`@retry`), `EmptyState`, `Skeleton`, `ProgressIndicator` |
| Fields | `TextField`, `SelectField`, `TextArea`, `MoneyField` (v-model in cents), `Checkbox`, `Switch`, `RadioGroup`, `SegmentedButton`, `ChipGroup` / `FilterChip`, `NumericKeypad`, `DateStepper`, `DateRangeField`, `CustomerSearch` |
| Data | `Card`, `StatCard`, `StatusChip` + `statusChips.js` (`statusInfo(kind, status)`: the one status → label/tone/icon map), `DataTable` (cards below md, sort, keyboard row click, `actions` slot), `AppPagination`, `AppTabs`, `PageHeader` |
| Navigation | `TopAppBar`, `NavDrawer` (modal / standard / responsive), `NavRail`, `BottomNavBar`, `navItems.js` helpers |

`App.vue` mounts the single `ConfirmDialog` and `AppSnackbar` hosts. Dialogs that hold typed input are `persistent`
(no backdrop close). Use `useConfirm()` instead of `window.confirm()` and the snackbar for save feedback.

Legacy classes in `src/assets/main.css` (`.btn-*`, `.card*`, `.field`, `.price-*`, `.event-*`) are in
`@layer components` so utilities override them; they go away as pages migrate. Receipts, slips, the statement and
the Z report are print documents and keep their own styles.

---

## Static Course Data

Pure JS modules in `apps/web/src/data/` — no API calls needed:

| File                | Contents                                               |
|---------------------|--------------------------------------------------------|
| `holes.js`          | 18 holes: name, par, hdcp, yards by tee, hazard flags  |
| `teeSets.js`        | Tee set definitions (Black/Blue/Red/Gold)              |
| `rates.js`          | Rate cards, additional fees, course policies           |
| `membershipTiers.js`| 3 membership tiers with pricing and benefits           |

---

## Code Conventions

### JavaScript / Vue
- **ES Modules throughout** — both workspaces use `"type": "module"`. No `require()`.
- **Vue 3 Composition API** — all components use `<script setup>`.
- **Pinia stores** — setup function style (not options API style).
- **No TypeScript** — plain JS. Do not add TypeScript without discussion.
- **Path alias** — `@` maps to `apps/web/src/` (Vite alias).
- **ESLint** — `plugin:vue/vue3-recommended`, `vue/multi-word-component-names` disabled.

### Cloudflare Pages Functions
- Each file exports `onRequestGet`, `onRequestPost`, etc. (or `onRequest` for any method).
- All Functions are stateless — create a fresh Supabase client per request.
- Access secrets via `context.env.<VAR>` — never hardcode or import secrets.
- Use `crypto.randomUUID()` for ID generation when inserting records (see ID generation note).
- Prices are stored and processed in **cents** in the database (`totalCents: Int`, e.g., `4500` = $45.00).
- Return responses with `Response.json(data, { status })`.

### Supabase conventions
- Use the **service role key** in Functions (bypasses RLS, full admin access).
- Use the **anon key** only in the frontend client (`apps/web/src/lib/supabase.js`).
- Table names in queries match Prisma model names exactly (PascalCase): `'User'`, `'TeeTimeSlot'`, `'Booking'`, `'CourseSettings'`, `'Employee'`, `'Shift'`, `'TimeOffRequest'`, `'Sale'`, etc.
- `TIMESTAMP(3)` columns come back without a zone; pass them through `toUtcIso()` (`src/lib/timeclock.js`) before parsing.
- `DATE` columns come back as `YYYY-MM-DD` strings; compare them as strings and format with `formatLocalDate()` (no time zone shift).
- Multi-step writes that must be atomic (sales, refunds, stock changes) are Postgres functions called with `supabase.rpc()`.

### Git
- Feature branches follow the pattern `claude/<description>-<id>`.
- Commit messages should be concise and descriptive.

---

## Deployment

### Cloudflare Pages (web + functions)
- **Root directory**: `apps/web`
- **Build command**: `vite build`
- **Output directory**: `dist`
- Functions in `apps/web/functions/` are auto-detected and deployed alongside the static site.
- `apps/web/public/_redirects` handles SPA routing (Vue Router history mode).

**Environment variable setup in Cloudflare dashboard:**
1. Build-time vars (Build tab): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`
2. Runtime secrets (Production tab): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CONTACT_EMAIL_TO`, `CRON_SECRET`

### Scheduled jobs (`apps/cron`)
Pages has no cron triggers, so a separate Worker runs daily (11:15 UTC) and POSTs to each `/api/internal/*` job
with `Authorization: Bearer <CRON_SECRET>`. Today: `/api/internal/memberships` (renewal reminders, lapsed members →
GUEST), `/api/internal/statements` (monthly statements, autopay, overdue reminders and late fees) and
`/api/internal/bookings` (release expired unpaid bookings) and `/api/internal/pace` (learned hole times). Deploy: `cd apps/cron && npx wrangler secret put CRON_SECRET && npm run deploy`. Add new jobs to `JOBS` in
`apps/cron/src/index.js`.

### Stripe Webhook
- Register endpoint: `https://deerrun.golf/api/webhooks/stripe`
- Events to enable: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

### Database Migrations (CI/CD)
Run `npm run db:migrate:deploy` (wraps `prisma migrate deploy`) as part of the release
pipeline whenever `apps/api/prisma/schema.prisma` changes.
