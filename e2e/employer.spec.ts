import { expect, test } from '@playwright/test'

import { query } from './db'
import { postJob, register, signOut } from './fixtures'

test('a posted listing starts pending and is not publicly visible', async ({ page }) => {
  await register(page, 'employer')
  const title = `E2E Pending ${Date.now()}`
  const id = await postJob(page, title)

  // The dashboard row shows it awaiting review.
  const row = page.getByRole('row', { name: new RegExp(title) })
  await expect(row).toContainText('Pending review')
  await expect(row).toContainText('0')

  // Status is pending in the database, not just in the badge.
  const { rows } = await query<{ status: string }>('select status from jobs where id = $1', [
    id,
  ])
  expect(rows[0]?.status).toBe('pending')

  // The requirement: not on the public list, and its detail page 404s.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeHidden()

  const response = await page.goto(`/jobs/${id}`)
  expect(response?.status(), 'a pending listing must not be publicly reachable').toBe(404)
})

test('editing a pending listing keeps it pending', async ({ page }) => {
  await register(page, 'employer')
  const title = `E2E Edit ${Date.now()}`
  const id = await postJob(page, title)

  await page.goto(`/dashboard/employer/${id}/edit`)
  await page.getByLabel('Job title').fill(`${title} (revised)`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL('/dashboard/employer')

  const { rows } = await query<{ status: string; title: string }>(
    'select status, title from jobs where id = $1',
    [id]
  )
  expect(rows[0]?.title).toBe(`${title} (revised)`)
  expect(rows[0]?.status).toBe('pending')
})

test('validation errors render next to the field', async ({ page }) => {
  await register(page, 'employer')

  await page.goto('/dashboard/employer/new')
  await page.getByLabel('Job title').fill('Backwards Salary')
  await page.getByLabel('Company').fill('E2E Test KK')
  await page.getByLabel('Location', { exact: true }).fill('Osaka')
  await page.getByLabel('Minimum salary (JPY)').fill('9000000')
  await page.getByLabel('Maximum salary (JPY)').fill('4000000')
  await page.getByLabel('Description').fill('Some description.')
  await page.getByRole('button', { name: 'Submit for review' }).click()

  await expect(page.getByText('Minimum salary cannot be greater than maximum salary')).toBeVisible()
  await expect(page).toHaveURL('/dashboard/employer/new')
})

// The ownership check is enforced in SQL, so it has to be tested by driving the
// URL directly — the UI never offers these buttons for someone else's listing.
test('another employer cannot reach or edit a listing they do not own', async ({ page }) => {
  await register(page, 'employer')
  const title = `E2E Owned ${Date.now()}`
  const id = await postJob(page, title)

  // A different employer entirely.
  await signOut(page)
  await register(page, 'employer')

  const response = await page.goto(`/dashboard/employer/${id}/edit`)
  expect(response?.status(), "another employer's listing must not be reachable").toBe(404)

  // And the row is untouched.
  const { rows } = await query<{ title: string; status: string }>(
    'select title, status from jobs where id = $1',
    [id]
  )
  expect(rows[0]?.title).toBe(title)
  expect(rows[0]?.status).toBe('pending')
})

/**
 * The strongest form of the ownership test: a real employer session, a real
 * form, and the outgoing Server Action payload rewritten in flight to carry
 * *another* employer's job id. The UI never offered this — the request is
 * forged — so only the `employerId` predicate inside the UPDATE can stop it.
 */
test('a forged action payload cannot edit another employer listing', async ({ page }) => {
  await register(page, 'employer')
  const victimTitle = `E2E Victim ${Date.now()}`
  const victimId = await postJob(page, victimTitle)

  await signOut(page)
  await register(page, 'employer')
  const attackerId = await postJob(page, `E2E Attacker ${Date.now()}`)

  let swapped = false
  await page.route('**/dashboard/employer/**', async (route) => {
    const body = route.request().postData()

    if (route.request().method() === 'POST' && body?.includes(attackerId)) {
      swapped = true
      await route.continue({ postData: body.replaceAll(attackerId, victimId) })
      return
    }
    await route.continue()
  })

  await page.goto(`/dashboard/employer/${attackerId}/edit`)
  await page.getByLabel('Job title').fill('PWNED BY ATTACKER')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('This listing can no longer be edited.')).toBeVisible()

  // The test is worthless unless the swap actually happened.
  expect(swapped, 'the action payload should have been rewritten').toBe(true)

  const { rows } = await query<{ title: string }>('select title from jobs where id = $1', [
    victimId,
  ])
  expect(rows[0]?.title, "the victim's listing must be untouched").toBe(victimTitle)
})

test('an approved listing cannot be edited', async ({ page }) => {
  await register(page, 'employer')
  const title = `E2E Approved ${Date.now()}`
  const id = await postJob(page, title)

  // Approve it the way the admin will in phase 6.
  await query("update jobs set status = 'approved', approved_at = now() where id = $1", [id])

  // The edit route bounces rather than showing a form that could never submit.
  await page.goto(`/dashboard/employer/${id}/edit`)
  await expect(page).toHaveURL('/dashboard/employer')

  // The dashboard offers Close, not Edit.
  const row = page.getByRole('row', { name: new RegExp(title) })
  await expect(row.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect(row.getByRole('link', { name: 'Edit' })).toBeHidden()
})

test('closing an approved listing removes it from the public site immediately', async ({
  page,
}) => {
  await register(page, 'employer')
  const title = `E2E Close ${Date.now()}`
  const id = await postJob(page, title)

  await query("update jobs set status = 'approved', approved_at = now() where id = $1", [id])

  // Publicly visible while approved.
  await page.goto(`/jobs/${id}`)
  expect((await page.goto(`/jobs/${id}`))?.status()).toBe(200)

  await page.goto('/dashboard/employer')
  const row = page.getByRole('row', { name: new RegExp(title) })
  await row.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toContainText(title)
  await page.getByRole('button', { name: 'Close listing' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()

  const { rows } = await query<{ status: string }>('select status from jobs where id = $1', [
    id,
  ])
  expect(rows[0]?.status).toBe('closed')

  // Immediately, not after the 60s revalidate window — that is what the
  // revalidatePath calls in closeJob are for.
  const response = await page.goto(`/jobs/${id}`)
  expect(response?.status(), 'a closed listing must leave the public site at once').toBe(404)
})
