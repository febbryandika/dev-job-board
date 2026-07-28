import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from './register-form'

export const metadata: Metadata = {
  title: 'Create an account',
}

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-muted-foreground text-sm">
          Post listings or apply to them — pick which below.
        </p>
      </div>

      <RegisterForm />

      <p className="text-muted-foreground text-sm">
        Already registered?{' '}
        <Link href="/login" className="text-foreground underline">
          Log in
        </Link>
      </p>
    </section>
  )
}
