import type { JobStatus } from '@/db/schema'
import type { Role } from '@/lib/roles'

/**
 * The whole status machine, as one pure function with no imports that touch the
 * database. Every call site — the employer actions, the admin queue, and the
 * queries — asks this, so the rules cannot drift between them. Add new
 * transitions here first. SPEC §3.2.
 */

type Transition = { from: JobStatus; to: JobStatus; actor: Role }

/**
 * The complete legal set. Anything absent is illegal, including every
 * `closed → *` (terminal) and `approved → approved` (which is what makes an
 * approved listing immutable — close and repost instead).
 */
const ALLOWED: readonly Transition[] = [
  // Editing a listing that is still awaiting review leaves it pending. It is a
  // no-op on the status, but the action routes through here anyway so there is
  // no second place where "may I edit this?" gets decided.
  { from: 'pending', to: 'pending', actor: 'employer' },
  // Editing a rejected listing resubmits it for review.
  { from: 'rejected', to: 'pending', actor: 'employer' },
  // Close and repost — the only way out of `approved`.
  { from: 'approved', to: 'closed', actor: 'employer' },
  // Moderation. Only an admin, and only from pending.
  { from: 'pending', to: 'approved', actor: 'admin' },
  { from: 'pending', to: 'rejected', actor: 'admin' },
]

export function canTransition(from: JobStatus, to: JobStatus, actorRole: Role): boolean {
  return ALLOWED.some((t) => t.from === from && t.to === to && t.actor === actorRole)
}

/** The statuses an employer is allowed to edit. Derived, so it can't disagree. */
export const EDITABLE_STATUSES = ALLOWED.filter(
  (t) => t.actor === 'employer' && t.to === 'pending'
).map((t) => t.from) as readonly JobStatus[]

/**
 * Where an employer's edit leaves the listing: `rejected` resubmits to
 * `pending`, `pending` stays put. Returns undefined when the listing is not
 * editable at all, so the caller has one thing to check.
 */
export function statusAfterEdit(from: JobStatus): JobStatus | undefined {
  return canTransition(from, 'pending', 'employer') ? 'pending' : undefined
}
