'use server';

import { revalidatePath } from 'next/cache';
import { apiForm, apiSend } from './api';

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; message: string; code?: string };

const ALLOWED_PREFIXES = ['/user/', '/admin/'];

/** Only plain user/admin API paths: no traversal (incl. encoded), backslashes, whitespace or schemes. */
function allowedPath(path: string) {
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) return false;
  const pathname = path.split('?')[0];
  return !/\.\.|%2e|%2f|%5c|\\|\s|:\/\//i.test(pathname);
}

/**
 * Generic authenticated API call for client components. The browser can only
 * reach the user/admin API with the signed-in user's own token, and the API
 * enforces every permission, so this adds no authority the user lacks.
 */
export async function apiAction<T = unknown>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  revalidate: string[] = [],
): Promise<ActionResult<T>> {
  if (!allowedPath(path)) {
    return { ok: false, message: 'Not allowed.' };
  }
  const result = await apiSend<T>(method, path, body);
  if (!result.ok) return { ok: false, message: result.message ?? defaultMessage(result.reason), code: result.code };
  for (const p of revalidate) if (p.startsWith('/app') || p.startsWith('/admin')) revalidatePath(p, 'layout');
  return { ok: true, data: result.data };
}

/** Multipart upload to an allowed admin/user endpoint. */
export async function uploadAction<T = unknown>(path: string, form: FormData, revalidate: string[] = []): Promise<ActionResult<T>> {
  if (!allowedPath(path)) return { ok: false, message: 'Not allowed.' };
  const result = await apiForm<T>(path, form);
  if (!result.ok) return { ok: false, message: result.message ?? defaultMessage(result.reason), code: result.code };
  for (const p of revalidate) if (p.startsWith('/app') || p.startsWith('/admin')) revalidatePath(p, 'layout');
  return { ok: true, data: result.data };
}

function defaultMessage(reason: string) {
  switch (reason) {
    case 'unauthenticated':
      return 'Please sign in to continue.';
    case 'forbidden':
      return 'You do not have permission to do this.';
    case 'not_found':
      return 'This item no longer exists.';
    case 'conflict':
      return 'This conflicts with an existing item.';
    case 'invalid':
      return 'Please check the information and try again.';
    default:
      return 'The service is unavailable. Please try again.';
  }
}

/** Authenticated GET for client components (search-as-you-type, pickers). */
export async function apiQuery<T = unknown>(path: string): Promise<ActionResult<T>> {
  if (!allowedPath(path)) return { ok: false, message: 'Not allowed.' };
  const { apiGet } = await import('./api');
  const result = await apiGet<T>(path, { auth: true });
  if (!result.ok) return { ok: false, message: defaultMessage(result.reason) };
  return { ok: true, data: result.data };
}
