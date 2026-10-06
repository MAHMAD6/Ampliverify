import 'server-only';

/**
 * Returns the Better Auth API bearer token for the current request, or null.
 *
 * Sign-in is not wired yet (the auth screens have not been supplied), so this
 * always returns null and authenticated pages render their signed-out /
 * empty states. Once Better Auth runs in this app, read the session here and
 * return its API JWT (audience BETTER_AUTH_AUDIENCE).
 */
export async function getAccessToken(): Promise<string | null> {
  return null;
}
