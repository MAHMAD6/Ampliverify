import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

describe('Marketplace', () => {
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
    expect(sum.seller).toMatchObject({ listings: 0, completedSales: 0, earnings: [], payoutThresholdMinor: 5000, payoutsAvailable: false });
    expect(sum.buyer).toMatchObject({ inquiriesSent: 0, purchases: 0 });
  });

  it('runs list → review → publish → inquiry → reply', async () => {
    // Outsider workspace is refused.
    await h.api().post('/api/v1/user/marketplace/listings').set(seller).send({ ...listing, workspaceId: buyerWs }).expect((r) => expect([403, 404]).toContain(r.status));
    await h.api().post('/api/v1/user/marketplace/listings').set(seller).send({ ...listing, workspaceId: sellerWs, askingPriceMinor: 0 }).expect(400);

    const created = (await h.api().post('/api/v1/user/marketplace/listings').set(seller).send({ ...listing, workspaceId: sellerWs }).expect(201)).body.data;
    expect(created).toMatchObject({ status: 'PENDING_REVIEW', currency: 'USD', askingPriceMinor: 1_250_000 });

    // Pending listings are hidden from buyers and from browse.
    await h.api().get(`/api/v1/user/marketplace/listings/${created.id}`).set(buyer).expect(404);
    expect((await h.api().get('/api/v1/user/marketplace/listings?q=gardening').set(buyer).expect(200)).body.data.total).toBe(0);

    // Only marketplace admins review; rejection needs a reason.
    await h.api().post(`/api/v1/admin/marketplace/listings/${created.id}/review`).set(buyer).send({ decision: 'APPROVE' }).expect(403);
    await h.api().post(`/api/v1/admin/marketplace/listings/${created.id}/review`).set(admin).send({ decision: 'REJECT' }).expect(400);
    await h.api().post(`/api/v1/admin/marketplace/listings/${created.id}/review`).set(admin).send({ decision: 'APPROVE' }).expect(201);

    const browse = (await h.api().get('/api/v1/user/marketplace/listings?q=gardening&type=CONTENT_SITE').set(buyer).expect(200)).body.data;
    expect(browse.items.map((l: { id: string }) => l.id)).toContain(created.id);

    await h.api().post(`/api/v1/user/marketplace/listings/${created.id}/inquiries`).set(seller).send({ workspaceId: sellerWs, message: 'Asking my own listing' }).expect(400);
    const inq = (await h.api().post(`/api/v1/user/marketplace/listings/${created.id}/inquiries`).set(buyer).send({ workspaceId: buyerWs, message: 'What are the main traffic sources?' }).expect(201)).body.data;
    await h.api().post(`/api/v1/user/marketplace/listings/${created.id}/inquiries`).set(buyer).send({ workspaceId: buyerWs, message: 'A second open question here' }).expect(400);

    // Buyer cannot answer; seller sees it without the buyer's email.
    await h.api().post(`/api/v1/user/marketplace/inquiries/${inq.id}/reply`).set(buyer).send({ message: 'hi there' }).expect(404);
    const received = (await h.api().get('/api/v1/user/marketplace/my/inquiries?role=received').set(seller).expect(200)).body.data;
    expect(received).toHaveLength(1);
    expect(JSON.stringify(received)).not.toContain('@');
    await h.api().post(`/api/v1/user/marketplace/inquiries/${inq.id}/reply`).set(seller).send({ message: 'Mostly organic search.' }).expect(201);
    const sent = (await h.api().get('/api/v1/user/marketplace/my/inquiries?role=sent').set(buyer).expect(200)).body.data;
    expect(sent[0]).toMatchObject({ status: 'REPLIED', reply: 'Mostly organic search.' });

    // Withdrawing hides it again; no transactions exist without the payment provider.
    await h.api().patch(`/api/v1/user/marketplace/my/listings/${created.id}`).set(seller).send({ withdraw: true }).expect(200);
    await h.api().get(`/api/v1/user/marketplace/listings/${created.id}`).set(buyer).expect(404);
    expect((await h.api().get('/api/v1/user/marketplace/my/transactions').set(seller).expect(200)).body.data).toEqual([]);
    expect((await h.api().get('/api/v1/user/marketplace/my/purchases').set(buyer).expect(200)).body.data).toEqual([]);
  });
});
