'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function HomeError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load listings</h1>
      <p className="text-muted-foreground">
        Something went wrong fetching the job list. Trying again often fixes it.
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Clear filters</Link>
        </Button>
      </div>
    </section>
  )
}
