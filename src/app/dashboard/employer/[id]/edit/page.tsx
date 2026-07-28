import { requireRole } from '@/lib/session'

// TODO(phase-6): edit form wired to updateJob. Editable only while `pending`
// or `rejected`; editing a rejected listing resets it to `pending`. SPEC §3.2.
export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('employer')
  const { id } = await params

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>
      <p className="text-muted-foreground">Job ID: {id}</p>
    </section>
  )
}
