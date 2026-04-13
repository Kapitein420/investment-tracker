# Investment Tracker

Internal deal pipeline tracking system for commercial real estate / capital markets teams. Replaces Power BI dashboards with a fully editable operational web application.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Prisma** + **PostgreSQL**
- **NextAuth** (Credentials)
- **TanStack Table**
- **React Hook Form** + **Zod**

## Quick Start

### 1. Start the database

```bash
docker-compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

The defaults work with the Docker Compose setup.

### 4. Push schema and seed

```bash
npx prisma db push
npm run db:seed
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Credentials

| Role   | Email               | Password    |
|--------|---------------------|-------------|
| Admin  | admin@example.com   | password123 |
| Editor | editor@example.com  | password123 |
| Viewer | viewer@example.com  | password123 |

## Features

- **Asset management** - Create and manage real estate assets
- **Pipeline tracking** - Track companies through deal stages (Teaser, NDA, IM, Viewing, NBO)
- **Inline editing** - Update stage statuses directly from the table
- **Comments** - Add notes and comments to each tracking row
- **Audit history** - Full change trail for all stage and lifecycle changes
- **Role-based access** - Admin, Editor, Viewer roles with protected routes
- **Filters & search** - Filter by lifecycle, type, stage; search by company name
- **Stage summary** - KPI cards showing pipeline progress at a glance
- **CSV export** - Export filtered table data
- **Admin panel** - Manage users and pipeline stage configuration
- **Stale highlighting** - Visual indicator for rows not updated in 14+ days

## Project Structure

```
src/
  actions/        # Server actions (CRUD, mutations)
  app/            # Next.js App Router pages
    (protected)/  # Authenticated routes
    api/          # API routes (NextAuth)
    login/        # Public login page
  components/     # React components
    admin/        # Admin page components
    asset/        # Asset detail + pipeline table
    dashboard/    # Dashboard/asset list
    ui/           # shadcn/ui primitives
  lib/            # Utilities, auth, db, validators
  types/          # TypeScript type augmentations
prisma/
  schema.prisma   # Database schema
  seed.ts         # Seed script
```
