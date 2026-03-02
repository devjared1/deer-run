# Deer Run Golf Course

Production Vue 3 + Fastify monorepo for [deerrun.golf](https://deerrun.golf).

## Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS |
| Backend  | Fastify + Prisma + PostgreSQL |
| Auth     | Supabase Auth |
| Payments | Stripe Checkout |
| Email    | Resend |
| Deploy   | Vercel (web) + Railway (api + db) |

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
# Fill in your Supabase, Stripe, and Resend keys
```

### 3. Set up the database
```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Run dev servers
```bash
# From the root — starts both web (5173) and api (3001)
npm run dev
```

## Project Structure

```
deer-run/
├── apps/
│   ├── web/               # Vue 3 frontend
│   │   ├── src/
│   │   │   ├── assets/    # Global CSS
│   │   │   ├── components/# Reusable UI components
│   │   │   ├── data/      # Static course data (holes, rates, etc.)
│   │   │   ├── lib/       # Supabase client
│   │   │   ├── router/    # Vue Router config
│   │   │   ├── stores/    # Pinia stores (auth, booking)
│   │   │   └── views/     # Page-level components
│   │   └── ...
│   └── api/               # Fastify backend
│       ├── prisma/        # Schema + seed
│       └── src/
│           ├── plugins/   # Prisma, Auth, Stripe, Email
│           └── routes/    # API route handlers
└── package.json           # Workspace root
```

## Deployment

- **Frontend**: Connect `apps/web` to Vercel. Set `VITE_*` env vars.
- **API + DB**: Deploy `apps/api` to Railway with a PostgreSQL plugin.
- **Webhooks**: Register `https://api.yourdomain.com/api/webhooks/stripe` in Stripe Dashboard.
