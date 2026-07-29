import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth, type SessionUser } from '@/lib/auth'
import { ForbiddenError, hasRole, type Role } from '@/lib/roles'

/**
 * The current user, or `null`. Does **not** redirect — for the places that need
 * to ask "who is looking?" and behave differently rather than bounce, like the
 * apply island on the public detail page.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })

  return session?.user ?? null
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  return user
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
