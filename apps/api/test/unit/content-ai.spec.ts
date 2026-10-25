import { ConfigService } from '@nestjs/config';
import { BillingService } from '../../src/billing/billing.service';
import { StripeClient } from '../../src/billing/stripe.client';
import { ContentAuditService } from '../../src/content/content-audit.service';

describe('Content audit analysis', () => {
  const long = 'word '.repeat(10);
  it('flags thin, duplicate and badly structured pages', () => {
    const { summary, pages } = ContentAuditService.analyze([
      { url: 'https://a.test/', title: 'Home', metaDescription: 'Same', h1: ['Home'], headings: [{ level: 1, text: 'Home' }, { level: 2, text: 'How does it work?' }], wordCount: 800, schemaTypes: ['Organization'] },
      { url: 'https://a.test/x', title: 'Home', metaDescription: 'Same', h1: [], headings: [{ level: 1, text: long }, { level: 3, text: 'Skipped' }], wordCount: 120, imageCount: 2, imagesMissingAlt: 1 },
      { url: 'https://a.test/y', title: null, metaDescription: null, h1: ['A', 'B'], headings: [{ level: 1, text: 'A' }, { level: 1, text: 'B' }], wordCount: 500 },
    ]);
    expect(summary).toMatchObject({ pages: 3, thin: 1, duplicateTitles: 2, missingDescriptions: 1, withQuestions: 1, withSchema: 1, avgWords: 473 });
    const x = pages.find((p) => p.url === 'https://a.test/x')!;
    expect(x.issues).toEqual(expect.arrayContaining(['Thin content (120 words)', 'Duplicate title', 'Duplicate meta description', 'No H1', 'Heading level skipped (H1 → H3)', '1 image(s) without alt text']));
    const y = pages.find((p) => p.url === 'https://a.test/y')!;
    expect(y.issues).toEqual(expect.arrayContaining(['Missing title', 'Missing meta description', 'Multiple H1', 'Long text without H2 sections']));
    expect(pages[0].issues.length).toBeGreaterThanOrEqual(pages[2].issues.length);
  });
});

describe('Stripe price verification', () => {
  const billingWith = (price: Record<string, unknown>) => {
    const b = Object.create(BillingService.prototype) as BillingService;
    (b as unknown as { stripe: { request: () => Promise<unknown> } }).stripe = { request: async () => ({ id: 'price_1', ...price }) };
    return b;
  };
  const monthly = { active: true, currency: 'usd', unit_amount: 19900, recurring: { interval: 'month', interval_count: 1 } };

  it('accepts a matching recurring price', async () => {
    await expect(billingWith(monthly).verifyStripePrice('price_1', { currency: 'USD', amountMinor: 19900, interval: 'month' })).resolves.toMatchObject({ id: 'price_1' });
  });

  it('rejects amount, interval, currency and archived mismatches', async () => {
    const err = await billingWith({ ...monthly, active: false, unit_amount: 9900, currency: 'eur' })
      .verifyStripePrice('price_1', { currency: 'USD', amountMinor: 19900, interval: 'year' })
      .catch((e: { response: { code: string; message: string } }) => e.response);
    expect(err.code).toBe('STRIPE_PRICE_MISMATCH');
    expect(err.message).toMatch(/archived.*currency is EUR.*amount is 9900.*every year/);
  });

  it('requires one-time prices for credit packs', async () => {
    const err = await billingWith(monthly).verifyStripePrice('price_1', { currency: 'USD', amountMinor: 19900, interval: null }).catch((e: { response: { message: string } }) => e.response);
    expect(err.message).toMatch(/recurring, expected one-time/);
  });
});

describe('Stripe restricted key errors', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('maps 403 to STRIPE_PERMISSION without echoing the key', async () => {
    global.fetch = (async () => new Response(JSON.stringify({ error: { message: "The provided key 'rk_test_abc***' does not have the required permissions" } }), { status: 403 })) as typeof fetch;
    const client = new StripeClient(new ConfigService({ STRIPE_SECRET_KEY: 'rk_test_abc' }));
    const err = await client.request('POST', '/products', { name: 'x' }).catch((e: { response: { code: string; message: string } }) => e.response);
    expect(err.code).toBe('STRIPE_PERMISSION');
    expect(err.message).not.toContain('rk_');
  });
});
