'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * The app-wide fallback with deliberately neutral copy — `/`, `/jobs/[id]` and
 * `/dashboard` each have their own nearer boundary with specific wording, so
 * this one only ever renders for routes that don't (the auth pages).
 *
 * Note there is intentionally no root `loading.tsx`: a Suspense boundary at the
 * root segment makes every route stream, and a streamed response has already
 * sent its headers, so `notFound()` degrades to HTTP 200. The home skeleton
 * lives in `(home)/loading.tsx` instead.
 */
export default function RootError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">Trying again often fixes it.</p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to jobs</Link>
        </Button>
      </div>
    </section>
  )
}
