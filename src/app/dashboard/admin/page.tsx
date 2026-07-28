import { requireRole } from '@/lib/session'

// TODO(phase-7): moderation queue — all `pending` listings, oldest first,
// with approve / reject + required note. Admin only. SPEC §3.5.
export default async function AdminDashboardPage() {
  await requireRole('admin')

  return <h1 className="text-2xl font-semibold tracking-tight">Moderation queue</h1>
}
