'use client';

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

/** Browser client for the Better Auth endpoints under /api/auth (same origin). */
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Sign-in with MFA enabled continues on the verification page.
      onTwoFactorRedirect: () => {
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = `/login/two-factor${next ? `?next=${encodeURIComponent(next)}` : ''}`;
      },
    }),
    passkeyClient(),
  ],
});
