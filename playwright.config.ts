import { existsSync } from 'node:fs'

import { defineConfig, devices } from '@playwright/test'

// Specs that need to pick a job by status query Postgres directly, so they
// need DATABASE_URL. Node's built-in loader avoids adding dotenv.
if (existsSync('.env')) process.loadEnvFile('.env')

const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // These are journey tests: several register/sign-out/sign-in cycles each,
  // against a dev server with workers competing for it. Playwright's 30s
  // default is tight for that and made long-but-correct tests fail.
  timeout: 60_000,
  // Sign-up lands via two redirects (/dashboard → the role's page), so URL and
  // visibility assertions need more than the 5s default on a loaded dev server.
  expect: { timeout: 10_000 },
  // Clears accounts left behind by previous runs, so a repeated run starts from
  // the same state as the first one.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
