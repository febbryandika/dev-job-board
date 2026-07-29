import { expect, test } from '@playwright/test'

import { query } from './db'
import {
  login,
  postJob,
  queueCard,
  register,
  registerAdmin,
  signOut,
  waitForHydration,
} from './fixtures'

/**
 * The product loop, exactly as SPEC §10 specifies it — one narrative rather
 * than assertions scattered across specs, because the thing being tested is
 * that the *sequence* works end to end.
 */

const RESUME = 'https://example.com/loop-resume.pdf'

test('employer posts → admin approves → candidate applies → employer sees it', async ({ page }) => {
  // 1. Employer registers, posts a job, and it is NOT public.
  const employerEmail = await register(page, 'employer')
  const title = `Loop ${Date.now()}`
  const jobId = await postJob(page, title)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeHidden()
  expect((await page.goto(`/jobs/${jobId}`))?.status()).toBe(404)

  // 2. Admin approves it, and it appears on the public list.
  await signOut(page)
  await registerAdmin(page)
  await queueCard(page, title).getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(`Approved “${title}”`)).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  expect((await page.goto(`/jobs/${jobId}`))?.status()).toBe(200)

  // 3. Candidate registers, applies, and sees it in their own list.
  await signOut(page)
  const candidateEmail = await register(page, 'candidate')

  await page.goto(`/jobs/${jobId}`)
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Apply for this job' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Résumé URL').fill(RESUME)
  await page.getByLabel(/Cover letter/).fill('I would like to work on this.')
  await page.getByRole('button', { name: 'Send application' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.goto('/dashboard/applications')
  await expect(page.getByRole('cell', { name: title })).toBeVisible()

  // 4. A second attempt is blocked, and the employer sees the application.
  await page.goto(`/jobs/${jobId}`)
  await waitForHydration(page)
  await expect(page.getByRole('button', { name: 'Already applied' })).toBeDisabled()

  await signOut(page)
  await login(page, employerEmail, '/dashboard/employer')
  await page.goto(`/dashboard/employer/${jobId}/applications`)
  await expect(page.getByText(candidateEmail)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open résumé' })).toHaveAttribute('href', RESUME)

  // Exactly one row survived the duplicate attempt.
  const { rows } = await query<{ count: string }>(
    'select count(*)::text as count from applications where job_id = $1',
    [jobId]
  )
  expect(rows[0]?.count).toBe('1')
})

test('rejection with a note → employer edits → back to pending', async ({ page }) => {
  const employerEmail = await register(page, 'employer')
  const title = `Loop Reject ${Date.now()}`
  const jobId = await postJob(page, title)
  const note = 'Please add a salary range and describe the day-to-day work.'

  await signOut(page)
  await registerAdmin(page)

  const card = queueCard(page, title)
  await card.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Reason for rejection').fill(note)
  await page.getByRole('button', { name: 'Reject listing' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  const { rows: rejected } = await query<{ status: string; rejection_note: string | null }>(
    'select status, rejection_note from jobs where id = $1',
    [jobId]
  )
  expect(rejected[0]?.status).toBe('rejected')
  expect(rejected[0]?.rejection_note).toBe(note)

  // The employer reads the note and resubmits by editing.
  await signOut(page)
  await login(page, employerEmail, '/dashboard/employer')
  await page.goto(`/dashboard/employer/${jobId}/edit`)
  await waitForHydration(page)
  await expect(page.getByText(note)).toBeVisible()

  await page.getByLabel('Minimum salary (JPY)').fill('6000000')
  await page.getByRole('button', { name: 'Resubmit for review' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  const { rows: resubmitted } = await query<{ status: string }>(
    'select status from jobs where id = $1',
    [jobId]
  )
  expect(resubmitted[0]?.status, 'editing a rejected listing resubmits it').toBe('pending')
})
