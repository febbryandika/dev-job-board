import { createId } from '@paralleldrive/cuid2'
import { index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { user } from './auth-schema'

export const jobs = pgTable(
  'jobs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    employerId: text('employer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location').notNull(),
    locationType: text('location_type', { enum: ['remote', 'hybrid', 'onsite'] }).notNull(),
    roleType: text('role_type', { enum: ['fulltime', 'parttime', 'contract'] }).notNull(),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    description: text('description').notNull(),
    tags: text('tags').array().notNull().default([]),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'closed'] })
      .notNull()
      .default('pending'),
    rejectionNote: text('rejection_note'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_jobs_employer').on(t.employerId),
    index('idx_jobs_public').on(t.status, t.approvedAt), // serves the public list + sitemap
  ]
)

export const applications = pgTable(
  'applications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    applicantId: text('applicant_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    resumeUrl: text('resume_url').notNull(),
    coverLetter: text('cover_letter'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The UI disables the apply button; this is what actually guarantees it.
    unique('uq_application').on(t.jobId, t.applicantId),
    index('idx_applications_job').on(t.jobId),
    index('idx_applications_applicant').on(t.applicantId),
  ]
)

export type Job = typeof jobs.$inferSelect
export type JobStatus = Job['status']
export type Application = typeof applications.$inferSelect
