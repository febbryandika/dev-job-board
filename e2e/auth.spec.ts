import { expect, test } from '@playwright/test'

// A fresh account per run, so the spec is re-runnable without teardown.
// `.test` is a reserved TLD, so these can never be real addresses.
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`
}

const PASSWORD = 'e2e-password-1234'

test('register, then log out, then log back in', async ({ page }) => {
  const email = uniqueEmail()

  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Candidate')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('radio', { name: "I'm looking for a job" }).check()
  await page.getByRole('button', { name: 'Create account' }).click()

  // The role redirector sends a candidate to their applications list.
  await expect(page).toHaveURL('/dashboard/applications')
  await expect(page.getByRole('heading', { level: 1, name: 'My applications' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()

  // The session is genuinely gone, not just hidden in the header.
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard/applications')
})

test('a registered employer lands on the employer dashboard', async ({ page }) => {
  const email = uniqueEmail()

  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Employer')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('radio', { name: "I'm hiring" }).check()
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL('/dashboard/employer')
  await expect(page.getByRole('heading', { level: 1, name: 'My listings' })).toBeVisible()
})

test('a wrong password is rejected without leaving the login page', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('candidate@demo.dev')
  await page.getByLabel('Password').fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page.getByText('Incorrect email or password')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('a candidate hitting the admin queue gets a 403, not the queue', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('candidate@demo.dev')
  await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard/applications')

  await page.goto('/dashboard/admin')

  await expect(page.getByText('403 — Forbidden')).toBeVisible()
  await expect(page.getByRole('heading', { name: /don't have access/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Moderation queue' })).toBeHidden()
})
