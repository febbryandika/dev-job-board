import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

// Phase 0 has no business logic yet. This asserts the test runner and the
// `@/*` path alias both work, so later suites (canTransition, Zod schemas,
// the JPY formatter) have a known-good harness to land in.
describe('test harness', () => {
  it('resolves the @/* alias and runs assertions', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
