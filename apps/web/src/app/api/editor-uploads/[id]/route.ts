import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/public-origin';

/**
 * Signed direct-upload target for editor media (V13.2 guide §6, phase B).
 * The browser posts the file with the signed fields from /media/init and
 * without any AmpliVerify token; the API verifies the signature, expiry and
 * exact size. The body is streamed through, not buffered here.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const MAX_BYTES = 100 * 1024 * 1024 + 64 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ detail: 'Not found.' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== publicOrigin(request.url)) return NextResponse.json({ detail: 'Cross-site upload blocked.' }, { status: 403 });
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!length || length > MAX_BYTES) return NextResponse.json({ detail: 'The file is too large.' }, { status: 413 });
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data')) return NextResponse.json({ detail: 'Upload the file as multipart form data.' }, { status: 400 });
  const headers: Record<string, string> = { 'content-type': type, 'content-length': String(length) };
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/studio/uploads/${id}`, { method: 'POST', headers, body: request.body, cache: 'no-store', duplex: 'half', signal: AbortSignal.timeout(15 * 60_000) } as RequestInit & { duplex: 'half' });
  } catch {
    return NextResponse.json({ detail: 'The upload service is unavailable.' }, { status: 503 });
  }
  const payload = (await res.json().catch(() => null)) as { data?: unknown; error?: { message?: string } | null } | null;
  if (res.ok) return NextResponse.json(payload?.data ?? { received: true });
  return NextResponse.json({ detail: payload?.error?.message ?? `Upload failed (HTTP ${res.status}).` }, { status: res.status });
}
