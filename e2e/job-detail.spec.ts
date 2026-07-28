import { expect, test } from '@playwright/test'

import { query } from './db'

/**
 * Job IDs are cuid2, so they can't be hardcoded. These specs pick a real row
 * per status straight from the database — the only way to prove a *pending*
 * listing 404s is to hold its actual ID.
 */


async function jobIdWithStatus(status: string): Promise<string> {
  const { rows } = await query<{ id: string; title: string }>(
    'select id, title from jobs where status = $1 limit 1',
    [status]
  )
  const row = rows[0]
  if (!row) throw new Error(`Seed data has no ${status} job — seed the database first.`)
  return row.id
}

test('an approved listing renders its content', async ({ page }) => {
  const { rows } = await query<{ id: string; title: string; company: string }>(
    "select id, title, company from jobs where status = 'approved' and salary_min is not null limit 1"
  )
  const job = rows[0]!

  await page.goto(`/jobs/${job.id}`)

  await expect(page.getByRole('heading', { level: 1, name: job.title })).toBeVisible()
  await expect(page.getByText(job.company).first()).toBeVisible()
  await expect(page.getByText('Salary')).toBeVisible()
  await expect(page.locator('.job-description')).not.toBeEmpty()
})

// The security assertion of this phase: visibility is enforced in SQL, so a
// listing that is not approved must be indistinguishable from one that never
// existed — tested per status, not once.
for (const status of ['pending', 'rejected', 'closed']) {
  test(`a ${status} listing returns a real 404`, async ({ page }) => {
    const id = await jobIdWithStatus(status)
    const response = await page.goto(`/jobs/${id}`)

    expect(response?.status(), `a ${status} job must not be publicly reachable`).toBe(404)
    await expect(page.getByRole('heading', { name: /doesn't exist/ })).toBeVisible()
  })
}

test('an unknown id returns a real 404', async ({ page }) => {
  const response = await page.goto('/jobs/does-not-exist-at-all')

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: /doesn't exist/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Browse open jobs' })).toBeVisible()
})

test('the page renders fully with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()

  const { rows } = await query<{ id: string; title: string; company: string }>(
    "select id, title, company from jobs where status = 'approved' and salary_min is not null limit 1"
  )
  const job = rows[0]!

  await page.goto(`/jobs/${job.id}`)

  await expect(page.getByRole('heading', { level: 1, name: job.title })).toBeVisible()
  await expect(page.getByText(job.company).first()).toBeVisible()
  await expect(page.locator('.job-description')).not.toBeEmpty()
  // Salary is server-formatted, so it is in the HTML rather than hydrated in.
  await expect(page.getByText(/￥[\d,]/).first()).toBeVisible()

  await context.close()
})

test('the detail page carries valid JobPosting JSON-LD', async ({ page }) => {
  const id = await jobIdWithStatus('approved')
  await page.goto(`/jobs/${id}`)

  const raw = await page.locator('script[type="application/ld+json"]').innerText()
  const data = JSON.parse(raw)

  expect(data['@context']).toBe('https://schema.org/')
  expect(data['@type']).toBe('JobPosting')
  for (const field of ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation']) {
    expect(data[field], `${field} is required by Google`).toBeTruthy()
  }
  expect(new Date(data.datePosted).toString()).not.toBe('Invalid Date')
})

test('metadata comes from the row', async ({ page }) => {
  const { rows } = await query<{ id: string; title: string; company: string }>(
    "select id, title, company from jobs where status = 'approved' limit 1"
  )
  const job = rows[0]!

  await page.goto(`/jobs/${job.id}`)

  await expect(page).toHaveTitle(`${job.title} at ${job.company} — Dev Job Board`)
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
  expect(ogTitle).toBe(`${job.title} at ${job.company}`)

  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description).toBeTruthy()
  expect(description!.length).toBeLessThanOrEqual(160)
})

test('the sitemap lists every approved job and nothing else', async ({ request }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  const xml = await response.text()

  // Restricted to the seeded rows. The sitemap is ISR-cached for 60s, and
  // employer.spec.ts creates and closes listings in parallel, so comparing
  // against *every* current row would race the cache rather than test anything.
  const SEEDED = "created_at < now() - interval '1 hour'"

  const { rows: approved } = await query<{ id: string }>(
    `select id from jobs where status = 'approved' and ${SEEDED}`
  )
  const { rows: hidden } = await query<{ id: string }>(
    `select id from jobs where status <> 'approved' and ${SEEDED}`
  )

  expect(approved.length).toBeGreaterThan(0)
  for (const job of approved) {
    expect(xml, `approved job ${job.id} should be in the sitemap`).toContain(`/jobs/${job.id}`)
  }
  for (const job of hidden) {
    expect(xml, `non-approved job ${job.id} must not be in the sitemap`).not.toContain(
      `/jobs/${job.id}`
    )
  }
})

// Regression guard: a `loading.tsx` at the *root* segment makes every route
// stream, and a streamed response has already sent its headers — so every 404
// in the app silently became a soft 404 (HTTP 200 + noindex). The home skeleton
// must stay scoped to the (home) route group.
test('an unknown route returns a real 404, not a soft one', async ({ request }) => {
  const response = await request.get('/no-such-page', { maxRedirects: 0 })

  expect(response.status()).toBe(404)
})

test('robots.txt keeps crawlers out of the private surfaces', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.status()).toBe(200)
  const text = await response.text()

  expect(text).toContain('Disallow: /dashboard/')
  expect(text).toContain('Disallow: /api/')
  expect(text).toContain('Sitemap:')
})
