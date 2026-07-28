import { count, desc } from 'drizzle-orm'

import { db } from '@/db'
import { jobs } from '@/db/schema'
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
