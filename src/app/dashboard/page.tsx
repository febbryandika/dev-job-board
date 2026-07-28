import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/session'

/**
 * The one place that owns the role → landing-page mapping, so login, signup,
 * and the header can all just point at /dashboard.
 */
const HOME_BY_ROLE: Record<string, string> = {
  candidate: '/dashboard/applications',
  employer: '/dashboard/employer',
  admin: '/dashboard/admin',
}

export default async function DashboardIndexPage() {
  const user = await requireUser()

  redirect(HOME_BY_ROLE[user.role ?? ''] ?? '/dashboard/applications')
}
