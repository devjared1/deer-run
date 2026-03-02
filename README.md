# Deer Run Golf Course

Production Vue 3 + Cloudflare Pages monorepo for [deerrun.golf](https://deerrun.golf).

## Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS |
| API      | Cloudflare Pages Functions |
| Database | Supabase (PostgreSQL) via Supabase JS client |
| Auth     | Supabase Auth |
| Payments | Stripe Checkout |
| Email    | Resend |
| Deploy   | Cloudflare Pages (web + API functions) |
| DB Mgmt  | Prisma (migrations + seed only, via `apps/api`) |

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp apps/web/.env.example apps/web/.env
# Fill in your Supabase, Stripe, Resend, and Google Maps keys.
# For local Pages dev, copy server-side vars into apps/web/.dev.vars too.

cp apps/api/.env.example apps/api/.env
# Set DATABASE_URL to your Supabase PostgreSQL connection string.
```

### 3. Set up the database
```bash
npm run db:migrate   # runs prisma migrate dev
npm run db:seed      # seeds course settings, tee time slots, and events
```

### 4. Run dev servers

**Frontend only** (Vite, no Functions):
```bash
npm run dev
```

**Full local dev** (Vite + Cloudflare Pages Functions via wrangler):
```bash
npm run dev:pages
```
> Requires `wrangler login`. Put server-side secrets in `apps/web/.dev.vars`
> (same format as `.env`, no `VITE_` prefix needed for runtime vars).

## Project Structure

```
deer-run/
├── apps/
│   ├── web/                   # Vue 3 frontend + Cloudflare Pages Functions
│   │   ├── functions/         # Pages Functions — served as /api/* routes
│   │   │   └── api/
│   │   │       ├── auth/me.js
│   │   │       ├── teetimes.js
│   │   │       ├── bookings.js
│   │   │       ├── events.js
│   │   │       ├── inquiries.js
│   │   │       └── webhooks/stripe.js
│   │   ├── public/
│   │   │   └── _redirects     # SPA fallback for Cloudflare Pages
│   │   ├── src/
│   │   │   ├── assets/        # Global CSS
│   │   │   ├── components/    # Reusable UI components
│   │   │   ├── data/          # Static course data (holes, rates, etc.)
│   │   │   ├── lib/           # Supabase anon client
│   │   │   ├── router/        # Vue Router config
│   │   │   ├── stores/        # Pinia stores (auth, booking)
│   │   │   └── views/         # Page-level components
│   │   └── wrangler.toml      # Cloudflare Pages config
│   └── api/                   # DB management only
│       └── prisma/
│           ├── schema.prisma
│           └── seed.js
└── package.json               # Workspace root
```

## Deployment

### Cloudflare Pages
1. Connect the repo to Cloudflare Pages.
2. **Root directory**: `apps/web` · **Build command**: `vite build` · **Output**: `dist`
3. **Build-time env vars** (Settings → Environment Variables → Build tab):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`
4. **Runtime secrets** (Settings → Environment Variables → Production tab):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CONTACT_EMAIL_TO`

Or deploy from the CLI:
```bash
npm run deploy
```

### Stripe Webhook
- Register endpoint: `https://deerrun.golf/api/webhooks/stripe`
- Events: `checkout.session.completed`
- Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Root Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (frontend only, port 5173) |
| `npm run dev:pages` | Vite + wrangler (full Functions support) |
| `npm run build` | Production build of the frontend |
| `npm run deploy` | Build + deploy to Cloudflare Pages |
| `npm run lint` | ESLint all workspaces |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:migrate:deploy` | Prisma migrate deploy (CI/CD) |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
