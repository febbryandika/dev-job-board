'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCATION_TYPES, ROLE_TYPES } from '@/lib/validation'

const ANY = 'any'

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

export function JobFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function apply(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }

    // Any filter change goes back to page 1 — narrowing the results while
    // sitting on page 7 would otherwise strand you on an empty page.
    next.delete('page')

    const query = next.toString()
    // replace, not push: filter tweaks shouldn't each become a history entry,
    // but the URL stays shareable and the back button still leaves the page.
    router.replace(query ? `/?${query}` : '/')
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('q')
    apply({ q: typeof value === 'string' ? value.trim() : undefined })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <label htmlFor="q" className="text-sm font-medium">
          Search
        </label>
        <div className="flex gap-2">
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Job title or company"
            defaultValue={searchParams.get('q') ?? ''}
            // Remount when the term changes from outside (Clear filters, back
            // button) so the box reflects the URL instead of stale keystrokes.
            key={searchParams.get('q') ?? ''}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="locationType" className="text-sm font-medium">
          Location type
        </label>
        <Select
          value={searchParams.get('locationType') ?? ANY}
          onValueChange={(value) => apply({ locationType: value === ANY ? undefined : value })}
        >
          <SelectTrigger id="locationType" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any location</SelectItem>
            {LOCATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {LOCATION_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="roleType" className="text-sm font-medium">
          Role type
        </label>
        <Select
          value={searchParams.get('roleType') ?? ANY}
          onValueChange={(value) => apply({ roleType: value === ANY ? undefined : value })}
        >
          <SelectTrigger id="roleType" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any role</SelectItem>
            {ROLE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ROLE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
