'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { db } from '@/db'
import { jobs } from '@/db/schema'
import {
  jobApprovedEmail,
  jobRejectedEmail,
  sendEmail,
  type EmailMessage,
} from '@/lib/email'
import { requireRole } from '@/lib/session'
import { canTransition } from '@/lib/transitions'
import { formError, rejectionSchema, type ActionResult } from '@/lib/validation'
import { getJobNotificationTarget } from '@/server/queries'

/**
 * The approval workflow's two writes. Both: `requireRole('admin')` → Zod →
 * `canTransition` → an UPDATE with the current status as a predicate →
 * `revalidatePath`. SPEC §3.5, §5.
 *
 * The admin can approve or reject and nothing else — there is deliberately no
 * action here that touches listing content.
 */

/**
 * `status = 'pending'` in the WHERE is what makes a second click harmless: it
 * matches zero rows rather than re-stamping a listing that was already decided.
 */
function pendingJob(id: string) {
  return and(eq(jobs.id, id), eq(jobs.status, 'pending'))
}

/**
 * Every decision records who made it and when. These four columns *are* the
 * audit trail — SPEC §3.5 asks for exactly this and no separate log table.
 */
function reviewStamp(adminId: string) {
  return { reviewedBy: adminId, reviewedAt: new Date() }
}

/**
 * A decision has to show up publicly without a redeploy, and Phase 4 made the
 * detail page and the sitemap ISR-cached on a 60s interval. The detail path
 * matters most: if anyone requested this listing while it was pending, its
 * **404 is cached**, and approving without clearing it would leave the job
 * unreachable for up to a minute. SPEC §8.
 */
/**
 * Tells the employer what was decided. Runs via `after`, so it happens once the
 * response is finished: a slow or failing Resend call cannot delay the admin's
 * action, and the decision is already committed regardless. SPEC §3.6.
 */
function notifyEmployer(
  jobId: string,
  build: (target: { jobTitle: string; employerEmail: string }) => EmailMessage
) {
  after(async () => {
    const target = await getJobNotificationTarget(jobId)
    if (!target) return

    await sendEmail(target.employerEmail, build(target))
  })
}

function revalidatePublicSurfaces(id: string) {
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/')
  revalidatePath('/sitemap.xml')
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard/employer')
}

export async function approveJob(id: string): Promise<ActionResult> {
  const admin = await requireRole('admin')

  // Asked rather than assumed: no status is written here without the status
  // machine agreeing, so widening the admin's powers means editing that table.
  if (!canTransition('pending', 'approved', 'admin')) {
    return formError('Approving listings is not permitted.')
  }

  const approved = await db
    .update(jobs)
    .set({ status: 'approved', approvedAt: new Date(), ...reviewStamp(admin.id) })
    .where(pendingJob(id))
    .returning({ id: jobs.id })

  if (approved.length === 0) {
    return formError('This listing is no longer awaiting review.')
  }

  revalidatePublicSurfaces(id)
  notifyEmployer(id, (target) =>
    jobApprovedEmail({ jobTitle: target.jobTitle, jobId: id })
  )

  return { ok: true }
}

export async function rejectJob(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireRole('admin')

  // Validated before anything is written, so a missing or too-short note can
  // never produce a rejected listing with no explanation on it.
  const parsed = rejectionSchema.safeParse({ note: formData.get('note') })
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  if (!canTransition('pending', 'rejected', 'admin')) {
    return formError('Rejecting listings is not permitted.')
  }

  const rejected = await db
    .update(jobs)
    .set({
      status: 'rejected',
      rejectionNote: parsed.data.note,
      // Deliberately no `approvedAt`: a rejected listing was never approved,
      // and stamping it would corrupt the audit trail.
      ...reviewStamp(admin.id),
    })
    .where(pendingJob(id))
    .returning({ id: jobs.id })

  if (rejected.length === 0) {
    return formError('This listing is no longer awaiting review.')
  }

  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard/employer')
  notifyEmployer(id, (target) =>
    jobRejectedEmail({ jobTitle: target.jobTitle, jobId: id, note: parsed.data.note })
  )

  return { ok: true }
}
