'use client'

import { useActionState } from 'react'

import { fieldErrors, FieldError, FormError } from '@/components/form-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ActionResult } from '@/lib/validation'
import { loginAction } from '@/server/actions/auth'

export function LoginForm() {
  // A full-document navigation on success, not router.push: Better Auth's
  // client session store is seeded once per document load, so a soft
  // navigation would leave the header showing the logged-out state.
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await loginAction(prev, formData)
    if (result.ok) window.location.assign('/dashboard')
    return result
  }, null)

  const emailErrors = fieldErrors(state, 'email')
  const passwordErrors = fieldErrors(state, 'password')

  return (
    <form action={formAction} className="space-y-4">
      <FormError state={state} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={emailErrors ? true : undefined}
          aria-describedby={emailErrors ? 'email-error' : undefined}
        />
        <FieldError id="email-error" messages={emailErrors} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordErrors ? true : undefined}
          aria-describedby={passwordErrors ? 'password-error' : undefined}
        />
        <FieldError id="password-error" messages={passwordErrors} />
      </div>

      {/* Disabled while pending so the form cannot be double-submitted. SPEC §6.1. */}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Log in'}
      </Button>
    </form>
  )
}
