import { NextResponse } from 'next/server';
import { apiRaw } from '@/lib/api';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const INLINE = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm))$/;

/**
 * Listing images and videos. Published media come from the public API; a
 * seller previewing an unpublished listing is served with their own token.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  let res = await fetch(`${API_URL}/api/v1/public/marketplace/media/${id}`, { cache: 'no-store', redirect: 'manual' }).catch(() => null);
  if (!res || res.status === 404) res = (await apiRaw(`/user/marketplace/media/${id}`).catch(() => null)) ?? res;
  if (!res) return new NextResponse('Not found', { status: 404 });
  const location = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && location && /^https:\/\//.test(location)) {
    return new NextResponse(null, { status: 302, headers: { location, 'cache-control': 'private, no-store' } });
  }
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  // Only images and videos are rendered inline.
  if (!res.ok || !INLINE.test(type)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(res.body, {
    status: 200,
    headers: { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=300', 'content-security-policy': "default-src 'none'" },
  });
}
