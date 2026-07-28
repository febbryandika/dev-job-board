'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

import { db } from '@/db'
import { user } from '@/db/auth-schema'
import { auth } from '@/lib/auth'
import { formError, loginSchema, registerSchema, type ActionResult } from '@/lib/validation'

/** Better Auth throws `APIError`, which carries a machine-readable code. */
function authErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'body' in error) {
    const body = (error as { body?: { code?: unknown } }).body
    if (typeof body?.code === 'string') return body.code
  }
  return undefined
}

// These actions return `{ ok: true }` rather than calling redirect(). The
// caller then does a full-document navigation, because Better Auth's client
// session store is populated once per document load and does not observe a
// session created server-side — without a real navigation the header would
// stay logged-out until the next hard refresh.

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  })

  // `registerSchema` only accepts candidate | employer, so a crafted
  // `role: 'admin'` never gets past this line.
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  const { name, email, password, role } = parsed.data

  try {
    // `role` is `input: false` on the Better Auth user, so this always creates
    // the account as the default `candidate` no matter what was submitted.
    await auth.api.signUpEmail({ body: { name, email, password }, headers: await headers() })
  } catch (error) {
    if (authErrorCode(error) === 'USER_ALREADY_EXISTS') {
      return formError('An account with this email already exists', 'email')
    }
    console.error('Sign-up failed:', error)
    return formError('Could not create your account. Please try again.')
  }

  // Only now, server-side and from a validated enum, does the chosen role land
  // on the row. SPEC §3.1, §7.
  await db.update(user).set({ role }).where(eq(user.email, email))

  return { ok: true }
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() })
  } catch (error) {
    const code = authErrorCode(error)
    if (code === 'INVALID_EMAIL_OR_PASSWORD' || code === 'USER_NOT_FOUND') {
      // Deliberately one message for both: saying which half was wrong would
      // turn the form into an account-enumeration oracle.
      return formError('Incorrect email or password')
    }
    console.error('Sign-in failed:', error)
    return formError('Could not sign you in. Please try again.')
  }

  return { ok: true }
}
