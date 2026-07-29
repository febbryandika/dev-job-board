import { SkeletonPageHeader, SkeletonTable } from '@/components/skeleton-table'

import { APPLICATION_COLUMNS } from './page'

/** Columns come from the page itself, so the two cannot drift apart. */
export default function MyApplicationsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable headers={APPLICATION_COLUMNS} rows={4} />
    </div>
  )
}
