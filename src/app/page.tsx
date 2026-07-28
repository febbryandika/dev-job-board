// TODO(phase-4): replace with the SSR public job list — searchParams-driven
// filters (q, locationType, roleType, page) + pagination. See SPEC §3.3.
export default function HomePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dev Job Board</h1>
      <p className="text-muted-foreground">
        Developer roles in Japan. Listings are reviewed before they go public.
      </p>
    </section>
  )
}
