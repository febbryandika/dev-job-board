import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Application } from '@/db/schema'

export type ApplicationRow = {
  application: Application
  applicantName: string | null
  applicantEmail: string | null
}

/**
 * The employer's view of who applied. Everything here comes from
 * `listJobApplications`, which scopes by `employerId` in SQL — this component
 * is never handed rows it had to filter itself. SPEC §9.
 */
export function ApplicationTable({ rows }: { rows: ApplicationRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Applicant</TableHead>
            <TableHead>Résumé</TableHead>
            <TableHead>Cover letter</TableHead>
            <TableHead>Applied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ application, applicantName, applicantEmail }) => (
            <TableRow key={application.id}>
              <TableCell className="align-top">
                <div className="font-medium">{applicantName ?? 'Unknown'}</div>
                {applicantEmail && (
                  <a href={`mailto:${applicantEmail}`} className="text-muted-foreground text-sm hover:underline">
                    {applicantEmail}
                  </a>
                )}
              </TableCell>
              <TableCell className="align-top">
                {/* A candidate-supplied URL, so it is untrusted: no referrer,
                    no window.opener handed to it. */}
                <a
                  href={application.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-sm underline underline-offset-2"
                >
                  Open résumé
                </a>
              </TableCell>
              <TableCell className="text-muted-foreground max-w-md align-top text-sm whitespace-pre-line">
                {application.coverLetter || '—'}
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
  )
}
