import { lookup as dnsLookup } from 'dns';
import * as http from 'http';
import * as https from 'https';
import { isIP } from 'net';
import * as zlib from 'zlib';

/**
 * Server-side fetch for user-supplied URLs (audits, CMS connectors).
 *
 * SSRF protection: only http(s) on ports 80/443, no credentials in the URL,
 * and every connection is checked at DNS-resolution time (inside the socket's
 * `lookup`), so a hostname cannot pass validation and then rebind to an
 * internal address. Redirects are followed manually and each hop is
 * re-validated. Bodies are size-capped and decompressed.
 */

export type SafeFetchOptions = {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
  /** Tests and local development only: permit loopback/private targets. */
  allowPrivate?: boolean;
};

export type RedirectHop = { url: string; status: number };

export type SafeFetchResponse = {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  redirects: RedirectHop[];
  elapsedMs: number;
  truncated: boolean;
};

export class SafeFetchError extends Error {
  constructor(
    readonly code: 'INVALID_URL' | 'BLOCKED_HOST' | 'TIMEOUT' | 'TOO_MANY_REDIRECTS' | 'NETWORK',
    message: string,
  ) {
    super(message);
  }
}

const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const BLOCKED_V6: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

function v4ToBigInt(ip: string) {
  return ip.split('.').reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
}

function v6ToBigInt(ip: string) {
  let address = ip.toLowerCase().split('%')[0];
  const v4Tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (v4Tail) {
    const n = v4ToBigInt(v4Tail[1]);
    address = address.replace(v4Tail[1], `${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`);
  }
  const [head, tail] = address.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = address.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  const parts = [...headParts, ...Array(fill).fill('0'), ...tailParts];
  return parts.reduce((acc, part) => (acc << 16n) + BigInt(parseInt(part || '0', 16)), 0n);
}

function inSubnet(value: bigint, base: bigint, prefix: number, bits: number) {
  const shift = BigInt(bits - prefix);
  return value >> shift === base >> shift;
}

export function isBlockedAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const n = v4ToBigInt(address);
    return BLOCKED_V4.some(([net, prefix]) => inSubnet(n, v4ToBigInt(net), prefix, 32));
  }
  if (family === 6) {
    const n = v6ToBigInt(address);
    // IPv4-mapped (::ffff:a.b.c.d): judge the embedded IPv4 address.
    if (n >> 32n === 0xffffn) {
      const v4 = n & 0xffffffffn;
      return BLOCKED_V4.some(([net, prefix]) => inSubnet(v4, v4ToBigInt(net), prefix, 32));
    }
    return BLOCKED_V6.some(([net, prefix]) => inSubnet(n, v6ToBigInt(net), prefix, 128));
  }
  return true;
}

/** `allowAnyPort` is for tests / local development together with `allowPrivate`. */
export function parsePublicUrl(raw: string, allowAnyPort = false): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('INVALID_URL', 'Enter a full URL, for example https://example.com/page.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('INVALID_URL', 'Only http and https URLs can be fetched.');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('INVALID_URL', 'URLs with credentials are not allowed.');
  }
  if (!allowAnyPort && url.port && url.port !== '80' && url.port !== '443') {
    throw new SafeFetchError('INVALID_URL', 'Only the standard web ports (80, 443) are allowed.');
  }
  url.hash = '';
  return url;
}

function guardedLookup(allowPrivate: boolean) {
  return (
    hostname: string,
    options: object,
    callback: (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void,
  ) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const list = addresses as { address: string; family: number }[];
      if (!allowPrivate && (list.length === 0 || list.some((a) => isBlockedAddress(a.address)))) {
        const error = new Error(`Blocked host: ${hostname}`) as NodeJS.ErrnoException;
        error.code = 'EBLOCKEDHOST';
        return callback(error, '', 0);
      }
      if ((options as { all?: boolean }).all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}

function requestOnce(url: URL, opts: Required<Pick<SafeFetchOptions, 'timeoutMs' | 'maxBytes' | 'allowPrivate'>> & SafeFetchOptions) {
  return new Promise<{ status: number; headers: Record<string, string>; body: Buffer; truncated: boolean }>((resolve, reject) => {
    if (!opts.allowPrivate && isIP(url.hostname.replace(/^\[|\]$/g, '')) && isBlockedAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
      return reject(new SafeFetchError('BLOCKED_HOST', 'This address cannot be fetched.'));
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: opts.method ?? 'GET',
        headers: {
          'user-agent': 'AmpliVerifyBot/1.0 (+https://ampliverify.com/bot)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          ...opts.headers,
        },
        lookup: guardedLookup(opts.allowPrivate) as never,
        timeout: opts.timeoutMs,
      },
      (res) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        }
        const encoding = headers['content-encoding'];
        let stream: NodeJS.ReadableStream = res;
        if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        stream.on('data', (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > opts.maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, chunk.length - (size - opts.maxBytes)));
            res.destroy();
            resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks), truncated });
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks), truncated }));
        stream.on('error', (err) => {
          if (truncated) return;
          reject(new SafeFetchError('NETWORK', err.message));
        });
      },
    );
    req.on('timeout', () => req.destroy(new SafeFetchError('TIMEOUT', 'The request timed out.')));
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err instanceof SafeFetchError) return reject(err);
      if (err.code === 'EBLOCKEDHOST') return reject(new SafeFetchError('BLOCKED_HOST', 'This address cannot be fetched.'));
      reject(new SafeFetchError('NETWORK', err.message));
    });
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const opts = {
    timeoutMs: 15000,
    maxBytes: 5 * 1024 * 1024,
    allowPrivate: false,
    ...options,
  };
  const maxRedirects = options.maxRedirects ?? 5;
  const started = Date.now();
  const redirects: RedirectHop[] = [];
  let url = parsePublicUrl(rawUrl, opts.allowPrivate);

  for (;;) {
    const res = await requestOnce(url, opts);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location) {
      if (redirects.length >= maxRedirects) {
        throw new SafeFetchError('TOO_MANY_REDIRECTS', 'The URL redirects too many times.');
      }
      redirects.push({ url: url.toString(), status: res.status });
      url = parsePublicUrl(new URL(location, url).toString(), opts.allowPrivate);
      if (redirects.some((r) => r.url === url.toString())) {
        throw new SafeFetchError('TOO_MANY_REDIRECTS', 'The URL is in a redirect loop.');
      }
      continue;
    }
    return {
      url: rawUrl,
      finalUrl: url.toString(),
      status: res.status,
      headers: res.headers,
      body: res.body.toString('utf8'),
      redirects,
      elapsedMs: Date.now() - started,
      truncated: res.truncated,
    };
  }
}
