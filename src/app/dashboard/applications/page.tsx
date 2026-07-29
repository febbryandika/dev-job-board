import type { Metadata } from 'next'
import Link from 'next/link'

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
import { requireRole } from '@/lib/session'
import { listMyApplications } from '@/server/queries'

export const metadata: Metadata = {
  title: 'My applications',
}

/** Shared with `loading.tsx`, so the skeleton's columns cannot drift from these. */
export const APPLICATION_COLUMNS = ['Listing', 'Status', 'Résumé', 'Applied'] as const

/**
 * What the candidate is told about a listing they applied to. `pending` and
 * `rejected` never appear here — an approved listing is the only kind that can
 * be applied to, and moderation cannot send it back.
 */
const STATUS_LABELS: Record<JobStatus, string> = {
  approved: 'Open',
  closed: 'Closed by employer',
  pending: 'Awaiting review',
  rejected: 'Not published',
}

export default async function MyApplicationsPage() {
  const user = await requireRole('candidate')
  const rows = await listMyApplications(user.id)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My applications</h1>
        <p className="text-muted-foreground">
          {rows.length === 0
            ? 'Nothing sent yet.'
            : `${rows.length} application${rows.length === 1 ? '' : 's'} sent.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">You haven&apos;t applied to anything yet</p>
          <p className="text-muted-foreground text-sm">
            Find a role that fits and send your first application.
          </p>
          <Button asChild>
            <Link href="/">Browse open jobs</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {APPLICATION_COLUMNS.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ application, jobId, jobTitle, jobCompany, jobStatus }) => (
                <TableRow key={application.id}>
                  <TableCell className="align-top">
                    <div className="font-medium">
                      {jobStatus === 'approved' ? (
                        <Link href={`/jobs/${jobId}`} className="hover:underline">
                          {jobTitle}
                        </Link>
                      ) : (
                        jobTitle
                      )}
                    </div>
                    <div className="text-muted-foreground text-sm">{jobCompany}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={jobStatus === 'approved' ? 'default' : 'outline'}>
                      {STATUS_LABELS[jobStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <a
                      href={application.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline underline-offset-2"
                    >
                      Open résumé
                    </a>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    <time dateTime={application.createdAt.toISOString()}>
                      {application.createdAt.toISOString().slice(0, 10)}
                    </time>
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
