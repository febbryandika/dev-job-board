'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { JobForm } from '@/components/job-form'
import { createJob } from '@/server/actions/jobs'

export function NewJobForm() {
  const router = useRouter()

  return (
    <JobForm
      action={createJob}
      submitLabel="Submit for review"
      onSuccess={() => {
        toast.success('Submitted for review')
        router.push('/dashboard/employer')
      }}
    />
  )
}
