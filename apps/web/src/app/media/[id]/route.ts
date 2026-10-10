const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public media (images uploaded in the admin Media Library), served from the web origin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response('Not found', { status: 404 });
  const res = await fetch(`${API_URL}/api/v1/public/media/${id}`, { next: { revalidate: 3600 } });
  if (!res.ok || !res.body) return new Response('Not found', { status: 404 });
  return new Response(res.body, {
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' },
  });
}
