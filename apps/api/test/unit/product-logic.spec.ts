import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { analyzeAnswer } from '../../src/geo/geo-providers';
import { lexicalClusters } from '../../src/keywords/keywords.service';
import { SecretBox } from '../../src/common/utils/secret-box';
import { StripeClient, encodeForm } from '../../src/billing/stripe.client';
import { detectFileType, DOCUMENT_TYPES, IMAGE_TYPES } from '../../src/storage/file-safety';
import { nextRunAt } from '../../src/geo/geo.service';

describe('GEO answer analysis', () => {
  const brand = { names: ['AmpliVerify'], domains: ['ampliverify.com'] };
  const competitors = [
    { id: 'c1', name: 'Semrush', domain: 'semrush.com' },
    { id: 'c2', name: 'Ahrefs', domain: 'ahrefs.com' },
  ];

  it('ranks the brand among competitors and detects citations', () => {
    const r = analyzeAnswer(
      { text: 'Popular options are Semrush and AmpliVerify. AmpliVerify focuses on verification. Ahrefs is also used.', citations: [{ url: 'https://www.semrush.com/x' }, { url: 'https://blog.ampliverify.com/guide' }] },
      brand,
      competitors,
    );
    expect(r).toMatchObject({ mentioned: true, position: 2, cited: true, citationRank: 2, mentionCount: 2 });
    expect(r.competitors).toEqual([
      { id: 'c1', name: 'Semrush', position: 1 },
      { id: 'c2', name: 'Ahrefs', position: 3 },
    ]);
    expect(r.excerpt).toContain('AmpliVerify');
  });

  it('does not match brand names inside other words', () => {
    const r = analyzeAnswer({ text: 'Try superampliverifyx instead.', citations: [] }, brand, []);
    expect(r.mentioned).toBe(false);
    expect(r.position).toBeNull();
  });

  it('computes schedule cadence', () => {
    const from = new Date('2026-01-31T00:00:00Z');
    expect(nextRunAt('DAILY', from).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(nextRunAt('WEEKLY', from).toISOString()).toBe('2026-02-07T00:00:00.000Z');
  });
});

describe('keyword clustering', () => {
  it('groups keywords by shared head terms', () => {
    const groups = lexicalClusters([
      { id: '1', term: 'seo audit tool' },
      { id: '2', term: 'free seo audit' },
      { id: '3', term: 'audit checklist' },
      { id: '4', term: 'keyword research guide' },
      { id: '5', term: 'keyword research tool' },
    ]);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.items.map((i) => i.id).sort()]));
    expect(byLabel.audit).toEqual(['1', '2', '3']);
    expect(byLabel.research ?? byLabel.keyword).toEqual(['4', '5']);
  });
});

describe('secrets and signatures', () => {
  it('seals and opens integration secrets', () => {
    const box = new SecretBox('x'.repeat(40));
    const sealed = box.seal('{"password":"p@ss"}');
    expect(sealed).not.toContain('p@ss');
    expect(box.open(sealed)).toBe('{"password":"p@ss"}');
    expect(() => new SecretBox('y'.repeat(40)).open(sealed)).toThrow();
    expect(() => new SecretBox('short')).toThrow();
  });

  it('verifies Stripe webhook signatures with tolerance', () => {
    const client = new StripeClient(new ConfigService({ STRIPE_WEBHOOK_SECRET: 'whsec_1' }));
    const body = Buffer.from('{"id":"evt_1"}');
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', 'whsec_1').update(`${t}.${body}`).digest('hex');
    expect(client.verifyWebhook(body, `t=${t},v1=${sig}`)).toBe(true);
    expect(client.verifyWebhook(body, `t=${t},v1=${'0'.repeat(64)}`)).toBe(false);
    expect(client.verifyWebhook(body, `t=${t - 3600},v1=${sig}`)).toBe(false);
    expect(client.verifyWebhook(Buffer.from('{"id":"evt_2"}'), `t=${t},v1=${sig}`)).toBe(false);
  });

  it('encodes nested Stripe form parameters', () => {
    expect(encodeForm({ a: 1, line_items: [{ price: 'p', quantity: 1 }], metadata: { k: 'v w' } }).join('&')).toBe(
      'a=1&line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Bk%5D=v%20w',
    );
  });
});

describe('upload type detection', () => {
  it('trusts magic bytes, not names', () => {
    expect(detectFileType(Buffer.from('%PDF-1.7 ...'), DOCUMENT_TYPES)?.mime).toBe('application/pdf');
    expect(detectFileType(Buffer.from('%PDF-1.7 ...'), IMAGE_TYPES)).toBeNull();
    expect(detectFileType(Buffer.from('<svg onload=alert(1)>'), IMAGE_TYPES)).toBeNull();
    expect(detectFileType(Buffer.from('89504e470d0a1a0a00', 'hex'), IMAGE_TYPES)?.ext).toBe('png');
  });
});
