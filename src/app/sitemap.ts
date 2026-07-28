import type { MetadataRoute } from 'next'

// TODO(phase-5): emit every `approved` job URL from listPublicJobs. SPEC §8.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

  return [{ url: baseUrl, changeFrequency: 'daily', priority: 1 }]
}
