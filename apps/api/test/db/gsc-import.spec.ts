import { IntegrationsService } from '../../src/integrations/integrations.service';
import { startApp } from './app-harness';

describe('Import projects from Google Search Console', () => {
  let h: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40) });
  });
  afterAll(async () => {
    await h?.close();
  });

  it('creates projects for chosen sites, links existing domains and rejects sites not on the account', async () => {
    const { user, workspaceId, projectId: existingId } = await h.onboard('gsc-import', { domain: 'existing.example' });
    const auth = { authorization: user.bearer };
    const provider = await h.prisma.integrationProvider.findUniqueOrThrow({ where: { key: 'google_search_console' } });
    const me = await h.prisma.user.findFirstOrThrow({ where: { authSubject: user.authSubject } });
    const integ = await h.prisma.workspaceIntegration.create({ data: { workspaceId, providerId: provider.id, status: 'CONNECTED', connectedBy: me.id, externalAccountRef: 'owner@example.test' } });
    // The Google API itself is not called in tests: the account's site list is stubbed.
    jest.spyOn(h.app.get(IntegrationsService), 'googleProperties').mockResolvedValue([
      { id: 'sc-domain:fresh.example', name: 'sc-domain:fresh.example' },
      { id: 'https://www.existing.example/', name: 'https://www.existing.example/' },
    ]);

    const res = await h.api()
      .post(`/api/v1/user/workspaces/${workspaceId}/integrations/google/import-projects`)
      .set(auth)
      .send({ integrationId: integ.id, siteUrls: ['sc-domain:fresh.example', 'https://www.existing.example/', 'https://not-mine.example/'] })
      .expect(201);
    const results = res.body.data as { siteUrl: string; status: string; projectId?: string }[];
    expect(results.map((r) => r.status)).toEqual(['created', 'linked', 'failed']);
    expect(results[1].projectId).toBe(existingId);

    const created = await h.prisma.project.findUniqueOrThrow({ where: { id: results[0].projectId! }, include: { domains: true, dataSources: true } });
    expect(created.domains.map((d) => d.host)).toEqual(['fresh.example']);
    expect(created.dataSources[0]).toMatchObject({ sourceType: 'GOOGLE_SEARCH_CONSOLE', configJson: { propertyId: 'sc-domain:fresh.example' } });
    expect(await h.prisma.projectDataSource.count({ where: { projectId: existingId } })).toBe(1);

    // Another workspace cannot use this connection.
    const other = await h.onboard('gsc-other');
    await h.api()
      .post(`/api/v1/user/workspaces/${other.workspaceId}/integrations/google/import-projects`)
      .set({ authorization: other.user.bearer })
      .send({ integrationId: integ.id, siteUrls: ['sc-domain:fresh.example'] })
      .expect(404);
  });
});
