'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { fieldErrors, FieldError, FormError } from '@/components/form-errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { authClient } from '@/lib/auth-client'
import type { ActionResult } from '@/lib/validation'
import { applyToJob, checkApplied } from '@/server/actions/applications'

const noopSubscribe = () => () => {}

/** `false` on the server and the first client render — see SiteNav. */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

/**
 * A client island, because `/jobs/[id]` is statically prerendered and shared by
 * every visitor (SPEC §8) while "have I applied?" is per-user. Resolving it
 * here keeps the page SSG — and keeps its real 404s — instead of turning every
 * public listing view into a per-request render.
 *
 * The disabled state is a convenience. `uq_application` is the guarantee, and
 * `applyToJob` reports a duplicate from that constraint. SPEC §3.4.
 */
export function ApplyDialog({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const hydrated = useIsHydrated()
  const { data: session, isPending } = authClient.useSession()
  const [applied, setApplied] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)

  const role = session?.user.role
  const isCandidate = role === 'candidate'

  // Asking the server a question the prerendered HTML cannot answer. Only for a
  // signed-in candidate — nobody else can apply, so nobody else needs the read.
  useEffect(() => {
    if (!isCandidate) return

    let active = true
    void checkApplied(jobId).then((result) => {
      if (active) setApplied(result)
    })

    return () => {
      active = false
    }
  }, [isCandidate, jobId])

  // Same height in every branch so the page doesn't jump as this resolves.
  if (!hydrated || isPending) return <div className="h-9" aria-hidden />

  if (!session) {
    return (
      <Button asChild>
        <Link href="/login">Log in to apply</Link>
      </Button>
    )
  }

  if (!isCandidate) {
    return (
      <p className="text-muted-foreground text-sm">
        You&apos;re signed in as {role === 'employer' ? 'an employer' : 'an admin'}. Only candidate
        accounts can apply.
      </p>
    )
  }

  if (applied === null) return <div className="h-9" aria-hidden />

  if (applied) {
    return (
      <Button disabled variant="secondary">
        Already applied
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Apply for this job</Button>
      <ApplyForm
        jobId={jobId}
        jobTitle={jobTitle}
        open={open}
        onOpenChange={setOpen}
        onApplied={() => setApplied(true)}
      />
    </>
  )
}

function ApplyForm({
  jobId,
  jobTitle,
  open,
  onOpenChange,
  onApplied,
}: {
  jobId: string
  jobTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await applyToJob(jobId, prev, formData)

      if (result.ok) {
        toast.success('Application sent')
        onApplied()
        onOpenChange(false)
      }
      return result
    },
    null
  )

  const resumeErrors = fieldErrors(state, 'resumeUrl')
  const coverErrors = fieldErrors(state, 'coverLetter')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Apply for “{jobTitle}”</DialogTitle>
            <DialogDescription>
              The employer sees your name, email and what you send here.
            </DialogDescription>
          </DialogHeader>

          <FormError state={state} />

          <div className="space-y-1.5">
            <label htmlFor="resumeUrl" className="text-sm font-medium">
              Résumé URL
            </label>
            <Input
              id="resumeUrl"
              name="resumeUrl"
              type="url"
              required
              placeholder="https://example.com/your-cv.pdf"
              aria-invalid={resumeErrors ? true : undefined}
              aria-describedby={resumeErrors ? 'resumeUrl-error' : 'resumeUrl-hint'}
            />
            {resumeErrors ? (
              <FieldError id="resumeUrl-error" messages={resumeErrors} />
            ) : (
              <p id="resumeUrl-hint" className="text-muted-foreground text-sm">
                Must be an https link the employer can open.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="coverLetter" className="text-sm font-medium">
              Cover letter <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="coverLetter"
              name="coverLetter"
              rows={6}
              aria-invalid={coverErrors ? true : undefined}
              aria-describedby={coverErrors ? 'coverLetter-error' : undefined}
            />
            <FieldError id="coverLetter-error" messages={coverErrors} />
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
              {pending ? 'Sending…' : 'Send application'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
