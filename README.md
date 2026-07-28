# Dev Job Board

A developer job board for the Japanese market: employers post listings, an admin
approves them, candidates apply. Public pages are server-rendered for SEO;
everything else is auth-gated CRUD.

> **Status: Phase 0 — project scaffold.** The tooling, folder structure, and app
> shell are in place. Schema, auth, and every feature surface land in later
> phases; route files are stubs marked with `TODO(phase-N)`.

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
