import { Pool } from 'pg'

/**
 * Shared Postgres access for the E2E specs, which need to assert on rows the UI
 * never shows (a pending listing's status, another employer's untouched row).
 *
 * One lazily-created pool per worker process, and deliberately **no
 * `afterAll` teardown**: with `fullyParallel`, a worker can be handed more
 * tests from the same file after that file's `afterAll` has run, and a pool
 * that has been `end()`ed throws on the next query. Playwright terminates its
 * workers, so the connections go with them.
 */
let pool: Pool | undefined

export function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  return pool.query<T>(text, params)
}
