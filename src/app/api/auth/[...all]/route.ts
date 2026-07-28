// TODO(phase-3): export Better Auth's handler here —
//   import { auth } from '@/lib/auth'
//   import { toNextJsHandler } from 'better-auth/next-js'
//   export const { GET, POST } = toNextJsHandler(auth)
//
// This is the only Route Handler in the app (SPEC §5). Until Better Auth is
// wired up the segment must still export at least one HTTP method, or the
// route is invalid.

function notImplemented() {
  return new Response('Auth is not wired up yet.', { status: 501 })
}

export const GET = notImplemented
export const POST = notImplemented
