'use server'

import { createId } from '@paralleldrive/cuid2'
import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { applications, jobs } from '@/db/schema'
import { getSessionUser, requireRole } from '@/lib/session'
import { applicationInputSchema, formError, type ActionResult } from '@/lib/validation'

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * Drizzle wraps driver errors, putting the pg error on `cause` — verified
 * against a real violation, which surfaces as
 * `{ cause: { code: '23505', constraint: 'uq_application' } }`. Reading only
 * the top level would silently never match, turning every duplicate into a 500.
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const candidates = [error, (error as { cause?: unknown })?.cause]

  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false

    const { code, constraint: name } = candidate as { code?: unknown; constraint?: unknown }

    return code === UNIQUE_VIOLATION && name === constraint
  })
}

export async function applyToJob(
  jobId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole('candidate')

  const parsed = applicationInputSchema.safeParse({
    resumeUrl: formData.get('resumeUrl'),
    coverLetter: formData.get('coverLetter') || undefined,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  try {
    // INSERT … SELECT, so "the job must be approved" is a predicate inside the
    // write rather than a separate read. A check-then-insert would leave a
    // window where the listing closes between the two statements.
    //
    // Every column is listed, in table order: Drizzle requires the select to
    // match the table definition exactly, and `$defaultFn` does not run for an
    // insert-from-select, so the id and timestamp are supplied here.
    const inserted = await db
      .insert(applications)
      .select(
        db
          .select({
            id: sql<string>`${createId()}`.as('id'),
            jobId: jobs.id,
            applicantId: sql<string>`${user.id}`.as('applicant_id'),
            resumeUrl: sql<string>`${parsed.data.resumeUrl}`.as('resume_url'),
            coverLetter: sql<string | null>`${parsed.data.coverLetter ?? null}`.as('cover_letter'),
            createdAt: sql<Date>`now()`.as('created_at'),
          })
          .from(jobs)
          .where(and(eq(jobs.id, jobId), eq(jobs.status, 'approved')))
      )
      .returning({ id: applications.id })

    if (inserted.length === 0) {
      // Zero rows means the SELECT matched nothing: no such listing, or it is
      // not approved. One message for both — distinguishing them would confirm
      // that a pending listing exists.
      return formError('This listing is no longer accepting applications.')
    }
  } catch (error) {
    // The duplicate is caught from the constraint, never prevented by a prior
    // lookup: `uq_application` is the guarantee, and a lookup would race.
    // SPEC §3.4.
    if (isUniqueViolation(error, 'uq_application')) {
      return formError("You've already applied to this listing.")
    }
    // Any other failure is not an "already applied" — mislabelling it would
    // hide a real bug.
    throw error
  }

  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/employer')

  return { ok: true }
}

/**
 * Read-only, for the apply island on the statically prerendered detail page:
 * "have I applied?" is per-user and cannot be baked into that cached HTML.
 * Returns false for anyone who is not a signed-in candidate.
 */
export async function checkApplied(jobId: string): Promise<boolean> {
  const user = await getSessionUser()

  if (user?.role !== 'candidate') return false

  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.jobId, jobId), eq(applications.applicantId, user.id)))
    .limit(1)

  return row !== undefined
}
