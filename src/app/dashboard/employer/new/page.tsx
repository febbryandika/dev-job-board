import { requireRole } from '@/lib/session'

// TODO(phase-6): job form wired to the createJob Server Action. New listings
// always start `pending`. SPEC §3.2.
export default async function NewJobPage() {
  await requireRole('employer')

  return <h1 className="text-2xl font-semibold tracking-tight">Post a job</h1>
}
