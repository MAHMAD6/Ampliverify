import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

type ParamValue = string | number | boolean | undefined | null | Params | (string | Params)[];
interface Params {
  [key: string]: ParamValue;
}

/** Flattens nested params into Stripe's form encoding (a[b][0]=c). */
export function encodeForm(params: Params, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') out.push(...encodeForm(item, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof value === 'object') {
      out.push(...encodeForm(value, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

/**
 * Minimal Stripe REST client (no SDK): STRIPE_SECRET_KEY for API calls and
 * STRIPE_WEBHOOK_SECRET for webhook signature verification.
 */
@Injectable()
export class StripeClient {
  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get<string>('STRIPE_SECRET_KEY');
  }

  private key() {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) {
      throw new ServiceUnavailableException({ code: 'BILLING_NOT_CONFIGURED', message: 'Online payments are not available yet.' });
    }
    return key;
  }

  async request<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Params = {}, idempotencyKey?: string): Promise<T> {
    const body = encodeForm(params).join('&');
    const url = `https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`;
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${this.key()}`,
        'content-type': 'application/x-www-form-urlencoded',
        'stripe-version': '2024-06-20',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: method === 'GET' ? undefined : body,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) {
      throw new ServiceUnavailableException({ code: 'PAYMENT_PROVIDER_ERROR', message: json.error?.message ?? `Payment provider error (${res.status}).` });
    }
    return json;
  }

  /** Verifies the `Stripe-Signature` header (v1 HMAC-SHA256, 5-minute tolerance). */
  verifyWebhook(rawBody: Buffer, header: string | undefined, toleranceSec = 300) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret || !header) return false;
    const parts = Object.fromEntries(
      header.split(',').map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), p.slice(i + 1)];
      }),
    );
    const signatures = header
      .split(',')
      .filter((p) => p.startsWith('v1='))
      .map((p) => p.slice(3));
    const timestamp = Number(parts.t);
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
    return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
  }
}
