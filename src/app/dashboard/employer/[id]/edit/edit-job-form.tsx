'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { JobForm } from '@/components/job-form'
import type { Job } from '@/db/schema'
import { updateJob } from '@/server/actions/jobs'

export function EditJobForm({ job }: { job: Job }) {
  const router = useRouter()
  // The id is bound on the server side of the action, so it is not something
  // the browser can swap for someone else's — and the action re-checks
  // ownership in the UPDATE regardless.
  const action = updateJob.bind(null, job.id)

  return (
    <JobForm
      action={action}
      job={job}
      submitLabel={job.status === 'rejected' ? 'Resubmit for review' : 'Save changes'}
      onSuccess={() => {
        toast.success('Submitted for review')
        router.push('/dashboard/employer')
      }}
    />
  )
}
