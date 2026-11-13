import { createHmac } from 'crypto';
import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

const WEBHOOK_SECRET = 'whsec_test_secret';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
// 1×1 transparent PNG: passes content sniffing for identity evidence.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

function signed(payload: object) {
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  return { body, header: `t=${t},v1=${sig}` };
}

/** Checkout, webhook fulfilment, downloads and refunds for digital products. Stripe is mocked at the HTTP layer. */
describe('Marketplace commerce', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let seller: { authorization: string };
  let buyer: { authorization: string };
  let outsider: { authorization: string };
  let admin: { authorization: string };
  let sellerWs: string;
  const realFetch = global.fetch;
  const stripeCalls: { path: string; body: string; idempotencyKey: string | null }[] = [];

  beforeAll(async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.startsWith('https://api.stripe.com')) return realFetch(input, init);
      const path = new URL(url).pathname.replace(/^\/v1/, '');
      const headers = new Headers(init?.headers);
      stripeCalls.push({ path, body: String(init?.body ?? ''), idempotencyKey: headers.get('idempotency-key') });
      const json = path === '/checkout/sessions' ? { id: `cs_test_${stripeCalls.length}`, url: 'https://checkout.stripe.com/c/pay/cs_test' } : path === '/refunds' ? { id: 're_test_1', status: 'succeeded', amount: 5_292 } : { error: { message: 'unexpected' } };
      return new Response(JSON.stringify(json), { status: json.error ? 400 : 200, headers: { 'content-type': 'application/json' } });
    });
    h = await startApp({ STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
    const s = await h.onboard('com-seller');
    const b = await h.onboard('com-buyer');
    const o = await h.onboard('com-outsider');
    seller = { authorization: s.user.bearer };
    buyer = { authorization: b.user.bearer };
    outsider = { authorization: o.user.bearer };
    sellerWs = s.workspaceId;
    const a = await h.provision('com-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
  });
  afterAll(async () => {
    // Other suites share the database and expect checkout to be closed by default.
    await h?.prisma.systemSetting.deleteMany({ where: { key: 'marketplace.terms' } });
    jest.restoreAllMocks();
    await h?.close();
  });

  const webhook = async (event: object) => {
    const { body, header } = signed(event);
    await h.api().post('/api/v1/webhooks/stripe').set('stripe-signature', header).set('content-type', 'application/json').send(body).expect(200);
    await h.jobs.drain(['billing.webhook']);
  };
  const sessionEvent = (id: string, orderId: string, amount: number, currency = 'usd', tax = 0) => ({
    id,
    type: 'checkout.session.completed',
    data: { object: { id: `cs_${id}`, object: 'checkout.session', payment_status: 'paid', amount_subtotal: amount, amount_total: amount + tax, currency, payment_intent: `pi_${orderId.slice(0, 8)}`, metadata: { kind: 'marketplace_order', orderId } } },
  });

  let listingId = '';
  let orderId = '';
  let entitlementId = '';

  it('publishes a digital product with a deliverable file', async () => {
    const created = (
      await h
        .api()
        .post('/api/v1/user/marketplace/listings')
        .set(seller)
        .send({
          workspaceId: sellerWs,
          kind: 'DIGITAL_PRODUCT',
          title: 'SEO audit checklist',
          assetType: 'OTHER',
          summary: 'A printable 120-point technical SEO audit checklist.',
          description: 'Covers crawling, indexing, Core Web Vitals, structured data and internal links, with notes for each check.',
          askingPriceMinor: 4_900,
          currency: 'usd',
          licenseTerms: 'Single-user licence. Do not resell or redistribute.',
        })
        .expect(201)
    ).body.data;
    listingId = created.id;

    await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/files`).set(seller).field('role', 'DELIVERABLE').attach('file', Buffer.from('not a real file'), 'x.exe').expect(400);
    await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/files`).set(outsider).field('role', 'DELIVERABLE').attach('file', PDF, 'checklist.pdf').expect((r) => expect([403, 404]).toContain(r.status));
    await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/files`).set(seller).field('role', 'DELIVERABLE').attach('file', PDF, 'checklist.pdf').expect(201);

    await h.api().put('/api/v1/user/marketplace/seller').set(seller).send({ displayName: 'Checklist Studio', headline: 'SEO templates' }).expect(200);
    await h.api().post('/api/v1/user/marketplace/seller/verifications/identity').set(seller).field('fullName', 'Casey Seller').attach('files', PNG, 'id.png').expect(201);
    await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/submit`).set(seller).expect(201);
    const checks = (await h.api().get('/api/v1/admin/marketplace/verifications?status=PENDING').set(admin).expect(200)).body.data;
    const idCheck = checks.find((c: { kind: string; seller: { displayName: string } }) => c.kind === 'IDENTITY' && c.seller.displayName === 'Checklist Studio');
    await h.api().post(`/api/v1/admin/marketplace/verifications/${idCheck.id}/decision`).set(admin).send({ decision: 'APPROVE' }).expect(201);
    await h.api().post(`/api/v1/admin/marketplace/listings/${listingId}/review`).set(admin).send({ decision: 'APPROVE' }).expect(201);
  });

  it('keeps checkout closed until enabled and requires both consents', async () => {
    const consent = { license: true, refundPolicy: true };
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/checkout`).set(buyer).send(consent).expect(400);
    await h.api().put('/api/v1/admin/marketplace/settings').set(buyer).send({ checkoutEnabled: true }).expect(403);
    await h.api().put('/api/v1/admin/marketplace/settings').set(admin).send({ checkoutEnabled: true, commissionBps: 1000 }).expect(200);

    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/checkout`).expect(401);
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/checkout`).set(buyer).send({ license: true, refundPolicy: false }).expect(400);
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/checkout`).set(seller).send(consent).expect(400);
    const res = (await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/checkout`).set(buyer).send(consent).expect(201)).body.data;
    expect(res.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    orderId = res.orderId;

    const call = stripeCalls.find((c) => c.path === '/checkout/sessions')!;
    expect(call.idempotencyKey).toBe(`marketplace-checkout:${orderId}`);
    const sent = decodeURIComponent(call.body);
    // Stripe Tax stays off until STRIPE_AUTOMATIC_TAX=true.
    expect(sent).not.toContain('automatic_tax');
    expect(sent).not.toContain('consent_collection');
    const order = await h.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'PENDING_PAYMENT', amountMinor: 4_900n, platformFeeMinor: 490n, currency: 'USD' });

    // Nothing is delivered before the provider confirms payment.
    expect((await h.api().get('/api/v1/user/marketplace/my/downloads').set(buyer).expect(200)).body.data).toEqual([]);
  });

  it('does not fulfil a payment with the wrong amount or currency', async () => {
    await webhook(sessionEvent('evt_wrong_amount', orderId, 100));
    await webhook(sessionEvent('evt_wrong_currency', orderId, 4_900, 'eur'));
    expect((await h.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING_PAYMENT');
    expect(await h.prisma.marketplaceDownloadEntitlement.count({ where: { orderId } })).toBe(0);
  });

  it('fulfils a paid order exactly once and records the commission', async () => {
    // Stripe Tax adds 8% on top of the price; only the price is seller revenue.
    await webhook(sessionEvent('evt_paid_1', orderId, 4_900, 'usd', 392));
    await webhook(sessionEvent('evt_paid_2', orderId, 4_900, 'usd', 392)); // a second delivery of the same payment
    const order = await h.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'PAID', taxMinor: 392n });
    expect(await h.prisma.marketplaceDownloadEntitlement.count({ where: { orderId } })).toBe(1);
    const ledger = await h.prisma.sellerLedgerEntry.findMany({ where: { orderId }, orderBy: { type: 'asc' } });
    expect(ledger.map((l) => [l.type, l.amountMinor])).toEqual(
      expect.arrayContaining([
        ['SALE', 4_900n],
        ['PLATFORM_FEE', -490n],
      ]),
    );
    expect(ledger).toHaveLength(2);

    // Buying the same item again is refused.
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/checkout`).set(buyer).send({ license: true, refundPolicy: true }).expect(409);
  });

  it('serves the file only to the buyer and logs each download', async () => {
    const downloads = (await h.api().get('/api/v1/user/marketplace/my/downloads').set(buyer).expect(200)).body.data;
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatchObject({ filename: 'checklist.pdf', state: 'AVAILABLE', orderId });
    entitlementId = downloads[0].id;

    const file = await h.api().get(`/api/v1/user/marketplace/downloads/${entitlementId}/file`).set(buyer).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toContain('attachment');
    expect(file.headers['cache-control']).toContain('no-store');
    expect(Buffer.compare(file.body as Buffer, PDF)).toBe(0);

    await h.api().get(`/api/v1/user/marketplace/downloads/${entitlementId}/file`).set(outsider).expect(404);
    await h.api().get(`/api/v1/user/marketplace/downloads/${entitlementId}/file`).set(seller).expect(404);
    await h.api().get(`/api/v1/user/marketplace/downloads/${entitlementId}/file`).expect(401);
    expect((await h.api().get('/api/v1/user/marketplace/my/downloads').set(outsider).expect(200)).body.data).toEqual([]);
    expect(await h.prisma.marketplaceDownloadEvent.count({ where: { entitlementId } })).toBe(1);
  });

  it('refunds through a case, revokes access and applies each refund once', async () => {
    await h.api().post('/api/v1/user/marketplace/cases').set(outsider).send({ orderId, kind: 'REFUND', reason: 'Not as described', details: 'The checklist does not cover structured data at all.' }).expect(404);
    const c = (await h.api().post('/api/v1/user/marketplace/cases').set(buyer).send({ orderId, kind: 'REFUND', reason: 'Not as described', details: 'The checklist does not cover structured data at all.' }).expect(201)).body.data;
    await h.api().post('/api/v1/user/marketplace/cases').set(buyer).send({ orderId, kind: 'REFUND', reason: 'Again', details: 'Opening a second case for the same order.' }).expect(409);

    await h.api().post(`/api/v1/admin/marketplace/cases/${c.id}/resolve`).set(buyer).send({ decision: 'APPROVE_REFUND', note: 'ok' }).expect(403);
    await h.api().post(`/api/v1/admin/marketplace/cases/${c.id}/resolve`).set(admin).send({ decision: 'APPROVE_REFUND' }).expect(400);
    await h.api().post(`/api/v1/admin/marketplace/cases/${c.id}/resolve`).set(admin).send({ decision: 'APPROVE_REFUND', note: 'Listing omitted a promised section.' }).expect(201);

    const refundCall = stripeCalls.find((x) => x.path === '/refunds')!;
    expect(refundCall.idempotencyKey).toBe(`marketplace-refund:${c.id}`);
    // A full refund returns everything left on the charge, tax included.
    expect(refundCall.body).not.toMatch(/(^|&)amount=/);

    const order = await h.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'REFUNDED', refundedMinor: 4_900n });
    expect((await h.prisma.marketplaceCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('REFUNDED');
    const dl = (await h.api().get('/api/v1/user/marketplace/my/downloads').set(buyer).expect(200)).body.data;
    expect(dl[0].state).toBe('REVOKED');
    await h.api().get(`/api/v1/user/marketplace/downloads/${entitlementId}/file`).set(buyer).expect(403);

    // The provider's own refund notifications for the same refund change nothing.
    await webhook({ id: 'evt_refund_1', type: 'refund.created', data: { object: { id: 're_test_1', object: 'refund', status: 'succeeded', amount: 5_292, payment_intent: order.paymentIntentId } } });
    await webhook({ id: 'evt_charge_refunded', type: 'charge.refunded', data: { object: { id: 'ch_1', object: 'charge', payment_intent: order.paymentIntentId, refunds: { data: [{ id: 're_test_1', status: 'succeeded', amount: 5_292 }] } } } });
    const refunds = await h.prisma.sellerLedgerEntry.findMany({ where: { orderId, type: 'REFUND' } });
    expect(refunds).toHaveLength(1);
    // The seller's net (sale minus commission) is reversed.
    expect(refunds[0].amountMinor).toBe(-4_410n);
    expect((await h.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } })).refundedMinor).toBe(4_900n);

    await h.api().post(`/api/v1/admin/marketplace/cases/${c.id}/resolve`).set(admin).send({ decision: 'CLOSE', note: 'Done' }).expect(400);
    expect(stripeCalls.filter((x) => x.path === '/refunds')).toHaveLength(1);
  });

  it('opens a dispute case from a card dispute once', async () => {
    const order = await h.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });
    const dispute = { id: 'evt_dispute', type: 'charge.dispute.created', data: { object: { id: 'dp_1', object: 'dispute', amount: 4_900, reason: 'fraudulent', payment_intent: order.paymentIntentId } } };
    await webhook(dispute);
    await webhook({ ...dispute, id: 'evt_dispute_again' });
    expect(await h.prisma.marketplaceCase.count({ where: { orderId, kind: 'DISPUTE' } })).toBe(1);
  });
});
