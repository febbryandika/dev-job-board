import { expect, test } from '@playwright/test'

// Placeholder until phase 11 replaces it with the real product loop:
// employer posts → admin approves → job appears publicly → candidate applies.
// For now this proves the app boots and the shared shell renders.
test('the public shell renders', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Dev Job Board')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Dev Job Board' })).toBeVisible()
})
