import { and, asc, count, desc, eq } from 'drizzle-orm'
import { cache } from 'react'

import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { applications, jobs } from '@/db/schema'
import { PAGE_SIZE, type JobSearchParams } from '@/lib/validation'
import { publicJobsWhere } from '@/server/predicates'

/**
 * The public list. **Exactly two queries** — one page of rows, one total —
 * sharing a single WHERE clause and running concurrently. Never one query per
 * card. SPEC §5.
 */
export async function listPublicJobs(filters: JobSearchParams) {
  const where = publicJobsWhere(filters)
  const offset = (filters.page - 1) * PAGE_SIZE

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(where)
      // Matches idx_jobs_public on (status, approved_at); createdAt breaks ties
      // for rows approved in the same instant, as the seed data does.
      .orderBy(desc(jobs.approvedAt), desc(jobs.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ value: count() }).from(jobs).where(where),
  ])

  return { jobs: rows, total: totals[0]?.value ?? 0 }
}

/**
 * A single public listing. `status = 'approved'` is part of the WHERE clause,
 * not a check the page performs afterwards — a pending or rejected job is
 * simply not fetchable through this function. SPEC §9.
 *
 * Returns `undefined` so the caller can `notFound()`.
 *
 * Wrapped in React's `cache()` because `generateMetadata` and the page body
 * both need the row — without it, one request issued the identical query twice.
 */
export const getPublicJob = cache(async (id: string) => {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.status, 'approved')))
    .limit(1)

  return job
})

/**
 * An employer's own listings **with their application counts in one round
 * trip** — a LEFT JOIN and a GROUP BY, never a count query per row. SPEC §5.
 *
 * The employer id is a predicate here, not a filter applied afterwards.
 */
export async function listMyJobs(employerId: string) {
  return db
    .select({ job: jobs, applicationCount: count(applications.id) })
    .from(jobs)
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .where(eq(jobs.employerId, employerId))
    .groupBy(jobs.id)
    .orderBy(desc(jobs.createdAt))
}

/**
 * One of the employer's own listings, for the edit page. Ownership is in the
 * WHERE clause, so another employer's id simply returns nothing — the caller
 * cannot forget to check. SPEC §9.
 */
export const getMyJob = cache(async (id: string, employerId: string) => {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.employerId, employerId)))
    .limit(1)

  return job
})

/**
 * The moderation queue: every `pending` listing, **oldest first**, so the queue
 * is a genuine FIFO and nothing starves at the bottom. SPEC §3.5.
 *
 * The employer join is part of the same query — the admin is judging whether a
 * listing is legitimate, and one lookup per row would be the N+1 SPEC §5 warns
 * about.
 */
export async function listPendingJobs() {
  return db
    .select({
      job: jobs,
      employerName: user.name,
      employerEmail: user.email,
    })
    .from(jobs)
    .leftJoin(user, eq(user.id, jobs.employerId))
    .where(eq(jobs.status, 'pending'))
    .orderBy(asc(jobs.createdAt))
}

/** Only the two columns the sitemap needs — no `SELECT *` for a URL list. */
export async function listApprovedJobsForSitemap() {
  return db
    .select({ id: jobs.id, approvedAt: jobs.approvedAt })
    .from(jobs)
    .where(eq(jobs.status, 'approved'))
    .orderBy(desc(jobs.approvedAt))
}
