'use client'

import { useActionState } from 'react'

import { fieldErrors, FieldError, FormError } from '@/app/(auth)/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ActionResult } from '@/lib/validation'
import { registerAction } from '@/server/actions/auth'

// Native radios rather than a Radix Select: they submit with the form without a
// hidden-input workaround, and they are keyboard- and screen-reader-correct with
// no extra work. SPEC §6.1.
const ROLE_CHOICES = [
  { value: 'candidate', label: "I'm looking for a job", hint: 'Browse and apply to listings' },
  { value: 'employer', label: "I'm hiring", hint: 'Post listings for review' },
] as const

export function RegisterForm() {
  // See LoginForm: a full-document navigation is what seeds the client session
  // store with the account the Server Action just created.
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await registerAction(prev, formData)
    if (result.ok) window.location.assign('/dashboard')
    return result
  }, null)

  const nameErrors = fieldErrors(state, 'name')
  const emailErrors = fieldErrors(state, 'email')
  const passwordErrors = fieldErrors(state, 'password')
  const roleErrors = fieldErrors(state, 'role')

  return (
    <form action={formAction} className="space-y-4">
      <FormError state={state} />

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          aria-invalid={nameErrors ? true : undefined}
          aria-describedby={nameErrors ? 'name-error' : undefined}
        />
        <FieldError id="name-error" messages={nameErrors} />
      </div>

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
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={passwordErrors ? true : undefined}
          aria-describedby={passwordErrors ? 'password-error' : 'password-hint'}
        />
        {passwordErrors ? (
          <FieldError id="password-error" messages={passwordErrors} />
        ) : (
          <p id="password-hint" className="text-muted-foreground text-sm">
            At least 8 characters.
          </p>
        )}
      </div>

      <fieldset
        className="space-y-2"
        aria-invalid={roleErrors ? true : undefined}
        aria-describedby={roleErrors ? 'role-error' : undefined}
      >
        <legend className="text-sm font-medium">I am…</legend>
        {ROLE_CHOICES.map((choice, index) => (
          <label
            key={choice.value}
            htmlFor={`role-${choice.value}`}
            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3"
          >
            <input
              id={`role-${choice.value}`}
              type="radio"
              name="role"
              value={choice.value}
              defaultChecked={index === 0}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">{choice.label}</span>
              <span className="text-muted-foreground block text-sm">{choice.hint}</span>
            </span>
          </label>
        ))}
        <FieldError id="role-error" messages={roleErrors} />
      </fieldset>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
