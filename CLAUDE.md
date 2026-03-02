# CLAUDE.md — Deer Run Golf Course

## Project Overview

Production Vue 3 + Fastify monorepo for [deerrun.golf](https://deerrun.golf) — an 18-hole public/semi-private golf course in Lawrence County, Alabama. The site handles tee time booking, membership inquiries, tournament listings, scorecards, rates, and course contact.

---

## Repository Structure

```
deer-run/
├── apps/
│   ├── web/               # Vue 3 frontend (Vite + Pinia + Tailwind)
│   │   ├── src/
│   │   │   ├── assets/    # Global CSS (main.css)
│   │   │   ├── components/
│   │   │   │   ├── booking/    # BookingWizard + 4 step components
│   │   │   │   ├── layout/     # AppNav, AppFooter, PageHero
│   │   │   │   ├── membership/ # MembershipInquiryForm, MembershipTierCard
│   │   │   │   ├── scorecard/  # CourseStatBar, ScorecardTable, TeeSetSelector
│   │   │   │   ├── tournament/ # EventCard, EventFilterBar
│   │   │   │   └── ui/         # CourseDiagram, DeerLogo, SectionLabel, TreelineDivider
│   │   │   ├── data/      # Static JS data (holes, rates, membershipTiers, teeSets)
│   │   │   ├── lib/       # supabase.js client singleton
│   │   │   ├── router/    # Vue Router (index.js)
│   │   │   ├── stores/    # Pinia stores (auth.js, booking.js)
│   │   │   ├── views/     # Page-level components (one per route)
│   │   │   ├── App.vue    # Root component — calls auth.init() on mount
│   │   │   └── main.js    # App entry point
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── .eslintrc.cjs
│   │   └── .env.example
│   └── api/               # Fastify backend (Node ESM)
│       ├── prisma/
│       │   ├── schema.prisma  # DB schema
│       │   └── seed.js        # Seeds course settings, tee time slots, events
│       ├── src/
│       │   ├── plugins/   # Fastify plugins (prisma, auth, stripe, email)
│       │   ├── routes/    # Route handlers (auth, teetimes, bookings, events, inquiries, webhooks)
│       │   └── server.js  # App entry point
│       ├── package.json
│       └── .env.example
└── package.json           # Workspace root (npm workspaces)
```

---

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | Vue 3, Vite 5, Pinia 2, Vue Router 4, Tailwind CSS 3 |
| Backend    | Fastify 4, Node.js (ESM, `"type": "module"`)        |
| ORM        | Prisma 5 + PostgreSQL                               |
| Auth       | Supabase Auth (JWT via JWKS verification in API)    |
| Payments   | Stripe Checkout (v14, API version 2023-10-16)       |
| Email      | Resend v3                                           |
| Dev tools  | nodemon, concurrently, ESLint (vue3-recommended)    |
| Deploy     | Vercel (web), Railway (api + PostgreSQL)            |

---

## Development Setup

### Prerequisites
- Node.js (LTS)
- PostgreSQL database
- Supabase project
- Stripe account
- Resend account

### First-time setup
```bash
# 1. Install all workspace dependencies from repo root
npm install

# 2. Configure environment variables
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
# Fill in keys (see Environment Variables section below)

# 3. Run database migrations and seed
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

### Running the dev servers
```bash
# From repo root — starts both web (:5173) and api (:3001) concurrently
npm run dev

# Or individually:
npm run dev:web   # Vite dev server on :5173
npm run dev:api   # nodemon on :3001
```

### Other scripts
```bash
npm run build     # Build both apps (web: vite build, api: no-op currently)
npm run lint      # ESLint both apps
```

### Vite dev proxy
The web dev server proxies `/api/*` to `http://localhost:3001`, so frontend code can use relative `/api/...` paths during development or the `VITE_API_URL` env var for explicit calls.

---

## Environment Variables

### `apps/api/.env`
| Variable              | Description                                    |
|-----------------------|------------------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string                   |
| `PORT`                | API server port (default: 3001)                |
| `FRONTEND_URL`        | CORS allowed origin (default: http://localhost:5173) |
| `SUPABASE_URL`        | Supabase project URL                           |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `STRIPE_SECRET_KEY`   | Stripe secret key (sk_test_... or sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret               |
| `RESEND_API_KEY`      | Resend API key                                 |
| `CONTACT_EMAIL_TO`    | Destination for contact form emails            |

### `apps/web/.env`
| Variable                  | Description                          |
|---------------------------|--------------------------------------|
| `VITE_API_URL`            | API base URL (e.g., http://localhost:3001) |
| `VITE_SUPABASE_URL`       | Supabase project URL                 |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon/public key             |
| `VITE_GOOGLE_MAPS_API_KEY`| Google Maps embed key                |

All `VITE_*` variables are bundled into the frontend at build time by Vite.

---

## API Routes

All routes are registered with the `/api` prefix in `apps/api/src/server.js`.

| Prefix              | File                        | Status         |
|---------------------|-----------------------------|----------------|
| `/api/auth`         | `routes/auth.js`            | Implemented    |
| `/api/teetimes`     | `routes/teetimes.js`        | Stub (Phase 4) |
| `/api/bookings`     | `routes/bookings.js`        | Stub (Phase 4) |
| `/api/events`       | `routes/events.js`          | Stub (Phase 4) |
| `/api/inquiries`    | `routes/inquiries.js`       | Stub (Phase 4) |
| `/api/webhooks`     | `routes/webhooks.js`        | Stub (Phase 4) |
| `/health`           | `server.js` inline          | Implemented    |

### Implemented endpoints
- `GET /api/auth/me` — Requires bearer token. Upserts a User record from the Supabase JWT (`sub` claim = `supabaseId`). Returns the user profile.
- `GET /health` — Returns `{ status: 'ok', ts: <ISO timestamp> }`.

### Phase 4 stubs
Routes for `teetimes`, `bookings`, `events`, `inquiries`, and `webhooks` return placeholder messages. These are the next implementation targets.

---

## Fastify Plugins

Plugins are registered on the Fastify instance and decorated as:

| Decorator          | Source               | Usage                                   |
|--------------------|----------------------|-----------------------------------------|
| `fastify.prisma`   | `plugins/prisma.js`  | `fastify.prisma.<model>.<method>()`     |
| `fastify.authenticate` | `plugins/auth.js` | `preHandler: [fastify.authenticate]` — requires valid Supabase JWT |
| `fastify.optionalAuth` | `plugins/auth.js` | Attaches `request.user` if token present, silent if not |
| `fastify.stripe`   | `plugins/stripe.js`  | `fastify.stripe.<method>()`             |
| `fastify.email`    | `plugins/email.js`   | `fastify.email.emails.send(...)` (Resend) |

Auth plugin validates JWTs against Supabase's JWKS endpoint. After verification, `request.user` contains the decoded JWT payload (including `sub` = Supabase user UUID, `email`).

---

## Database Schema (Prisma)

Models in `apps/api/prisma/schema.prisma`:

| Model            | Key fields                                               |
|------------------|----------------------------------------------------------|
| `User`           | `id`, `email`, `name`, `role` (GUEST/MEMBER/ADMIN), `supabaseId` |
| `TeeTimeSlot`    | `id`, `date` (Date), `startTime` (string "HH:MM"), `maxPlayers`, `memberOnly` |
| `Booking`        | `id`, `teeTimeSlotId`, `userId?`, `players`, `totalCents`, `status`, `stripeSessionId?` |
| `CourseSettings` | Singleton (`id = "singleton"`): booking window days, price, tee time range |
| `TournamentEvent`| `id`, `name`, `eventDate`, `format`, `entry`, `spotsTotal`, `memberOnly`, `featured`, `past` |
| `Inquiry`        | Membership inquiry form submissions                      |
| `ContactMessage` | General contact form submissions                         |

### Seed data
`npx prisma db seed` (or `node prisma/seed.js`) creates:
- A singleton `CourseSettings` record (7-day public / 14-day member booking window, $45/player, 07:30–17:00 tee times at 10-min intervals)
- `TeeTimeSlot` records for the next 30 days
- 8 `TournamentEvent` records (6 upcoming, 2 past) — only if no events exist yet

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

---

## State Management (Pinia)

### `useAuthStore` (`stores/auth.js`)
- `session` — raw Supabase session object
- `profile` — User record from `/api/auth/me`
- `isLoggedIn` — computed boolean
- `isMember` — computed, true if `profile.role === 'MEMBER'`
- `maxBookDays` — 14 for members, 7 for public
- `init()` — called on app mount; hydrates session from Supabase
- `login(email, password)` — Supabase sign-in + fetches profile
- `logout()` — Supabase sign-out + clears state
- `getToken()` — returns current `access_token` or null

### `useBookingStore` (`stores/booking.js`)
- `selectedDate`, `selectedSlot`, `players`, `guestName`, `guestEmail` — booking state
- `totalPrice` — computed: `players * 45` (hardcoded $45/player in frontend; authoritative price is `CourseSettings.pricePerPlayerCents` on the API)
- `fetchAvailableSlots(date)` — GET `/api/teetimes?date=<date>`
- `createBooking()` — POST `/api/bookings` → returns `{ bookingId, checkoutUrl }`
- `reset()` — clears all booking state

---

## Booking Flow

The booking UI is a 4-step wizard (`components/booking/BookingWizard.vue`):

1. **StepDate** — calendar date picker
2. **StepTime** — available tee time slots for chosen date
3. **StepDetails** — player count; guest name/email if not logged in
4. **StepPayment** — summary + redirect to Stripe Checkout

Steps communicate with the parent wizard via `@next` / `@back` events. Animated with CSS transitions (`step-fade`).

---

## Design System (Tailwind)

Custom color palette in `tailwind.config.js`:

| Token   | Hex (default) | Usage                          |
|---------|---------------|--------------------------------|
| `pine`  | `#1E3D2F`     | Primary dark green (header, CTAs) |
| `clay`  | `#8C4A2F`     | Accent rust/brown               |
| `lake`  | `#4A6670`     | Secondary blue-grey             |
| `bark`  | `#3D2B1A`     | Dark brown text                 |
| `parch` | `#F2EBD9`     | Warm off-white background       |
| `amber` | `#C4873A`     | Gold accent, active states      |

Custom font families:
- `font-display` → Playfair Display (serif, headings)
- `font-serif` → Libre Baskerville (body serif)
- `font-body` → Lato (sans-serif, UI)

---

## Static Course Data

Static JS modules in `apps/web/src/data/` — no API calls needed:

| File                | Contents                                       |
|---------------------|------------------------------------------------|
| `holes.js`          | 18 holes: name, par, hdcp, yards by tee set, hazard flags |
| `teeSets.js`        | Tee set definitions (Black/Blue/Red/Gold)      |
| `rates.js`          | Rate cards, additional fees, course policies   |
| `membershipTiers.js`| 3 membership tiers with pricing and benefits   |

---

## Code Conventions

### JavaScript / Vue
- **ES Modules throughout** — both apps use `"type": "module"`. No `require()`.
- **Vue 3 Composition API** — all components use `<script setup>` with `defineStore` composition style.
- **Pinia stores** — use the setup function style (not options API style).
- **No TypeScript** — plain JS in both apps. Do not add TypeScript without discussion.
- **Path alias** — `@` maps to `apps/web/src/` (configured in Vite and assumed in ESLint).
- **ESLint** — `plugin:vue/vue3-recommended`, `vue/multi-word-component-names` disabled.

### API / Fastify
- All route files export a default `async function <name>Routes(fastify)`.
- Plugins use `fastify-plugin` (`fp`) to share decorations across the app scope.
- Auth is enforced via `preHandler: [fastify.authenticate]`. For optional auth, use `preHandler: [fastify.optionalAuth]`.
- Prices are stored and processed in **cents** (`Int` in Prisma, e.g., `4500` = $45.00).
- IDs use Prisma's `cuid()` by default.

### Git
- Feature branches follow the pattern `claude/<description>-<id>`.
- Commit messages should be concise and descriptive.

---

## Deployment

### Frontend (Vercel)
- Root: `apps/web`
- Build command: `vite build`
- Output: `dist/`
- Set all `VITE_*` environment variables in the Vercel dashboard.

### API + Database (Railway)
- Root: `apps/api`
- Start command: `node src/server.js`
- Add a PostgreSQL plugin; Railway auto-sets `DATABASE_URL`.
- Set remaining env vars in Railway service settings.

### Stripe Webhook
- Register endpoint: `https://api.yourdomain.com/api/webhooks/stripe`
- Handle in `apps/api/src/routes/webhooks.js` (Phase 4).
- Verify signature using `STRIPE_WEBHOOK_SECRET`.

---

## Known Incomplete Areas (Phase 4)

The following route files are stubs returning placeholder messages:

- `routes/teetimes.js` — list available slots by date, enforce member-only slots
- `routes/bookings.js` — create booking, initiate Stripe Checkout session, handle confirmation
- `routes/events.js` — list tournament events with filtering
- `routes/inquiries.js` — accept and store membership inquiry + send confirmation email
- `routes/webhooks.js` — handle `checkout.session.completed` Stripe event to confirm bookings

The frontend booking store (`createBooking()`, `fetchAvailableSlots()`) is wired and ready; it just needs the API endpoints to go live.

---

## Health Check

```
GET /health
→ { "status": "ok", "ts": "2025-01-01T00:00:00.000Z" }
```

Useful for Railway/Vercel uptime checks and deployment verification.
