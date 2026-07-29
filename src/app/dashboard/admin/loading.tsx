import { SkeletonPageHeader } from '@/components/skeleton-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The queue is cards, not a table, so this mirrors a QueueCard: company, title,
 * submitter, badge row, the disclosure, and the two decision buttons.
 */
export default function ModerationQueueLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />

      <ul className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <Card>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-64 max-w-full" />
                  <Skeleton className="h-4 w-72 max-w-full" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-9 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
