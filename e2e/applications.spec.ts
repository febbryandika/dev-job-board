import { expect, test, type Page } from '@playwright/test'

import { query } from './db'

/**
 * Serial for the same reason as the moderation spec: these tests sign in as the
 * one seeded admin to approve listings, and share the global queue.
 */
test.describe.configure({ mode: 'serial' })

const PASSWORD = 'e2e-password-1234'
const RESUME = 'https://example.com/e2e-resume.pdf'

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`
}

/** SiteNav renders a placeholder until it hydrates — a precise "client bundle ran" signal. */
async function waitForHydration(page: Page) {
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

async function register(page: Page, role: 'candidate' | 'employer', landing: string) {
  const email = uniqueEmail(role)

  await page.goto('/register')
  await page.getByLabel('Name').fill(role === 'candidate' ? 'Apply E2E Candidate' : 'Apply E2E Co')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page
    .getByRole('radio', { name: role === 'candidate' ? "I'm looking for a job" : "I'm hiring" })
    .check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(landing)
  await waitForHydration(page)

  return email
}

async function login(page: Page, email: string, password: string, landing: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(landing)
  await waitForHydration(page)
}

async function signOut(page: Page) {
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
}

async function postJob(page: Page, title: string) {
  await page.goto('/dashboard/employer/new')
  await waitForHydration(page)
  await page.getByLabel('Job title').fill(title)
  await page.getByLabel('Company').fill('Apply E2E KK')
  await page.getByLabel('Location', { exact: true }).fill('Shibuya, Tokyo')
  await page.getByLabel('Description').fill('## Role\n\nWork with us.')
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  const { rows } = await query<{ id: string }>('select id from jobs where title = $1', [title])
  return rows[0]!.id
}

/** Approves through the real admin UI, so the whole loop is exercised. */
async function approveAsAdmin(page: Page, title: string) {
  await login(page, 'admin@demo.dev', 'demo1234', '/dashboard/admin')
  // Scoped to the queue list: Sonner toasts are `<li>` too, and would collide.
  const card = page
    .getByRole('list', { name: 'Pending listings' })
    .locator('> li')
    .filter({ hasText: title })
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(`Approved “${title}”`)).toBeVisible()
}

async function applyTo(page: Page, jobId: string, coverLetter?: string) {
  await page.goto(`/jobs/${jobId}`)
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Apply for this job' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Résumé URL').fill(RESUME)
  if (coverLetter) await page.getByLabel(/Cover letter/).fill(coverLetter)
  await page.getByRole('button', { name: 'Send application' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('the whole loop: post, approve, apply, employer sees the applicant', async ({ page }) => {
  const employerEmail = await register(page, 'employer', '/dashboard/employer')
  const title = `Apply Loop ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  const candidateEmail = await register(page, 'candidate', '/dashboard/applications')
  const coverLetter = 'I have shipped production TypeScript for four years.'
  await applyTo(page, jobId, coverLetter)

  // Exactly one row, carrying what was submitted.
  const { rows } = await query<{ resume_url: string; cover_letter: string | null }>(
    'select resume_url, cover_letter from applications where job_id = $1',
    [jobId]
  )
  expect(rows).toHaveLength(1)
  expect(rows[0]?.resume_url).toBe(RESUME)
  expect(rows[0]?.cover_letter).toBe(coverLetter)

  // The candidate's own list.
  await page.goto('/dashboard/applications')
  await expect(page.getByRole('cell', { name: title })).toBeVisible()

  // The employer sees the applicant's contact details and résumé.
  await signOut(page)
  await login(page, employerEmail, PASSWORD, '/dashboard/employer')
  await page.goto(`/dashboard/employer/${jobId}/applications`)

  await expect(page.getByText(candidateEmail)).toBeVisible()
  await expect(page.getByText(coverLetter)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open résumé' })).toHaveAttribute('href', RESUME)
})

test('a duplicate application is blocked by the database, not just the UI', async ({ page }) => {
  await register(page, 'employer', '/dashboard/employer')
  const title = `Apply Dup ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  await register(page, 'candidate', '/dashboard/applications')

  // Capture the genuine apply request so it can be replayed verbatim.
  let body: string | undefined
  let headers: Record<string, string> = {}
  await page.route(`**/jobs/${jobId}`, async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      body = request.postData() ?? undefined
      headers = await request.allHeaders()
    }
    await route.continue()
  })

  await applyTo(page, jobId)
  expect(body, 'the apply request should have been captured').toBeTruthy()

  // 1. On reload the UI offers the disabled state rather than the form.
  await page.goto(`/jobs/${jobId}`)
  await waitForHydration(page)
  await expect(page.getByRole('button', { name: 'Already applied' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Apply for this job' })).toBeHidden()

  // 2. The UI is only a convenience. Replaying the exact same action bypasses
  //    it entirely — `uq_application` is what actually stops the second row.
  const replay = await page.request.post(`/jobs/${jobId}`, { headers, data: body! })
  expect(replay.status(), 'the replay should be handled, not crash').toBeLessThan(500)

  const { rows } = await query<{ count: string }>(
    'select count(*)::text as count from applications where job_id = $1',
    [jobId]
  )
  expect(rows[0]?.count, 'the unique constraint must hold').toBe('1')
})

test('applying to a listing that is not approved fails', async ({ page }) => {
  await register(page, 'employer', '/dashboard/employer')
  const title = `Apply Pending ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await register(page, 'candidate', '/dashboard/applications')

  // The listing is still pending, so its page 404s and there is nothing to
  // apply to — the action would refuse it too.
  const response = await page.goto(`/jobs/${jobId}`)
  expect(response?.status()).toBe(404)

  const { rows } = await query<{ count: string }>(
    'select count(*)::text as count from applications where job_id = $1',
    [jobId]
  )
  expect(rows[0]?.count).toBe('0')
})

test('another employer cannot read the applicants or their contact details', async ({ page }) => {
  await register(page, 'employer', '/dashboard/employer')
  const title = `Apply Private ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  const candidateEmail = await register(page, 'candidate', '/dashboard/applications')
  await applyTo(page, jobId)

  await signOut(page)
  await register(page, 'employer', '/dashboard/employer')

  const response = await page.goto(`/dashboard/employer/${jobId}/applications`)
  expect(response?.status(), "another employer's applicants must not be reachable").toBe(404)

  // Not just hidden — the applicant's email is nowhere in what was served.
  const body = await page.content()
  expect(body, 'applicant contact details must not leak').not.toContain(candidateEmail)
})

test('the candidate empty state renders', async ({ page }) => {
  await register(page, 'candidate', '/dashboard/applications')

  await expect(page.getByText("You haven't applied to anything yet")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Browse open jobs' })).toBeVisible()
})

test('the employer empty state renders for a listing with no applicants', async ({ page }) => {
  await register(page, 'employer', '/dashboard/employer')
  const title = `Apply Empty ${Date.now()}`
  const jobId = await postJob(page, title)

  await page.goto(`/dashboard/employer/${jobId}/applications`)
  await expect(page.getByText('No applications yet')).toBeVisible()
})

test('an employer viewing a listing is told they cannot apply', async ({ page }) => {
  await register(page, 'employer', '/dashboard/employer')
  const title = `Apply RoleGate ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  await register(page, 'employer', '/dashboard/employer')
  await page.goto(`/jobs/${jobId}`)
  await waitForHydration(page)

  await expect(page.getByText('Only candidate accounts can apply')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply for this job' })).toBeHidden()
})
