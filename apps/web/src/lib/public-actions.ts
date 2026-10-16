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

const ID = /^[0-9a-f-]{36}$/i;
const TOKEN = /^[\w-]{10,64}$/;
const tq = (t?: string) => (t && TOKEN.test(t) ? `?t=${encodeURIComponent(t)}` : '');

/** Starts a website valuation (POST /valuations): as the signed-in user when there is a session, else anonymously. */
export async function startValuation(domain: string, consentVersion: string, idempotencyKey: string) {
  const token = await getAccessToken();
  const body = JSON.stringify({ domain: domain.slice(0, 2048), consentVersion, idempotencyKey });
  const path = token ? '/user/valuations' : '/public/valuations';
  return send<{ id: string; status: string; shareToken: string }>(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body });
}

/** Projection for the enhance page; nothing is saved. */
export async function previewValuation(id: string, shareToken: string, financial: { ttmRevenue?: number; ttmExpenses?: number; ttmProfit?: number; businessModel?: string }, planned: string[]) {
  if (!ID.test(id)) return { ok: false as const, message: 'Valuation not found.' };
  const token = await getAccessToken();
  const path = token ? `/user/valuations/${id}/preview${tq(shareToken)}` : `/public/valuations/${id}/preview${tq(shareToken)}`;
  return send<{ qualityScore: number | null; confidence: string; monetaryRange: { low: number; high: number; currency: string } | null; limitations: string[] }>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ financial, planned }),
  });
}

/** Enhanced valuation (signed-in): GA4 / Search Console and self-reported financials. */
export async function verifyValuation(id: string, shareToken: string, inputs: Record<string, unknown>) {
  if (!ID.test(id)) return { ok: false as const, message: 'Valuation not found.' };
  const token = await getAccessToken();
  if (!token) return { ok: false as const, message: 'Please sign in to connect your data.' };
  return send<{ id: string; status: string; shareToken: string }>(`/user/valuations/${id}/verify${tq(shareToken)}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(inputs) });
}

/** Cancels a queued valuation. */
export async function cancelValuation(id: string, shareToken: string) {
  if (!ID.test(id)) return { ok: false as const, message: 'Valuation not found.' };
  const token = await getAccessToken();
  return send<{ id: string; status: string }>(token ? `/user/valuations/${id}/cancel${tq(shareToken)}` : `/public/valuations/${id}/cancel${tq(shareToken)}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
}

const ARTICLE_KINDS = ['blog', 'guides'] as const;
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;

/** Newsletter sign-up (double opt-in; POST /public/newsletter). */
export async function subscribeNewsletter(values: { email: string; source?: string; website?: string }) {
  return send<{ received: boolean }>('/public/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
}

/** "Was this article helpful?" vote. */
export async function voteArticle(kind: (typeof ARTICLE_KINDS)[number], slug: string, helpful: boolean) {
  if (!ARTICLE_KINDS.includes(kind) || !SLUG.test(slug)) return { ok: false as const, message: 'Article not found.' };
  return send<{ recorded: boolean }>(`/public/${kind}/${slug}/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ helpful }) });
}

/** Reader comment (held for moderation). */
export async function postComment(kind: (typeof ARTICLE_KINDS)[number], slug: string, values: { name: string; email: string; body: string; website?: string }) {
  if (!ARTICLE_KINDS.includes(kind) || !SLUG.test(slug)) return { ok: false as const, message: 'Article not found.' };
  return send<{ received: boolean }>(`/public/${kind}/${slug}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
}

/** Newsletter confirmation / unsubscribe links. */
export async function newsletterToken(action: 'confirm' | 'unsubscribe', token: string) {
  if (!/^[\w-]{10,100}$/.test(token)) return { ok: false as const, message: 'This link is invalid.' };
  return send<{ subscribed?: boolean; unsubscribed?: boolean; unsubscribeToken?: string }>(`/public/newsletter/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
}
