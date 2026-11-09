import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

// 1×1 transparent PNG: passes content sniffing for identity evidence.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

describe('Marketplace (V2)', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let seller: { authorization: string };
  let buyer: { authorization: string };
  let admin: { authorization: string };
  let sellerWs: string;
  let buyerWs: string;

  beforeAll(async () => {
    h = await startApp();
    const s = await h.onboard('mkt-seller');
    const b = await h.onboard('mkt-buyer');
    seller = { authorization: s.user.bearer };
    buyer = { authorization: b.user.bearer };
    sellerWs = s.workspaceId;
    buyerWs = b.workspaceId;
    const a = await h.provision('mkt-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
  });
  afterAll(async () => {
    await h?.close();
  });

  const listing = {
    title: 'Established gardening blog',
    kind: 'BUSINESS',
    assetType: 'CONTENT_SITE',
    url: 'https://www.Garden-Blog.test/',
    summary: 'Evergreen gardening guides with steady search traffic.',
    description: 'Includes 180 articles, the domain, the email list and all images. Selling to focus on a new project.',
    askingPriceMinor: 1_250_000,
    currency: 'usd',
    monthlyRevenueMinor: 42_000,
    monthlyVisitors: 18_000,
  };

  it('requires sign-in and an empty summary has no invented figures', async () => {
    await h.api().get('/api/v1/user/marketplace/summary').expect(401);
    const sum = (await h.api().get('/api/v1/user/marketplace/summary').set(buyer).expect(200)).body.data;
    expect(sum.buyer).toMatchObject({ saved: 0, activeInquiries: 0, activeOffers: 0, purchases: 0, downloads: 0, activeTransactions: 0 });
    expect(sum.seller).toMatchObject({ enabled: false, listings: 0, payoutThresholdMinor: 5000 });
    const meta = (await h.api().get('/api/v1/public/marketplace/meta').expect(200)).body.data;
    expect(meta.terms).toMatchObject({ payoutThresholdMinor: 5000, checkoutEnabled: false });
  });

  let listingId = '';
  let inquiryId = '';

  it('needs a seller profile and identity check before a draft can be submitted and published', async () => {
    await h.api().post('/api/v1/user/marketplace/listings').set(seller).send({ ...listing, workspaceId: buyerWs }).expect((r) => expect([403, 404]).toContain(r.status));
    await h.api().post('/api/v1/user/marketplace/listings').set(seller).send({ ...listing, workspaceId: sellerWs, askingPriceMinor: 0 }).expect(400);

    const created = (await h.api().post('/api/v1/user/marketplace/listings').set(seller).send({ ...listing, workspaceId: sellerWs }).expect(201)).body.data;
    expect(created).toMatchObject({ status: 'DRAFT', currency: 'USD', askingPriceMinor: 1_250_000 });
    listingId = created.id;

    // No seller profile yet, then no identity evidence.
    await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/submit`).set(seller).expect(403);
    await h.api().put('/api/v1/user/marketplace/seller').set(seller).send({ displayName: 'Garden Media Ltd', headline: 'Content sites' }).expect(200);
    await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/submit`).set(seller).expect(403);
    await h.api().post('/api/v1/user/marketplace/seller/verifications/identity').set(seller).field('fullName', 'Sam Seller').expect(400);
    await h.api().post('/api/v1/user/marketplace/seller/verifications/identity').set(seller).field('fullName', 'Sam Seller').attach('files', PNG, 'id.png').expect(201);

    const submitted = (await h.api().post(`/api/v1/user/marketplace/my/listings/${listingId}/submit`).set(seller).expect(201)).body.data;
    expect(submitted.status).toBe('PENDING_REVIEW');

    // Pending listings are hidden from buyers, browse and the public site.
    await h.api().get(`/api/v1/user/marketplace/listings/${listingId}`).set(buyer).expect(404);
    expect((await h.api().get('/api/v1/user/marketplace/listings?q=gardening').set(buyer).expect(200)).body.data.total).toBe(0);
    await h.api().get(`/api/v1/public/marketplace/listings/${listingId}`).expect(404);

    // Only marketplace admins decide; notes are required except to approve; identity must be approved first.
    await h.api().post(`/api/v1/admin/marketplace/listings/${listingId}/review`).set(buyer).send({ decision: 'APPROVE' }).expect(403);
    await h.api().post(`/api/v1/admin/marketplace/listings/${listingId}/review`).set(admin).send({ decision: 'REJECT' }).expect(400);
    await h.api().post(`/api/v1/admin/marketplace/listings/${listingId}/review`).set(admin).send({ decision: 'APPROVE' }).expect(400);

    const checks = (await h.api().get('/api/v1/admin/marketplace/verifications?status=PENDING').set(admin).expect(200)).body.data;
    const idCheck = checks.find((c: { kind: string; seller: { displayName: string } }) => c.kind === 'IDENTITY' && c.seller.displayName === 'Garden Media Ltd');
    expect(idCheck.files).toHaveLength(1);
    await h.api().post(`/api/v1/admin/marketplace/verifications/${idCheck.id}/decision`).set(buyer).send({ decision: 'APPROVE' }).expect(403);
    await h.api().post(`/api/v1/admin/marketplace/verifications/${idCheck.id}/decision`).set(admin).send({ decision: 'REJECT' }).expect(400);
    await h.api().post(`/api/v1/admin/marketplace/verifications/${idCheck.id}/decision`).set(admin).send({ decision: 'APPROVE' }).expect(201);

    await h.api().post(`/api/v1/admin/marketplace/listings/${listingId}/review`).set(admin).send({ decision: 'APPROVE' }).expect(201);
    const browse = (await h.api().get('/api/v1/user/marketplace/listings?q=gardening&type=CONTENT_SITE').set(buyer).expect(200)).body.data;
    expect(browse.items.map((l: { id: string }) => l.id)).toContain(listingId);
    const pub = (await h.api().get(`/api/v1/public/marketplace/listings/${created.slug ?? listingId}`).expect(200)).body.data;
    expect(pub.viewer).toBeNull();
  });

  it('saves listings per buyer', async () => {
    await h.api().put(`/api/v1/user/marketplace/listings/${listingId}/save`).set(buyer).send({ saved: true }).expect(200);
    const saved = (await h.api().get('/api/v1/user/marketplace/saved').set(buyer).expect(200)).body.data;
    expect(saved.map((s: { listing: { id: string } }) => s.listing.id)).toEqual([listingId]);
    expect((await h.api().get('/api/v1/user/marketplace/saved').set(seller).expect(200)).body.data).toEqual([]);
    await h.api().put(`/api/v1/user/marketplace/listings/${listingId}/save`).set(buyer).send({ saved: false }).expect(200);
    expect((await h.api().get('/api/v1/user/marketplace/saved').set(buyer).expect(200)).body.data).toEqual([]);
  });

  it('opens messaging only after the seller approves the introduction', async () => {
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/inquiries`).set(seller).send({ workspaceId: sellerWs, message: 'Asking my own listing' }).expect(400);
    const inq = (await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/inquiries`).set(buyer).send({ workspaceId: buyerWs, message: 'What are the main traffic sources?', buyerRole: 'Individual investor' }).expect(201)).body.data;
    inquiryId = inq.id;
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/inquiries`).set(buyer).send({ workspaceId: buyerWs, message: 'A second open question here' }).expect(400);

    // No offers or messages before the introduction is approved.
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/offers`).set(buyer).send({ amountMinor: 1_000_000 }).expect(403);
    await h.api().post(`/api/v1/user/marketplace/inquiries/${inquiryId}/messages`).set(buyer).send({ message: 'Hello?' }).expect(403);

    // The seller sees the request without the buyer's email; only the seller decides.
    const received = (await h.api().get('/api/v1/user/marketplace/my/inquiries?role=received').set(seller).expect(200)).body.data;
    expect(received).toHaveLength(1);
    expect(JSON.stringify(received)).not.toContain('@');
    await h.api().post(`/api/v1/user/marketplace/inquiries/${inquiryId}/introduction`).set(buyer).send({ decision: 'APPROVE' }).expect(404);
    await h.api().post(`/api/v1/user/marketplace/inquiries/${inquiryId}/introduction`).set(seller).send({ decision: 'APPROVE', message: 'Happy to talk.' }).expect(201);

    await h.api().post(`/api/v1/user/marketplace/inquiries/${inquiryId}/messages`).set(buyer).send({ message: 'Thanks! Can you share analytics?' }).expect(201);
    const thread = (await h.api().get(`/api/v1/user/marketplace/inquiries/${inquiryId}`).set(seller).expect(200)).body.data;
    expect(JSON.stringify(thread)).toContain('Can you share analytics?');
  });

  it('versions offers and rejects stale answers', async () => {
    const offer = (await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/offers`).set(buyer).send({ amountMinor: 1_000_000, terms: 'Includes 30 days of support' }).expect(201)).body.data;
    expect(offer).toMatchObject({ status: 'SUBMITTED', version: 1 });
    await h.api().post(`/api/v1/user/marketplace/listings/${listingId}/offers`).set(buyer).send({ amountMinor: 1_100_000 }).expect(409);

    // The buyer cannot accept their own terms.
    await h.api().post(`/api/v1/user/marketplace/offers/${offer.id}`).set(buyer).send({ action: 'ACCEPT', expectedVersion: 1 }).expect(400);
    const countered = (await h.api().post(`/api/v1/user/marketplace/offers/${offer.id}`).set(seller).send({ action: 'COUNTER', expectedVersion: 1, amountMinor: 1_150_000 }).expect(201)).body.data;
    expect(countered).toMatchObject({ status: 'COUNTERED', version: 2 });
    // An answer to version 1 is stale.
    await h.api().post(`/api/v1/user/marketplace/offers/${offer.id}`).set(buyer).send({ action: 'ACCEPT', expectedVersion: 1 }).expect(409);
    await h.api().post(`/api/v1/user/marketplace/offers/${offer.id}`).set(buyer).send({ action: 'ACCEPT', expectedVersion: 2 }).expect(201);

    const deals = (await h.api().get('/api/v1/user/marketplace/my/deals?role=seller').set(seller).expect(200)).body.data;
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ status: 'AGREEMENT_PENDING', amountMinor: 1_150_000 });
    // Outsiders cannot open the deal.
    await h.api().get(`/api/v1/user/marketplace/deals/${deals[0].id}`).set(admin).expect(404);
  });

  it('keeps payouts at $50+ and under dual control', async () => {
    const profile = await h.prisma.sellerProfile.findFirstOrThrow({ where: { displayName: 'Garden Media Ltd' } });
    // No payout account yet.
    await h.api().post('/api/v1/user/marketplace/finances/payouts').set(seller).expect(403);
    await h.prisma.sellerProfile.update({ where: { id: profile.id }, data: { payoutsEnabled: true, stripeAccountId: 'acct_test_only', payoutStatus: 'APPROVED' } });

    // Manual adjustments need the payouts permission and a reason.
    await h.api().post('/api/v1/admin/marketplace/ledger/adjustments').set(buyer).send({ sellerUserId: profile.userId, amountMinor: 4_000, currency: 'USD', reason: 'Goodwill' }).expect(403);
    await h.api().post('/api/v1/admin/marketplace/ledger/adjustments').set(admin).send({ sellerUserId: profile.userId, amountMinor: 4_000, currency: 'USD', reason: 'Goodwill credit' }).expect(201);
    await h.api().post('/api/v1/user/marketplace/finances/payouts').set(seller).expect(400);
    await h.api().post('/api/v1/admin/marketplace/ledger/adjustments').set(admin).send({ sellerUserId: profile.userId, amountMinor: 2_000, currency: 'USD', reason: 'Correction credit' }).expect(201);

    const payout = (await h.api().post('/api/v1/user/marketplace/finances/payouts').set(seller).expect(201)).body.data;
    expect(payout).toMatchObject({ status: 'REQUESTED', amountMinor: 6_000 });
    await h.api().post('/api/v1/user/marketplace/finances/payouts').set(seller).expect(409);

    await h.api().post(`/api/v1/admin/marketplace/payouts/${payout.id}/action`).set(admin).send({ action: 'PROCESS' }).expect(400);
    await h.api().post(`/api/v1/admin/marketplace/payouts/${payout.id}/action`).set(admin).send({ action: 'APPROVE' }).expect(201);
    // The approver cannot also send the money.
    const dual = await h.api().post(`/api/v1/admin/marketplace/payouts/${payout.id}/action`).set(admin).send({ action: 'PROCESS' }).expect(403);
    expect(JSON.stringify(dual.body)).toContain('DUAL_CONTROL');

    await h.api().post(`/api/v1/admin/marketplace/payouts/${payout.id}/action`).set(admin).send({ action: 'CANCEL' }).expect(400);
    await h.api().post(`/api/v1/admin/marketplace/payouts/${payout.id}/action`).set(admin).send({ action: 'CANCEL', note: 'Test cancellation' }).expect(201);
    const bal = (await h.api().get('/api/v1/user/marketplace/finances/balance').set(seller).expect(200)).body.data;
    expect(bal.balances.find((b: { currency: string }) => b.currency === 'USD').availableMinor).toBe(6_000);
  });

  it('withdrawing hides the listing again and nothing is purchased without payment', async () => {
    await h.api().patch(`/api/v1/user/marketplace/my/listings/${listingId}`).set(seller).send({ withdraw: true }).expect(200);
    await h.api().get(`/api/v1/user/marketplace/listings/${listingId}`).set(buyer).expect(404);
    expect((await h.api().get('/api/v1/user/marketplace/my/purchases').set(buyer).expect(200)).body.data).toEqual([]);
    expect((await h.api().get('/api/v1/user/marketplace/my/downloads').set(buyer).expect(200)).body.data).toEqual([]);
  });
});
