import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'

// The only Route Handler in the app. Reads go through Server Components and
// writes through Server Actions — see SPEC §5.
export const { GET, POST } = toNextJsHandler(auth)
