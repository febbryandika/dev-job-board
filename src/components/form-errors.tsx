import type { ActionResult } from '@/lib/validation'

/**
 * Renders the messages a Server Action's Zod `flatten()` produced for one
 * field, next to that field — never as a generic banner. SPEC §6.1.
 */
export function FieldError({ id, messages }: { id: string; messages: string[] | undefined }) {
  if (!messages?.length) return null

  return (
    <p id={id} className="text-destructive text-sm">
      {messages.join(' ')}
    </p>
  )
}

/** Errors that belong to the form as a whole, e.g. bad credentials. */
export function FormError({ state }: { state: ActionResult | null }) {
  if (!state || state.ok || state.error.formErrors.length === 0) return null

  return (
    <p role="alert" className="border-destructive/50 text-destructive rounded-md border px-3 py-2 text-sm">
      {state.error.formErrors.join(' ')}
    </p>
  )
}

export function fieldErrors(state: ActionResult | null, field: string): string[] | undefined {
  return state && !state.ok ? state.error.fieldErrors[field] : undefined
}
