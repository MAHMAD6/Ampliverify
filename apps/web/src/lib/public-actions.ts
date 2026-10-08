'use server';

import { headers } from 'next/headers';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export type PublicResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** The visitor's address, forwarded so the API's per-IP limits apply to them, not to this server. */
async function clientHeaders(): Promise<Record<string, string>> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '';
  return ip ? { 'x-forwarded-for': ip } : {};
}

async function send<T>(path: string, init: RequestInit): Promise<PublicResult<T>> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { ...init, cache: 'no-store', headers: { accept: 'application/json', ...(await clientHeaders()), ...(init.headers as Record<string, string>) } });
    const body = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
    if (!res.ok) return { ok: false, message: body?.error?.message ?? 'Something went wrong. Please try again.' };
    return { ok: true, data: body?.data as T };
  } catch {
    return { ok: false, message: 'The service is unavailable. Please try again.' };
  }
}

/** Public contact form (POST /public/contact). */
export async function submitContact(values: { name: string; email: string; company?: string; topic: string; message: string; website?: string }) {
  return send<{ received: boolean; reference?: string }>('/public/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
}

/** Job application with optional résumé and cover letter (multipart, POST /public/careers/:slug/apply). */
export async function submitApplication(slug: string, form: FormData) {
  form.delete('consent');
  for (const key of ['resume', 'coverLetter']) {
    const f = form.get(key);
    if (f instanceof File && f.size === 0) form.delete(key);
  }
  for (const [key, value] of Array.from(form.entries())) if (typeof value === 'string' && !value.trim()) form.delete(key);
  return send<{ received: boolean; receipt: string | null }>(`/public/careers/${encodeURIComponent(slug)}/apply`, { method: 'POST', body: form });
}
