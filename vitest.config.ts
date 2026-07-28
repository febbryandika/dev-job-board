import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Resolves the `@/*` alias from tsconfig.json (native in Vite 7+/Vitest 4).
  resolve: { tsconfigPaths: true },
  test: {
    // Unit tests here are pure functions (status transitions, Zod schemas,
    // query predicates, the JPY formatter) — no DOM needed.
    environment: 'node',
    // Explicit include: the default glob would also pick up the Playwright
    // specs in e2e/, which must only run under `pnpm test:e2e`.
    include: ['src/tests/**/*.test.ts'],
  },
})
