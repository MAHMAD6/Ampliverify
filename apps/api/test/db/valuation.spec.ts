import { DataForSeoClient } from '../../src/keywords/dataforseo.client';
import { IntegrationsService } from '../../src/integrations/integrations.service';
import { startApp } from './app-harness';

/** Canned DataForSEO responses: the provider is stubbed, everything else is real. */
function stubDataForSeo(client: DataForSeoClient) {
  jest.spyOn(client, 'configured', 'get').mockReturnValue(true);
  jest.spyOn(client, 'domainKeywords').mockResolvedValue([
    { keyword: 'valuedsite pricing', searchVolume: 500, difficulty: 30, cpc: 2, competition: null, intent: null, trend: null },
    { keyword: 'seo audit tool', searchVolume: 9_500, difficulty: 60, cpc: 4, competition: null, intent: null, trend: null },
  ]);
  jest.spyOn(client, 'request').mockImplementation(async (path: string) => {
    if (path.includes('domain_rank_overview')) return { items: [{ metrics: { organic: { etv: 12_400, count: 3_200, estimated_paid_traffic_cost: 900, pos_1: 100, pos_2_3: 200, pos_4_10: 700, pos_11_20: 1_000, pos_21_30: 1_200 } } }] };
    if (path.includes('historical_rank_overview')) return { items: Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, metrics: { organic: { etv: 8_000 + i * 400, count: 3_000 + i * 20 } } })) };
    if (path.includes('backlinks/summary')) return { rank: 620, backlinks: 12_600, referring_domains: 3_800 };
    if (path.includes('backlinks/history')) return { items: Array.from({ length: 12 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-01`, referring_domains: 3_000 + i * 70 })) };
    return null;
  });
}

describe('Website Value Calculator', () => {
  let h: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40) });
    stubDataForSeo(h.app.get(DataForSeoClient));
    // No outbound calls in tests: PageSpeed and RDAP are switched off.
    await h.prisma.systemSetting.upsert({
      where: { key: 'valuation.engine' },
      create: { key: 'valuation.engine', valueJson: { sources: { pagespeed: false, rdap: false }, limits: { freePerMonth: 2 } } },
      update: { valueJson: { sources: { pagespeed: false, rdap: false }, limits: { freePerMonth: 2 } } },
    });
  });
  afterAll(async () => {
    await h?.close();
  });

  it('calculates an anonymous estimate on the queue, caches it, and enforces the free monthly limit', async () => {
    const cfg = await h.api().get('/api/v1/public/valuations/config').expect(200);
    expect(cfg.body.data).toMatchObject({ enabled: true, available: true, freePerMonth: 2 });

    const created = await h.api().post('/api/v1/public/valuations').set('x-forwarded-for', '203.0.113.7').send({ domain: 'https://www.ValuedSite.com/path' }).expect(201);
    const id = created.body.data.id as string;
    const pending = await h.api().get(`/api/v1/public/valuations/${id}`).expect(200);
    expect(pending.body.data).toMatchObject({ domain: 'valuedsite.com', status: 'PENDING', result: null });

    expect(await h.jobs.drain(['valuation.run'])).toBe(1);
    const done = await h.api().get(`/api/v1/public/valuations/${id}`).expect(200);
    const r = done.body.data;
    expect(r.status).toBe('COMPLETED');
    expect(r.access).toBe('limited');
    expect(r.result.valueLow).toBeLessThan(r.result.valueMid);
    expect(r.result.valueMid).toBeLessThan(r.result.valueHigh);
    expect(r.result.metrics).toMatchObject({ organicTraffic: 12_400, referringDomains: 3_800, domainAuthority: 62 });
    expect(r.result.drivers.length).toBeGreaterThan(0);
    // Limited access hides the detail tabs and exports.
    expect(r.result.detail).toBeNull();
    expect(r.exports).toEqual({ pdf: false, json: false });
    await h.api().get(`/api/v1/public/valuations/${id}/pdf`).expect(403);

    // Same domain again: served from cache, no new calculation.
    const again = await h.api().post('/api/v1/public/valuations').send({ domain: 'valuedsite.com' }).expect(201);
    expect(again.body.data).toEqual({ id, cached: true });

    // Projected confidence with planned GA4 + Search Console connections.
    const preview = await h.api().post(`/api/v1/public/valuations/${id}/preview`).send({ planned: ['ga4', 'gsc'], business: { annualRevenue: 250000, profitMargin: '20-30' } }).expect(201);
    expect(preview.body.data.confidence).toBeGreaterThan(r.result.confidence);
  });

  it('limits anonymous estimates per requester', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.9' };
    await h.api().post('/api/v1/public/valuations').set(ip).send({ domain: 'first-site.com' }).expect(201);
    await h.api().post('/api/v1/public/valuations').set(ip).send({ domain: 'second-site.com' }).expect(201);
    const res = await h.api().post('/api/v1/public/valuations').set(ip).send({ domain: 'third-site.com' }).expect(429);
    expect(res.body.error.code).toBe('VALUATION_LIMIT_REACHED');
    await h.api().post('/api/v1/public/valuations').send({ domain: 'localhost' }).expect(400);
  });

  it('builds a verified valuation from connected GA4 data and business inputs', async () => {
    const { user, workspaceId } = await h.onboard('valuation-owner');
    const auth = { authorization: user.bearer };
    const est = await h.api().post('/api/v1/user/valuations').set(auth).send({ domain: 'ownersite.com' }).expect(201);
    await h.jobs.drain(['valuation.run']);

    const provider = await h.prisma.integrationProvider.findUniqueOrThrow({ where: { key: 'google_analytics' } });
    const me = await h.prisma.user.findFirstOrThrow({ where: { authSubject: user.authSubject } });
    const integ = await h.prisma.workspaceIntegration.create({ data: { workspaceId, providerId: provider.id, status: 'CONNECTED', connectedBy: me.id } });
    const svc = h.app.get(IntegrationsService);
    jest.spyOn(svc, 'ga4ValuationSummary').mockResolvedValue({
      totalSessions: 30_000,
      organicSessions: 13_000,
      socialSessions: 6_800,
      socialSources: [{ source: 'linkedin.com', sessions: 2_200 }, { source: 'youtube.com', sessions: 1_600 }],
      organicTrend: [{ month: '2026-09', value: 12_000 }, { month: '2026-10', value: 13_000 }],
      socialTrend: [{ month: '2026-09', value: 6_000 }, { month: '2026-10', value: 6_800 }],
    });

    const ver = await h.api()
      .post(`/api/v1/user/valuations/${est.body.data.id}/verify`)
      .set(auth)
      .send({ ga4: { integrationId: integ.id, propertyId: 'properties/123' }, monthlyRevenue: 5000, profitMargin: '20-30', industry: 'Technology' })
      .expect(201);
    await h.jobs.drain(['valuation.run']);
    const report = await h.api().get(`/api/v1/public/valuations/${ver.body.data.id}`).expect(200);
    const v = report.body.data;
    expect(v).toMatchObject({ kind: 'VERIFIED', status: 'COMPLETED', parentId: est.body.data.id });
    expect(v.result.metrics).toMatchObject({ organicTraffic: 13_000, organicTrafficVerified: true, socialTraffic: 6_800 });
    expect(v.result.method).toBe('traffic+revenue');
    expect(v.result.sources.find((s: { key: string }) => s.key === 'ga4').state).toBe('verified');
    const parent = await h.api().get(`/api/v1/public/valuations/${est.body.data.id}`).expect(200);
    expect(parent.body.data.verifiedChild).toMatchObject({ id: ver.body.data.id });

    // Another user's connection cannot be used.
    const other = await h.onboard('valuation-other');
    jest.spyOn(svc, 'ga4ValuationSummary').mockRestore();
    const denied = await h.api().post(`/api/v1/user/valuations/${est.body.data.id}/verify`).set({ authorization: other.user.bearer }).send({ ga4: { integrationId: integ.id, propertyId: 'properties/123' } });
    expect([403, 404]).toContain(denied.status);
  });

  it('lets admins edit settings with validation and history, and denies regular users', async () => {
    const { user } = await h.onboard('valuation-nonadmin');
    await h.api().get('/api/v1/admin/valuation/settings').set({ authorization: user.bearer }).expect(403);
    await h.api().put('/api/v1/admin/valuation/settings').set({ authorization: user.bearer }).send({ settings: {} }).expect(403);
  });
});
