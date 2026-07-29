import { expect, test, type Page } from '@playwright/test'

import { query } from './db'
import {
  postJob,
  queueCard,
  register,
  registerAdmin,
  signOut,
} from './fixtures'

/** `exact: true` because the dialog's own "Reject listing" would also match. */
async function openRejectDialog(page: Page, card: ReturnType<typeof queueCard>) {
  await card.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('approving makes a listing public, even after its 404 was cached', async ({ page }) => {
  await register(page, 'employer')
  const title = `Mod Approve ${Date.now()}`
  const id = await postJob(page, title)

  // Request it while pending *first*, so the 404 is in the ISR cache. This is
  // the ordering that makes revalidatePath load-bearing.
  const pendingResponse = await page.goto(`/jobs/${id}`)
  expect(pendingResponse?.status()).toBe(404)

  await signOut(page)
  await registerAdmin(page)

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

test('a rejection note under the minimum is refused', async ({ page }) => {
  await register(page, 'employer')
  const title = `Mod ShortNote ${Date.now()}`
  const id = await postJob(page, title)

  await signOut(page)
  await registerAdmin(page)

  const card = queueCard(page, title)
  await openRejectDialog(page, card)
  await page.getByLabel('Reason for rejection').fill('too short')
  await page.getByRole('button', { name: 'Reject listing' }).click()

  await expect(page.getByText(/at least 10 characters/i)).toBeVisible()

  const { rows } = await query<{ status: string }>('select status from jobs where id = $1', [id])
  expect(rows[0]?.status, 'nothing should have been written').toBe('pending')
})

test('the queue is ordered oldest first', async ({ page }) => {
  await registerAdmin(page)

  const dates = await page.getByRole('listitem').locator('time').allTextContents()
  const sorted = [...dates].sort()

  expect(dates).toEqual(sorted)
})

test.describe('only an admin can moderate', () => {
  for (const role of ['employer', 'candidate'] as const) {
    test(`a ${role} gets a 403 at the moderation queue`, async ({ page }) => {
      await register(page, role)
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
    await register(page, 'employer')
    const title = `Mod Forge ${Date.now()}`
    const id = await postJob(page, title)

    await signOut(page)
    await registerAdmin(page)

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
    await register(page, 'candidate')

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
