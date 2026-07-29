import { execFileSync } from 'node:child_process'

import { Pool } from 'pg'

/**
 * Restores a known database state before every run.
 *
 * Two things drift otherwise, and both made the suite non-reproducible:
 *
 * 1. The specs register throwaway `@example.test` accounts and never tear them
 *    down, so their listings pile up in the moderation queue and public list.
 * 2. More subtly, the moderation and applications specs **approve and reject
 *    the seeded `pending` listings**, permanently. After enough runs there are
 *    none left in the state those specs assume, and tests that passed on a
 *    fresh database start failing for reasons that have nothing to do with the
 *    code under test.
 *
 * Deleting the accounts cascades to their jobs and applications; reseeding puts
 * the 20 listings back at 12 approved / 4 pending / 2 rejected / 2 closed.
 */
export default async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const { rowCount } = await pool.query("delete from \"user\" where email like '%@example.test'")
    if (rowCount) console.log(`[e2e] cleared ${rowCount} leftover test account(s)`)
  } finally {
    await pool.end()
  }

  execFileSync('pnpm', ['db:seed'], { stdio: 'pipe' })
  console.log('[e2e] database reseeded to the baseline')
}
