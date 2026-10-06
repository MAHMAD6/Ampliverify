import 'server-only';
import { getAccessToken } from './session';

/**
 * Outcome of an API read. Pages render an honest state for every failure
 * mode instead of substituting sample data.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'not_found' | 'unavailable' };

type Envelope<T> = { data: T; error: null | { code: string; message: string } };

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

type Options = {
  /** Send the user's bearer token; resolves to `unauthenticated` without one. */
  auth?: boolean;
  /** ISR seconds for public content; authenticated reads are never cached. */
  revalidate?: number;
};

export async function apiGet<T>(path: string, { auth = false, revalidate = 60 }: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (auth) {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: 'unauthenticated' };
    headers.authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      headers,
      ...(auth ? { cache: 'no-store' as const } : { next: { revalidate } }),
    });
    if (res.status === 401) return { ok: false, reason: 'unauthenticated' };
    if (res.status === 403) return { ok: false, reason: 'forbidden' };
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const body = (await res.json()) as Envelope<T>;
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Convenience: the data on success, otherwise the fallback (usually an empty list). */
export async function apiList<T>(path: string, options?: Options): Promise<T[]> {
  const result = await apiGet<T[]>(path, options);
  return result.ok ? result.data : [];
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'unavailable'; message?: string };

/** Authenticated write. Returns the API's error message for display. */
export async function apiSend<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<MutationResult<T>> {
  const token = await getAccessToken();
  if (!token) return { ok: false, reason: 'unauthenticated', message: 'Please sign in to continue.' };
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (res.ok && payload) return { ok: true, data: payload.data };
    const message = payload?.error?.message;
    const reason =
      res.status === 401 ? 'unauthenticated'
      : res.status === 403 ? 'forbidden'
      : res.status === 404 ? 'not_found'
      : res.status === 409 ? 'conflict'
      : res.status === 400 ? 'invalid'
      : 'unavailable';
    return { ok: false, reason, message };
  } catch {
    return { ok: false, reason: 'unavailable', message: 'The service is unavailable. Please try again.' };
  }
}
