import { NextResponse } from 'next/server';
import { apiRaw } from '@/lib/api';

/** Only these authenticated API downloads may be proxied. */
const ALLOWED = [
  /^user\/reports\/[0-9a-f-]{36}\/download\/(html|pdf|csv)$/,
  /^user\/exports\/[0-9a-f-]{36}\/download$/,
  /^admin\/applicant-files\/[0-9a-f-]{36}$/,
];

/**
 * Streams a protected file from the API with the signed-in user's token
 * (browsers cannot attach the API bearer to a plain link).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/');
  if (!ALLOWED.some((re) => re.test(path))) return new NextResponse('Not found', { status: 404 });
  const res = await apiRaw(`/${path}`);
  if (!res) return NextResponse.redirect(new URL('/login', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'));
  if (!res.ok) return new NextResponse(res.status === 403 ? 'You do not have access to this file.' : 'File not available.', { status: res.status });
  const headers = new Headers();
  for (const h of ['content-type', 'content-disposition', 'content-security-policy']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'private, no-store');
  return new NextResponse(res.body, { status: 200, headers });
}
