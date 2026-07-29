# Server interface

There is no REST API. **Reads** are plain async functions called directly from Server Components.
**Writes** are Server Actions called from forms. The only Route Handler in the app is Better Auth's
at `/api/auth/[...all]`.

That means there is nothing to authenticate twice, no fetch layer, and no client cache to
invalidate — `revalidatePath()` does that job.

## Reads — [`src/server/queries.ts`](../src/server/queries.ts)

Called from Server Components only. None of these check a session; the *caller* establishes who is
asking and passes the id, and the id is a SQL predicate rather than a filter applied afterwards.

| Function | Called by | Returns | Scoping |
| --- | --- | --- | --- |
| `listPublicJobs(filters)` | `/` | `{ jobs, total }` | `status = 'approved'`, always. Two queries — one page, one count |
| `getPublicJob(id)` | `/jobs/[id]` | `Job \| undefined` | `id AND status = 'approved'`; caller calls `notFound()` |
| `listMyJobs(employerId)` | employer dashboard | `{ job, applicationCount }[]` | `employer_id`; all four statuses |
| `getMyJob(id, employerId)` | employer edit page | `Job \| undefined` | `id AND employer_id` |
| `listPendingJobs()` | admin queue | `{ job, employerName, employerEmail }[]` | `status = 'pending'`, oldest first |
| `listJobApplications(jobId, employerId)` | employer applicant list | `{ application, applicantName, applicantEmail }[]` | `job_id AND jobs.employer_id` |
| `listMyApplications(applicantId)` | candidate dashboard | `{ application, jobId, jobTitle, jobCompany, jobStatus }[]` | `applicant_id` |
| `getJobNotificationTarget(jobId)` | email senders | `{ jobTitle, employerEmail } \| undefined` | none — runs after a committed write |
| `listApprovedJobsForSitemap()` | `sitemap.ts`, `generateStaticParams` | `{ id, approvedAt }[]` | `status = 'approved'` |

`getPublicJob` and `getMyJob` are wrapped in React's `cache()` because `generateMetadata` and the
page body both need the same row — without it each request ran the identical query twice.

### Two rules these queries follow

**Authorization is a predicate, not a condition.** `listJobApplications` is the only query that
returns a third party's contact details, and `employer_id` is in the same `WHERE` clause as
`job_id`. There is no version of it that returns rows unscoped, so no call site can forget the
check. Same reasoning for `getMyJob` and for the unconditional `status = 'approved'` in
[`publicJobsWhere`](../src/server/predicates.ts).

**No N+1.** The employer dashboard shows an applicant count per listing: that is one `LEFT JOIN` +
`GROUP BY`, not a count query per row. The public list is one query for the page plus one for the
total, running concurrently — never one per card.

Filter-to-SQL logic lives in [`src/server/predicates.ts`](../src/server/predicates.ts), separate
from `queries.ts` because that module opens the connection pool. Keeping predicates apart lets the
tests assert on generated SQL without a database.

## Writes — [`src/server/actions/`](../src/server/actions/)

Every action follows the same shape:

```
requireRole(…) → Zod safeParse → scoped write → revalidatePath() → after(): email
```

and returns the same envelope:

```ts
type ActionResult<T> = { ok: true; data?: T } | { ok: false; error: ActionError }
```

`error` is Zod's `flatten()` shape, so a validation failure and a business failure ("this listing
can no longer be edited") arrive in the same format and every form needs exactly one error
renderer. Thrown errors are never control flow.

| Action | Role | Effect | Revalidates | Email |
| --- | --- | --- | --- | --- |
| `createJob` | employer | Insert with `status: 'pending'` — status is hardcoded, never read from the payload | `/dashboard/employer` | — |
| `updateJob(id)` | employer, owner | Update where `id AND employer_id AND status IN (pending, rejected)`; resets status to `pending` | `/dashboard/employer`, the edit page | — |
| `closeJob(id)` | employer, owner | `approved → closed`, where `id AND employer_id AND status = 'approved'` | `/jobs/[id]`, `/`, `/dashboard/employer` | — |
| `applyToJob(jobId)` | candidate | `INSERT … SELECT` guarded on the job being `approved` | `/dashboard/applications`, `/dashboard/employer` | → employer |
| `approveJob(id)` | admin | `→ approved`, stamps `approved_at`, `reviewed_by`, `reviewed_at` | `/jobs/[id]`, `/`, `/sitemap.xml`, `/dashboard/admin`, `/dashboard/employer` | → employer |
| `rejectJob(id)` | admin | `→ rejected` + note, stamps `reviewed_by`, `reviewed_at` | `/dashboard/admin`, `/dashboard/employer` | → employer |
| `registerAction` | public | Better Auth sign-up, then applies the validated role server-side | — | — |
| `loginAction` | public | Better Auth sign-in | — | — |

`checkApplied(jobId)` is a read-only Server Action rather than a query, because `/jobs/[id]` is
prerendered — "have I already applied?" cannot be baked into static HTML, so the dialog asks after
mount. It returns `false` for anyone who is not a signed-in candidate.

### Details worth knowing

**`rejectJob` deliberately revalidates less than `approveJob`.** A rejected listing was never
public, so busting `/`, `/jobs/[id]` and the sitemap would be wasted work. Approving has to bust
all five, including the detail page — that route is ISR with `revalidate = 60`, and a visitor may
already have a cached 404 for it.

**`applyToJob` is one statement, not check-then-insert.** The insert selects from `jobs` with
`status = 'approved'` in the `WHERE`, so a listing closed between page load and submit inserts zero
rows instead of racing. A duplicate trips `uq_application`, which the action catches by SQLSTATE
`23505` and reports as a field error; any other database error is re-thrown rather than swallowed.

**Roles never come from the client.** `role` is `input: false` on the Better Auth user, so a
crafted sign-up payload cannot set it. `registerAction` validates against `['candidate', 'employer']`
and applies the role in a separate server-side update. `admin` is assigned in the database only.

**`requireRole` is not `requireUser`.** No session redirects to `/login`; a session with the wrong
role throws `ForbiddenError`, which the dashboard's `error.tsx` renders as a 403. There is no role
hierarchy — an admin does not satisfy an employer check.

**Emails never block a write.** All three sends run inside `after()`, after the transaction has
committed. `sendEmail` returns `'sent' | 'logged' | 'failed'` and never throws. With no
`RESEND_API_KEY` it logs to the console and returns `'logged'`, which is how a clean clone and CI
exercise all three send paths without an account.

## Validation

One Zod schema per input in [`src/lib/validation.ts`](../src/lib/validation.ts), shared by the
Server Action and the form that feeds it — the messages you see under a field are the same strings
the server validated with.

| Schema | Guards |
| --- | --- |
| `jobInputSchema` | Lengths; `salaryMin <= salaryMax` (error reported on `salaryMax`); max 8 tags of 24 chars |
| `applicationInputSchema` | `resumeUrl` must be `https` with a real domain — `http:`, `javascript:` and `data:` all fail; cover letter max 5000 |
| `rejectionSchema` | Note of at least 10 characters, so "no" cannot be the entire feedback loop |
| `registerSchema` | Role restricted to `candidate \| employer` |
| `jobSearchParamsSchema` | Per-field `.catch()`, so `?q=Go&page=abc` keeps the search and resets only the page |
