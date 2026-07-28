import { z } from 'zod'

// One schema per input, shared by the Server Action and the form that feeds it.
// Actions return `error: parsed.error.flatten()`, so every message here is what
// renders under the field. SPEC §5, §6.1.

export const LOCATION_TYPES = ['remote', 'hybrid', 'onsite'] as const
export const ROLE_TYPES = ['fulltime', 'parttime', 'contract'] as const
export const JOB_STATUSES = ['pending', 'approved', 'rejected', 'closed'] as const

export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 24

export const jobInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    company: z.string().trim().min(1, 'Company is required').max(120),
    location: z.string().trim().min(1, 'Location is required').max(120),
    locationType: z.enum(LOCATION_TYPES),
    roleType: z.enum(ROLE_TYPES),
    // JPY, stored as a whole yen amount. Nullable in the DB: a listing may give
    // a minimum only, a maximum only, or neither.
    salaryMin: z.int().positive().max(1_000_000_000).nullable().default(null),
    salaryMax: z.int().positive().max(1_000_000_000).nullable().default(null),
    description: z.string().trim().min(1, 'Description is required').max(20_000),
    tags: z
      .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
      .max(MAX_TAGS, `Use at most ${MAX_TAGS} tags`)
      .default([]),
  })
  .refine((v) => v.salaryMin === null || v.salaryMax === null || v.salaryMin <= v.salaryMax, {
    message: 'Minimum salary cannot be greater than maximum salary',
    path: ['salaryMax'],
  })

export type JobInput = z.infer<typeof jobInputSchema>

export const applicationInputSchema = z.object({
  // https only — an http resume link would leak the candidate's document over
  // the wire, and `javascript:` / `data:` URLs must never reach an href. SPEC §9.
  resumeUrl: z
    .url({ protocol: /^https$/, hostname: z.regexes.domain })
    .max(2000, 'Resume URL is too long'),
  coverLetter: z.string().trim().max(5000).optional(),
})

export type ApplicationInput = z.infer<typeof applicationInputSchema>

export const rejectionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'A rejection note is required')
    .max(1000, 'Keep the note under 1000 characters'),
})

export type RejectionInput = z.infer<typeof rejectionSchema>
