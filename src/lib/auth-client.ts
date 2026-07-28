import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import type { auth } from '@/lib/auth'

export const authClient = createAuthClient({
  // Without this plugin `session.user.role` would not exist on the client type.
  plugins: [inferAdditionalFields<typeof auth>()],
})
