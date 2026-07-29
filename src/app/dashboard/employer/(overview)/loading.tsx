import { SkeletonPageHeader, SkeletonTable } from '@/components/skeleton-table'

import { LISTING_COLUMNS } from './page'

/**
 * Lives in the `(overview)` route group, not at `/dashboard/employer`, so its
 * Suspense boundary covers only this index page. At the parent segment it also
 * wrapped `[id]/edit` and `[id]/applications`, and a streamed response has
 * already sent its headers — which turned their `notFound()` into a soft 404.
 *
 * Columns come from the page itself, so the two cannot drift apart.
 */
export default function EmployerDashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader withAction />
      <SkeletonTable headers={LISTING_COLUMNS} />
    </div>
  )
}
