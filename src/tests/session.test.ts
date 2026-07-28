import { describe, expect, it } from 'vitest'

import { FORBIDDEN_DIGEST, ForbiddenError, hasRole, ROLES, type Role } from '@/lib/roles'
import { loginSchema, registerSchema, SIGNUP_ROLES } from '@/lib/validation'

describe('hasRole', () => {
  it.each(ROLES)('accepts a user whose role is exactly %s', (role) => {
    expect(hasRole({ role }, role)).toBe(true)
  })

  // Every off-diagonal pair must fail. Written as a matrix rather than a few
  // hand-picked cases so adding a role can't quietly skip a combination.
  const mismatches = ROLES.flatMap((required) =>
    ROLES.filter((actual) => actual !== required).map((actual) => [actual, required] as const)
  )

  it.each(mismatches)('rejects a %s against a %s check', (actual, required) => {
    expect(hasRole({ role: actual }, required)).toBe(false)
  })

  // The single most load-bearing assertion here: SPEC defines no role
  // hierarchy, so admin must not be a superset of employer. If this ever
  // passes, an admin could reach employer-owned mutations.
  it('does not treat admin as a superset of the other roles', () => {
    expect(hasRole({ role: 'admin' }, 'employer')).toBe(false)
    expect(hasRole({ role: 'admin' }, 'candidate')).toBe(false)
  })

  it.each([
    ['null user', null],
    ['undefined user', undefined],
    ['null role', { role: null }],
    ['undefined role', { role: undefined }],
    ['empty role', { role: '' }],
    ['unknown role', { role: 'superuser' }],
  ])('rejects %s', (_label, user) => {
    for (const role of ROLES) {
      expect(hasRole(user, role as Role)).toBe(false)
    }
  })
})

describe('ForbiddenError', () => {
  // The digest is what survives into the client error boundary in production;
  // without it the 403 screen silently degrades to a generic error.
  it('carries the FORBIDDEN digest', () => {
    const error = new ForbiddenError('admin', 'candidate')

    expect(error.digest).toBe(FORBIDDEN_DIGEST)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ForbiddenError')
  })

  it('names both the required and the actual role', () => {
    expect(new ForbiddenError('employer', null).message).toContain('employer')
    expect(new ForbiddenError('employer', null).message).toContain('none')
  })
})

describe('registerSchema — role cannot be escalated', () => {
  const base = { name: 'Aiko Tanaka', email: 'aiko@example.com', password: 'demo1234' }

  it.each(SIGNUP_ROLES)('accepts the self-service role %s', (role) => {
    expect(registerSchema.safeParse({ ...base, role }).success).toBe(true)
  })

  // admin is DB-assigned only. This is the schema half of the defence; the
  // other half is `input: false` on the Better Auth user field.
  it.each(['admin', 'ADMIN', 'superuser', '', null, undefined])(
    'rejects role %s',
    (role) => {
      expect(registerSchema.safeParse({ ...base, role }).success).toBe(false)
    }
  )

  it('rejects a password under 8 characters', () => {
    const result = registerSchema.safeParse({ ...base, password: 'demo123', role: 'candidate' })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.password).toEqual([
      'Password must be at least 8 characters',
    ])
  })

  it('rejects a malformed email', () => {
    expect(registerSchema.safeParse({ ...base, email: 'not-an-email', role: 'candidate' }).success).toBe(
      false
    )
  })
})

describe('loginSchema', () => {
  it('requires an email and a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'nope', password: 'demo1234' }).success).toBe(false)
  })
})
