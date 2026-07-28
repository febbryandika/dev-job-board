import { z } from 'zod'

// One schema per input, shared by the Server Action and the form that feeds it.
// Actions return `error: parsed.error.flatten()`, so every message here is what
// renders under the field. SPEC §5, §6.1.

/**
 * What every Server Action returns. `error` is the Zod `flatten()` shape, so
 * failures that are not validation failures (bad credentials, a taken email)
 * use the same envelope and the forms need exactly one error renderer.
 * Thrown errors are never control flow. SPEC §5.
 */
export type ActionError = {
  formErrors: string[]
  fieldErrors: Record<string, string[] | undefined>
}

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: ActionError }

/** Build the `ActionResult` envelope for a failure that Zod did not produce. */
export function formError(message: string, field?: string): ActionResult<never> {
  return {
    ok: false,
    error: field ? { formErrors: [], fieldErrors: { [field]: [message] } } : { formErrors: [message], fieldErrors: {} },
  }
}

export const LOCATION_TYPES = ['remote', 'hybrid', 'onsite'] as const
export const ROLE_TYPES = ['fulltime', 'parttime', 'contract'] as const
export const JOB_STATUSES = ['pending', 'approved', 'rejected', 'closed'] as const

/**
 * Roles a person can pick for themselves. `admin` is absent on purpose: it is
 * DB-assigned only (SPEC §3.1), so a crafted `role: 'admin'` payload fails
 * validation before it reaches the database — a second lock behind the
 * `input: false` on the Better Auth user field.
 */
export const SIGNUP_ROLES = ['candidate', 'employer'] as const

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.email('Enter a valid email address').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  role: z.enum(SIGNUP_ROLES, { message: 'Choose whether you are hiring or job hunting' }),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
})

export type LoginInput = z.infer<typeof loginSchema>

/** Page size for the public list. SPEC §3.3. */
export const PAGE_SIZE = 20

/**
 * Parses the public list's `searchParams`.
 *
 * `.catch()` on every field rather than one big fallback: a URL like
 * `?q=Go&page=abc` keeps the search term and only resets the bad page. A
 * whole-object fallback would silently throw the valid half away.
 */
export const jobSearchParamsSchema = z.object({
  q: z.string().trim().min(1).max(100).optional().catch(undefined),
  locationType: z.enum(LOCATION_TYPES).optional().catch(undefined),
  roleType: z.enum(ROLE_TYPES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export type JobSearchParams = z.infer<typeof jobSearchParamsSchema>

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
