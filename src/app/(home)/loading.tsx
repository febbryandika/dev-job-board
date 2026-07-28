import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Deliberately mirrors JobCard's structure — company, title, badge row, salary,
 * tags, posted date — so the grid doesn't shift when the real cards arrive.
 * SPEC §6.1.
 */
export default function HomeLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Skeleton className="h-16 w-full" />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-48 max-w-full" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
