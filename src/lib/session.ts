import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth, type SessionUser } from '@/lib/auth'
import { ForbiddenError, hasRole, type Role } from '@/lib/roles'

export async function requireUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect('/login')

  return session.user
}

/**
 * The authorization primitive. Every Server Action calls this **first** — the
 * dashboard layout guard is convenience, never the authorization boundary.
 * SPEC §3.1.
 */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser()

  if (!hasRole(user, role)) throw new ForbiddenError(role, user.role)

  return user
}
