import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db, schema } from '@/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // `input: false` is the whole point: role must never be settable from a
      // client payload. Signup assigns candidate/employer through a server-side
      // action; admin is assigned in the DB only. SPEC §7.
      role: { type: 'string', defaultValue: 'candidate', input: false },
    },
  },
})
