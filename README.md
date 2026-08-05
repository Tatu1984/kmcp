# KMCP — Smart Street Parking Management System

Government-approved on-street parking, digitised end to end: live occupancy, enforced tariffs,
digital collection, vendor settlement and a complete audit trail.

One Next.js application serves the **Admin Portal** UI and the REST API that the two React Native
(Expo) mobile apps consume.

- **Phase 1 (this build):** the attendant photographs the number plate and types the registration
  number. The photo is stored as timestamped, geotagged evidence.
- **Phase 2 (deferred):** ANPR/OCR auto-recognition slots in at the capture step without changing
  anything downstream.

---

## Getting started

```bash
cp .env.example .env.local     # fill in the values you have; the UI runs without any of them
npm install
npx prisma generate
npm run dev                    # http://localhost:3000
```

The portal currently runs on a deterministic mock dataset (`src/frontend/lib/mock`), so every screen
is fully interactive before the database is wired up. Sign in with any of the four demo accounts on
the login screen — the password is pre-filled and any six digits pass the 2FA step.

### With a database

```bash
# set DATABASE_URL and DIRECT_URL in .env.local first
npx prisma migrate dev
npm run db:seed
```

Prisma 7 notes: the datasource URL lives in `prisma.config.ts`, **not** in `schema.prisma`, and the
client is constructed with `@prisma/adapter-pg` and no `datasourceUrl` argument.

---

## Deploying to Vercel

Import the repo in Vercel and leave the build settings on their defaults — the `build`
script runs `prisma generate && next build`.

**Migrations are deliberately not part of the build.** Running `prisma migrate deploy`
during a build means it fires on every preview deploy, can race between concurrent
builds, and turns a bad migration into a failed build instead of a failed deploy. Apply
them from your machine (or a release step) against the same database instead:

```bash
# after editing schema.prisma
set -a && . ./.env.local && set +a   # prisma.config.ts disables Prisma's own .env loading
npm run db:migrate                   # creates the migration and applies it locally
git add src/backend/database/prisma/migrations && git commit && git push

# to apply an already-committed migration to another environment
DATABASE_URL="<target>" npm run db:deploy
```

### Environment variables

Paste the contents of `.env.local` into Vercel's *Settings → Environment Variables*
bulk-add, then change two of them:

| Variable | Value on Vercel |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | your Vercel domain |

Every integration key may stay empty. `src/config/env.ts` marks them optional, and the
portal currently renders from the mock dataset, so the deploy succeeds with nothing but
the defaults. Fill them in as each integration is wired.

---

## Documentation

| Document | Path |
|---|---|
| Scope of Work | `docs/sow/KMCP_Scope_of_Work.docx` |
| Developer's Guide (API routes, DB schema, conventions) | `docs/KMCP_Developers_Guide.docx` |
| Software architecture diagram | `docs/diagrams/architecture.jpg` |
| Data flow diagram | `docs/diagrams/dataflow.jpg` |
| Source feature list | `kmcpfl.docx` |

Both `.docx` files are generated from the `.md` sources alongside them. Regenerate with pandoc after
editing the Markdown.

---

## Architecture in one screen

```
src/
├── app/                  Next.js App Router — (auth) and (dashboard) route groups
├── backend/              API logic: api → services → repositories → Prisma
│   ├── database/         Prisma schema, client, seed
│   └── utils/            money, rbac, error handling
├── frontend/             Portal UI: components, hooks, mock data, navigation
│   ├── components/ui/        shadcn/ui primitives
│   ├── components/reactbits/ animation layer (CountUp, Aurora, SpotlightCard…)
│   ├── components/shared/    DataTable, StatCard, RowActions, ConfirmDialog…
│   └── components/features/  one folder per domain
├── shared/               types and constants used by both sides
└── config/               env validation, API and app configuration
```

**Layer rules** — a route handler never touches Prisma, a repository never holds business logic, and
no amount is ever computed anywhere except `tariff.service.ts` / `settlement.service.ts`. Money is
integer paise; times are UTC.

---

## Portal screens

| Group | Screens |
|---|---|
| Overview | Dashboard, Live sessions |
| Kerbside | Zones (+ detail), Slots, Incidents |
| Partners | Vendors (+ detail), Attendants, Shifts |
| Pricing | Tariffs (+ rule builder and quote preview), Passes |
| Money | Payments, Settlements (+ detail), Revenue, Reports |
| Governance | Citizens, Audit trail, Content, Settings |

---

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # typecheck
npx prisma generate  # regenerate the Prisma client
npx prisma migrate dev
```

---

## Stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui (radix) · reactbits-style motion
via framer-motion · TanStack Table & Query · Recharts · Zustand · Zod · Prisma 7 · PostgreSQL (Neon)
· Razorpay + RazorpayX · React Native (Expo) for the two mobile apps.
