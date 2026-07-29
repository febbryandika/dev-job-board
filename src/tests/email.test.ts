import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { jobApprovedEmail, jobRejectedEmail, newApplicationEmail } from '@/lib/email'

const JOB_ID = 'dm5lmla8ce5kmkalnifjzctx'
const ORIGINAL_URL = process.env.BETTER_AUTH_URL

beforeEach(() => {
  process.env.BETTER_AUTH_URL = 'https://jobs.example.test'
})

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.BETTER_AUTH_URL
  else process.env.BETTER_AUTH_URL = ORIGINAL_URL
})

const templates = [
  ['newApplicationEmail', () => newApplicationEmail({ jobTitle: 'Go Engineer', applicantName: 'Aiko Tanaka' })],
  ['jobApprovedEmail', () => jobApprovedEmail({ jobTitle: 'Go Engineer', jobId: JOB_ID })],
  [
    'jobRejectedEmail',
    () => jobRejectedEmail({ jobTitle: 'Go Engineer', jobId: JOB_ID, note: 'Add a salary range.' }),
  ],
] as const

describe('every template', () => {
  it.each(templates)('%s ships a subject, html and text', (_name, build) => {
    const message = build()

    expect(message.subject.length).toBeGreaterThan(0)
    expect(message.html.length).toBeGreaterThan(0)
    expect(message.text.length).toBeGreaterThan(0)
  })

  it.each(templates)('%s names the job in the subject and body', (_name, build) => {
    const message = build()

    expect(message.subject).toContain('Go Engineer')
    expect(message.html).toContain('Go Engineer')
    expect(message.text).toContain('Go Engineer')
  })

  // The requirement: absolute URLs come from BETTER_AUTH_URL, never hardcoded.
  // Asserted by changing the variable and watching the output follow.
  it.each(templates)('%s builds links from BETTER_AUTH_URL', (_name, build) => {
    expect(build().html).toContain('https://jobs.example.test/')

    process.env.BETTER_AUTH_URL = 'https://other.example.test'
    const moved = build()

    expect(moved.html).toContain('https://other.example.test/')
    expect(moved.html).not.toContain('jobs.example.test')
    expect(moved.text).toContain('https://other.example.test/')
  })

  it.each(templates)('%s never emits a localhost link when the env var is set', (_name, build) => {
    expect(build().html).not.toContain('localhost')
  })
})

describe('newApplicationEmail — SPEC §3.6', () => {
  const message = () => newApplicationEmail({ jobTitle: 'Go Engineer', applicantName: 'Aiko Tanaka' })

  it('carries the job title, the applicant name, and a dashboard link', () => {
    const email = message()

    expect(email.subject).toBe('New application for Go Engineer')
    expect(email.html).toContain('Aiko Tanaka')
    expect(email.text).toContain('Aiko Tanaka')
    expect(email.html).toContain('https://jobs.example.test/dashboard/employer')
  })
})

describe('jobApprovedEmail — SPEC §3.6', () => {
  it('carries the job title and the public link', () => {
    const email = jobApprovedEmail({ jobTitle: 'Go Engineer', jobId: JOB_ID })

    expect(email.subject).toBe('Go Engineer is now live')
    // The public listing, not the dashboard — this is the "it's live" email.
    expect(email.html).toContain(`https://jobs.example.test/jobs/${JOB_ID}`)
    expect(email.html).not.toContain('/dashboard/')
  })
})

describe('jobRejectedEmail — SPEC §3.6', () => {
  const note = 'Please add a salary range and describe the work.'
  const message = () => jobRejectedEmail({ jobTitle: 'Go Engineer', jobId: JOB_ID, note })

  it('carries the job title, the note, and a link to edit', () => {
    const email = message()

    expect(email.html).toContain(note)
    expect(email.text).toContain(note)
    expect(email.html).toContain(`https://jobs.example.test/dashboard/employer/${JOB_ID}/edit`)
  })

  it('does not link to the public listing, which does not exist yet', () => {
    expect(message().html).not.toContain(`/jobs/${JOB_ID}"`)
  })
})

// Job titles, applicant names and rejection notes are user-authored and end up
// inside HTML in someone's inbox.
describe('HTML escaping', () => {
  it('escapes a script tag in a job title', () => {
    const email = jobApprovedEmail({ jobTitle: '<script>alert(1)</script>', jobId: JOB_ID })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('escapes an image handler in an applicant name', () => {
    const email = newApplicationEmail({
      jobTitle: 'Go Engineer',
      applicantName: '<img src=x onerror=alert(1)>',
    })

    expect(email.html).not.toContain('<img')
    expect(email.html).toContain('&lt;img')
  })

  it('escapes markup in a rejection note', () => {
    const email = jobRejectedEmail({
      jobTitle: 'Go Engineer',
      jobId: JOB_ID,
      note: '</blockquote><script>alert(1)</script>',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('</blockquote><script')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('escapes quotes so an attribute cannot be broken out of', () => {
    const email = jobApprovedEmail({ jobTitle: 'Say "hi" & \'bye\'', jobId: JOB_ID })

    expect(email.html).toContain('&quot;')
    expect(email.html).toContain('&#39;')
    expect(email.html).toContain('&amp;')
  })

  // The plain-text part is not markup, so it should read naturally.
  it('leaves the text part unescaped', () => {
    const email = jobApprovedEmail({ jobTitle: 'C++ & Rust', jobId: JOB_ID })

    expect(email.text).toContain('C++ & Rust')
    expect(email.text).not.toContain('&amp;')
  })
})
