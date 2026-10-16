import { DataForSeoClient } from '../../src/keywords/dataforseo.client';
import { IntegrationsService } from '../../src/integrations/integrations.service';
import * as sources from '../../src/valuation/valuation-sources';
import { DEFAULT_CONFIG } from '../../src/valuation/valuation-engine';
import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

const CONSENT = DEFAULT_CONFIG.consentVersion;

/** Providers are stubbed; the pipeline, storage, access rules and credits are real. */
function stubProviders(client: DataForSeoClient) {
  jest.spyOn(client, 'configured', 'get').mockReturnValue(true);
  jest.spyOn(sources, 'collectCrawler').mockImplementation(async () => [
    sources.ev('crawler', 'http_ok', 'Home page responds', true),
    sources.ev('crawler', 'https', 'HTTPS', true),
    sources.ev('crawler', 'indexable', 'Indexable', true),
    sources.ev('crawler', 'crawlable', 'Crawlable', true),
    sources.ev('crawler', 'title_length', 'Title length', 50),
    sources.ev('crawler', 'meta_description_length', 'Description length', 140),
    sources.ev('crawler', 'h1_count', 'H1', 1),
    sources.ev('crawler', 'h2_count', 'H2', 5),
    sources.ev('crawler', 'canonical_valid', 'Canonical', true),
    sources.ev('crawler', 'structured_data', 'Schema', true),
    sources.ev('crawler', 'word_count', 'Words', 900),
    sources.ev('crawler', 'sitemap_urls', 'Sitemap', null, { missingReason: 'No readable XML sitemap was found.' }),
  ]);
  // Provider outage: PageSpeed fails for every request.
  jest.spyOn(sources, 'collectPageSpeed').mockRejectedValue(new Error('PageSpeed Insights returned 503.'));
  jest.spyOn(sources, 'collectRdap').mockResolvedValue([sources.ev('rdap', 'domain_age_years', 'Domain age', 9), sources.ev('rdap', 'status', 'Status', 'active')]);
  jest.spyOn(sources, 'collectDataForSeo').mockResolvedValue({
    evidence: [sources.ev('dataforseo', 'estimated_organic_visits', 'Visits', 12_400), sources.ev('dataforseo', 'ranking_keywords', 'Keywords', 3_200), sources.ev('dataforseo', 'avg_position', 'Position', 18.5)],
    trend: [{ month: '2026-09', value: 12_000 }],
  });
}

describe('Website Value Calculator (V1 manual)', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let admin: { authorization: string };

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40) });
    stubProviders(h.app.get(DataForSeoClient));
    const a = await h.provision('valuation-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
  });
  afterAll(async () => {
    await h?.close();
  });

  it('runs a public estimate: score + evidence, no monetary value, share-token access only', async () => {
    const cfg = await h.api().get('/api/v1/public/valuations/config').expect(200);
    expect(cfg.body.data).toMatchObject({ enabled: true, available: true, consentVersion: CONSENT, methodologyVersion: 'v1.0.0' });

    await h.api().post('/api/v1/public/valuations').send({ domain: 'valuedsite.com', consentVersion: '2020-01-01' }).expect(400);
    const created = await h.api().post('/api/v1/public/valuations').set('x-forwarded-for', '203.0.113.7').send({ domain: 'https://www.ValuedSite.com/path', consentVersion: CONSENT, idempotencyKey: 'pub-key-0001' }).expect(201);
    const { id, shareToken, status } = created.body.data;
    expect(status).toBe('queued');

    // Same idempotency key: same job, nothing new queued.
    const replay = await h.api().post('/api/v1/public/valuations').set('x-forwarded-for', '203.0.113.7').send({ domain: 'valuedsite.com', consentVersion: CONSENT, idempotencyKey: 'pub-key-0001' }).expect(201);
    expect(replay.body.data.id).toBe(id);
    expect(await h.prisma.websiteValuation.count({ where: { domain: 'valuedsite.com' } })).toBe(1);

    // Without the share token the job does not exist for others.
    await h.api().get(`/api/v1/public/valuations/${id}`).expect(404);
    await h.api().get(`/api/v1/public/valuations/${id}?t=wrong-token-value-000000000000`).expect(404);

    expect(await h.jobs.drain(['valuation.run'])).toBe(1);
    const r = (await h.api().get(`/api/v1/public/valuations/${id}?t=${shareToken}`).expect(200)).body.data;
    expect(r).toMatchObject({ status: 'completed', domain: 'valuedsite.com', mode: 'public', confidence: 'LOW', monetaryRange: null, methodologyVersion: 'v1.0.0', currency: 'USD' });
    expect(r.qualityScore).toBeGreaterThan(0);
    expect(r.limitations[0]).toBe('Insufficient evidence for a monetary valuation.');
    expect(r.limitations).toContain('Performance: no evidence was available.');

    const evid = (await h.api().get(`/api/v1/public/valuations/${id}/evidence?t=${shareToken}`).expect(200)).body.data;
    const ps = evid.find((e: { metric: string }) => e.metric === 'pagespeed.performance_mobile');
    expect(ps).toMatchObject({ status: 'unavailable', classification: 'observed', value: null });
    expect(ps.missingReason).toMatch(/503/);
    expect(evid.find((e: { metric: string }) => e.metric === 'dataforseo.estimated_organic_visits')).toMatchObject({ classification: 'modeled', value: 12400 });
    expect(evid.find((e: { metric: string }) => e.metric === 'crawler.sitemap_urls')).toMatchObject({ status: 'unavailable', value: null });

    // Completed results are immutable at the database layer.
    await expect(h.prisma.websiteValuation.update({ where: { id }, data: { qualityScore: 1 } })).rejects.toThrow(/immutable/);
  });

  it('rejects private or invalid hosts before any fetch and enforces anonymous quotas', async () => {
    await h.api().post('/api/v1/public/valuations').send({ domain: 'localhost', consentVersion: CONSENT }).expect(422);
    await h.api().post('/api/v1/public/valuations').send({ domain: 'http://169.254.169.254/latest', consentVersion: CONSENT }).expect(422);
    const ip = { 'x-forwarded-for': '198.51.100.9' };
    for (const d of ['first-site.com', 'second-site.com', 'third-site.com']) await h.api().post('/api/v1/public/valuations').set(ip).send({ domain: d, consentVersion: CONSENT }).expect(201);
    const res = await h.api().post('/api/v1/public/valuations').set(ip).send({ domain: 'fourth-site.com', consentVersion: CONSENT }).expect(429);
    expect(res.body.error.code).toBe('VALUATION_LIMIT_REACHED');
    await h.jobs.drain(['valuation.run']);
  });

  it('publishes methodology versions; results keep the version they were calculated with', async () => {
    const before = (await h.api().get('/api/v1/admin/valuation/config').set(admin).expect(200)).body.data;
    expect(before.version).toBe('v1.0.0');
    const bad = await h.api().patch('/api/v1/admin/valuation/config').set(admin).send({ config: { ...before.config, weights: { ...before.config.weights, visibility: 90 } } }).expect(400);
    expect(bad.body.error.code).toBe('INVALID_VALUATION_CONFIG');
    const comparables = [{ id: 'content-2026', label: 'Content sites (H1 2026)', businessModel: 'content', multipleLow: 2.5, multipleHigh: 3.5, observedAt: '2026-06-01', source: 'Broker transaction report' }];
    const saved = await h.api().patch('/api/v1/admin/valuation/config').set(admin).send({ config: { ...before.config, comparables, enhancedCredits: 2 }, note: 'Add content comparables' }).expect(200);
    expect(saved.body.data.version).toBe('v1.0.1');
    const after = (await h.api().get('/api/v1/admin/valuation/config').set(admin).expect(200)).body.data;
    expect(after.versions.map((v: { version: string }) => v.version)).toEqual(['v1.0.1', 'v1.0.0']);
    await expect(h.prisma.valuationMethodology.updateMany({ data: { note: 'tamper' } })).rejects.toThrow(/append-only/);
    const old = await h.prisma.websiteValuation.findFirstOrThrow({ where: { domain: 'valuedsite.com' } });
    expect(old.methodologyVersion).toBe('v1.0.0');
    const user = await h.provision('valuation-nonadmin');
    await h.api().patch('/api/v1/admin/valuation/config').set({ authorization: user.bearer }).send({ config: {} }).expect(403);
  });

  it('runs an enhanced valuation with verified GA4 data and self-reported earnings, reserving and settling credits once', async () => {
    const { user, workspaceId } = await h.onboard('valuation-owner');
    const auth = { authorization: user.bearer };
    const est = (await h.api().post('/api/v1/user/valuations').set(auth).send({ domain: 'ownersite.com', consentVersion: CONSENT }).expect(201)).body.data;
    await h.jobs.drain(['valuation.run']);
    // Owners read their own job without a token.
    await h.api().get(`/api/v1/user/valuations/${est.id}`).set(auth).expect(200);

    // Grant credits and enhanced access for this workspace's (default) plan.
    const wallet = await h.prisma.creditWallet.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
    await h.prisma.creditLedger.create({ data: { walletId: wallet.id, delta: 10, reason: 'PROMOTIONAL', idempotencyKey: `grant:${workspaceId}` } });
    await h.prisma.creditWallet.update({ where: { id: wallet.id }, data: { balanceCache: 10 } });
    const current = (await h.api().get('/api/v1/admin/valuation/config').set(admin).expect(200)).body.data.config;
    await h.api().patch('/api/v1/admin/valuation/config').set(admin).send({ config: { ...current, access: { free: 'enhanced' } } }).expect(200);

    const provider = await h.prisma.integrationProvider.findUniqueOrThrow({ where: { key: 'google_analytics' } });
    const me = await h.prisma.user.findFirstOrThrow({ where: { authSubject: user.authSubject } });
    const integ = await h.prisma.workspaceIntegration.create({ data: { workspaceId, providerId: provider.id, status: 'CONNECTED', connectedBy: me.id } });
    jest.spyOn(h.app.get(IntegrationsService), 'ga4ValuationSummary').mockResolvedValue({ totalSessions: 30_000, organicSessions: 13_000, socialSessions: 0, socialSources: [], organicTrend: [], socialTrend: [] });

    const body = { ga4: { integrationId: integ.id, propertyId: 'properties/123' }, financial: { ttmRevenue: 200_000, ttmExpenses: 80_000, businessModel: 'content' }, consentVersion: CONSENT, idempotencyKey: 'verify-key-001' };
    await h.api().post(`/api/v1/user/valuations/${est.id}/verify`).set(auth).send(body).expect(400); // assumptions not accepted
    const ver = (await h.api().post(`/api/v1/user/valuations/${est.id}/verify`).set(auth).send({ ...body, acceptAssumptions: true }).expect(201)).body.data;
    const again = (await h.api().post(`/api/v1/user/valuations/${est.id}/verify`).set(auth).send({ ...body, acceptAssumptions: true }).expect(201)).body.data;
    expect(again.id).toBe(ver.id);
    const reservation = await h.prisma.creditReservation.findFirstOrThrow({ where: { referenceId: ver.id } });
    expect(reservation.status).toBe('RESERVED');
    expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(8);

    await h.jobs.drain(['valuation.run']);
    const v = (await h.api().get(`/api/v1/user/valuations/${ver.id}`).set(auth).expect(200)).body.data;
    expect(v).toMatchObject({ mode: 'enhanced', status: 'completed', confidence: 'MEDIUM', monetaryRange: { earnings: 120_000, low: 300_000, high: 420_000, currency: 'USD' } });
    const evid = (await h.api().get(`/api/v1/user/valuations/${ver.id}/evidence`).set(auth).expect(200)).body.data;
    expect(evid.find((e: { metric: string }) => e.metric === 'ga4.organic_sessions_30d')).toMatchObject({ classification: 'verified', value: 13000 });
    expect(evid.find((e: { metric: string }) => e.metric === 'user.ttm_revenue')).toMatchObject({ classification: 'self_reported', value: 200000 });
    expect((await h.prisma.creditReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('SETTLED');
    expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(8);

    // User B cannot read user A's job, evidence or report, nor use A's connection.
    const other = await h.onboard('valuation-other');
    const ob = { authorization: other.user.bearer };
    await h.api().get(`/api/v1/user/valuations/${ver.id}`).set(ob).expect(404);
    await h.api().get(`/api/v1/user/valuations/${ver.id}/evidence`).set(ob).expect(404);
    await h.api().get(`/api/v1/user/valuations/${ver.id}/report`).set(ob).expect(404);
    jest.spyOn(h.app.get(IntegrationsService), 'ga4ValuationSummary').mockRestore();
    const otherEst = (await h.api().post('/api/v1/user/valuations').set(ob).send({ domain: 'otherco.com', consentVersion: CONSENT }).expect(201)).body.data;
    await h.jobs.drain(['valuation.run']);
    const denied = await h.api().post(`/api/v1/user/valuations/${otherEst.id}/verify`).set(ob).send({ ga4: { integrationId: integ.id, propertyId: 'properties/123' }, consentVersion: CONSENT });
    expect([403, 404]).toContain(denied.status);
  });

  it('releases reserved credits when an enhanced valuation fails', async () => {
    const { user, workspaceId } = await h.onboard('valuation-fail');
    const auth = { authorization: user.bearer };
    const est = (await h.api().post('/api/v1/user/valuations').set(auth).send({ domain: 'failingsite.com', consentVersion: CONSENT }).expect(201)).body.data;
    await h.jobs.drain(['valuation.run']);
    const wallet = await h.prisma.creditWallet.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
    await h.prisma.creditLedger.create({ data: { walletId: wallet.id, delta: 5, reason: 'PROMOTIONAL', idempotencyKey: `grant:${workspaceId}` } });
    await h.prisma.creditWallet.update({ where: { id: wallet.id }, data: { balanceCache: 5 } });
    // Every source fails this time.
    jest.spyOn(sources, 'collectCrawler').mockResolvedValueOnce(sources.missing('crawler', sources.CRAWLER_METRICS, 'Connection refused'));
    jest.spyOn(sources, 'collectRdap').mockResolvedValueOnce(sources.missing('rdap', sources.RDAP_METRICS, 'Timeout'));
    jest.spyOn(sources, 'collectDataForSeo').mockResolvedValueOnce({ evidence: sources.missing('dataforseo', sources.DATAFORSEO_METRICS, 'Provider error'), trend: [] });
    await h.prisma.providerCache.deleteMany({});
    const ver = (await h.api().post(`/api/v1/user/valuations/${est.id}/verify`).set(auth).send({ financial: { ttmProfit: 50_000, businessModel: 'content' }, acceptAssumptions: true, consentVersion: CONSENT }).expect(201)).body.data;
    expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(3);
    await h.jobs.drain(['valuation.run']);
    const v = (await h.api().get(`/api/v1/user/valuations/${ver.id}`).set(auth).expect(200)).body.data;
    expect(v.status).toBe('failed');
    expect(v.error).toMatch(/SOURCE_UNAVAILABLE/);
    expect((await h.prisma.creditReservation.findFirstOrThrow({ where: { referenceId: ver.id } })).status).toBe('RELEASED');
    expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(5);
  });
});
