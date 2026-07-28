import { expect, test } from '@playwright/test'

// Placeholder until phase 11 replaces it with the real product loop:
// employer posts → admin approves → job appears publicly → candidate applies.
// For now this proves the app boots and the shared shell renders.
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

  await page.goto('/login')
  await page.getByLabel('Email').fill('employer@demo.dev')
  await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  // Signed in is the case that used to break: the store has a session on the
  // client's first render, the server has none.
  for (const url of ['/', '/dashboard/employer']) {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
  }

  expect(hydrationErrors, hydrationErrors.join(' | ')).toEqual([])
})
