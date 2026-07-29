import { expect, type Page } from '@playwright/test'

import { query } from './db'

/**
 * Every account a spec needs, created per test.
 *
 * The specs used to share the seeded `admin@demo.dev`, which made anything that
 * approves a listing contend over one account and one queue — three spec files
 * were marked `serial` purely to work around it, and it still failed under
 * parallelism. Giving each test its own accounts removes the coupling.
 */

export const PASSWORD = 'e2e-password-1234'

/** `.test` is a reserved TLD, so these can never collide with a real address. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}@example.test`
}

/**
 * `SiteNav` renders a placeholder until it hydrates, so its Sign out button
 * appearing is a precise signal that the client bundle has run — a click that
 * lands before then is silently swallowed.
 */
export async function waitForHydration(page: Page) {
  // Its own allowance rather than the generic expect timeout: this waits for
  // the client bundle *and* the session fetch behind it, which on the first
  // hit of a cold server takes longer than a normal assertion should.
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 25_000 })
}

const LANDING = {
  candidate: '/dashboard/applications',
  employer: '/dashboard/employer',
} as const

export async function register(
  page: Page,
  role: 'candidate' | 'employer',
  name = 'E2E User'
): Promise<string> {
  const email = uniqueEmail(role)

  await page.goto('/register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page
    .getByRole('radio', { name: role === 'candidate' ? "I'm looking for a job" : "I'm hiring" })
    .check()
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(LANDING[role])
  await waitForHydration(page)

  return email
}

/**
 * An admin of this test's own. `admin` is DB-assigned only (SPEC §3.1), so this
 * registers a normal account and promotes it with the exact SQL the README
 * documents for granting a real admin.
 */
export async function registerAdmin(page: Page): Promise<string> {
  const email = await register(page, 'candidate', 'E2E Admin')

  await query('update "user" set role = $1 where email = $2', ['admin', email])

  // No re-login: Better Auth reads the user row on every `getSession`, so the
  // promotion is live on the next request. Verified — signing out and back in
  // just doubled the scrypt work, which is what this suite is bottlenecked on.
  await page.goto('/dashboard/admin')
  await expect(page.getByRole('heading', { name: 'Moderation queue' })).toBeVisible()
  await waitForHydration(page)

  return email
}

export async function login(page: Page, email: string, landing: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(landing)
  await waitForHydration(page)
}

export async function signOut(page: Page) {
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
}

/** Posts a listing as the currently signed-in employer and returns its id. */
export async function postJob(page: Page, title: string, company = 'E2E KK') {
  await page.goto('/dashboard/employer/new')
  await waitForHydration(page)
  await page.getByLabel('Job title').fill(title)
  await page.getByLabel('Company').fill(company)
  await page.getByLabel('Location', { exact: true }).fill('Shibuya, Tokyo')
  await page.getByLabel('Location type').selectOption('hybrid')
  await page.getByLabel('Role type').selectOption('fulltime')
  await page.getByLabel('Minimum salary (JPY)').fill('7000000')
  await page.getByLabel('Maximum salary (JPY)').fill('9000000')
  await page.getByLabel('Tags').fill('TypeScript, React')
  await page.getByLabel('Description').fill('## About\n\nBuild **great** things with us.')
  await page.getByRole('button', { name: 'Submit for review' }).click()

  await expect(page).toHaveURL('/dashboard/employer')

  const { rows } = await query<{ id: string }>('select id from jobs where title = $1', [title])
  expect(rows[0], 'the listing should exist in the database').toBeTruthy()

  return rows[0]!.id
}

/** A queue card, scoped to the queue's own list — Sonner toasts are `<li>` too. */
export function queueCard(page: Page, title: string) {
  return page
    .getByRole('list', { name: 'Pending listings' })
    .locator('> li')
    .filter({ hasText: title })
}
