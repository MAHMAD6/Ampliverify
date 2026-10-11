import { getAccessToken } from '@/lib/session';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** CSV export of confirmed subscribers (the API authorizes and audits it). */
export async function GET() {
  const token = await getAccessToken();
  if (!token) return new Response('Please sign in.', { status: 401 });
  const res = await fetch(`${API_URL}/api/v1/admin/newsletter/export`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return new Response(res.status === 403 ? 'You do not have access.' : 'Export failed.', { status: res.status });
  return new Response(await res.text(), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="newsletter-subscribers.csv"', 'cache-control': 'no-store' },
  });
}
