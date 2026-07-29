/**
 * The one place the public base URL is derived. Metadata, the sitemap,
 * robots.txt, JSON-LD and every email link go through here, so
 * "absolute URLs come from BETTER_AUTH_URL, never hardcoded" is structurally
 * true rather than a convention several files happen to follow.
 */
export function siteUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
}

/** An absolute URL for `path`, which should start with `/`. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path}`
}
