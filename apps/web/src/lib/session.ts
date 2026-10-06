import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from './auth';

/** The Better Auth session for this request, or null. Memoized per request. */
export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
});

/**
 * Short-lived API bearer JWT (jwt plugin; audience BETTER_AUTH_AUDIENCE) for
 * the signed-in user, or null. Minted once per request.
 */
export const getAccessToken = cache(async (): Promise<string | null> => {
  if (!(await getSession())) return null;
  try {
    const { token } = await auth.api.getToken({ headers: await headers() });
    return token ?? null;
  } catch {
    return null;
  }
});
