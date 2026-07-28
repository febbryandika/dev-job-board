import { requireRole } from '@/lib/session'

// TODO(phase-6): my listings + application counts via listMyJobs — one
// LEFT JOIN + GROUP BY, never a count query per row. SPEC §5.
export default async function EmployerDashboardPage() {
  await requireRole('employer')

  return <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
}
