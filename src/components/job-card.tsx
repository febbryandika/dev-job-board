import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Job } from '@/db/schema'
import { formatPostedDate, formatSalaryRange } from '@/lib/format'

const LOCATION_TYPE_LABELS = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
} as const

const ROLE_TYPE_LABELS = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  contract: 'Contract',
} as const

export function JobCard({ job, now }: { job: Job; now: Date }) {
  const posted = job.approvedAt ?? job.createdAt

  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{job.company}</p>
          <h2 className="text-base leading-snug font-semibold">
            {/* A real anchor stretched over the card: middle-click and "open in
                new tab" still work, and the accessible name is the job title. */}
            <Link href={`/jobs/${job.id}`} className="hover:underline after:absolute after:inset-0">
              {job.title}
            </Link>
          </h2>
        </div>

        {/* Badges carry text, never colour alone. SPEC §6.1. */}
        <ul className="flex flex-wrap items-center gap-1.5">
          <li>
            <Badge variant="outline">{job.location}</Badge>
          </li>
          <li>
            <Badge variant="secondary">{LOCATION_TYPE_LABELS[job.locationType]}</Badge>
          </li>
          <li>
            <Badge variant="secondary">{ROLE_TYPE_LABELS[job.roleType]}</Badge>
          </li>
        </ul>

        <p className="text-sm font-medium">{formatSalaryRange(job.salaryMin, job.salaryMax)}</p>

        {job.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="ghost" className="font-normal">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        <p className="text-muted-foreground mt-auto text-sm">
          Posted <time dateTime={posted.toISOString()}>{formatPostedDate(posted, now)}</time>
        </p>
      </CardContent>
    </Card>
  )
}
