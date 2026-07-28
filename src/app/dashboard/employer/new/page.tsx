import type { Metadata } from 'next'
import Link from 'next/link'

import { requireRole } from '@/lib/session'

import { NewJobForm } from './new-job-form'

export const metadata: Metadata = {
  title: 'Post a job',
}

export default async function NewJobPage() {
  await requireRole('employer')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard/employer" className="hover:underline">
            ← My listings
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Post a job</h1>
      </div>

      <NewJobForm />
    </div>
  )
}
