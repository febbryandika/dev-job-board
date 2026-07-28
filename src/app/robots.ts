import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing under these is public or useful to index: the dashboard is
      // session-gated, and /api/auth is Better Auth's handler.
      disallow: ['/dashboard/', '/api/', '/login', '/register'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
