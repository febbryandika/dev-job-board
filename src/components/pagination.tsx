import Link from 'next/link'

import { cn } from '@/lib/utils'

/**
 * Compact page list: first, last, and a window around the current page, with
 * ellipsis for the gaps. `null` marks a gap.
 *
 * Exported for unit testing — the ellipsis boundaries are the fiddly part, and
 * the seed data has fewer than one page of listings so this rarely renders in
 * development.
 */
export function pageWindow(current: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages = new Set([1, totalPages, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  return sorted.flatMap((page, i) => {
    const previous = sorted[i - 1]
    return previous !== undefined && page - previous > 1 ? [null, page] : [page]
  })
}

function hrefFor(page: number, searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams)
  if (page <= 1) next.delete('page')
  else next.set('page', String(page))

  const query = next.toString()
  return query ? `/?${query}` : '/'
}

/**
 * Real `<a href>` links, not buttons: a crawler has to be able to reach page 3
 * to index the listings on it, which is the whole point of an SSR job board.
 */
export function Pagination({
  page,
  total,
  pageSize,
  searchParams,
}: {
  page: number
  total: number
  pageSize: number
  searchParams: URLSearchParams
}) {
  const totalPages = Math.ceil(total / pageSize)

  if (totalPages <= 1) return null

  const linkClass = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted'

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1, searchParams)} rel="prev" className={linkClass}>
          Previous
        </Link>
      )}

      {pageWindow(page, totalPages).map((entry, index) =>
        entry === null ? (
          <span key={`gap-${index}`} aria-hidden className="text-muted-foreground px-1 text-sm">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry, searchParams)}
            aria-label={`Page ${entry}`}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(linkClass, entry === page && 'bg-primary text-primary-foreground')}
          >
            {entry}
          </Link>
        )
      )}

      {page < totalPages && (
        <Link href={hrefFor(page + 1, searchParams)} rel="next" className={linkClass}>
          Next
        </Link>
      )}
    </nav>
  )
}
