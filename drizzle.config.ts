import { existsSync } from 'node:fs'

import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Next.js, so nothing has loaded .env for us.
// Node's built-in loader avoids pulling in dotenv just for this.
if (existsSync('.env')) process.loadEnvFile('.env')

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  // Generated SQL lives here and is committed — never `drizzle-kit push`. SPEC §11.
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
})
