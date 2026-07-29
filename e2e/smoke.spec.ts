import { expect, test } from '@playwright/test'

import { query } from './db'
import { register } from './fixtures'

// The cheapest possible failure signal: the app boots and the shared shell
// renders. When this fails, nothing in `loop.spec.ts` is worth reading yet.
test('the public shell renders', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Dev Job Board')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Developer jobs in Japan')
})

/**
 * Regression guard. `SiteNav` reads a browser-only session store, so before it
 * deferred to after mount the server rendered its placeholder while the client's
 * first render produced the signed-in nav — a hydration mismatch that made React
 * discard and rebuild the header subtree on every page load.
 */
test('no hydration mismatch on the shared header', async ({ page }) => {
  const hydrationErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydrat|didn't match/i.test(m.text())) {
      hydrationErrors.push(m.text().slice(0, 200))
    }
  })

  await register(page, 'employer')

  // Signed in is the case that used to break: the store has a session on the
  // client's first render, the server has none. The job detail page is included
  // because ApplyDialog is a second session-reading island on a *prerendered*
  // page, where a mismatch is easiest to introduce.
  const { rows } = await query<{ id: string }>(
    "select id from jobs where status = 'approved' limit 1"
  )

  for (const url of ['/', '/dashboard/employer', `/jobs/${rows[0]!.id}`]) {
    await page.goto(url)
    // The header's Sign out button only renders after hydration, so waiting on
    // it is a deterministic signal — `networkidle` is not, and hung here.
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await page.waitForTimeout(600)
  }

  expect(hydrationErrors, hydrationErrors.join(' | ')).toEqual([])
})
