# Dev Job Board

A developer job board for the Japanese market: employers post listings, an admin
approves them, candidates apply. Public pages are server-rendered for SEO;
everything else is auth-gated CRUD.

> **Status: Phase 1 — database schema, migrations, and seed data.** The tooling,
> schema, and demo data are in place. Auth pages and every feature surface land
> in later phases; route files are stubs marked with `TODO(phase-N)`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS · shadcn/ui ·
PostgreSQL 16 · Drizzle ORM · Better Auth · Zod · Resend · Vitest · Playwright

## Local setup

```bash
docker compose up -d
```

```bash
cp .env.example .env && pnpm install && pnpm db:migrate && pnpm db:seed
```

```bash
pnpm dev
```

The app runs on <http://localhost:3000>. Postgres is exposed on host port
**5435** to avoid clashing with a local Postgres on the default 5432.

## Demo accounts

Created by `pnpm db:seed`. All three share the same password.

| Email | Role | Password |
| --- | --- | --- |
| `candidate@demo.dev` | candidate | `demo1234` |
| `employer@demo.dev` | employer | `demo1234` |
| `admin@demo.dev` | admin | `demo1234` |

The seed is safe to re-run: it deletes these three users first, and every
seeded listing and application cascades from them, so nothing you created by
hand is touched. It loads 20 listings across all four statuses (12 approved,
4 pending, 2 rejected, 2 closed) so the moderation queue and the
rejected → resubmit path are both non-empty on first load.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint (flat config, Next core-web-vitals + TypeScript) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm db:generate` | Generate SQL migrations into `drizzle/` (commit these) |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed demo data |

Playwright needs its browser once per machine:

```bash
pnpm exec playwright install chromium
```

Migrations are **generated, committed, and applied** — never `drizzle-kit push`.
