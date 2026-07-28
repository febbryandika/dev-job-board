import { describe, expect, it } from 'vitest'

import type { Job } from '@/db/schema'
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/json-ld'

const SITE = 'https://jobs.example.test'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'dm5lmla8ce5kmkalnifjzctx',
    employerId: 'employer-1',
    title: 'Senior Frontend Engineer',
    company: 'Kaizen Labs',
    location: 'Shibuya, Tokyo',
    locationType: 'hybrid',
    roleType: 'fulltime',
    salaryMin: 8_000_000,
    salaryMax: 12_000_000,
    description: '## About\n\nBuild **great** things.',
    tags: ['TypeScript', 'React'],
    status: 'approved',
    rejectionNote: null,
    reviewedBy: 'admin-1',
    reviewedAt: new Date('2026-07-08T00:00:00Z'),
    approvedAt: new Date('2026-07-08T00:00:00Z'),
    createdAt: new Date('2026-07-07T00:00:00Z'),
    ...overrides,
  }
}

// Google's documented required set for JobPosting.
const REQUIRED_FIELDS = [
  'title',
  'description',
  'datePosted',
  'hiringOrganization',
  'jobLocation',
] as const

describe('buildJobPostingJsonLd — Google required fields', () => {
  it.each([
    ['hybrid full-time', makeJob()],
    ['fully remote contract', makeJob({ locationType: 'remote', roleType: 'contract' })],
    ['on-site part-time', makeJob({ locationType: 'onsite', roleType: 'parttime' })],
    ['no salary', makeJob({ salaryMin: null, salaryMax: null })],
    ['Japanese location', makeJob({ location: 'フルリモート', locationType: 'remote' })],
  ])('emits every required field for a %s listing', (_label, job) => {
    const data = buildJobPostingJsonLd(job, SITE) as Record<string, unknown>

    for (const field of REQUIRED_FIELDS) {
      expect(data[field], `${field} is required by Google`).toBeTruthy()
    }
    expect(data['@context']).toBe('https://schema.org/')
    expect(data['@type']).toBe('JobPosting')
  })

  it('uses the correct schema.org types', () => {
    const data = buildJobPostingJsonLd(makeJob(), SITE)

    expect(data.hiringOrganization['@type']).toBe('Organization')
    expect(data.jobLocation['@type']).toBe('Place')
    expect(data.jobLocation.address['@type']).toBe('PostalAddress')
    expect(data.identifier['@type']).toBe('PropertyValue')
  })

  it('emits datePosted as an ISO 8601 string taken from approvedAt', () => {
    const data = buildJobPostingJsonLd(makeJob(), SITE)

    expect(data.datePosted).toBe('2026-07-08T00:00:00.000Z')
    expect(new Date(data.datePosted).toString()).not.toBe('Invalid Date')
  })

  // A row can in principle lack approvedAt; the field is required, so it must
  // still be a valid date rather than null.
  it('falls back to createdAt when approvedAt is null', () => {
    const data = buildJobPostingJsonLd(makeJob({ approvedAt: null }), SITE)

    expect(data.datePosted).toBe('2026-07-07T00:00:00.000Z')
  })

  it('carries data from the row, not hardcoded strings', () => {
    const data = buildJobPostingJsonLd(makeJob({ title: 'Go Engineer', company: 'Acme KK' }), SITE)

    expect(data.title).toBe('Go Engineer')
    expect(data.hiringOrganization.name).toBe('Acme KK')
    expect(data.url).toBe(`${SITE}/jobs/dm5lmla8ce5kmkalnifjzctx`)
  })
})

describe('buildJobPostingJsonLd — employment type mapping', () => {
  it.each([
    ['fulltime', 'FULL_TIME'],
    ['parttime', 'PART_TIME'],
    ['contract', 'CONTRACTOR'],
  ] as const)('maps %s to Google\'s %s', (roleType, expected) => {
    expect(buildJobPostingJsonLd(makeJob({ roleType }), SITE).employmentType).toBe(expected)
  })
})

describe('buildJobPostingJsonLd — remote listings', () => {
  it('marks a remote job as TELECOMMUTE with an applicant location requirement', () => {
    const data = buildJobPostingJsonLd(makeJob({ locationType: 'remote' }), SITE)

    expect(data.jobLocationType).toBe('TELECOMMUTE')
    expect(data.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'JP' })
    // jobLocation stays: Google wants both for a remote role.
    expect(data.jobLocation).toBeTruthy()
  })

  it.each(['hybrid', 'onsite'] as const)('omits the remote fields for a %s job', (locationType) => {
    const data = buildJobPostingJsonLd(makeJob({ locationType }), SITE)

    expect(data.jobLocationType).toBeUndefined()
    expect(data.applicantLocationRequirements).toBeUndefined()
  })
})

describe('buildJobPostingJsonLd — baseSalary', () => {
  it('emits a closed range as min and max', () => {
    const { baseSalary } = buildJobPostingJsonLd(makeJob(), SITE)

    expect(baseSalary).toEqual({
      '@type': 'MonetaryAmount',
      currency: 'JPY',
      value: {
        '@type': 'QuantitativeValue',
        minValue: 8_000_000,
        maxValue: 12_000_000,
        unitText: 'YEAR',
      },
    })
  })

  it('emits only minValue when there is no maximum', () => {
    const { baseSalary } = buildJobPostingJsonLd(makeJob({ salaryMax: null }), SITE)

    expect(baseSalary?.value.minValue).toBe(8_000_000)
    expect(baseSalary?.value).not.toHaveProperty('maxValue')
  })

  it('emits only maxValue when there is no minimum', () => {
    const { baseSalary } = buildJobPostingJsonLd(makeJob({ salaryMin: null }), SITE)

    expect(baseSalary?.value.maxValue).toBe(12_000_000)
    expect(baseSalary?.value).not.toHaveProperty('minValue')
  })

  // An empty MonetaryAmount is worse than none — Google flags incomplete
  // objects, so the property is dropped entirely.
  it('omits baseSalary entirely when neither bound is set', () => {
    const data = buildJobPostingJsonLd(makeJob({ salaryMin: null, salaryMax: null }), SITE)

    expect(data).not.toHaveProperty('baseSalary')
  })
})

describe('buildJobPostingJsonLd — description', () => {
  it('is the same sanitized HTML the page renders', () => {
    const data = buildJobPostingJsonLd(makeJob(), SITE)

    expect(data.description).toContain('<strong>great</strong>')
    expect(data.description).not.toContain('##')
  })

  it('carries no script through from a hostile description', () => {
    const data = buildJobPostingJsonLd(
      makeJob({ description: 'Nice role <script>alert(1)</script>' }),
      SITE
    )

    expect(data.description).not.toContain('<script')
    expect(data.description).not.toContain('alert(1)')
  })
})

describe('serializeJsonLd', () => {
  it('produces valid JSON that round-trips', () => {
    const data = buildJobPostingJsonLd(makeJob(), SITE)
    const parsed = JSON.parse(serializeJsonLd(data).replace(/\\u003c/g, '<'))

    expect(parsed['@type']).toBe('JobPosting')
    expect(parsed.title).toBe('Senior Frontend Engineer')
  })

  // A `</script>` reaching the page as markup would end the JSON-LD block early
  // and put attacker-controlled text into the document.
  it('escapes every < so a closing script tag cannot break out', () => {
    const serialized = serializeJsonLd({ description: '</script><img src=x onerror=alert(1)>' })

    expect(serialized).not.toContain('<')
    expect(serialized).toContain('\\u003c')
  })

  it('still parses as JSON after escaping', () => {
    const serialized = serializeJsonLd({ a: '<b>' })

    expect(JSON.parse(serialized)).toEqual({ a: '<b>' })
  })
})
