import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

// Harness check, kept deliberately: when a suite fails because Vitest cannot
// resolve `@/*` rather than because the logic broke, this is the test that says
// so — the other nine all import through the alias.
describe('test harness', () => {
  it('resolves the @/* alias and runs assertions', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
