import { NextResponse, type NextRequest } from 'next/server';

/**
 * Public form submission. Embedded forms run in sandboxed iframes on
 * customer sites (opaque origin), so this endpoint answers CORS for any
 * origin without credentials. Validation, bot defence, rate limits and
 * encryption happen in the API.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ detail: 'Form not found.' }, { status: 404, headers: CORS });
  const body = await request.text();
  if (body.length > 64 * 1024) return NextResponse.json({ detail: 'The submission is too large.' }, { status: 413, headers: CORS });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  if (ip) headers['x-forwarded-for'] = ip;
  const res = await fetch(`${API_URL}/api/v1/forms/public/${id}/submit`, { method: 'POST', headers, body, cache: 'no-store' }).catch(() => null);
  if (!res) return NextResponse.json({ detail: 'The form service is unavailable. Please try again.' }, { status: 503, headers: CORS });
  const payload = (await res.json().catch(() => null)) as { data?: unknown; error?: { message?: string } | null } | null;
  if (res.ok) return NextResponse.json(payload?.data ?? { success: true }, { headers: CORS });
  return NextResponse.json({ detail: res.status === 429 ? 'Too many submissions. Please wait a minute.' : (payload?.error?.message ?? 'The form could not be sent.') }, { status: res.status, headers: CORS });
}
