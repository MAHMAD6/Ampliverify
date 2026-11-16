import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/public-origin';
import { getAccessToken } from '@/lib/session';

/**
 * Same-origin bridge for the SEO Editor Studio (public/seo-editor): the
 * editor calls /api/workspaces/:workspaceId/...; this forwards to the API
 * (/api/v1/workspaces/...) with the signed-in user's bearer token, which the
 * browser never sees. Any Authorization header from the browser is ignored.
 * Mutations must come from this site (Origin check, CSRF defence).
 *
 * Responses are unwrapped from the API envelope into the plain JSON the
 * editor expects; errors become { detail, code }. Exports stream through.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const PATH = /^[0-9a-f-]{36}(\/[A-Za-z0-9_-]{1,100}){1,6}$/;

async function forward(request: NextRequest, params: Promise<{ path: string[] }>) {
  const path = (await params).path.join('/');
  if (!PATH.test(path)) return NextResponse.json({ detail: 'Not found.' }, { status: 404 });
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (!origin || origin !== publicOrigin(request.url)) return NextResponse.json({ detail: 'Cross-site request blocked.' }, { status: 403 });
  }
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ detail: 'Your session has ended. Sign in to AmpliVerify again.', code: 'UNAUTHENTICATED' }, { status: 401 });

  const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: 'application/json' };
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'DELETE') {
    body = await request.text();
    if (body.length > 2 * 1024 * 1024) return NextResponse.json({ detail: 'The request is too large.' }, { status: 413 });
    headers['content-type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/workspaces/${path}`, { method: request.method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(180_000) });
  } catch {
    return NextResponse.json({ detail: 'The AmpliVerify service is unavailable. Try again shortly.' }, { status: 503 });
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    // Export downloads (DOCX, PDF, ZIP, HTML…).
    const out = new Headers({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    for (const h of ['content-type', 'content-disposition']) {
      const v = res.headers.get(h);
      if (v) out.set(h, v);
    }
    return new NextResponse(res.body, { status: res.status, headers: out });
  }
  const payload = (await res.json().catch(() => null)) as { data?: unknown; error?: { code?: string; message?: string } | null } | null;
  if (res.ok) return NextResponse.json(payload?.data ?? null, { status: res.status, headers: { 'cache-control': 'no-store' } });
  const detail = payload?.error?.message ?? (res.status === 403 ? 'You do not have permission for this action in this workspace.' : `Request failed (HTTP ${res.status}).`);
  return NextResponse.json({ detail, code: payload?.error?.code ?? null }, { status: res.status, headers: { 'cache-control': 'no-store' } });
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = (r: NextRequest, c: Ctx) => forward(r, c.params);
export const POST = (r: NextRequest, c: Ctx) => forward(r, c.params);
export const PUT = (r: NextRequest, c: Ctx) => forward(r, c.params);
export const DELETE = (r: NextRequest, c: Ctx) => forward(r, c.params);
