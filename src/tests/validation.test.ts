import { describe, expect, it } from 'vitest'

import {
  applicationInputSchema,
  jobInputSchema,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MIN_REJECTION_NOTE,
  rejectionSchema,
} from '@/lib/validation'

function omit<T extends object, K extends keyof T>(source: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...source }
  for (const key of keys) delete copy[key]
  return copy
}

const validJob = {
  title: 'Senior Frontend Engineer',
  company: 'Kaizen Labs',
  location: 'Shibuya, Tokyo',
  locationType: 'hybrid',
  roleType: 'fulltime',
  salaryMin: 8_000_000,
  salaryMax: 12_000_000,
  description: 'Build the booking flow with Next.js and TypeScript.',
  tags: ['TypeScript', 'React', '日本語N2+'],
}

describe('jobInputSchema — salary ordering', () => {
  it('accepts min <= max', () => {
    expect(jobInputSchema.safeParse(validJob).success).toBe(true)
  })

  it('accepts min === max', () => {
    const result = jobInputSchema.safeParse({ ...validJob, salaryMin: 9e6, salaryMax: 9e6 })
    expect(result.success).toBe(true)
  })

  it('rejects min > max, reporting the error on salaryMax', () => {
    const result = jobInputSchema.safeParse({
      ...validJob,
      salaryMin: 12_000_000,
      salaryMax: 8_000_000,
    })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.salaryMax).toEqual([
      'Minimum salary cannot be greater than maximum salary',
    ])
  })

  // Open-ended ranges are a real case: SPEC §11 wants the formatter to handle
  // min-only, max-only, and neither, so the schema has to allow all three.
  it.each([
    ['min only', { salaryMin: 6_000_000, salaryMax: null }],
    ['max only', { salaryMin: null, salaryMax: 9_000_000 }],
    ['neither', { salaryMin: null, salaryMax: null }],
  ])('accepts an open-ended range: %s', (_label, salary) => {
    expect(jobInputSchema.safeParse({ ...validJob, ...salary }).success).toBe(true)
  })

  it('defaults salary to null when omitted', () => {
    const result = jobInputSchema.safeParse(omit(validJob, 'salaryMin', 'salaryMax'))

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ salaryMin: null, salaryMax: null })
  })

  it('rejects a negative or fractional salary', () => {
    expect(jobInputSchema.safeParse({ ...validJob, salaryMin: -1 }).success).toBe(false)
    expect(jobInputSchema.safeParse({ ...validJob, salaryMin: 5_000_000.5 }).success).toBe(false)
  })
})

describe('jobInputSchema — tag cap', () => {
  it(`accepts exactly ${MAX_TAGS} tags`, () => {
    const tags = Array.from({ length: MAX_TAGS }, (_, i) => `tag-${i}`)
    expect(jobInputSchema.safeParse({ ...validJob, tags }).success).toBe(true)
  })

  it(`rejects ${MAX_TAGS + 1} tags`, () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag-${i}`)
    const result = jobInputSchema.safeParse({ ...validJob, tags })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.tags).toEqual([`Use at most ${MAX_TAGS} tags`])
  })

  it(`rejects a tag longer than ${MAX_TAG_LENGTH} characters`, () => {
    const tags = ['x'.repeat(MAX_TAG_LENGTH + 1)]
    expect(jobInputSchema.safeParse({ ...validJob, tags }).success).toBe(false)
  })

  it('rejects an empty tag and defaults tags to an empty array', () => {
    expect(jobInputSchema.safeParse({ ...validJob, tags: [''] }).success).toBe(false)

    expect(jobInputSchema.safeParse(omit(validJob, 'tags')).data?.tags).toEqual([])
  })
})

describe('jobInputSchema — enums and required text', () => {
  it('rejects a locationType or roleType outside the SPEC enum', () => {
    expect(jobInputSchema.safeParse({ ...validJob, locationType: 'anywhere' }).success).toBe(false)
    expect(jobInputSchema.safeParse({ ...validJob, roleType: 'internship' }).success).toBe(false)
  })

  it('rejects whitespace-only required text', () => {
    expect(jobInputSchema.safeParse({ ...validJob, title: '   ' }).success).toBe(false)
    expect(jobInputSchema.safeParse({ ...validJob, description: '  \n ' }).success).toBe(false)
  })
})

describe('applicationInputSchema — resume URL shape', () => {
  it('accepts an https URL', () => {
    const result = applicationInputSchema.safeParse({
      resumeUrl: 'https://example.com/resume.pdf',
    })
    expect(result.success).toBe(true)
  })

  // http is rejected on purpose, and the javascript:/data: cases are the ones
  // that would actually be dangerous in an href. SPEC §9.
  it.each([
    'http://example.com/resume.pdf',
    'ftp://example.com/resume.pdf',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'not-a-url',
    '',
  ])('rejects %s', (resumeUrl) => {
    expect(applicationInputSchema.safeParse({ resumeUrl }).success).toBe(false)
  })

  it('treats the cover letter as optional', () => {
    expect(
      applicationInputSchema.safeParse({ resumeUrl: 'https://example.com/cv.pdf' }).success
    ).toBe(true)
  })

  it('rejects a cover letter over 5000 characters', () => {
    const result = applicationInputSchema.safeParse({
      resumeUrl: 'https://example.com/cv.pdf',
      coverLetter: 'x'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

describe('rejectionSchema', () => {
  it('requires a non-empty note', () => {
    expect(rejectionSchema.safeParse({ note: '   ' }).success).toBe(false)
    expect(rejectionSchema.safeParse({ note: 'Salary range is missing.' }).success).toBe(true)
  })

  // The employer only ever sees this note — it is the whole feedback loop, so
  // "no" must not be a valid rejection reason.
  it(`rejects a note under ${MIN_REJECTION_NOTE} characters`, () => {
    const result = rejectionSchema.safeParse({ note: 'x'.repeat(MIN_REJECTION_NOTE - 1) })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.note?.[0]).toContain(String(MIN_REJECTION_NOTE))
  })

  it(`accepts a note of exactly ${MIN_REJECTION_NOTE} characters`, () => {
    expect(rejectionSchema.safeParse({ note: 'x'.repeat(MIN_REJECTION_NOTE) }).success).toBe(true)
  })

  // Trimming happens before the length check, so spaces cannot pad a note to
  // the minimum.
  it('does not let whitespace pad a note to the minimum', () => {
    expect(rejectionSchema.safeParse({ note: `  no${' '.repeat(20)}` }).success).toBe(false)
  })

  it('rejects a note over 1000 characters', () => {
    expect(rejectionSchema.safeParse({ note: 'x'.repeat(1001) }).success).toBe(false)
  })
})
