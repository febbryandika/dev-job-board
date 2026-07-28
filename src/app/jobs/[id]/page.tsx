import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { formatPostedDate, formatSalaryRange } from '@/lib/format'
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/json-ld'
import { renderMarkdown, toMetaDescription } from '@/lib/markdown'
import { getPublicJob, listApprovedJobsForSitemap } from '@/server/queries'

// SPEC §8. This route only depends on `params`, so unlike the filtered list it
// really can be prerendered and revalidated on an interval.
export const revalidate = 60

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

function siteUrl() {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
}

/** Prerender the approved listings; anything new is generated on first request. */
export async function generateStaticParams() {
  const jobs = await listApprovedJobsForSitemap()

  return jobs.map((job) => ({ id: job.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const job = await getPublicJob(id)

  // A non-approved or missing job gets 404 metadata rather than throwing here.
  if (!job) return { title: 'Job not found', robots: { index: false } }

  // Every value comes from the row — no hardcoded strings. The root layout's
  // `%s — Dev Job Board` template completes the title.
  const title = `${job.title} at ${job.company}`
  const description = toMetaDescription(job.description)
  const url = `${siteUrl()}/jobs/${job.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: (job.approvedAt ?? job.createdAt).toISOString(),
    },
  }
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getPublicJob(id)

  // Not an "is it approved?" check in the UI — `getPublicJob` filters on status
  // in SQL, so a pending or rejected listing is simply not fetchable. SPEC §9.
  if (!job) notFound()

  const posted = job.approvedAt ?? job.createdAt
  const descriptionHtml = renderMarkdown(job.description)

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <script
        type="application/ld+json"
        // Serialised with `<` escaped, so a description cannot close this tag.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJobPostingJsonLd(job, siteUrl())) }}
      />

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          <Link href="/" className="hover:underline">
            ← All jobs
          </Link>
        </p>
        <p className="text-muted-foreground">{job.company}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{job.title}</h1>
      </div>

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

      <dl className="grid grid-cols-1 gap-4 border-y py-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Salary</dt>
          <dd className="font-medium">{formatSalaryRange(job.salaryMin, job.salaryMax)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Posted</dt>
          <dd className="font-medium">
            <time dateTime={posted.toISOString()}>{formatPostedDate(posted, new Date())}</time>
          </dd>
        </div>
      </dl>

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

      {/* Sanitized by src/lib/markdown.ts against a strict allowlist. */}
      <div
        className="job-description leading-relaxed"
        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
      />
    </article>
  )
}
