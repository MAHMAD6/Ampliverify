import { NextResponse } from 'next/server';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Streams the valuation PDF from the API (the browser never talks to the API directly). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const res = await fetch(`${API_URL}/api/v1/public/valuations/${id}/pdf`, { cache: 'no-store' }).catch(() => null);
  if (!res) return new NextResponse('The service is unavailable. Please try again.', { status: 503 });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return new NextResponse(body?.error?.message ?? 'The PDF could not be generated.', { status: res.status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new NextResponse(res.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment; filename="website-value.pdf"',
      'cache-control': 'private, no-store',
    },
  });
}
