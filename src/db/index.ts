import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as authSchema from './auth-schema'
import * as appSchema from './schema'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.')
}

// Next.js hot-reloads modules in development, which would otherwise leak a new
// pool on every reload until Postgres refuses connections.
const globalForDb = globalThis as unknown as { pool?: Pool }

const pool = globalForDb.pool ?? new Pool({ connectionString: databaseUrl })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool
}

export const schema = { ...authSchema, ...appSchema }

export const db = drizzle(pool, { schema })
