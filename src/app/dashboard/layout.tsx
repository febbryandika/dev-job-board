import { requireUser } from '@/lib/session'

/**
 * Requires a session, nothing more. Role checks belong to the pages below and,
 * critically, to every Server Action — the layout is convenience, never the
 * authorization boundary. SPEC §3.1.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return children
}
