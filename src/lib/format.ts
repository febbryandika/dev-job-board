// Constructed once at module load: Intl formatters are expensive to build and
// cheap to reuse. One formatter for the whole app, so JPY renders identically
// everywhere. SPEC §11.
const jpy = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

export function formatJpy(amount: number): string {
  return jpy.format(amount)
}

/**
 * Salary ranges are open-ended in both directions — the schema allows a minimum
 * only, a maximum only, or neither, and the seed data contains all four cases.
 */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (min != null && max != null) return `${formatJpy(min)} – ${formatJpy(max)}`
  if (min != null) return `${formatJpy(min)}+`
  if (max != null) return `Up to ${formatJpy(max)}`
  return 'Salary not specified'
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "today", "3 days ago", "2 months ago" — for the posted date on a JobCard. */
export function formatPostedDate(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)

  if (days < 1) return 'today'
  if (days < 30) return relative.format(-days, 'day')
  if (days < 365) return relative.format(-Math.floor(days / 30), 'month')
  return relative.format(-Math.floor(days / 365), 'year')
}
