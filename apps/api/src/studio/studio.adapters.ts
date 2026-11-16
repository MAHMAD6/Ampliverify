import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac } from 'crypto';
import { safeFetch, SafeFetchError } from '../common/utils/safe-fetch';

/**
 * The editor's eight CMS connectors (V13 package adapters.ts) behind one
 * publish contract. Every request goes through safeFetch: public addresses
 * only (DNS checked on every hop), no redirects, bounded responses and a
 * timeout. Hosts may additionally be limited with PUBLISH_ALLOWED_HOSTS.
 */
export const PROVIDERS = ['wordpress', 'shopify', 'webflow', 'ghost', 'drupal', 'joomla', 'strapi', 'custom'] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Connector configuration fields (the editor's connection form). */
export const PROVIDER_FIELDS: Record<Provider, { required: string[]; optional: string[] }> = {
  wordpress: { required: ['site', 'username', 'token'], optional: [] },
  shopify: { required: ['shop', 'token', 'blog_id', 'author'], optional: [] },
  webflow: { required: ['token', 'collection_id'], optional: ['body_field', 'description_field'] },
  ghost: { required: ['site', 'token'], optional: ['updated_at'] },
  drupal: { required: ['site', 'token'], optional: ['bundle', 'text_format'] },
  joomla: { required: ['site', 'token', 'category_id'], optional: [] },
  strapi: { required: ['site', 'token', 'collection'], optional: ['title_field', 'body_field', 'slug_field'] },
  custom: { required: ['endpoint', 'token'], optional: [] },
};

export type ConnectorConfig = Record<string, string>;
export type PublishArticle = { title: string; html: string; description: string; status: 'draft' | 'publish' };
export type PublishOutcome = { id: string; state: string; url: string | null };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'article';

const bad = (code: string, message: string) => new BadRequestException({ code, message });

/** Validates and normalizes a connector configuration; returns the destination host for display. */
export function normalizeConfig(provider: Provider, input: unknown): { config: ConnectorConfig; host: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const spec = PROVIDER_FIELDS[provider];
  const config: ConnectorConfig = {};
  for (const key of [...spec.required, ...spec.optional]) {
    const v = raw[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' || v.length > 4000 || /[\r\n]/.test(v)) throw bad('INVALID_CONNECTOR', `Invalid value for ${key}.`);
    config[key] = v.trim();
  }
  for (const key of spec.required) if (!config[key]) throw bad('INVALID_CONNECTOR', `Missing connector field ${key.replace(/_/g, ' ')}.`);
  let host: string;
  if (provider === 'shopify') {
    config.shop = config.shop.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(config.shop)) throw bad('INVALID_CONNECTOR', 'Enter the store address, e.g. your-store.myshopify.com.');
    host = config.shop;
  } else if (provider === 'webflow') {
    if (!/^[a-z0-9]{6,64}$/i.test(config.collection_id)) throw bad('INVALID_CONNECTOR', 'Enter the Webflow collection ID.');
    host = 'api.webflow.com';
  } else {
    const field = provider === 'custom' ? 'endpoint' : 'site';
    const u = destination(config[field]);
    config[field] = provider === 'custom' ? u.toString() : u.origin + u.pathname.replace(/\/$/, '');
    host = u.hostname;
  }
  if (provider === 'ghost' && !/^[a-f0-9]{24}:[a-f0-9]{64}$/i.test(config.token)) throw bad('INVALID_CONNECTOR', 'Enter the Ghost Admin API key (id:secret).');
  if (provider === 'drupal' && config.bundle && !/^[a-z][a-z0-9_]*$/.test(config.bundle)) throw bad('INVALID_CONNECTOR', 'Invalid Drupal content type.');
  if (provider === 'joomla' && !/^\d{1,10}$/.test(config.category_id)) throw bad('INVALID_CONNECTOR', 'Joomla category ID must be a number.');
  if (provider === 'strapi' && !/^[a-z][a-z0-9-]*$/.test(config.collection)) throw bad('INVALID_CONNECTOR', 'Invalid Strapi collection (plural API ID).');
  for (const k of ['body_field', 'description_field', 'title_field', 'slug_field', 'text_format']) {
    if (config[k] && !/^[a-zA-Z0-9_-]{1,100}$/.test(config[k])) throw bad('INVALID_CONNECTOR', `Invalid ${k.replace(/_/g, ' ')}.`);
  }
  return { config, host };
}

/** HTTPS only, no embedded credentials or custom ports, never local names; optional host allowlist. */
export function destination(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw bad('INVALID_DESTINATION', 'Enter the full https:// address of the CMS.');
  }
  const allowPrivate = process.env.AUDIT_ALLOW_PRIVATE_HOSTS === 'true';
  if (!allowPrivate && (u.protocol !== 'https:' || (u.port && u.port !== '443'))) throw bad('INVALID_DESTINATION', 'CMS addresses must use https:// on the standard port.');
  if (u.username || u.password || u.hash) throw bad('INVALID_DESTINATION', 'Remove credentials and # fragments from the CMS address.');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!allowPrivate && (host === 'localhost' || /\.(local|internal|localhost)$/.test(host))) throw bad('PRIVATE_DESTINATION', 'Private CMS hosts are not allowed.');
  const allowed = (process.env.PUBLISH_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(host)) throw bad('DESTINATION_NOT_APPROVED', 'This CMS host is not approved for publishing.');
  return u;
}

type Json = Record<string, unknown>;

async function cms(method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, headers: Record<string, string>, body?: unknown): Promise<Json> {
  const allowPrivate = process.env.AUDIT_ALLOW_PRIVATE_HOSTS === 'true';
  let res;
  try {
    res = await safeFetch(url, { method, headers: { accept: 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body), maxRedirects: 0, timeoutMs: 18_000, maxBytes: 2_000_000, allowPrivate });
  } catch (e) {
    const code = e instanceof SafeFetchError ? e.code : 'NETWORK';
    throw new HttpException({ code: `CMS_${code}`, message: code === 'BLOCKED_HOST' ? 'The CMS address resolves to a restricted network.' : 'The CMS could not be reached.' }, HttpStatus.BAD_GATEWAY);
  }
  if (res.status === 401 || res.status === 403) throw new HttpException({ code: 'CMS_AUTH_FAILED', message: `The CMS rejected the credentials (HTTP ${res.status}).` }, HttpStatus.BAD_GATEWAY);
  if (res.status === 429) throw new HttpException({ code: 'CMS_RATE_LIMITED', message: 'The CMS is rate limiting requests. Try again later.' }, HttpStatus.BAD_GATEWAY);
  if (res.status >= 500) throw new HttpException({ code: 'CMS_SERVER_ERROR', message: `The CMS returned HTTP ${res.status}; the outcome is uncertain.` }, HttpStatus.BAD_GATEWAY);
  if (res.status < 200 || res.status >= 300) throw new HttpException({ code: 'CMS_REJECTED', message: `The CMS returned HTTP ${res.status}.` }, HttpStatus.BAD_GATEWAY);
  if (res.truncated) throw new HttpException({ code: 'CMS_RESPONSE_TOO_LARGE', message: 'The CMS response was too large.' }, HttpStatus.BAD_GATEWAY);
  if (!res.body.trim()) return {};
  try {
    return JSON.parse(res.body) as Json;
  } catch {
    throw new HttpException({ code: 'CMS_INVALID_RESPONSE', message: 'The CMS returned a non-JSON response.' }, HttpStatus.BAD_GATEWAY);
  }
}

const bearer = (c: ConnectorConfig) => ({ authorization: `Bearer ${c.token}`, 'content-type': 'application/json' });
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function ghostToken(key: string) {
  const [id, secret] = key.split(':');
  const enc = (x: unknown) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const signed = `${enc({ alg: 'HS256', typ: 'JWT', kid: id })}.${enc({ iat: now, exp: now + 300, aud: '/admin/' })}`;
  return `${signed}.${createHmac('sha256', Buffer.from(secret, 'hex')).update(signed).digest('base64url')}`;
}

/** Creates or updates the article at the destination; `externalId` comes from the saved publication mapping. */
export async function publishTo(provider: Provider, c: ConnectorConfig, article: PublishArticle, externalId: string | null): Promise<PublishOutcome> {
  const title = article.title.slice(0, 300);
  const body = article.html;
  const description = article.description.slice(0, 500);
  const handle = slug(title);
  const live = article.status === 'publish';
  const id = externalId ? encodeURIComponent(externalId) : null;

  switch (provider) {
    case 'wordpress': {
      const auth = `Basic ${Buffer.from(`${c.username}:${c.token}`).toString('base64')}`;
      const res = await cms('POST', `${c.site}/wp-json/wp/v2/posts${id ? `/${id}` : ''}`, { authorization: auth, 'content-type': 'application/json' }, { title, content: body, slug: handle, status: live ? 'publish' : 'draft', excerpt: description });
      return { id: str(res.id), state: str(res.status) || (live ? 'published' : 'draft'), url: str(res.link) || null };
    }
    case 'shopify': {
      const data: Json = { title, body, handle, author: { name: c.author }, isPublished: live, ...(externalId ? {} : { blogId: c.blog_id }) };
      const op = externalId ? 'articleUpdate' : 'articleCreate';
      const query = externalId
        ? 'mutation($id:ID!,$article:ArticleUpdateInput!){articleUpdate(id:$id,article:$article){article{id handle isPublished} userErrors{message}}}'
        : 'mutation($article:ArticleCreateInput!){articleCreate(article:$article){article{id handle isPublished} userErrors{message}}}';
      const res = await cms('POST', `https://${c.shop}/admin/api/2026-10/graphql.json`, { 'content-type': 'application/json', 'x-shopify-access-token': c.token }, { query, variables: externalId ? { id: externalId, article: data } : { article: data } });
      const r = (res.data as Json | undefined)?.[op] as { article?: { id?: string }; userErrors?: { message: string }[] } | undefined;
      if ((res.errors as unknown[] | undefined)?.length || r?.userErrors?.length) throw new HttpException({ code: 'CMS_REJECTED', message: `Shopify rejected the article: ${r?.userErrors?.[0]?.message ?? 'GraphQL error'}` }, HttpStatus.BAD_GATEWAY);
      return { id: str(r?.article?.id), state: live ? 'published' : 'draft', url: null };
    }
    case 'webflow': {
      const fieldData: Json = { name: title, slug: handle, [c.body_field || 'post-body']: body };
      if (c.description_field && description) fieldData[c.description_field] = description;
      const root = `https://api.webflow.com/v2/collections/${encodeURIComponent(c.collection_id)}/items`;
      const res = await cms(id ? 'PATCH' : 'POST', `${root}${id ? `/${id}` : ''}${live ? '/live' : ''}`, bearer(c), { isDraft: !live, isArchived: false, fieldData });
      return { id: str(res.id) || str(externalId), state: live ? 'published' : 'staged', url: null };
    }
    case 'ghost': {
      const headers = { authorization: `Ghost ${ghostToken(c.token)}`, 'content-type': 'application/json', 'accept-version': 'v5.0' };
      const post: Json = { title, slug: handle, html: body, status: live ? 'published' : 'draft', custom_excerpt: description };
      if (id) {
        // Ghost requires the post's current updated_at for edits (collision detection).
        const current = await cms('GET', `${c.site}/ghost/api/admin/posts/${id}/`, headers);
        post.updated_at = str(((current.posts as Json[] | undefined)?.[0] ?? {}).updated_at) || c.updated_at;
      }
      const res = await cms(id ? 'PUT' : 'POST', `${c.site}/ghost/api/admin/posts/${id ? `${id}/` : ''}?source=html`, headers, { posts: [post] });
      const r = ((res.posts as Json[] | undefined)?.[0] ?? {}) as Json;
      return { id: str(r.id), state: str(r.status) || (live ? 'published' : 'draft'), url: str(r.url) || null };
    }
    case 'drupal': {
      const bundle = c.bundle || 'article';
      const res = await cms(
        id ? 'PATCH' : 'POST',
        `${c.site}/jsonapi/node/${bundle}${id ? `/${id}` : ''}`,
        { authorization: `Bearer ${c.token}`, 'content-type': 'application/vnd.api+json', accept: 'application/vnd.api+json' },
        { data: { type: `node--${bundle}`, ...(externalId ? { id: externalId } : {}), attributes: { title, body: { value: body, format: c.text_format || 'basic_html', summary: description }, status: live } } },
      );
      return { id: str((res.data as Json | undefined)?.id), state: live ? 'published' : 'draft', url: null };
    }
    case 'joomla': {
      const res = await cms(id ? 'PATCH' : 'POST', `${c.site}/api/index.php/v1/content/articles${id ? `/${id}` : ''}`, { 'x-joomla-token': c.token, 'content-type': 'application/json' }, { title, alias: handle, articletext: body, catid: Number(c.category_id), state: live ? 1 : 0, language: '*', metadesc: description });
      return { id: str((res.data as Json | undefined)?.id), state: live ? 'published' : 'draft', url: null };
    }
    case 'strapi': {
      const fields: Json = { [c.title_field || 'title']: title, [c.body_field || 'content']: body };
      if (c.slug_field) fields[c.slug_field] = handle;
      const res = await cms(id ? 'PUT' : 'POST', `${c.site}/api/${c.collection}${id ? `/${id}` : ''}${live ? '' : '?status=draft'}`, bearer(c), { data: fields });
      const d = (res.data ?? {}) as Json;
      return { id: str(d.documentId) || str(d.id), state: live ? 'published' : 'draft', url: null };
    }
    case 'custom': {
      const res = await cms('POST', c.endpoint, bearer(c), { title, html: body, description, slug: handle, status: article.status, external_id: externalId });
      return { id: str(res.id), state: str(res.status) || 'submitted', url: /^https:\/\//.test(str(res.url)) ? str(res.url) : null };
    }
  }
}
