import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * A placeholder that mirrors the real table's markup — same wrapper, same
 * `<Table>`, same column count — so rows land at the same height and the page
 * doesn't jump when the data arrives. SPEC §6.1.
 */
export function SkeletonTable({
  headers,
  rows = 5,
}: {
  headers: readonly string[]
  rows?: number
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {headers.map((header, column) => (
                <TableCell key={header} className="align-top">
                  {/* The first column carries two lines in every one of these
                      tables — a title and a subtitle — so it gets two here. */}
                  {/* Heights tuned against the real table: a measured row is
                      57px, and the naive 16/14 pair with space-y-1.5 came out
                      at 53 — a 4px shift per row. */}
                  {column === 0 ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-44 max-w-full" />
                      <Skeleton className="h-4 w-32 max-w-full" />
                    </div>
                  ) : (
                    <Skeleton className="h-4 w-20" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** The page heading block every dashboard route opens with. */
export function SkeletonPageHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-8 w-24" />}
    </div>
  )
}
