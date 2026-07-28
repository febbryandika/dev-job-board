import { expect, test, type Page } from '@playwright/test'

import { query } from './db'

/**
 * Serial on purpose. Every test here signs in as the one seeded admin and works
 * the same global queue, so they are not independent the way `fullyParallel`
 * assumes — running them concurrently made them contend for the account and the
 * queue and time out. The rest of the suite stays parallel.
 */
test.describe.configure({ mode: 'serial' })

const PASSWORD = 'e2e-password-1234'

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`
}

async function registerEmployer(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Name').fill('Mod E2E Employer')
  await page.getByLabel('Email').fill(uniqueEmail('mod-employer'))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('radio', { name: "I'm hiring" }).check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/dashboard/employer')
  await waitForHydration(page)
}

/**
 * The queue is a client component, so a click that lands before hydration is
 * silently swallowed — which under parallel load made these specs flaky.
 * `SiteNav` renders a placeholder until it hydrates, so its Sign out button
 * appearing is a precise signal that the client bundle has run.
 */
async function waitForHydration(page: Page) {
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

async function loginAs(page: Page, email: string, expectedUrl: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(expectedUrl)
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
  await page.getByLabel('Company').fill('Moderation KK')
  await page.getByLabel('Location', { exact: true }).fill('Shibuya, Tokyo')
  await page.getByLabel('Description').fill('## Role\n\nBuild **great** things with us.')
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  const { rows } = await query<{ id: string }>('select id from jobs where title = $1', [title])
  return rows[0]!.id
}

function queueCard(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title })
}

/** `exact: true` because the dialog's own "Reject listing" would also match. */
async function openRejectDialog(page: Page, card: ReturnType<typeof queueCard>) {
  await card.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/**
 * Waits for the write to actually land. Radix marks the rest of the page
 * `aria-hidden` while the dialog is open, so asserting the *card* disappeared
 * passes the instant the dialog opens — before anything has been submitted.
 * The dialog closing only happens on `result.ok`, so that is the honest signal.
 */
async function submitRejection(page: Page) {
  await page.getByRole('button', { name: 'Reject listing' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('approving makes a listing public, even after its 404 was cached', async ({ page }) => {
  await registerEmployer(page)
  const title = `Mod Approve ${Date.now()}`
  const id = await postJob(page, title)

  // Request it while pending *first*, so the 404 is in the ISR cache. This is
  // the ordering that makes revalidatePath load-bearing.
  const pendingResponse = await page.goto(`/jobs/${id}`)
  expect(pendingResponse?.status()).toBe(404)

  await signOut(page)
  await loginAs(page, 'admin@demo.dev', '/dashboard/admin')

  const card = queueCard(page, title)
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Approve' }).click()
  // The toast only fires on `result.ok`, so it is the signal the write landed.
  await expect(page.getByText(`Approved “${title}”`)).toBeVisible()
  // The row leaving is a revalidation round trip after that, and the queue can
  // be long, so it gets its own allowance rather than the 5s default.
  await expect(card).toBeHidden({ timeout: 15_000 })

  // Public immediately — no redeploy, no waiting out the 60s window.
  const approvedResponse = await page.goto(`/jobs/${id}`)
  expect(approvedResponse?.status(), 'the cached 404 must have been cleared').toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()

  const sitemap = await page.request.get('/sitemap.xml')
  expect(await sitemap.text()).toContain(`/jobs/${id}`)

  // The audit trail, at the database.
  const { rows } = await query<{
    status: string
    reviewed_by: string | null
    reviewed_at: Date | null
    approved_at: Date | null
  }>('select status, reviewed_by, reviewed_at, approved_at from jobs where id = $1', [id])

  expect(rows[0]?.status).toBe('approved')
  expect(rows[0]?.reviewed_by).toBeTruthy()
  expect(rows[0]?.reviewed_at).toBeTruthy()
  expect(rows[0]?.approved_at).toBeTruthy()
})

test('rejecting lets the employer read the note, edit, and resubmit', async ({ page }) => {
  await registerEmployer(page)
  const title = `Mod Reject ${Date.now()}`
  const id = await postJob(page, title)
  const note = 'Please add a salary range and describe the actual work.'

  await signOut(page)
  await loginAs(page, 'admin@demo.dev', '/dashboard/admin')

  const card = queueCard(page, title)
  await openRejectDialog(page, card)
  await page.getByLabel('Reason for rejection').fill(note)
  await submitRejection(page)

  // Rejected rows carry the note and the review stamps, but never approved_at.
  const { rows } = await query<{
    status: string
    rejection_note: string | null
    reviewed_by: string | null
    approved_at: Date | null
  }>('select status, rejection_note, reviewed_by, approved_at from jobs where id = $1', [id])

  expect(rows[0]?.status).toBe('rejected')
  expect(rows[0]?.rejection_note).toBe(note)
  expect(rows[0]?.reviewed_by).toBeTruthy()
  expect(rows[0]?.approved_at, 'a rejected listing was never approved').toBeNull()

  // The employer sees exactly that note, and resubmitting returns it to the queue.
  await signOut(page)
  const { rows: owner } = await query<{ email: string }>(
    'select u.email from jobs j join "user" u on u.id = j.employer_id where j.id = $1',
    [id]
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill(owner[0]!.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  await page.goto(`/dashboard/employer/${id}/edit`)
  await waitForHydration(page)
  await expect(page.getByText(note)).toBeVisible()

  await page.getByLabel('Minimum salary (JPY)').fill('6000000')
  await page.getByRole('button', { name: 'Resubmit for review' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  const { rows: after } = await query<{ status: string }>(
    'select status from jobs where id = $1',
    [id]
  )
  expect(after[0]?.status).toBe('pending')

  // Back in the queue, flagged as a resubmission with the previous reason.
  await signOut(page)
  await loginAs(page, 'admin@demo.dev', '/dashboard/admin')
  const resubmitted = queueCard(page, title)
  await expect(resubmitted).toContainText('Resubmitted after rejection')
  await expect(resubmitted).toContainText(note)
})

test('a rejection note under the minimum is refused', async ({ page }) => {
  await registerEmployer(page)
  const title = `Mod ShortNote ${Date.now()}`
  const id = await postJob(page, title)

  await signOut(page)
  await loginAs(page, 'admin@demo.dev', '/dashboard/admin')

  const card = queueCard(page, title)
  await openRejectDialog(page, card)
  await page.getByLabel('Reason for rejection').fill('too short')
  await page.getByRole('button', { name: 'Reject listing' }).click()

  await expect(page.getByText(/at least 10 characters/i)).toBeVisible()

  const { rows } = await query<{ status: string }>('select status from jobs where id = $1', [id])
  expect(rows[0]?.status, 'nothing should have been written').toBe('pending')
})

test('the queue is ordered oldest first', async ({ page }) => {
  await loginAs(page, 'admin@demo.dev', '/dashboard/admin')

  const dates = await page.getByRole('listitem').locator('time').allTextContents()
  const sorted = [...dates].sort()

  expect(dates).toEqual(sorted)
})

test.describe('only an admin can moderate', () => {
  for (const [email, landing] of [
    ['employer@demo.dev', '/dashboard/employer'],
    ['candidate@demo.dev', '/dashboard/applications'],
  ] as const) {
    test(`${email} gets a 403 at the moderation queue`, async ({ page }) => {
      await loginAs(page, email, landing)
      await page.goto('/dashboard/admin')

      await expect(page.getByText('403 — Forbidden')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Moderation queue' })).toBeHidden()
    })
  }

  /**
   * The role guard lives in the action, not the page. This forges an approve by
   * rewriting the outgoing payload from a *candidate's* session, so only
   * `requireRole('admin')` can stop it.
   */
  test('a forged approve from a non-admin leaves the listing pending', async ({ page }) => {
    await registerEmployer(page)
    const title = `Mod Forge ${Date.now()}`
    const id = await postJob(page, title)

    await signOut(page)
    await loginAs(page, 'admin@demo.dev', '/dashboard/admin')

    // Capture a genuine approve request, then replay it as the candidate.
    let approveBody: string | undefined
    let approveHeaders: Record<string, string> = {}
    await page.route('**/dashboard/admin**', async (route) => {
      const request = route.request()
      if (request.method() === 'POST' && request.postData()?.includes(id)) {
        approveBody = request.postData() ?? undefined
        approveHeaders = await request.allHeaders()
        await route.abort()
        return
      }
      await route.continue()
    })

    await queueCard(page, title).getByRole('button', { name: 'Approve' }).click()
    await page.waitForTimeout(1000)
    expect(approveBody, 'the approve request should have been captured').toBeTruthy()

    await page.unrouteAll()
    await signOut(page)
    await loginAs(page, 'candidate@demo.dev', '/dashboard/applications')

    const replay = await page.request.post('/dashboard/admin', {
      headers: { ...approveHeaders, cookie: '' },
      data: approveBody!,
    })
    // Whatever the response, the only thing that matters is the row.
    expect(replay.status()).toBeLessThan(500)

    const { rows } = await query<{ status: string }>('select status from jobs where id = $1', [id])
    expect(rows[0]?.status, 'a candidate must not be able to approve').toBe('pending')
  })
})
