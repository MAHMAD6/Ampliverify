import { NextResponse } from 'next/server';

/**
 * Hosted form page (V13 hosted-form): brand-neutral, embeddable on customer
 * sites. Its own CSP comes from the API; the site-wide headers in
 * next.config are not applied to /forms/public/*.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Form not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const res = await fetch(`${API_URL}/api/v1/forms/public/${id}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) {
    return new NextResponse(res?.status === 404 ? 'This form is not available.' : 'This form is temporarily unavailable.', { status: res?.status === 404 ? 404 : 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' });
  const csp = res.headers.get('content-security-policy');
  if (csp) headers.set('content-security-policy', csp);
  return new NextResponse(await res.text(), { status: 200, headers });
}
