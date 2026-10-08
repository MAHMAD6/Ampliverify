'use server';

import { revalidatePath } from 'next/cache';
import { apiAction, type ActionResult } from './actions';
import { deleteSessions } from './auth-sessions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Revokes sign-in sessions for a user. The API authorizes (`user.manage`)
 * and writes the audit record first; only then are the sessions deleted
 * from the auth database.
 */
export async function revokeUserSessions(userId: string, reason: string, sessionId?: string): Promise<ActionResult<{ revoked: number }>> {
  if (!UUID.test(userId)) return { ok: false, message: 'Unknown user.' };
  const r = await apiAction<{ authSubject: string }>('POST', `/admin/users/${userId}/sessions/revoke`, { reason, ...(sessionId ? { sessionId } : {}) });
  if (!r.ok) return r;
  const revoked = await deleteSessions(r.data.authSubject, sessionId);
  revalidatePath('/admin/security');
  return { ok: true, data: { revoked } };
}

/** Suspends or reactivates a user; suspension also signs them out everywhere. */
export async function setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string): Promise<ActionResult<{ status: string }>> {
  if (!UUID.test(userId)) return { ok: false, message: 'Unknown user.' };
  const r = await apiAction<{ status: string }>('POST', `/admin/users/${userId}/status`, { status, reason });
  if (!r.ok) return r;
  if (status === 'SUSPENDED') {
    const s = await revokeUserSessions(userId, `Suspended: ${reason}`);
    if (!s.ok) return { ok: false, message: `Suspended, but sessions could not be revoked: ${s.message}` };
  }
  revalidatePath('/admin/users');
  revalidatePath('/admin/security');
  return { ok: true, data: { status: r.data.status } };
}
