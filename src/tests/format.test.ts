import { describe, expect, it } from 'vitest'

import { formatJpy, formatPostedDate, formatSalaryRange } from '@/lib/format'

describe('formatJpy', () => {
  it('renders whole yen with grouping and no decimals', () => {
    expect(formatJpy(6_000_000)).toBe('￥6,000,000')
    expect(formatJpy(0)).toBe('￥0')
    expect(formatJpy(1_234)).toBe('￥1,234')
  })

  it('does not show fractional yen', () => {
    expect(formatJpy(1_234.56)).toBe('￥1,235')
  })
})

describe('formatSalaryRange — all four open-ended cases', () => {
  it('renders a closed range', () => {
    expect(formatSalaryRange(6_000_000, 9_000_000)).toBe('￥6,000,000 – ￥9,000,000')
  })

  it('renders a minimum only', () => {
    expect(formatSalaryRange(6_000_000, null)).toBe('￥6,000,000+')
  })

  it('renders a maximum only', () => {
    expect(formatSalaryRange(null, 9_000_000)).toBe('Up to ￥9,000,000')
  })

  it('renders neither', () => {
    expect(formatSalaryRange(null, null)).toBe('Salary not specified')
  })

  // The DB columns are nullable and Drizzle gives back null, but undefined
  // shows up when a caller spreads a partial row.
  it('treats undefined like null', () => {
    expect(formatSalaryRange(undefined, undefined)).toBe('Salary not specified')
    expect(formatSalaryRange(5_000_000, undefined)).toBe('￥5,000,000+')
  })

  // 0 is falsy — a naive truthiness check would report "not specified" for an
  // unpaid internship rather than ￥0.
  it('treats a zero salary as specified', () => {
    expect(formatSalaryRange(0, 0)).toBe('￥0 – ￥0')
    expect(formatSalaryRange(0, null)).toBe('￥0+')
  })

  it('renders an equal min and max as a range, not a single figure', () => {
    expect(formatSalaryRange(9_000_000, 9_000_000)).toBe('￥9,000,000 – ￥9,000,000')
  })
})

describe('formatPostedDate', () => {
  const now = new Date('2026-07-28T00:00:00Z')
  const daysBefore = (n: number) => new Date(now.getTime() - n * 86_400_000)

  it.each([
    [0, 'today'],
    [1, 'yesterday'],
    [3, '3 days ago'],
    [29, '29 days ago'],
    [30, 'last month'],
    [90, '3 months ago'],
    [400, 'last year'],
  ])('renders %i days ago as "%s"', (days, expected) => {
    expect(formatPostedDate(daysBefore(days), now)).toBe(expected)
  })
})
