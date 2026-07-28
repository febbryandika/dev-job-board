import { QueryBuilder } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { jobs } from '@/db/schema'
import { jobSearchParamsSchema, type JobSearchParams } from '@/lib/validation'
import { escapeLike, publicJobsWhere } from '@/server/predicates'

// QueryBuilder renders SQL without a driver, so these run with no database.
const qb = new QueryBuilder()

function toSql(filters: Partial<JobSearchParams>) {
  const query = qb.select().from(jobs).where(publicJobsWhere(filters)).toSQL()
  // The select list mentions every column, so assertions about which columns a
  // filter touches have to look at the WHERE clause alone.
  return { ...query, where: query.sql.slice(query.sql.indexOf(' where ')) }
}

const ALL_COMBINATIONS: Partial<JobSearchParams>[] = [
  {},
  { q: 'Kaizen' },
  { locationType: 'remote' },
  { roleType: 'contract' },
  { q: 'Kaizen', locationType: 'remote' },
  { q: 'Kaizen', roleType: 'contract' },
  { locationType: 'remote', roleType: 'contract' },
  { q: 'Kaizen', locationType: 'remote', roleType: 'contract' },
]

describe('publicJobsWhere — the approved predicate is not optional', () => {
  // If this ever fails, pending, rejected and closed listings are publicly
  // visible. It is the security bug this phase could plausibly introduce, so
  // it is asserted for every combination rather than spot-checked.
  it.each(ALL_COMBINATIONS)('filters to approved for %o', (filters) => {
    const { where, params } = toSql(filters)

    expect(where).toContain('"status" =')
    expect(params).toContain('approved')
  })

  it('binds status as a parameter rather than interpolating it', () => {
    expect(toSql({}).where).not.toContain("'approved'")
  })
})

describe('publicJobsWhere — filter combinations', () => {
  it('applies only the status predicate when nothing is filtered', () => {
    const { where, params } = toSql({})

    expect(params).toEqual(['approved'])
    expect(where).not.toContain('ilike')
    expect(where).not.toContain('"location_type"')
    expect(where).not.toContain('"role_type"')
  })

  it('searches title and company, and only those, for q', () => {
    const { where, params } = toSql({ q: 'Kaizen' })

    expect(where).toContain('"title" ilike')
    expect(where).toContain('"company" ilike')
    expect(where).not.toContain('"description" ilike')
    expect(where).not.toContain('"tags" ilike')
    expect(params).toEqual(['approved', '%Kaizen%', '%Kaizen%'])
  })

  it('adds locationType and roleType equality predicates', () => {
    const { where, params } = toSql({ locationType: 'remote', roleType: 'contract' })

    expect(where).toContain('"location_type" =')
    expect(where).toContain('"role_type" =')
    expect(params).toEqual(['approved', 'remote', 'contract'])
  })

  it('combines all three', () => {
    const { params } = toSql({ q: 'Go', locationType: 'hybrid', roleType: 'fulltime' })

    expect(params).toEqual(['approved', '%Go%', '%Go%', 'hybrid', 'fulltime'])
  })

  it('ignores an empty search term rather than matching everything', () => {
    expect(toSql({ q: '' }).params).toEqual(['approved'])
  })
})

describe('escapeLike', () => {
  // Unescaped, a search for "%" becomes '%%%' and matches every row — the
  // opposite of what the user asked for.
  it.each([
    ['%', '\\%'],
    ['_', '\\_'],
    ['100%', '100\\%'],
    ['a_b%c', 'a\\_b\\%c'],
    ['back\\slash', 'back\\\\slash'],
    ['Kaizen', 'Kaizen'],
  ])('escapes %s', (input, expected) => {
    expect(escapeLike(input)).toBe(expected)
  })

  it('is applied to the ILIKE pattern', () => {
    expect(toSql({ q: '100%' }).params).toEqual(['approved', '%100\\%%', '%100\\%%'])
  })
})

describe('jobSearchParamsSchema — junk in the URL degrades gracefully', () => {
  it('defaults an absent query string', () => {
    expect(jobSearchParamsSchema.parse({})).toEqual({ page: 1 })
  })

  it('coerces a numeric page', () => {
    expect(jobSearchParamsSchema.parse({ page: '3' }).page).toBe(3)
  })

  // The point of per-field `.catch()`: a bad page must not discard a good q.
  it.each([
    ['page=abc', { q: 'Go', page: 'abc' }],
    ['page=0', { q: 'Go', page: '0' }],
    ['page=-5', { q: 'Go', page: '-5' }],
    ['page=1e99', { q: 'Go', page: '1e99' }],
  ])('resets a bad %s to 1 while keeping q', (_label, input) => {
    const parsed = jobSearchParamsSchema.parse(input)

    expect(parsed.page).toBe(1)
    expect(parsed.q).toBe('Go')
  })

  it('drops an unknown enum value without discarding the rest', () => {
    const parsed = jobSearchParamsSchema.parse({ locationType: 'mars', roleType: 'contract' })

    expect(parsed.locationType).toBeUndefined()
    expect(parsed.roleType).toBe('contract')
  })

  it('treats a whitespace-only search as no search', () => {
    expect(jobSearchParamsSchema.parse({ q: '   ' }).q).toBeUndefined()
  })
})
