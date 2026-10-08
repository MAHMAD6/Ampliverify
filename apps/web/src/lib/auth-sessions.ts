import 'server-only';
import { authPool } from './auth-db';
import { adminGet } from './admin-data';

export type AdminMe = { userId: string; roles: string[]; permissions: string[] };

/** The signed-in administrator's platform permissions (null when not an admin). */
export function loadAdminMe() {
  return adminGet<AdminMe>('/admin/me');
}

export type SessionRow = { id: string; userId: string; email: string; name: string | null; twoFactorEnabled: boolean; ipAddress: string | null; userAgent: string | null; createdAt: Date; updatedAt: Date; expiresAt: Date };

/** Describes a user agent as "Browser on OS" without third-party parsing. */
export function describeAgent(ua: string | null) {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /node|undici|curl|python/i.test(ua) ? 'API client' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

/**
 * Sign-in sessions from the auth database. Callers must have checked the
 * administrator's `user.read` permission (see loadAdminMe) first.
 */
export async function listSessions({ activeOnly = true, sinceDays = 90 }: { activeOnly?: boolean; sinceDays?: number } = {}): Promise<SessionRow[]> {
  const { rows } = await authPool.query<SessionRow>(
    `SELECT s.id, s."userId", u.email, u.name, COALESCE(u."twoFactorEnabled", false) AS "twoFactorEnabled", s."ipAddress", s."userAgent", s."createdAt", s."updatedAt", s."expiresAt"
       FROM "session" s JOIN "user" u ON u.id = s."userId"
      WHERE ${activeOnly ? `s."expiresAt" > now()` : `s."updatedAt" > now() - make_interval(days => $1)`}
      ORDER BY s."updatedAt" DESC
      LIMIT 1000`,
    activeOnly ? [] : [sinceDays],
  );
  return rows;
}

/** Deletes sign-in sessions for an auth user (all, or one). Only call after the API authorized and audited the revocation. */
export async function deleteSessions(authUserId: string, sessionId?: string) {
  const r = sessionId ? await authPool.query('DELETE FROM "session" WHERE "userId" = $1 AND id = $2', [authUserId, sessionId]) : await authPool.query('DELETE FROM "session" WHERE "userId" = $1', [authUserId]);
  return r.rowCount ?? 0;
}
