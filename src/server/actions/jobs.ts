'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { jobs } from '@/db/schema'
import { requireRole } from '@/lib/session'
import { canTransition, EDITABLE_STATUSES } from '@/lib/transitions'
import { formError, jobInputSchema, type ActionResult } from '@/lib/validation'

/**
 * Every action here: `requireRole('employer')` → Zod `safeParse` → ownership
 * check inside the write → `revalidatePath()`. The dashboard layout guard is
 * never trusted on its own. SPEC §3.1, §5.
 */

/**
 * FormData is all strings. This shapes it for `jobInputSchema`, which stays the
 * single source of truth for the rules themselves.
 */
function parseJobForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }
  // An empty salary box means "not specified", which is null — not 0, and not
  // NaN, either of which would fail validation for the wrong reason.
  const salary = (key: string) => {
    const raw = text(key).trim().replace(/,/g, '')
    return raw === '' ? null : Number(raw)
  }

  return {
    title: text('title'),
    company: text('company'),
    location: text('location'),
    locationType: text('locationType'),
    roleType: text('roleType'),
    salaryMin: salary('salaryMin'),
    salaryMax: salary('salaryMax'),
    description: text('description'),
    tags: text('tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

export async function createJob(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole('employer')

  const parsed = jobInputSchema.safeParse(parseJobForm(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  const [job] = await db
    .insert(jobs)
    .values({
      ...parsed.data,
      employerId: user.id,
      // Never taken from the payload: a new listing always starts pending and
      // goes through moderation. SPEC §3.2.
      status: 'pending',
    })
    .returning({ id: jobs.id })

  if (!job) return formError('Could not create the listing. Please try again.')

  revalidatePath('/dashboard/employer')

  return { ok: true, data: { id: job.id } }
}

export async function updateJob(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole('employer')

  const parsed = jobInputSchema.safeParse(parseJobForm(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  // Ownership and editability are both predicates in the UPDATE itself, so a
  // listing belonging to someone else, or one that is approved or closed, is
  // never matched — there is no window between checking and writing. SPEC §9.
  const updated = await db
    .update(jobs)
    .set({
      ...parsed.data,
      // Both editable statuses land on `pending`: `rejected` resubmits for
      // review, `pending` stays put. `EDITABLE_STATUSES` is derived from the
      // status machine and `transitions.test.ts` asserts the two agree, so this
      // constant cannot drift from `canTransition`.
      // `rejection_note`, `reviewed_by` and `reviewed_at` are deliberately left
      // in place — the note tells the employer what to fix, and the review
      // fields are the audit trail SPEC §3.5 asks for.
      status: 'pending',
    })
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.employerId, user.id),
        inArray(jobs.status, [...EDITABLE_STATUSES])
      )
    )
    .returning({ id: jobs.id, status: jobs.status })

  if (updated.length === 0) {
    // Deliberately one message for all three causes (not found / not yours /
    // not editable): distinguishing them would confirm the existence of another
    // employer's listing.
    return formError('This listing can no longer be edited.')
  }

  revalidatePath('/dashboard/employer')
  revalidatePath(`/dashboard/employer/${id}/edit`)

  return { ok: true }
}

export async function closeJob(id: string): Promise<ActionResult> {
  const user = await requireRole('employer')

  // Guarded by the same pure function the UI uses to decide whether to offer
  // the button, so the two cannot disagree.
  if (!canTransition('approved', 'closed', 'employer')) {
    return formError('Closing listings is not permitted.')
  }

  const closed = await db
    .update(jobs)
    .set({ status: 'closed' })
    .where(and(eq(jobs.id, id), eq(jobs.employerId, user.id), eq(jobs.status, 'approved')))
    .returning({ id: jobs.id })

  if (closed.length === 0) {
    return formError('This listing could not be closed.')
  }

  // `/jobs/[id]` is SSG with `revalidate = 60` (SPEC §8), so without this the
  // closed listing would stay publicly readable from cache for up to a minute.
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/')
  revalidatePath('/dashboard/employer')

  return { ok: true }
}
