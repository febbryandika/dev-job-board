'use client'

import { useActionState, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { fieldErrors, FieldError, FormError } from '@/components/form-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { Job } from '@/db/schema'
import { formatSalaryRange } from '@/lib/format'
import { MIN_REJECTION_NOTE, type ActionResult } from '@/lib/validation'
import { approveJob, rejectJob } from '@/server/actions/moderation'

const LOCATION_TYPE_LABELS = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const
const ROLE_TYPE_LABELS = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  contract: 'Contract',
} as const

export type PendingItem = {
  job: Job
  employerName: string | null
  employerEmail: string | null
  /** Sanitized on the server by the same allowlist the public page uses. */
  descriptionHtml: string
}

export function ModerationQueue({ items }: { items: PendingItem[] }) {
  return (
    <ul className="space-y-4" aria-label="Pending listings">
      {items.map((item) => (
        <li key={item.job.id}>
          <QueueCard item={item} />
        </li>
      ))}
    </ul>
  )
}

function QueueCard({ item }: { item: PendingItem }) {
  const { job, employerName, employerEmail, descriptionHtml } = item
  const [rejecting, setRejecting] = useState(false)
  const [approvePending, startApprove] = useTransition()

  function approve() {
    startApprove(async () => {
      const result = await approveJob(job.id)

      if (result.ok) toast.success(`Approved “${job.title}”`)
      else toast.error(result.error.formErrors[0] ?? 'Could not approve this listing')
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">{job.company}</p>
            <h2 className="text-lg leading-snug font-semibold">{job.title}</h2>
            <p className="text-muted-foreground text-sm">
              Submitted by {employerName ?? 'Unknown'}
              {employerEmail && ` · ${employerEmail}`}
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            <time dateTime={job.createdAt.toISOString()}>
              {job.createdAt.toISOString().slice(0, 10)}
            </time>
          </p>
        </div>

        {/* Phase 5 keeps the note and review fields when an employer resubmits,
            precisely so the admin re-reviewing has this context. */}
        {job.rejectionNote && (
          <div className="border-muted-foreground/30 space-y-1 rounded-md border border-dashed px-3 py-2">
            <p className="text-sm font-medium">Resubmitted after rejection</p>
            <p className="text-muted-foreground text-sm">
              Previously rejected: {job.rejectionNote}
            </p>
          </div>
        )}

        <ul className="flex flex-wrap items-center gap-1.5">
          <li>
            <Badge variant="outline">{job.location}</Badge>
          </li>
          <li>
            <Badge variant="secondary">{LOCATION_TYPE_LABELS[job.locationType]}</Badge>
          </li>
          <li>
            <Badge variant="secondary">{ROLE_TYPE_LABELS[job.roleType]}</Badge>
          </li>
          <li className="text-sm font-medium">{formatSalaryRange(job.salaryMin, job.salaryMax)}</li>
        </ul>

        {job.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="ghost" className="font-normal">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {/* A native disclosure: the admin cannot judge a listing without reading
            it, and /jobs/[id] 404s while pending. Works without JS, and several
            can be open at once while working down the queue. */}
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Read the description</summary>
          <div
            className="job-description mt-3 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        </details>

        <div className="flex flex-wrap gap-2">
          <Button onClick={approve} disabled={approvePending}>
            {approvePending ? 'Approving…' : 'Approve'}
          </Button>
          <RejectDialog
            job={job}
            open={rejecting}
            onOpenChange={setRejecting}
            disabled={approvePending}
          />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The trigger lives inside the Dialog via `DialogTrigger` rather than beside
 * it. Without that, Radix has no trigger to hand focus back to when the dialog
 * closes, and `Esc` dropped the keyboard user on `<body>` — measured, and the
 * reason this component was restructured.
 */
function RejectDialog({
  job,
  open,
  onOpenChange,
  disabled,
}: {
  job: Job
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await rejectJob(job.id, prev, formData)

      if (result.ok) {
        toast.success(`Rejected “${job.title}”`)
        onOpenChange(false)
      }
      return result
    },
    null
  )

  const noteErrors = fieldErrors(state, 'note')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reject “{job.title}”</DialogTitle>
            <DialogDescription>
              The employer sees this note and can edit and resubmit the listing, so say what needs
              to change.
            </DialogDescription>
          </DialogHeader>

          <FormError state={state} />

          <div className="space-y-1.5">
            <label htmlFor={`note-${job.id}`} className="text-sm font-medium">
              Reason for rejection
            </label>
            <Textarea
              id={`note-${job.id}`}
              name="note"
              rows={4}
              required
              placeholder="e.g. Please add a salary range and a real description of the work."
              aria-invalid={noteErrors ? true : undefined}
              aria-describedby={noteErrors ? `note-${job.id}-error` : `note-${job.id}-hint`}
            />
            {noteErrors ? (
              <FieldError id={`note-${job.id}-error`} messages={noteErrors} />
            ) : (
              <p id={`note-${job.id}-hint`} className="text-muted-foreground text-sm">
                At least {MIN_REJECTION_NOTE} characters.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Rejecting…' : 'Reject listing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
