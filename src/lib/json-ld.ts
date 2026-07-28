import type { Job } from '@/db/schema'
import { renderMarkdown } from '@/lib/markdown'

/**
 * Google Jobs structured data. Field names and shapes follow
 * developers.google.com/search/docs/appearance/structured-data/job-posting.
 *
 * Pure, so it can be unit-tested against every job shape without a database —
 * the same split as `src/lib/roles.ts` and `src/server/predicates.ts`.
 */

const EMPLOYMENT_TYPES = {
  fulltime: 'FULL_TIME',
  parttime: 'PART_TIME',
  contract: 'CONTRACTOR',
} as const

/** Every listing in this board is in Japan; salaries are annual JPY. */
const COUNTRY = 'JP'

export function buildJobPostingJsonLd(job: Job, siteUrl: string) {
  const hasSalary = job.salaryMin != null || job.salaryMax != null

  return {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    // --- Google's required fields ---
    title: job.title,
    // Google wants the description as HTML; this is the same sanitized output
    // the page renders, so the two can never disagree.
    description: renderMarkdown(job.description),
    // `approvedAt` is when the listing actually became public. Falling back to
    // createdAt keeps the field present rather than emitting an invalid date.
    datePosted: (job.approvedAt ?? job.createdAt).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        // SPEC stores location as free text ("Shibuya, Tokyo", "フルリモート"),
        // so locality is the honest mapping of the data that exists.
        addressLocality: job.location,
        addressCountry: COUNTRY,
      },
    },
    // --- Recommended, where the data supports it ---
    identifier: {
      '@type': 'PropertyValue',
      name: job.company,
      value: job.id,
    },
    employmentType: EMPLOYMENT_TYPES[job.roleType],
    directApply: true,
    url: `${siteUrl}/jobs/${job.id}`,
    // Fully remote listings need both fields, or Google treats the physical
    // address as the only place the job can be done.
    ...(job.locationType === 'remote'
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: COUNTRY },
        }
      : {}),
    // Omitted entirely rather than emitted with nulls when a listing gives no
    // figures — an empty MonetaryAmount is worse than no MonetaryAmount.
    ...(hasSalary
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'JPY',
            value: {
              '@type': 'QuantitativeValue',
              ...(job.salaryMin != null ? { minValue: job.salaryMin } : {}),
              ...(job.salaryMax != null ? { maxValue: job.salaryMax } : {}),
              unitText: 'YEAR',
            },
          },
        }
      : {}),
    // `validThrough` is deliberately absent: SPEC §4 has no expiry column, and
    // inventing a date would be worse than omitting a recommended field.
  }
}

/**
 * Serialises for a `<script type="application/ld+json">` block.
 *
 * `<` is escaped so a description containing `</script>` cannot close the tag
 * early and turn the rest of the payload into markup. The sanitizer already
 * strips script tags; this is the second lock on the same door.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
