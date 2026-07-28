'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function JobDetailError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load this listing</h1>
      <p className="text-muted-foreground">
        Something went wrong fetching the job. Trying again often fixes it.
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to jobs</Link>
        </Button>
      </div>
    </section>
  )
}
