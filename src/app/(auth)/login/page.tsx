import type { Metadata } from 'next'
import Link from 'next/link'

import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Log in',
}

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back. Use your email and password.
        </p>
      </div>

      <LoginForm />

      <p className="text-muted-foreground text-sm">
        No account yet?{' '}
        <Link href="/register" className="text-foreground underline">
          Create one
        </Link>
      </p>
    </section>
  )
}
