import Link from 'next/link'
import { Suspense } from 'react'

import { JobCard } from '@/components/job-card'
import { JobFilters } from '@/components/job-filters'
import { Pagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { jobSearchParamsSchema, PAGE_SIZE } from '@/lib/validation'
import { listPublicJobs } from '@/server/queries'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams
  // Every field has a `.catch()`, so junk in the URL degrades that one filter
  // rather than throwing the page away.
  const filters = jobSearchParamsSchema.parse(raw)
  const { jobs, total } = await listPublicJobs(filters)

  const hasFilters = Boolean(filters.q || filters.locationType || filters.roleType)
  // Rendered once per request and threaded down, so every card computes
  // "3 days ago" against the same instant.
  const now = new Date()

  const urlParams = new URLSearchParams()
  if (filters.q) urlParams.set('q', filters.q)
  if (filters.locationType) urlParams.set('locationType', filters.locationType)
  if (filters.roleType) urlParams.set('roleType', filters.roleType)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Developer jobs in Japan</h1>
        <p className="text-muted-foreground">
          {total === 0 ? 'No open listings' : `${total} open ${total === 1 ? 'listing' : 'listings'}`}
          . Every listing is reviewed before it goes public.
        </p>
      </div>

      {/* useSearchParams needs a Suspense boundary to avoid opting the whole
          route out of static rendering on other pages that reuse this. */}
      <Suspense fallback={<div className="h-16" />}>
        <JobFilters />
      </Suspense>

      {jobs.length === 0 ? (
        <EmptyState hasFilters={hasFilters} page={filters.page} />
      ) : (
        <>
          <ul
            aria-label="Job listings"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} now={now} />
              </li>
            ))}
          </ul>

          <Pagination
            page={filters.page}
            total={total}
            pageSize={PAGE_SIZE}
            searchParams={urlParams}
          />
        </>
      )}
    </div>
  )
}

function EmptyState({ hasFilters, page }: { hasFilters: boolean; page: number }) {
  // Three variants, because one message would be wrong in two of the three
  // cases: offering "Clear filters" when none are set is a dead end, and
  // "no listings yet" is a lie when a filter — or a page number past the end —
  // is what hid them.
  if (!hasFilters && page > 1) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="font-medium">Nothing on this page</p>
        <p className="text-muted-foreground text-sm">
          There are listings, just not this far in.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to the first page</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-dashed px-6 py-16 text-center">
      {hasFilters ? (
        <div className="space-y-3">
          <p className="font-medium">No jobs match these filters</p>
          <p className="text-muted-foreground text-sm">
            Try a broader search, or clear the filters to see everything.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-medium">No listings yet</p>
          <p className="text-muted-foreground text-sm">
            Approved listings show up here. If you&apos;re hiring, post the first one.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/employer/new">Post a job</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
