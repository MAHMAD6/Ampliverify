'use server';

import { headers } from 'next/headers';
import { getAccessToken } from './session';

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

/** Starts a website valuation: as the signed-in user when there is a session, else anonymously. */
export async function startValuation(domain: string) {
  const token = await getAccessToken();
  const body = JSON.stringify({ domain: domain.slice(0, 2048) });
  if (token) {
    return send<{ id: string; cached: boolean }>('/user/valuations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body });
  }
  return send<{ id: string; cached: boolean }>('/public/valuations', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
}

/** Projected range and confidence for the enhance page (nothing is saved). */
export async function previewValuation(id: string, business: { monthlyRevenue?: number; annualRevenue?: number; profitMargin?: string; monthlyVisits?: number }, planned: string[]) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false as const, message: 'Valuation not found.' };
  return send<{ valueLow: number; valueHigh: number; valueMid: number; currency: string; confidence: number; confidenceLabel: string }>(`/public/valuations/${id}/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ business, planned }),
  });
}

/** Verified valuation (signed-in): connected GA4 / Search Console and business details. */
export async function verifyValuation(id: string, inputs: Record<string, unknown>) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false as const, message: 'Valuation not found.' };
  const token = await getAccessToken();
  if (!token) return { ok: false as const, message: 'Please sign in to connect your data.' };
  return send<{ id: string }>(`/user/valuations/${id}/verify`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(inputs) });
}
