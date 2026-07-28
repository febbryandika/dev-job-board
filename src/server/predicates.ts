import { and, eq, ilike, or, type SQL } from 'drizzle-orm'

import { jobs } from '@/db/schema'
import type { JobSearchParams } from '@/lib/validation'

/**
 * The SQL predicates that decide what a given caller may see.
 *
 * Separate from `queries.ts` because that module opens the connection pool:
 * keeping the predicates here lets SPEC §10's filter → SQL tests run without a
 * database, the same reasoning that put `hasRole` in `src/lib/roles.ts`.
 */

/**
 * `%` and `_` are wildcards in LIKE. Without escaping them, a candidate typing
 * "100%" would match every listing instead of none.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * `status = 'approved'` is unconditional. Public visibility is a SQL predicate,
 * never a UI condition — SPEC §9. Anything else here only narrows further.
 */
export function publicJobsWhere(filters: Partial<JobSearchParams>): SQL {
  const conditions: SQL[] = [eq(jobs.status, 'approved')]

  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`
    // Search is title + company only. SPEC §3.3.
    const search = or(ilike(jobs.title, pattern), ilike(jobs.company, pattern))
    if (search) conditions.push(search)
  }

  if (filters.locationType) conditions.push(eq(jobs.locationType, filters.locationType))
  if (filters.roleType) conditions.push(eq(jobs.roleType, filters.roleType))

  // `and()` of a non-empty list is always defined; the cast documents that
  // rather than letting an `undefined` WHERE silently expose every row.
  return and(...conditions) as SQL
}
