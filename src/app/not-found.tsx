import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * Also what a non-approved listing renders: `getPublicJob` won't return it, the
 * page calls `notFound()`, and the visitor cannot tell a pending listing from
 * one that never existed. That indistinguishability is the point.
 */
export default function NotFound() {
  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="text-muted-foreground">
        The listing may have been closed, or the link may be wrong.
      </p>
      <Button asChild>
        <Link href="/">Browse open jobs</Link>
      </Button>
    </section>
  )
}
