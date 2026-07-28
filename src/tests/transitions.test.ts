import { describe, expect, it } from 'vitest'

import type { JobStatus } from '@/db/schema'
import { ROLES, type Role } from '@/lib/roles'
import { canTransition, EDITABLE_STATUSES, statusAfterEdit } from '@/lib/transitions'
import { JOB_STATUSES } from '@/lib/validation'

/**
 * The five legal transitions, spelled out here independently of the
 * implementation. If the two ever disagree the matrix below fails.
 */
const LEGAL: ReadonlyArray<[JobStatus, JobStatus, Role]> = [
  ['pending', 'pending', 'employer'],
  ['rejected', 'pending', 'employer'],
  ['approved', 'closed', 'employer'],
  ['pending', 'approved', 'admin'],
  ['pending', 'rejected', 'admin'],
]

function isLegal(from: JobStatus, to: JobStatus, role: Role) {
  return LEGAL.some(([f, t, r]) => f === from && t === to && r === role)
}

// 4 statuses × 4 statuses × 3 roles = 48 cases, generated rather than
// hand-picked so adding a status or a role cannot silently skip a combination.
const MATRIX = JOB_STATUSES.flatMap((from) =>
  JOB_STATUSES.flatMap((to) => ROLES.map((role) => [from, to, role] as const))
)

describe('canTransition — full matrix', () => {
  it('covers every status and role combination', () => {
    expect(MATRIX).toHaveLength(JOB_STATUSES.length * JOB_STATUSES.length * ROLES.length)
  })

  it.each(MATRIX)('%s → %s as %s', (from, to, role) => {
    expect(canTransition(from, to, role)).toBe(isLegal(from, to, role))
  })

  it('allows exactly five transitions in total', () => {
    const allowed = MATRIX.filter(([from, to, role]) => canTransition(from, to, role))

    expect(allowed).toHaveLength(LEGAL.length)
  })
})

// The rules above encode business decisions. These name them, so a future
// change to the table has to consciously delete a stated rule.
describe('canTransition — the rules that carry meaning', () => {
  it('makes an approved listing immutable: close and repost', () => {
    for (const role of ROLES) {
      expect(canTransition('approved', 'approved', role)).toBe(false)
      expect(canTransition('approved', 'pending', role)).toBe(false)
      expect(canTransition('approved', 'rejected', role)).toBe(false)
    }
    // The single way out.
    expect(canTransition('approved', 'closed', 'employer')).toBe(true)
  })

  it('treats closed as terminal', () => {
    for (const to of JOB_STATUSES) {
      for (const role of ROLES) {
        expect(canTransition('closed', to, role)).toBe(false)
      }
    }
  })

  it('lets an employer resubmit a rejected listing by editing it', () => {
    expect(canTransition('rejected', 'pending', 'employer')).toBe(true)
  })

  it('lets an employer edit a pending listing without changing its status', () => {
    expect(canTransition('pending', 'pending', 'employer')).toBe(true)
  })

  // Role separation: neither side can perform the other's transitions. An
  // employer approving their own listing would defeat the entire workflow.
  it('never lets an employer approve or reject', () => {
    expect(canTransition('pending', 'approved', 'employer')).toBe(false)
    expect(canTransition('pending', 'rejected', 'employer')).toBe(false)
  })

  it('never lets an admin close or resubmit', () => {
    expect(canTransition('approved', 'closed', 'admin')).toBe(false)
    expect(canTransition('rejected', 'pending', 'admin')).toBe(false)
  })

  it('gives a candidate no transitions at all', () => {
    for (const from of JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        expect(canTransition(from, to, 'candidate')).toBe(false)
      }
    }
  })

  it('never lets anything become rejected except by an admin from pending', () => {
    for (const from of JOB_STATUSES) {
      for (const role of ROLES) {
        const expected = from === 'pending' && role === 'admin'
        expect(canTransition(from, 'rejected', role)).toBe(expected)
      }
    }
  })
})

describe('EDITABLE_STATUSES', () => {
  it('is exactly pending and rejected', () => {
    expect([...EDITABLE_STATUSES].sort()).toEqual(['pending', 'rejected'])
  })

  // Derived from the same table the guard uses, so the SQL predicate in
  // updateJob cannot drift from canTransition.
  it('agrees with canTransition for every status', () => {
    for (const status of JOB_STATUSES) {
      expect(EDITABLE_STATUSES.includes(status)).toBe(
        canTransition(status, 'pending', 'employer')
      )
    }
  })
})

describe('statusAfterEdit', () => {
  it.each([
    ['pending', 'pending'],
    ['rejected', 'pending'],
  ] as const)('leaves a %s listing as %s', (from, expected) => {
    expect(statusAfterEdit(from)).toBe(expected)
  })

  it.each(['approved', 'closed'] as const)('returns undefined for a %s listing', (from) => {
    expect(statusAfterEdit(from)).toBeUndefined()
  })
})
