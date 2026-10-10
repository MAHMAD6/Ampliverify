import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { safeFetch } from '../common/utils/safe-fetch';

/** What every CMS connector publishes: a saved editor document. */
export type PublishContent = { documentId: string; title: string; html: string; metaDescription: string; slug?: string; focusKeyword?: string };
export type PublishInput = { status: 'draft' | 'publish'; type: 'posts' | 'pages'; remoteId?: string | number | null };
export type PublishResult = { remoteId: string; link: string | null; status: string };

const json = (body: string) => {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
};
const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'untitled';

// ── Webflow (Data API v2, site API token with CMS write scope) ──────────────

export type WebflowSecret = { token: string; collectionId: string; bodyField: string; summaryField?: string | null };

/** Validates the token and collection, and picks the rich-text field that receives the article body. */
export async function webflowConnect(token: string, collectionId: string, allowPrivate: boolean) {
  if (!/^[a-f0-9]{24}$/i.test(collectionId)) throw new BadRequestException({ code: 'WEBFLOW_COLLECTION_INVALID', message: 'Enter the 24-character collection ID from Webflow (CMS → Collection settings).' });
  const res = await safeFetch(`https://api.webflow.com/v2/collections/${collectionId}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, allowPrivate, maxBytes: 1024 * 1024 }).catch(() => null);
  if (!res) throw new BadRequestException({ code: 'WEBFLOW_UNREACHABLE', message: 'We could not reach Webflow.' });
  if (res.status === 401 || res.status === 403) throw new BadRequestException({ code: 'WEBFLOW_AUTH_FAILED', message: 'Webflow rejected the API token (it needs CMS read and write access).' });
  if (res.status !== 200) throw new BadRequestException({ code: 'WEBFLOW_COLLECTION_NOT_FOUND', message: `Webflow returned HTTP ${res.status} for this collection.` });
  const c = json(res.body) as { displayName?: string; fields?: { slug: string; type: string; displayName?: string }[] };
  const fields = c.fields ?? [];
  const body = fields.find((f) => f.type === 'RichText');
  if (!body) throw new BadRequestException({ code: 'WEBFLOW_NO_RICH_TEXT', message: 'This collection has no Rich Text field to hold the article body.' });
  const summary = fields.find((f) => f.type === 'PlainText' && /summary|excerpt|description/i.test(`${f.slug} ${f.displayName ?? ''}`));
  return { account: c.displayName ?? `Collection ${collectionId}`, secret: { token, collectionId, bodyField: body.slug, summaryField: summary?.slug ?? null } satisfies WebflowSecret };
}

export async function webflowPublish(s: WebflowSecret, c: PublishContent, input: PublishInput, allowPrivate: boolean): Promise<PublishResult> {
  const live = input.status === 'publish';
  const fieldData: Record<string, unknown> = { name: c.title, slug: slugify(c.slug || c.title), [s.bodyField]: c.html };
  if (s.summaryField && c.metaDescription) fieldData[s.summaryField] = c.metaDescription;
  const base = `https://api.webflow.com/v2/collections/${s.collectionId}/items`;
  const url = input.remoteId ? `${base}/${input.remoteId}${live ? '/live' : ''}` : `${base}${live ? '/live' : ''}`;
  const res = await safeFetch(url, {
    method: input.remoteId ? 'PATCH' : 'POST',
    headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ isDraft: !live, isArchived: false, fieldData }),
    allowPrivate,
    maxBytes: 1024 * 1024,
  }).catch((e) => ({ status: 0, body: String(e) }));
  if (res.status < 200 || res.status >= 300) throw publishError('Webflow', res.status);
  const item = json(res.body) as { id?: string };
  return { remoteId: String(item.id ?? input.remoteId), link: null, status: live ? 'published' : 'draft' };
}

// ── Shopify (Admin REST API, custom-app access token) ───────────────────────

export type ShopifySecret = { shop: string; token: string; blogId?: number | null };
const SHOPIFY_API = '2024-10';

export function shopifyDomain(input: string) {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  // Only *.myshopify.com admin hosts: the token is never sent anywhere else.
  if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(host)) throw new BadRequestException({ code: 'SHOPIFY_DOMAIN_INVALID', message: 'Enter your store’s myshopify.com address, e.g. your-store.myshopify.com.' });
  return host;
}

const shopifyHeaders = (token: string) => ({ 'x-shopify-access-token': token, 'content-type': 'application/json', accept: 'application/json' });

export async function shopifyConnect(shopInput: string, token: string, allowPrivate: boolean) {
  const shop = shopifyDomain(shopInput);
  const res = await safeFetch(`https://${shop}/admin/api/${SHOPIFY_API}/shop.json`, { headers: shopifyHeaders(token), allowPrivate, maxBytes: 512 * 1024 }).catch(() => null);
  if (!res) throw new BadRequestException({ code: 'SHOPIFY_UNREACHABLE', message: 'We could not reach this Shopify store.' });
  if (res.status === 401 || res.status === 403) throw new BadRequestException({ code: 'SHOPIFY_AUTH_FAILED', message: 'Shopify rejected the access token (it needs read/write access to online store content).' });
  if (res.status !== 200) throw new BadRequestException({ code: 'SHOPIFY_API_UNAVAILABLE', message: `Shopify returned HTTP ${res.status}.` });
  const blogs = await safeFetch(`https://${shop}/admin/api/${SHOPIFY_API}/blogs.json?limit=1`, { headers: shopifyHeaders(token), allowPrivate, maxBytes: 512 * 1024 }).catch(() => null);
  const blogId = blogs?.status === 200 ? ((json(blogs.body).blogs as { id: number }[] | undefined)?.[0]?.id ?? null) : null;
  return { account: shop, secret: { shop, token, blogId } satisfies ShopifySecret };
}

export async function shopifyPublish(s: ShopifySecret, c: PublishContent, input: PublishInput, allowPrivate: boolean): Promise<PublishResult> {
  const published = input.status === 'publish';
  const handle = slugify(c.slug || c.title);
  let path: string;
  let payload: Record<string, unknown>;
  if (input.type === 'pages') {
    path = `pages${input.remoteId ? `/${input.remoteId}` : ''}.json`;
    payload = { page: { title: c.title, body_html: c.html, handle, published } };
  } else {
    if (!s.blogId) throw new BadRequestException({ code: 'SHOPIFY_NO_BLOG', message: 'This store has no blog. Create one in Shopify, or publish as a page.' });
    path = `blogs/${s.blogId}/articles${input.remoteId ? `/${input.remoteId}` : ''}.json`;
    payload = { article: { title: c.title, body_html: c.html, handle, published, ...(c.metaDescription ? { summary_html: `<p>${escapeHtml(c.metaDescription)}</p>` } : {}) } };
  }
  const res = await safeFetch(`https://${s.shop}/admin/api/${SHOPIFY_API}/${path}`, {
    method: input.remoteId ? 'PUT' : 'POST',
    headers: shopifyHeaders(s.token),
    body: JSON.stringify(payload),
    allowPrivate,
    maxBytes: 2 * 1024 * 1024,
  }).catch((e) => ({ status: 0, body: String(e) }));
  if (res.status !== 200 && res.status !== 201) throw publishError('Shopify', res.status);
  const body = json(res.body);
  const record = (body.page ?? body.article ?? {}) as { id?: number; handle?: string };
  const link = record.handle && input.type === 'pages' ? `https://${s.shop}/pages/${record.handle}` : null;
  return { remoteId: String(record.id ?? input.remoteId), link, status: published ? 'published' : 'draft' };
}

// ── Custom (API): signed webhook to the customer's endpoint ─────────────────

export type WebhookSecret = { url: string; signingSecret: string };

/** `X-AmpliVerify-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">` (same scheme as Stripe). */
export function signWebhook(secret: string, body: string, at = Math.floor(Date.now() / 1000)) {
  return `t=${at},v1=${createHmac('sha256', secret).update(`${at}.${body}`).digest('hex')}`;
}

export async function webhookSend(s: WebhookSecret, event: string, data: Record<string, unknown>, allowPrivate: boolean): Promise<{ status: number; body: string }> {
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data });
  return safeFetch(s.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'AmpliVerify-Webhook/1.0', 'x-ampliverify-event': event, 'x-ampliverify-signature': signWebhook(s.signingSecret, body) },
    body,
    allowPrivate,
    maxBytes: 256 * 1024,
  }).catch((e) => ({ status: 0, body: String(e) }));
}

export async function webhookPublish(s: WebhookSecret, c: PublishContent, input: PublishInput, allowPrivate: boolean): Promise<PublishResult> {
  const res = await webhookSend(s, 'document.publish', { document: { id: c.documentId, title: c.title, slug: c.slug ?? null, html: c.html, metaDescription: c.metaDescription, focusKeyword: c.focusKeyword ?? null }, status: input.status, type: input.type, remoteId: input.remoteId ?? null }, allowPrivate);
  if (res.status < 200 || res.status >= 300) throw publishError('Your endpoint', res.status);
  const reply = json(res.body) as { id?: string | number; url?: string };
  const link = typeof reply.url === 'string' && /^https:\/\//.test(reply.url) ? reply.url.slice(0, 2000) : null;
  return { remoteId: String(reply.id ?? input.remoteId ?? c.documentId), link, status: input.status === 'publish' ? 'published' : 'draft' };
}

function publishError(target: string, status: number) {
  return new BadRequestException({
    code: 'PUBLISH_FAILED',
    message: status === 401 || status === 403 ? `${target} rejected the credentials. Reconnect the integration.` : status === 0 ? `${target} could not be reached.` : `${target} could not save the content (HTTP ${status}).`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
