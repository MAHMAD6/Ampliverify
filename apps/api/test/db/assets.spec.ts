import { startApp } from './app-harness';

const denied = (r: { status: number }) => expect([403, 404]).toContain(r.status);

describe('Digital assets', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let owner: { authorization: string };
  let outsider: { authorization: string };
  let ws: string;
  let otherWs: string;

  beforeAll(async () => {
    h = await startApp();
    const a = await h.onboard('asset-owner');
    const b = await h.onboard('asset-outsider');
    owner = { authorization: a.user.bearer };
    outsider = { authorization: b.user.bearer };
    ws = a.workspaceId;
    otherWs = b.workspaceId;
  });
  afterAll(async () => {
    await h?.close();
  });

  it('starts empty with no invented value', async () => {
    await h.api().get(`/api/v1/user/assets/summary?workspaceId=${ws}`).expect(401);
    const s = (await h.api().get(`/api/v1/user/assets/summary?workspaceId=${ws}`).set(owner).expect(200)).body.data;
    expect(s).toMatchObject({ totalAssets: 0, owned: 0, prospective: 0, estimatedValue: null });
    await h.api().get(`/api/v1/user/assets/summary?workspaceId=${ws}`).set(outsider).expect((r) => expect([403, 404]).toContain(r.status));
  });

  it('never treats a claimed or prospective asset as verified', async () => {
    await h.api().post('/api/v1/user/assets').set(owner).send({ workspaceId: ws, name: 'X', assetType: 'WEBSITE', relationship: 'OWNED' }).expect(400);
    await h.api().post('/api/v1/user/assets').set(outsider).send({ workspaceId: ws, name: 'Intruder site', assetType: 'WEBSITE', relationship: 'OWNED' }).expect((r) => expect([403, 404]).toContain(r.status));

    const owned = (await h.api().post('/api/v1/user/assets').set(owner).send({ workspaceId: ws, name: 'Garden blog', url: 'https://garden-blog.test', assetType: 'CONTENT_SITE', relationship: 'OWNED', purchasePriceMinor: 500_000, currency: 'usd' }).expect(201)).body.data;
    const prospect = (await h.api().post('/api/v1/user/assets').set(owner).send({ workspaceId: ws, name: 'Recipe site', url: 'recipes.test', assetType: 'WEBSITE', relationship: 'PROSPECTIVE' }).expect(201)).body.data;

    const detail = (await h.api().get(`/api/v1/user/assets/${owned.id}`).set(owner).expect(200)).body.data;
    expect(detail).toMatchObject({ ownershipStatus: 'UNVERIFIED', verifiedAt: null, domain: 'garden-blog.test' });
    expect(detail.verification.dnsRecord.value).toContain(detail.verificationToken);

    // Prospective assets cannot be verified; outsiders cannot see either asset.
    await h.api().post(`/api/v1/user/assets/${prospect.id}/verify`).set(owner).send({ method: 'DNS_TXT' }).expect(400);
    await h.api().get(`/api/v1/user/assets/${owned.id}`).set(outsider).expect(denied);
    await h.api().patch(`/api/v1/user/assets/${owned.id}`).set(outsider).send({ name: 'Taken over' }).expect(denied);
    expect((await h.api().get(`/api/v1/user/assets?workspaceId=${otherWs}`).set(outsider).expect(200)).body.data).toEqual([]);

    const s = (await h.api().get(`/api/v1/user/assets/summary?workspaceId=${ws}`).set(owner).expect(200)).body.data;
    // Prospective acquisitions are counted apart from the portfolio total.
    expect(s).toMatchObject({ totalAssets: 1, owned: 1, prospective: 1, estimatedValue: null });
    expect(s.verification.VERIFIED ?? 0).toBe(0);
  });

  it('records self-reported financials for past months only', async () => {
    const [asset] = (await h.api().get(`/api/v1/user/assets?workspaceId=${ws}&relationship=OWNED`).set(owner).expect(200)).body.data;
    const next = new Date();
    next.setUTCMonth(next.getUTCMonth() + 2);
    const future = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
    await h.api().post(`/api/v1/user/assets/${asset.id}/financials`).set(owner).send({ month: future, revenueMinor: 1000, costMinor: 0 }).expect(400);
    await h.api().post(`/api/v1/user/assets/${asset.id}/financials`).set(owner).send({ month: '2026-01', revenueMinor: 120_000, costMinor: 20_000 }).expect(201);
    await h.api().post(`/api/v1/user/assets/${asset.id}/financials`).set(outsider).send({ month: '2026-02', revenueMinor: 1, costMinor: 0 }).expect(denied);
    const detail = (await h.api().get(`/api/v1/user/assets/${asset.id}`).set(owner).expect(200)).body.data;
    expect(detail.financials).toHaveLength(1);
    expect(detail.financials[0]).toMatchObject({ revenueMinor: 120_000, costMinor: 20_000 });

    await h.api().delete(`/api/v1/user/assets/${asset.id}`).set(outsider).expect(denied);
    await h.api().delete(`/api/v1/user/assets/${asset.id}`).set(owner).expect(200);
    await h.api().get(`/api/v1/user/assets/${asset.id}`).set(owner).expect(404);
  });
});
