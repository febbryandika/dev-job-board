'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { FORBIDDEN_DIGEST } from '@/lib/roles'

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  // requireRole() sets this digest on ForbiddenError. Next strips error
  // messages in production but forwards a digest that was already set, so this
  // check works in a real deploy and not just in dev.
  if (error.digest === FORBIDDEN_DIGEST) {
    return (
      <section className="mx-auto max-w-md space-y-4 py-8">
        <p className="text-muted-foreground text-sm font-medium">403 — Forbidden</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          You don&apos;t have access to this page
        </h1>
        <p className="text-muted-foreground">
          This area is limited to a different role. If you think that&apos;s wrong, check which
          account you&apos;re signed in as.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t load this page. Trying again often fixes it.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to jobs</Link>
        </Button>
      </div>
    </section>
  )
}
