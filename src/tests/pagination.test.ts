import { describe, expect, it } from 'vitest'

import { pageWindow } from '@/components/pagination'

describe('pageWindow', () => {
  it.each([1, 2, 5, 7])('lists every page without gaps when there are %i', (total) => {
    expect(pageWindow(1, total)).toEqual(Array.from({ length: total }, (_, i) => i + 1))
  })

  it('collapses the tail when the current page is near the start', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20])
  })

  it('collapses the head when the current page is near the end', () => {
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20])
  })

  it('collapses both sides in the middle', () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
  })

  // Off-by-one at the seams: page 3 of 20 is adjacent to page 1, so there is
  // no gap to elide on the left even though the page count is large.
  it('does not insert a gap of a single page', () => {
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, null, 20])
    expect(pageWindow(18, 20)).toEqual([1, null, 17, 18, 19, 20])
  })

  it('never emits a page outside the range', () => {
    for (const total of [1, 8, 20, 137]) {
      for (const current of [1, 2, Math.ceil(total / 2), total]) {
        const pages = pageWindow(current, total).filter((p) => p !== null)
        expect(Math.min(...pages)).toBeGreaterThanOrEqual(1)
        expect(Math.max(...pages)).toBeLessThanOrEqual(total)
      }
    }
  })

  it('always includes the current page and both endpoints', () => {
    const pages = pageWindow(57, 137)
    expect(pages).toContain(57)
    expect(pages).toContain(1)
    expect(pages).toContain(137)
  })

  it('never repeats a page', () => {
    const pages = pageWindow(2, 20).filter((p) => p !== null)
    expect(new Set(pages).size).toBe(pages.length)
  })
})
