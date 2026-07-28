'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

const noopSubscribe = () => () => {}

/**
 * `false` while server-rendering and on the first client render, `true`
 * thereafter — `useSyncExternalStore`'s server snapshot exists for exactly
 * this, so no state is set from an effect.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

/**
 * A client island on purpose. Reading the session in the root layout would call
 * `headers()` and opt **every** route into dynamic rendering, including the
 * public list that SPEC §8 wants statically revalidated.
 */
export function SiteNav() {
  const { data: session, isPending } = authClient.useSession()
  const [signingOut, setSigningOut] = useState(false)

  const mounted = useIsHydrated()

  async function signOut() {
    setSigningOut(true)
    await authClient.signOut()
    // Full-document navigation for the same reason the auth forms use one:
    // it re-seeds the session store and discards every per-session RSC payload
    // Next has cached for this user.
    window.location.assign('/')
  }

  // The session store is browser-only and can already hold a session on the
  // client's very first render, while the server — which has no store — always
  // renders the placeholder. Rendering the placeholder until after hydration
  // makes the server HTML and the first client render identical by
  // construction; without it React discards and rebuilds this subtree.
  if (!mounted || isPending) {
    // Reserve the row height so the header doesn't jump once the session lands.
    return <div className="h-8" aria-hidden />
  }

  if (!session) {
    return (
      <ul className="flex items-center gap-4 text-sm">
        <li>
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
        </li>
        <li>
          <Link href="/register" className="hover:underline">
            Sign up
          </Link>
        </li>
      </ul>
    )
  }

  return (
    <ul className="flex items-center gap-4 text-sm">
      <li className="text-muted-foreground hidden sm:block">{session.user.email}</li>
      <li>
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
      </li>
      <li>
        <Button variant="outline" size="sm" onClick={signOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </li>
    </ul>
  )
}
