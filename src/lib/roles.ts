/**
 * The role rules, as pure values with **no imports**.
 *
 * Deliberately separate from `session.ts`: that module pulls in the Better Auth
 * server and the Postgres client, which must never reach the browser bundle —
 * and the client `error.tsx` needs `FORBIDDEN_DIGEST`. Keeping the rules here
 * also lets them be unit-tested without a database, the same reasoning SPEC
 * §3.2 applies to `canTransition`.
 */

export const ROLES = ['candidate', 'employer', 'admin'] as const

export type Role = (typeof ROLES)[number]

/** Marker the client `error.tsx` matches on to render a 403 instead of a generic error. */
export const FORBIDDEN_DIGEST = 'FORBIDDEN'

export class ForbiddenError extends Error {
  // Next strips error messages crossing into a client error boundary in
  // production but preserves a digest that is already set — the same mechanism
  // notFound() uses. Without this the 403 screen would only work in dev.
  readonly digest = FORBIDDEN_DIGEST

  constructor(required: Role, actual: string | null | undefined) {
    super(`Requires role "${required}" but the session has "${actual ?? 'none'}".`)
    this.name = 'ForbiddenError'
  }
}

/**
 * There is deliberately **no role hierarchy**: SPEC defines none, so an admin
 * does not satisfy an employer check. Employer mutations are scoped by
 * `employerId = session.user.id`, which an admin would never match anyway.
 */
export function hasRole(user: { role?: string | null } | null | undefined, role: Role): boolean {
  return user?.role === role
}
