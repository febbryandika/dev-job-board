import type { Metadata } from 'next'

import { ModerationQueue, type PendingItem } from '@/components/moderation-queue'
import { renderMarkdown } from '@/lib/markdown'
import { requireRole } from '@/lib/session'
import { listPendingJobs } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Moderation queue',
}

export default async function AdminDashboardPage() {
  await requireRole('admin')

  const rows = await listPendingJobs()

  // Sanitized here, on the server, through the same allowlist the public detail
  // page uses — the admin is reading employer-authored markdown, so it is no
  // more trusted here than anywhere else. SPEC §9.
  const items: PendingItem[] = rows.map((row) => ({
    ...row,
    descriptionHtml: renderMarkdown(row.job.description),
  }))

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Moderation queue</h1>
        <p className="text-muted-foreground">
          {items.length === 0
            ? 'No listings are waiting for review.'
            : `${items.length} listing${items.length === 1 ? '' : 's'} awaiting review, oldest first.`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Nothing pending — you&apos;re clear</p>
          <p className="text-muted-foreground mt-1 text-sm">
            New listings show up here as soon as an employer submits them.
          </p>
        </div>
      ) : (
        <ModerationQueue items={items} />
      )}
    </div>
  )
}
