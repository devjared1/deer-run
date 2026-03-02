# CLAUDE.md — Deer Run Golf Course

## Project Overview

Production Vue 3 + Cloudflare Pages monorepo for [deerrun.golf](https://deerrun.golf) — an 18-hole public/semi-private golf course in Lawrence County, Alabama. The site handles tee time booking, membership inquiries, tournament listings, scorecards, rates, and course contact.

---

## Repository Structure

```
deer-run/
├── apps/
│   ├── web/                   # Vue 3 frontend + Cloudflare Pages Functions
│   │   ├── functions/         # Pages Functions — all served under /api/*
│   │   │   └── api/
│   │   │       ├── auth/
│   │   │       │   └── me.js          # GET /api/auth/me
│   │   │       ├── teetimes.js        # GET /api/teetimes?date=YYYY-MM-DD
│   │   │       ├── bookings.js        # POST /api/bookings
│   │   │       ├── events.js          # GET /api/events[?past=true|false]
│   │   │       ├── inquiries.js       # POST /api/inquiries
│   │   │       └── webhooks/
│   │   │           └── stripe.js      # POST /api/webhooks/stripe
│   │   ├── public/
│   │   │   └── _redirects     # SPA fallback: /* → /index.html 200
│   │   ├── src/
│   │   │   ├── assets/        # Global CSS (main.css)
│   │   │   ├── components/
│   │   │   │   ├── booking/   # BookingWizard + 4 step components
│   │   │   │   ├── layout/    # AppNav, AppFooter, PageHero
│   │   │   │   ├── membership/# MembershipInquiryForm, MembershipTierCard
│   │   │   │   ├── scorecard/ # CourseStatBar, ScorecardTable, TeeSetSelector
│   │   │   │   ├── tournament/# EventCard, EventFilterBar
│   │   │   │   └── ui/        # CourseDiagram, DeerLogo, SectionLabel, TreelineDivider
│   │   │   ├── data/          # Static JS data (holes, rates, membershipTiers, teeSets)
│   │   │   ├── lib/           # supabase.js — anon client singleton
│   │   │   ├── router/        # Vue Router (index.js)
│   │   │   ├── stores/        # Pinia stores (auth.js, booking.js)
│   │   │   ├── views/         # Page-level components (one per route)
│   │   │   ├── App.vue        # Root component — calls auth.init() on mount
│   │   │   └── main.js        # App entry point
│   │   ├── index.html
│   │   ├── vite.config.js     # Vite config (no API proxy — wrangler handles it)
│   │   ├── wrangler.toml      # Cloudflare Pages config
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── .eslintrc.cjs
│   │   └── .env.example       # Both VITE_* (build-time) and server-side vars
│   └── api/                   # DB management only — no running server
│       ├── prisma/
│       │   ├── schema.prisma  # DB schema (used for Prisma migrations)
│       │   └── seed.js        # Seeds course settings, tee time slots, events
│       ├── package.json       # Prisma devDep only
│       └── .env.example       # DATABASE_URL only
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
| Payments   | Stripe Checkout v14 (API version 2023-10-16)              |
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
# Frontend only (Vite on :5173). API calls will 404 without wrangler.
npm run dev

# Full local dev: Vite + Cloudflare Pages Functions via wrangler
npm run dev:pages
# ↳ Runs: wrangler pages dev --proxy 5173 -- vite
# ↳ Functions serve /api/* and Vite serves everything else
# ↳ Server-side secrets are read from apps/web/.dev.vars (gitignored)
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
npm run lint                # ESLint all workspaces
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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/me` | Required | Upsert + return DB user from Supabase JWT |
| GET | `/api/teetimes?date=YYYY-MM-DD` | Optional | Available slots for a date (member-only slots hidden from guests) |
| POST | `/api/bookings` | Optional | Create booking + Stripe Checkout session |
| GET | `/api/events[?past=true\|false]` | Public | Tournament events list |
| POST | `/api/inquiries` | Public | Submit membership inquiry + send email |
| POST | `/api/webhooks/stripe` | Stripe signature | Handle `checkout.session.completed` |

### Auth pattern in Functions
```javascript
// Strict auth (rejects unauthenticated requests):
const authHeader = request.headers.get('Authorization')
if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: '...' }, { status: 401 })
const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))

// Optional auth helper (returns null if no/invalid token):
async function getOptionalUser(request, supabase) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !user) return null
  const { data: dbUser } = await supabase.from('User').select('*').eq('supabaseId', user.id).maybeSingle()
  return dbUser
}
```

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

Schema in `apps/api/prisma/schema.prisma`. Managed with the Prisma CLI (`npm run db:migrate`).
The running application uses the Supabase JS client to access the same PostgreSQL database —
**Prisma is not used at runtime**.

### Models

| Model            | Key fields                                                           |
|------------------|----------------------------------------------------------------------|
| `User`           | `id`, `email`, `name`, `role` (GUEST/MEMBER/ADMIN), `supabaseId`    |
| `TeeTimeSlot`    | `id`, `date` (Date), `startTime` ("HH:MM"), `maxPlayers`, `memberOnly` |
| `Booking`        | `id`, `teeTimeSlotId`, `userId?`, `players`, `totalCents`, `status`, `stripeSessionId?`, `stripePaymentId?` |
| `CourseSettings` | Singleton (`id = "singleton"`): booking window, price, tee time range |
| `TournamentEvent`| `id`, `name`, `eventDate`, `format`, `entry`, `spotsTotal`, `memberOnly`, `featured`, `past` |
| `Inquiry`        | Membership inquiry form submissions                                  |
| `ContactMessage` | General contact form submissions                                     |

### Table names in Supabase queries
Prisma creates tables with PascalCase names matching the model (e.g., `"User"`, `"TeeTimeSlot"`,
`"Booking"` — quoted in PostgreSQL to preserve case). Use the same casing in Supabase JS calls:
```javascript
supabase.from('TeeTimeSlot').select(...)
supabase.from('CourseSettings').select(...)
```

### Seed data
`npm run db:seed` creates:
- A singleton `CourseSettings` record (7-day public / 14-day member booking window, $45/player, 07:30–17:00 tee times at 10-min intervals)
- `TeeTimeSlot` records for the next 30 days
- 8 `TournamentEvent` records (6 upcoming, 2 past) — only if none exist yet

---

## Frontend Routes & Views

| Path            | View                  | Auth required |
|-----------------|-----------------------|---------------|
| `/`             | `HomeView.vue`        | No            |
| `/scorecard`    | `ScorecardView.vue`   | No            |
| `/rates`        | `RatesView.vue`       | No            |
| `/memberships`  | `MembershipsView.vue` | No            |
| `/tournaments`  | `TournamentsView.vue` | No            |
| `/contact`      | `ContactView.vue`     | No            |
| `/book`         | `BookView.vue`        | No            |
| `/confirmation` | `ConfirmationView.vue`| No            |
| `/login`        | `LoginView.vue`       | No            |
| `/account`      | `AccountView.vue`     | Yes (`requiresAuth: true`) |

Unauthenticated access to `/account` redirects to `/login?redirect=<path>`.
All routes are lazy-loaded via `() => import('@/views/...')`.

---

## State Management (Pinia)

### `useAuthStore` (`stores/auth.js`)
- `session` — raw Supabase session object
- `profile` — User record from `GET /api/auth/me`
- `isLoggedIn` — computed boolean
- `isMember` — computed, true if `profile.role === 'MEMBER'`
- `maxBookDays` — 14 for members, 7 for public
- `init()` — called on app mount; hydrates session from Supabase
- `login(email, password)` — Supabase sign-in + fetches profile from `/api/auth/me`
- `logout()` — Supabase sign-out + clears state
- `getToken()` — returns current `access_token` or null

### `useBookingStore` (`stores/booking.js`)
- `selectedDate`, `selectedSlot`, `players`, `guestName`, `guestEmail` — booking state
- `totalPrice` — computed: `players * 45` (frontend display only; authoritative price is `CourseSettings.pricePerPlayerCents` on the server)
- `fetchAvailableSlots(date)` — GET `/api/teetimes?date=<date>`
- `createBooking()` — POST `/api/bookings` → returns `{ bookingId, checkoutUrl }`
- `reset()` — clears all booking state

API calls use **relative paths** (`/api/...`) — same origin as the static site on Cloudflare
Pages. No `VITE_API_URL` env var is used.

---

## Booking Flow

4-step wizard in `components/booking/BookingWizard.vue`:

1. **StepDate** — calendar date picker
2. **StepTime** — fetches `/api/teetimes?date=...`, shows available slots with `available` count
3. **StepDetails** — player count; guest name/email if not logged in
4. **StepPayment** — summary + calls `/api/bookings` → redirects to Stripe Checkout

On payment completion, Stripe sends a `checkout.session.completed` event to
`/api/webhooks/stripe`, which updates the booking `status` to `CONFIRMED` and stores
`stripePaymentId`.

Steps communicate via `@next` / `@back` events. Animated with `step-fade` CSS transition.

---

## Design System (Tailwind)

Custom palette in `tailwind.config.js`:

| Token   | Default hex | Usage                              |
|---------|-------------|-------------------------------------|
| `pine`  | `#1E3D2F`   | Primary dark green (header, CTAs)   |
| `clay`  | `#8C4A2F`   | Accent rust/brown                   |
| `lake`  | `#4A6670`   | Secondary blue-grey                 |
| `bark`  | `#3D2B1A`   | Dark brown text                     |
| `parch` | `#F2EBD9`   | Warm off-white background           |
| `amber` | `#C4873A`   | Gold accent, active states          |

Custom font families (Google Fonts):
- `font-display` → Playfair Display (headings)
- `font-serif` → Libre Baskerville (body serif)
- `font-body` → Lato (UI sans-serif)

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
- Table names in queries match Prisma model names exactly (PascalCase): `'User'`, `'TeeTimeSlot'`, `'Booking'`, `'CourseSettings'`, `'TournamentEvent'`, `'Inquiry'`.

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
1. Build-time vars (Build tab): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`
2. Runtime secrets (Production tab): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CONTACT_EMAIL_TO`

### Stripe Webhook
- Register endpoint: `https://deerrun.golf/api/webhooks/stripe`
- Event to enable: `checkout.session.completed`
- Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

### Database Migrations (CI/CD)
Run `npm run db:migrate:deploy` (wraps `prisma migrate deploy`) as part of the release
pipeline whenever `apps/api/prisma/schema.prisma` changes.
