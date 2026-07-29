import type { Metadata } from 'next'
import Link from 'next/link'

import { CloseJobDialog } from '@/components/close-job-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { JobStatus } from '@/db/schema'
import { formatSalaryRange } from '@/lib/format'
import { requireRole } from '@/lib/session'
import { EDITABLE_STATUSES } from '@/lib/transitions'
import { listMyJobs } from '@/server/queries'

export const metadata: Metadata = {
  title: 'My listings',
}

/** Shared with `loading.tsx`, so the skeleton's columns cannot drift from these. */
export const LISTING_COLUMNS = ['Listing', 'Status', 'Salary', 'Applicants', 'Actions'] as const

// Text on every badge, never colour alone. SPEC §6.1.
const STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
}

const STATUS_VARIANTS: Record<JobStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  closed: 'outline',
}

export default async function EmployerDashboardPage() {
  const user = await requireRole('employer')
  // One query for the listings *and* their application counts. SPEC §5.
  const rows = await listMyJobs(user.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
          <p className="text-muted-foreground">
            {rows.length === 0
              ? 'Nothing posted yet.'
              : `${rows.length} listing${rows.length === 1 ? '' : 's'}.`}{' '}
            Every listing is reviewed before it goes public.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/employer/new">Post a job</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">No listings yet</p>
          <p className="text-muted-foreground text-sm">
            Post a role and an admin will review it before candidates can see it.
          </p>
          <Button asChild>
            <Link href="/dashboard/employer/new">Post your first job</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {LISTING_COLUMNS.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ job, applicationCount }) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-muted-foreground text-sm">
                      {job.company} · {job.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[job.status]}>{STATUS_LABELS[job.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatSalaryRange(job.salaryMin, job.salaryMax)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {applicationCount > 0 ? (
                      <Link
                        href={`/dashboard/employer/${job.id}/applications`}
                        className="underline underline-offset-2"
                      >
                        {applicationCount}
                      </Link>
                    ) : (
                      applicationCount
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Gated by the same statuses the Server Action enforces in
                        SQL — the UI hiding a button is convenience, not the
                        guarantee. */}
                    <div className="flex justify-end gap-2">
                      {EDITABLE_STATUSES.includes(job.status) && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/employer/${job.id}/edit`}>Edit</Link>
                        </Button>
                      )}
                      {job.status === 'approved' && (
                        <>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/jobs/${job.id}`}>View</Link>
                          </Button>
                          <CloseJobDialog jobId={job.id} title={job.title} />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
