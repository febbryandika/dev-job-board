import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireRole } from '@/lib/session'
import { EDITABLE_STATUSES } from '@/lib/transitions'
import { getMyJob } from '@/server/queries'

import { EditJobForm } from './edit-job-form'

export const metadata: Metadata = {
  title: 'Edit listing',
}

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('employer')
  const { id } = await params

  // Ownership is in the query, so another employer's listing simply isn't
  // found — the visitor cannot tell it apart from an id that never existed.
  const job = await getMyJob(id, user.id)
  if (!job) notFound()

  // Approved and closed listings are immutable. Bounce rather than render a
  // form whose submit could only ever fail. SPEC §3.2.
  if (!EDITABLE_STATUSES.includes(job.status)) redirect('/dashboard/employer')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard/employer" className="hover:underline">
            ← My listings
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>
      </div>

      {/* The rejection note is kept on the row precisely so it can be shown
          here — otherwise the employer has no idea what to change. */}
      {job.status === 'rejected' && job.rejectionNote && (
        <div className="border-destructive/50 space-y-1 rounded-md border px-4 py-3">
          <p className="text-destructive text-sm font-medium">
            This listing was rejected — here&apos;s why
          </p>
          <p className="text-sm">{job.rejectionNote}</p>
          <p className="text-muted-foreground text-sm">
            Saving your changes resubmits it for review.
          </p>
        </div>
      )}

      <EditJobForm job={job} />
    </div>
  )
}
