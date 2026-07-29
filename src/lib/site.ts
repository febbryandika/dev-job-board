/**
 * The one place the public base URL is derived. Metadata, the sitemap,
 * robots.txt, JSON-LD and every email link go through here, so
 * "absolute URLs come from BETTER_AUTH_URL, never hardcoded" is structurally
 * true rather than a convention several files happen to follow.
 */
export function siteUrl(): string {
  const configured = process.env.BETTER_AUTH_URL

  if (configured) return configured

  // Falling back to localhost in production would silently poison the sitemap,
  // canonical URLs, JSON-LD and every email link — all of which are generated
  // once and cached, so nobody would notice until the damage was indexed.
  // Failing the request is recoverable; emitting localhost quietly is not.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BETTER_AUTH_URL is not set. It is required in production: every absolute URL is built from it.'
    )
  }

  return 'http://localhost:3000'
}

/** An absolute URL for `path`, which should start with `/`. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path}`
}
