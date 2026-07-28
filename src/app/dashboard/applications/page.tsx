import { requireRole } from '@/lib/session'

// TODO(phase-8): candidate's own applications, joined with job title/company
// via listMyApplications. SPEC §5.
export default async function MyApplicationsPage() {
  await requireRole('candidate')

  return <h1 className="text-2xl font-semibold tracking-tight">My applications</h1>
}
