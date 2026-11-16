import { NextResponse, type NextRequest } from 'next/server';

/**
 * Approved editor media (V13.2 guide §6, phase E): stable HTTPS URLs that
 * published articles reference. Only media that passed the approval
 * pipeline is served; Range requests are passed through for video seeking.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif|mp4|webm)$/.test(file)) return new NextResponse('Not found', { status: 404 });
  const range = request.headers.get('range');
  const res = await fetch(`${API_URL}/api/v1/studio/media/${file}`, { headers: range ? { range } : {}, redirect: 'manual', cache: 'no-store' }).catch(() => null);
  if (!res) return new NextResponse('Unavailable', { status: 503 });
  const location = res.headers.get('location');
  if (res.status === 302 && location && /^https:\/\//.test(location)) return NextResponse.redirect(location, { status: 302, headers: { 'cache-control': 'public, max-age=1800' } });
  if (!res.ok) return new NextResponse('Not found', { status: 404 });
  const headers = new Headers({ 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'cross-origin' });
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(res.body, { status: res.status, headers });
}
