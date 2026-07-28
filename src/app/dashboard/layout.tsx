// TODO(phase-3): require a session here and redirect to /login when absent.
// The layout is a convenience guard only — every Server Action must re-check
// the role itself (SPEC §3.1). Never treat this file as the authorization
// boundary.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
