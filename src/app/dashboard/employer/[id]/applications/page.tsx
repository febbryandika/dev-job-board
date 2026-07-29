import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ApplicationTable } from '@/components/application-table'
import { requireRole } from '@/lib/session'
import { getMyJob, listJobApplications } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Applications',
}

export default async function JobApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireRole('employer')
  const { id } = await params

  // Ownership is in the query, so another employer's listing is simply not
  // found — and the applicant contact details below are never fetched at all.
  const job = await getMyJob(id, user.id)
  if (!job) notFound()

  const rows = await listJobApplications(id, user.id)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard/employer" className="hover:underline">
            ← My listings
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          {job.title} · {job.company}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">No applications yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {job.status === 'approved'
              ? 'Candidates can see this listing — applications will show up here.'
              : 'This listing is not public yet, so candidates cannot apply to it.'}
          </p>
        </div>
      ) : (
        <ApplicationTable rows={rows} />
      )}
    </div>
  )
}
