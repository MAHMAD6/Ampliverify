import 'server-only';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/**
 * Provisions or updates the Better Auth user in the API (`users.auth_subject`
 * = Better Auth user id). Status is never sent, so a suspension made in the
 * API is not undone by a profile change here. Throws on failure so sign-up
 * does not silently produce an account the API cannot resolve.
 */
export async function syncUserToApi(user: { id: string; email: string; name?: string | null }) {
  const secret = process.env.AUTH_SYNC_SECRET;
  if (!secret) throw new Error('AUTH_SYNC_SECRET is not set; users cannot be provisioned in the API.');
  const res = await fetch(`${API_URL}/api/v1/internal/auth/users/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-auth-sync-secret': secret },
    body: JSON.stringify({ authSubject: user.id, email: user.email, ...(user.name ? { displayName: user.name.slice(0, 160) } : {}) }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    throw new Error(`User provisioning failed (${res.status} ${body?.error?.code ?? 'UNKNOWN'}).`);
  }
}
