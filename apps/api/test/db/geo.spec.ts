import { Prisma } from '@prisma/client';
import { CreditsService } from '../../src/commerce/credits.service';
import { SettingsService, SETTING } from '../../src/commerce/settings.service';
import { GeoProviders, type Observation, type Surface } from '../../src/geo/geo-providers';
import { GeoService } from '../../src/geo/geo.service';
import { startApp } from './app-harness';

const observation = (surface: Surface, query: string, domain: string): Observation => ({
  provider: 'dataforseo',
  surface,
  providerTaskId: 'task-123',
  query,
  location: 'United States',
  language: 'en',
  device: 'desktop',
  observedAt: new Date().toISOString(),
  aiPresent: true,
  text: 'Acme Widgets is a popular choice for teams. Others include Rival Co.',
  citations: [{ url: `https://${domain}/guide`, title: 'Guide', domain }],
  organic: [],
  linkedDomains: [domain],
  costUsd: 0.002,
  raw: {},
});

/** V1 manual acceptance: GEO names the observed provider, never synthetic LLM rankings; partial jobs and credit releases. */
describe('GEO / AI Search evidence (DataForSEO)', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let settings: SettingsService;
  let before: unknown;

  beforeAll(async () => {
    h = await startApp({ DATAFORSEO_LOGIN: 'test', DATAFORSEO_PASSWORD: 'test' });
    settings = h.app.get(SettingsService);
    before = await settings.get(SETTING.creditCosts, null);
    await settings.set(SETTING.creditCosts, { ...((before as object) ?? {}), 'geo.check': 2 }, null);
  });

  afterAll(async () => {
    if (before === null) await h.prisma.systemSetting.deleteMany({ where: { key: SETTING.creditCosts } });
    else await settings.set(SETTING.creditCosts, before as Prisma.InputJsonValue, null);
    await h?.close();
  });

  it('observes Google surfaces, reserves credits, settles partial runs and releases failed ones', async () => {
    const { user, workspaceId, projectId } = await h.onboard('geo', { domain: 'acme-widgets.test' });
    const auth = { authorization: user.bearer };
    const credits = h.app.get(CreditsService);
    await h.prisma.$transaction((tx) => credits.applyEntry(tx, { workspaceId, delta: new Prisma.Decimal(10), reason: 'ADJUSTMENT_CREDIT', referenceType: 'test', referenceId: workspaceId, idempotencyKey: `test-grant:${workspaceId}` }));
    await h.prisma.workspace.update({ where: { id: workspaceId }, data: { settingsJson: { aiGeo: { brandName: 'Acme Widgets' } } } });

    const providers = h.app.get(GeoProviders);
    const observe = jest.spyOn(providers, 'observe').mockImplementation(async (surface, query) => {
      if (surface === 'google_organic') throw new Error('DataForSEO HTTP 503');
      return observation(surface, query, 'acme-widgets.test');
    });

    const platforms = await h.api().get('/api/v1/public/geo-platforms').expect(200);
    const keys = (platforms.body.data as { key: string }[]).map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['google-ai-mode', 'google-ai-overview']));
    for (const synthetic of ['chatgpt', 'claude', 'gemini', 'perplexity']) expect(keys).not.toContain(synthetic);

    const prompt = await h.api().post(`/api/v1/user/projects/${projectId}/geo/prompts`).set(auth).send({ prompt: 'best widget tools' }).expect(201);
    const run = await h.api().post(`/api/v1/user/geo/prompts/${prompt.body.data.id}/run`).set(auth).send({}).expect(201);
    expect(run.body.data.platforms.sort()).toEqual(['google-ai-mode', 'google-ai-overview']);
    expect(run.body.data.reservedCredits).toBe(4);
    expect(Number((await credits.balanceDetail(workspaceId)).reserved)).toBe(4);

    await h.jobs.drain(['geo.run']);
    const geoRun = await h.prisma.geoRun.findUniqueOrThrow({ where: { id: run.body.data.id } });
    expect(geoRun.status).toBe('PARTIAL');
    const reservation = await h.prisma.creditReservation.findUniqueOrThrow({ where: { idempotencyKey: `geo:${geoRun.id}` } });
    expect(reservation.status).toBe('SETTLED');
    // 10 granted − 4 reserved + 2 returned for the surface that failed.
    expect(Number(await credits.balance(workspaceId))).toBe(8);

    // Repeated processing (duplicate task callback / redelivery) changes nothing.
    await h.app.get(GeoService).process(geoRun.id);
    expect(Number(await credits.balance(workspaceId))).toBe(8);

    const detail = await h.api().get(`/api/v1/user/geo/prompts/${prompt.body.data.id}`).set(auth).expect(200);
    const results = detail.body.data.results as { platform: { key: string }; status: string; cited: boolean; mentioned: boolean; model: string | null; evidence: { provider: string; surface: string; surfaceLabel: string; query: string; location: string; inferenceLabel: string } | null }[];
    const aiMode = results.find((r) => r.platform.key === 'google-ai-mode')!;
    expect(aiMode).toMatchObject({ status: 'SUCCEEDED', mentioned: true, cited: true, model: null });
    expect(aiMode.evidence).toMatchObject({ provider: 'dataforseo', surface: 'google_ai_mode', surfaceLabel: 'Google AI Mode', query: 'best widget tools', location: 'United States', inferenceLabel: 'observed' });
    expect(results.find((r) => r.platform.key === 'google-ai-overview')!.status).toBe('FAILED');
    expect(JSON.stringify(detail.body.data)).not.toMatch(/chatgpt|claude|gemini|perplexity/i);

    // Every surface fails: the run is FAILED and the whole reservation is released.
    observe.mockRejectedValue(new Error('DataForSEO HTTP 503'));
    const second = await h.api().post(`/api/v1/user/geo/prompts/${prompt.body.data.id}/run`).set(auth).send({}).expect(201);
    await h.jobs.drain(['geo.run']);
    expect((await h.prisma.geoRun.findUniqueOrThrow({ where: { id: second.body.data.id } })).status).toBe('FAILED');
    expect((await h.prisma.creditReservation.findUniqueOrThrow({ where: { idempotencyKey: `geo:${second.body.data.id}` } })).status).toBe('RELEASED');
    expect(Number(await credits.balance(workspaceId))).toBe(8);
    expect(Number((await credits.balanceDetail(workspaceId)).reserved)).toBe(0);
    observe.mockRestore();
  });
});
