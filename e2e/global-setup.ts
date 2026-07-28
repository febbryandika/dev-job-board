import { Pool } from 'pg'

/**
 * The specs register throwaway accounts under `@example.test` and never tear
 * them down, so across repeated local runs their listings pile up in the
 * moderation queue and the public list. That made later runs slower and
 * eventually flaky — not a product problem, but a suite that isn't
 * reproducible is a suite you stop trusting.
 *
 * Deleting the users cascades to their jobs and applications. `.test` is a
 * reserved TLD, so this can never match a real account, and the seeded demo
 * users are untouched.
 */
export default async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const { rowCount } = await pool.query("delete from \"user\" where email like '%@example.test'")
    if (rowCount) console.log(`[e2e] cleared ${rowCount} leftover test account(s)`)
  } finally {
    await pool.end()
  }
}
