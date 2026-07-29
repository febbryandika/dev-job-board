import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing under these is public or useful to index: the dashboard is
      // session-gated, and /api/auth is Better Auth's handler.
      disallow: ['/dashboard/', '/api/', '/login', '/register'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
