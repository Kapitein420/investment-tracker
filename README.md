# Investment Tracker

Internal deal pipeline tracking system for commercial real estate / capital markets teams. Replaces Power BI dashboards with a fully editable operational web application — plus an investor-facing portal for NDA/document e-signing and deal-room access.

## Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Prisma** + **PostgreSQL** (Supabase-hosted)
- **Supabase Storage** — signed URLs for documents, IMs, teasers, rent rolls
- **NextAuth** (Credentials)
- **Mailgun** — investor invites, NDA approvals, password resets
- **TanStack Table**
- **React Hook Form** + **Zod**
- **Vitest** — unit + integration tests

## Quick Start

### 1. Start the database

```bash
docker-compose up -d
```

(Or point `DATABASE_URL` at any local/hosted Postgres — see `.env.example`.)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

`DATABASE_URL`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL` defaults work out of the box for local dev. **Supabase and Mailgun are optional locally** — without them, cover images fall back to icons and no emails are sent, but document upload/download and e-signing (which read/write Supabase Storage) will fail. Fill in `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` to exercise those flows.

### 4. Push schema and seed

```bash
npx prisma db push
npm run db:seed
npm run db:seed-test   # optional: adds a seeded INVESTOR account for portal testing
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test        # run once
npm run test:watch
```

## Demo Credentials

| Role      | Email                       | Password     |
|-----------|------------------------------|--------------|
| Admin     | admin@example.com           | password123  |
| Editor    | editor@example.com          | password123  |
| Viewer    | viewer@example.com          | password123  |
| Investor  | test.investor@example.com   | testtest123 (via `npm run db:seed-test`) |

The login page also has one-click "Quick Login" buttons for each role in dev.

## Features

- **Asset management** — Create and manage real estate assets, content library (teasers, IMs, rent rolls, images)
- **Pipeline tracking** — Track companies through deal stages (Teaser, NDA, Viewing, NBO)
- **Document e-signing** — PDF placeholder/grid signing and HTML-templated NDAs, with placeholder auto-detection and admin field defaults
- **Investor portal** — Authenticated deal-journey view per investor: unlocks content/stages as they progress, download signed documents, request viewings
- **Public signing links** — Tokenized, rate-limited `/sign/[token]` route for unauthenticated signing (NDA/offer letters)
- **Offer (NBO) tracking** — Upload and manage offer PDFs per tracking
- **Inline editing** — Update stage statuses directly from the table
- **Comments** — Add notes and comments to each tracking row
- **Audit history** — Full change trail for all stage and lifecycle changes
- **Role-based access** — Admin, Editor, Viewer, Investor roles with protected routes; per-asset Viewer access grants
- **Filters & search** — Filter by lifecycle, type, stage; search by company name
- **Stage summary** — KPI cards showing pipeline progress at a glance
- **CSV export** — Export filtered table data
- **Admin panel** — Manage users, pipeline stage configuration, investor invites, email log
- **Stale highlighting** — Visual indicator for rows not updated in 14+ days
- **Security hardening** — CSP, rate limiting, HSTS, sanitized HTML rendering (see `docs/bug-tracker.html` for the running log of hardening/incident fixes)

## Project Structure

```
src/
  actions/          # Server actions (CRUD, mutations, signing, invites)
  app/               # Next.js App Router pages
    (protected)/     # Admin/Editor/Viewer authenticated routes
    (investor)/      # Investor portal (deal journey, signed-NDA viewer)
    sign/[token]/    # Public, rate-limited signing route (PDF + HTML NDA)
    api/             # API routes (NextAuth, health)
    login/           # Public login page
    invite/          # Investor invite acceptance
    request-access/  # Access request form
    forgot-password/ # Password reset flow
  components/        # React components
    admin/           # Admin page components
    asset/           # Asset detail + pipeline table + document upload
    investor/        # Portal-facing components (deal journey, signing modal)
    signing/         # Shared PDF/HTML NDA signing UI
    dashboard/       # Dashboard/asset list
    ui/              # shadcn/ui primitives
  lib/               # Utilities: auth, db, permissions, supabase-storage,
                      # pdf-signing, sanitize-html, rate-limit, security
  types/             # TypeScript type augmentations
prisma/
  schema.prisma      # Database schema
  seed.ts            # Seed script
  seed-testing.ts    # Adds a seeded INVESTOR test account
docs/
  bug-tracker.html   # Running log of bugs found + fixes shipped
```
