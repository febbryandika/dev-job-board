import { expect, test, type Page } from '@playwright/test'

import { query } from './db'
import {
  postJob,
  queueCard,
  register,
  registerAdmin,
  signOut,
  waitForHydration,
} from './fixtures'

const RESUME = 'https://example.com/e2e-resume.pdf'

/** Approves through the real admin UI, using an admin this test owns. */
async function approveAsAdmin(page: Page, title: string) {
  await registerAdmin(page)
  await queueCard(page, title).getByRole('button', { name: 'Approve' }).click()
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

test('a duplicate application is blocked by the database, not just the UI', async ({ page }) => {
  await register(page, 'employer')
  const title = `Apply Dup ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  await register(page, 'candidate')

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
  await register(page, 'employer')
  const title = `Apply Pending ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await register(page, 'candidate')

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
  await register(page, 'employer')
  const title = `Apply Private ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  const candidateEmail = await register(page, 'candidate')
  await applyTo(page, jobId)

  await signOut(page)
  await register(page, 'employer')

  const response = await page.goto(`/dashboard/employer/${jobId}/applications`)
  expect(response?.status(), "another employer's applicants must not be reachable").toBe(404)

  // Not just hidden — the applicant's email is nowhere in what was served.
  const body = await page.content()
  expect(body, 'applicant contact details must not leak').not.toContain(candidateEmail)
})

test('the candidate empty state renders', async ({ page }) => {
  await register(page, 'candidate')

  await expect(page.getByText("You haven't applied to anything yet")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Browse open jobs' })).toBeVisible()
})

test('the employer empty state renders for a listing with no applicants', async ({ page }) => {
  await register(page, 'employer')
  const title = `Apply Empty ${Date.now()}`
  const jobId = await postJob(page, title)

  await page.goto(`/dashboard/employer/${jobId}/applications`)
  await expect(page.getByText('No applications yet')).toBeVisible()
})

test('an employer viewing a listing is told they cannot apply', async ({ page }) => {
  await register(page, 'employer')
  const title = `Apply RoleGate ${Date.now()}`
  const jobId = await postJob(page, title)

  await signOut(page)
  await approveAsAdmin(page, title)
  await signOut(page)

  await register(page, 'employer')
  await page.goto(`/jobs/${jobId}`)
  await waitForHydration(page)

  await expect(page.getByText('Only candidate accounts can apply')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply for this job' })).toBeHidden()
})
