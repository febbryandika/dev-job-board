'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { closeJob } from '@/server/actions/jobs'

/**
 * Closing is irreversible — SPEC §3.2 says close and repost — and it pulls a
 * live listing off the public site, so it asks first and names the listing.
 */
export function CloseJobDialog({ jobId, title }: { jobId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const result = await closeJob(jobId)

      if (result.ok) {
        toast.success('Listing closed')
        setOpen(false)
      } else {
        toast.error(result.error.formErrors[0] ?? 'Could not close this listing')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Close
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this listing?</DialogTitle>
          <DialogDescription>
            “{title}” will be removed from the public job board straight away. This can&apos;t be
            undone — to hire again you&apos;d post a new listing and go through review.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep it open
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {pending ? 'Closing…' : 'Close listing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
