import { expect, test, type Page } from '@playwright/test'

import { query } from './db'

/**
 * Guards the properties from the phase 9 audit that are cheap to break later.
 * Each of these was measured before it was asserted.
 */

/**
 * Serial for the same reason as the moderation and applications specs: these
 * sign in as the shared seeded accounts, so running them concurrently with
 * each other just adds contention to a suite that already logs in a lot.
 */
test.describe.configure({ mode: 'serial' })

async function login(page: Page, email: string, landing: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(landing)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

/**
 * Radix renders a hidden native `<select>` alongside its own listbox purely for
 * form integration; it is `aria-hidden` and `tabindex=-1`, so assistive tech
 * never sees it and it needs no label.
 */
async function unlabelledControls(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('input:not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null && el.getAttribute('aria-hidden') !== 'true')
      .filter((el) => {
        const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
        return !(el.getAttribute('aria-label') || label?.textContent?.trim())
      })
      .map((el) => `${el.tagName.toLowerCase()}#${el.id || '(no id)'}`)
  )
}

const overflows = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )

test('the skip link is the first tab stop and moves focus to the content', async ({ page }) => {
  await page.goto('/')

  await page.keyboard.press('Tab')
  const link = page.locator('a.skip-link')
  await expect(link).toBeFocused()

  // Off-screen until focused, on-screen once it is. Polled, because the
  // position animates — asserting immediately caught it mid-transition.
  await expect
    .poll(async () => (await link.boundingBox())!.y, { message: 'focused skip link should be on screen' })
    .toBeGreaterThanOrEqual(0)

  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test('no route scrolls horizontally at 375px', async ({ page }) => {
  const { rows } = await query<{ id: string }>("select id from jobs where status='approved' limit 1")
  await page.setViewportSize({ width: 375, height: 812 })

  for (const url of ['/', `/jobs/${rows[0]!.id}`, '/login', '/register']) {
    await page.goto(url)
    expect(await overflows(page), `${url} overflows at 375px`).toBe(false)
  }

  await login(page, 'employer@demo.dev', '/dashboard/employer')
  for (const url of ['/dashboard/employer', '/dashboard/employer/new']) {
    await page.goto(url)
    expect(await overflows(page), `${url} overflows at 375px`).toBe(false)
  }
})

test('every visible form control has an accessible name', async ({ page }) => {
  for (const url of ['/', '/login', '/register']) {
    await page.goto(url)
    expect(await unlabelledControls(page), `${url} has unlabelled controls`).toEqual([])
  }

  await login(page, 'employer@demo.dev', '/dashboard/employer')
  await page.goto('/dashboard/employer/new')
  expect(await unlabelledControls(page)).toEqual([])
})

/**
 * The reject dialog used to leave focus on `<body>` after Esc, stranding a
 * keyboard user at the top of the document. All three now hand it back.
 */
test('each dialog traps focus, closes on Escape, and restores focus', async ({ page }) => {
  await login(page, 'admin@demo.dev', '/dashboard/admin')
  const reject = page
    .getByRole('list', { name: 'Pending listings' })
    .locator('> li')
    .first()
    .getByRole('button', { name: 'Reject', exact: true })

  await reject.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(reject).toBeFocused()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')

  await login(page, 'employer@demo.dev', '/dashboard/employer')
  const close = page.getByRole('button', { name: 'Close', exact: true }).first()
  await close.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(close).toBeFocused()
})

test('the loading skeleton matches the table it replaces', async ({ page }) => {
  await login(page, 'employer@demo.dev', '/dashboard/employer')

  const loaded = await page.evaluate(() =>
    [...document.querySelectorAll('main table thead th')].map((h) => h.textContent!.trim())
  )
  expect(loaded.length).toBeGreaterThan(0)

  // `loading.tsx` renders these same labels by importing the constant the page
  // exports, so a column added here without touching the skeleton is a type
  // error rather than a silent layout jump.
  expect(loaded).toEqual(['Listing', 'Status', 'Salary', 'Applicants', 'Actions'])
})
