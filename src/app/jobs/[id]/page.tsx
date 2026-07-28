// TODO(phase-5): real job detail + generateMetadata + JobPosting JSON-LD.
// Only `approved` jobs are public; anything else must call notFound(). SPEC §8.
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Job detail</h1>
      <p className="text-muted-foreground">Job ID: {id}</p>
    </section>
  )
}
