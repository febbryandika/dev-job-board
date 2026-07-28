import { expect, test } from '@playwright/test'

// Titles the seed gives to listings that are NOT approved. None may ever
// appear on the public list, under any filter. SPEC §3.2, §9.
/** The job grid only — `main ul > li` would also match each card's badge and tag lists. */
function jobCards(page: import('@playwright/test').Page) {
  return page.getByRole('list', { name: 'Job listings' }).locator('> li')
}

/**
 * `count()` does not auto-wait, so calling it straight after a navigation can
 * return 0 while loading.tsx is still on screen. Wait for the grid first.
 */
async function countJobCards(page: import('@playwright/test').Page) {
  await expect(page.getByRole('list', { name: 'Job listings' })).toBeVisible()
  return jobCards(page).count()
}

const NON_PUBLIC_TITLES = [
  'Rust Systems Engineer', // pending
  'Machine Learning Engineer', // pending
  'Technical Writer', // pending
  'Security Engineer', // pending
  'Web Developer', // rejected
  'Ninja Rockstar Developer 🚀', // rejected
  'Infrastructure Engineer', // closed
  'Product Designer (Engineering-adjacent)', // closed
]

test('lists approved jobs and hides every other status', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Developer jobs in Japan')
  await expect(page.getByRole('heading', { level: 2, name: 'Senior Frontend Engineer' })).toBeVisible()

  // Exact heading match, not a substring scan: the approved "Junior Web
  // Developer" contains the rejected "Web Developer".
  const headings = await page.getByRole('heading', { level: 2 }).allInnerTexts()

  for (const title of NON_PUBLIC_TITLES) {
    expect(headings, `"${title}" is not approved and must not be public`).not.toContain(title)
  }
})

test('search narrows the list and lives in the URL', async ({ page }) => {
  await page.goto('/')
  const before = await countJobCards(page)

  await page.getByLabel('Search').fill('Kaizen')
  await page.getByRole('button', { name: 'Search' }).click()

  await expect(page).toHaveURL(/[?&]q=Kaizen/)
  const after = await countJobCards(page)
  expect(after).toBeLessThan(before)
  await expect(page.getByText('Kaizen Labs').first()).toBeVisible()
})

test('a shared filtered URL renders the same list on a cold load', async ({ page }) => {
  await page.goto('/?locationType=remote')

  // Every card on this page must be a remote listing.
  const cards = jobCards(page)
  const count = await countJobCards(page)
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toContainText('Remote')
  }
})

test('the back button restores the previous filter', async ({ page }) => {
  await page.goto('/')
  await page.goto('/?roleType=contract')
  await expect(page).toHaveURL(/roleType=contract/)

  await page.goBack()
  await expect(page).toHaveURL('/')
  // Full-time listings are back, so the filter really was undone. Scoped to the
  // grid: Radix Select renders hidden <option> elements with the same labels.
  await expect(jobCards(page).filter({ hasText: 'Full-time' }).first()).toBeVisible()
})

test('junk search params render the page instead of erroring', async ({ page }) => {
  const response = await page.goto('/?page=abc&locationType=mars&q=%25')

  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // "%" is escaped, so it matches nothing rather than everything.
  await expect(page.getByText('No jobs match these filters')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Clear filters' })).toBeVisible()
})

test('an out-of-range page shows the empty state, not an error', async ({ page }) => {
  const response = await page.goto('/?page=999')

  expect(response?.status()).toBe(200)
  // Not "No listings yet" — listings exist, this page is just past the end.
  await expect(page.getByText('Nothing on this page')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to the first page' })).toBeVisible()
})

test('clear filters returns to the unfiltered list', async ({ page }) => {
  await page.goto('/?q=nothing-matches-this')
  await page.getByRole('link', { name: 'Clear filters' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Senior Frontend Engineer' })).toBeVisible()
})

test('the list is usable at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()

  // The page must not scroll sideways at the narrowest supported width.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflows).toBe(false)
})
