'use client'

import { useActionState } from 'react'

import { fieldErrors, FieldError, FormError } from '@/components/form-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Job } from '@/db/schema'
import {
  LOCATION_TYPES,
  MAX_TAGS,
  ROLE_TYPES,
  type ActionResult,
} from '@/lib/validation'

const LOCATION_TYPE_LABELS: Record<(typeof LOCATION_TYPES)[number], string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

const ROLE_TYPE_LABELS: Record<(typeof ROLE_TYPES)[number], string> = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  contract: 'Contract',
}

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>

/**
 * Shared by the create and edit pages. Every error shown here is the Zod
 * `flatten()` the Server Action returned — one schema, one source of truth,
 * rendered next to its field. SPEC §6.1.
 *
 * Native `<select>` rather than the Radix one because its value submits with
 * the form without a hidden-input workaround, and it is keyboard- and
 * screen-reader-correct with no extra code.
 *
 * This form needs JavaScript: wrapping the action to fire `onSuccess` (the
 * toast and redirect SPEC §6.1 asks for) means `formAction` is a client
 * closure, which Next cannot progressively enhance. The same is true of the
 * auth forms. The public, indexable pages render fine without JS — this is an
 * authenticated CRUD surface, and `useActionState`'s pending state assumes JS
 * regardless.
 */
export function JobForm({
  action,
  job,
  submitLabel,
  onSuccess,
}: {
  action: Action
  job?: Job
  submitLabel: string
  onSuccess?: () => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await action(prev, formData)
      if (result.ok) onSuccess?.()
      return result
    },
    null
  )

  const err = (field: string) => fieldErrors(state, field)

  return (
    <form action={formAction} className="space-y-5">
      <FormError state={state} />

      <Field id="title" label="Job title" errors={err('title')}>
        <Input id="title" name="title" defaultValue={job?.title} required maxLength={120} />
      </Field>

      <Field id="company" label="Company" errors={err('company')}>
        <Input id="company" name="company" defaultValue={job?.company} required maxLength={120} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="location"
          label="Location"
          hint="e.g. Shibuya, Tokyo or フルリモート"
          errors={err('location')}
        >
          <Input
            id="location"
            name="location"
            defaultValue={job?.location}
            required
            maxLength={120}
          />
        </Field>

        <Field id="locationType" label="Location type" errors={err('locationType')}>
          <Select id="locationType" name="locationType" defaultValue={job?.locationType}>
            {LOCATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {LOCATION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id="roleType" label="Role type" errors={err('roleType')}>
        <Select id="roleType" name="roleType" defaultValue={job?.roleType}>
          {ROLE_TYPES.map((value) => (
            <option key={value} value={value}>
              {ROLE_TYPE_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="salaryMin"
          label="Minimum salary (JPY)"
          hint="Leave blank if not specified"
          errors={err('salaryMin')}
        >
          <Input
            id="salaryMin"
            name="salaryMin"
            type="number"
            min={1}
            step={1}
            defaultValue={job?.salaryMin ?? ''}
          />
        </Field>

        <Field
          id="salaryMax"
          label="Maximum salary (JPY)"
          hint="Leave blank if not specified"
          errors={err('salaryMax')}
        >
          <Input
            id="salaryMax"
            name="salaryMax"
            type="number"
            min={1}
            step={1}
            defaultValue={job?.salaryMax ?? ''}
          />
        </Field>
      </div>

      <Field
        id="tags"
        label="Tags"
        hint={`Comma-separated, up to ${MAX_TAGS}. e.g. TypeScript, React, 日本語N2+`}
        errors={err('tags')}
      >
        <Input id="tags" name="tags" defaultValue={job?.tags.join(', ')} />
      </Field>

      <Field
        id="description"
        label="Description"
        hint="Markdown is supported: ## headings, **bold**, and - lists."
        errors={err('description')}
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={job?.description}
          required
          rows={14}
          className="font-mono text-sm"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : submitLabel}
        </Button>
        <p className="text-muted-foreground text-sm">
          Listings are reviewed by an admin before they go public.
        </p>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  errors,
  children,
}: {
  id: string
  label: string
  hint?: string
  errors: string[] | undefined
  children: React.ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = errors ? `${id}-error` : undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {/* aria-describedby is set on the control itself, so both hint and error
          are announced with the field rather than orphaned beside it. */}
      <div aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}>
        {children}
      </div>
      {hint && !errors && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} messages={errors} />
    </div>
  )
}

function Select({
  id,
  name,
  defaultValue,
  children,
}: {
  id: string
  name: string
  defaultValue?: string
  children: React.ReactNode
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
    >
      {children}
    </select>
  )
}
