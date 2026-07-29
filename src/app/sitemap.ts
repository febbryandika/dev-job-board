import type { MetadataRoute } from 'next'

import { absoluteUrl, siteUrl } from '@/lib/site'
import { listApprovedJobsForSitemap } from '@/server/queries'

// Regenerated on the same interval as the detail pages it points at.
export const revalidate = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Approved only, filtered in SQL — a pending listing must not be discoverable
  // through the sitemap any more than through the list. SPEC §8, §9.
  const jobs = await listApprovedJobsForSitemap()

  return [
    { url: siteUrl(), changeFrequency: 'daily', priority: 1 },
    ...jobs.map((job) => ({
      url: absoluteUrl(`/jobs/${job.id}`),
      lastModified: job.approvedAt ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
