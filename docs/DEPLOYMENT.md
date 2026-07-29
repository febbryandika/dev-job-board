# Deployment — Vercel + Neon

One app, one deploy. Neon hosts Postgres, Vercel builds and serves the Next.js app.

The step that matters is **migrations run before the build, not after**. `next build` calls
`generateStaticParams` for `/jobs/[id]`, which queries the database — so if the schema is not there
yet, the build fails rather than deploying against an empty database.

## 1. Neon

1. Create a project at [neon.tech](https://neon.tech) — pick the region closest to your users.
2. Copy the **pooled** connection string from the dashboard. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

   Use the pooled endpoint (`-pooler`) for the app: serverless functions open many short-lived
   connections and will exhaust a direct endpoint.

Neon's database branching is worth using here: branch `main`, run the migration against the branch,
confirm it applies, then run it against `main`. That is the cheap version of a staging database.

## 2. Resend (optional)

The app runs without it — with `RESEND_API_KEY` unset, emails are logged instead of sent and
nothing else changes. To send for real:

1. Create an API key at [resend.com](https://resend.com) → **API Keys**.
2. Either keep the default `onboarding@resend.dev` sender, which works without verifying anything,
   or verify your own domain under **Domains** and set `EMAIL_FROM` to an address on it.

## 3. Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). Framework preset and build
command are detected; leave them alone.

Set these under **Settings → Environment Variables**, for Production and Preview:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The pooled Neon connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — a **different** value from local |
| `BETTER_AUTH_URL` | Your deployed origin, e.g. `https://dev-job-board.vercel.app` |
| `RESEND_API_KEY` | Resend key, or leave unset to log instead of send |
| `EMAIL_FROM` | e.g. `Dev Job Board <jobs@yourdomain.com>` |

`BETTER_AUTH_URL` is not optional in production. [`src/lib/site.ts`](../src/lib/site.ts) throws
rather than falling back to `localhost`, so a missing value fails the build instead of silently
emailing people links to their own machine.

## 4. Migrate, then deploy

Run the migration from your machine against the production database before the first deploy:

```bash
DATABASE_URL="<neon-connection-string>" pnpm db:migrate
```

Optionally seed the demo data — this is a portfolio deployment, so a live URL with an empty list is
worth avoiding:

```bash
DATABASE_URL="<neon-connection-string>" pnpm db:seed
```

Then deploy. On Vercel that is a push to `main`, or `vercel --prod`.

For every later release that includes a schema change, the order is the same: **`pnpm db:migrate`
against production, then deploy.** Keep migrations additive (add a nullable column, backfill, then
tighten) so the currently-running version keeps working while the new one rolls out.

## 5. Check it

- `/` lists approved jobs, with no login wall.
- `/sitemap.xml` lists the same jobs and nothing pending or closed.
- `/robots.txt` disallows `/dashboard/`.
- Sign in as `admin@demo.dev`, approve a pending listing, and confirm it appears on `/` — that
  exercises the database write, `revalidatePath`, and the email path in one click.
- Vercel's function logs should show `email logged (no RESEND_API_KEY)` or a Resend id, not an
  error.

## Notes

**Seeding production is a choice.** The seed deletes and recreates the three `@demo.dev` users
every run. That is fine for a portfolio deployment with published credentials; it is not something
to point at a database with real users.

**The demo credentials are public by design.** They are in the README so a reviewer can evaluate
the app without signing up. Do not reuse that password anywhere else, and remember that anyone can
sign in as the admin and moderate listings.

**No secrets are needed to run the app locally.** `.env.example` works as-is against the Docker
Postgres, which is why the local setup is three commands.
