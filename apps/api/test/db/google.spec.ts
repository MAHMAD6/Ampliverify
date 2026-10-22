import { CreditsService } from '../../src/commerce/credits.service';
import { GoogleService } from '../../src/integrations/google.service';
import { startApp } from './app-harness';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (sub: string, email: string) => `x.${b64({ sub, email })}.y`;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Google API Integration Manual V1.1 §10 acceptance checks (Google endpoints stubbed). */
describe('Google integration (OAuth, tokens, sync)', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  const realFetch = global.fetch;
  let tokenResponses: Response[] = [];
  let lastTokenBody: URLSearchParams | null = null;

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40), GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'secret', WEB_URL: 'https://app.test' });
    jest.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === 'https://oauth2.googleapis.com/token') {
        lastTokenBody = new URLSearchParams(String(init?.body));
        return tokenResponses.shift() ?? json(400, { error: 'invalid_grant' });
      }
      if (url === 'https://oauth2.googleapis.com/revoke') return json(200, {});
      if (url.startsWith('https://www.googleapis.com/webmasters/v3/sites') && !url.includes('searchAnalytics')) return json(200, { siteEntry: [{ siteUrl: 'sc-domain:acme.test', permissionLevel: 'siteOwner' }] });
      if (url.includes('searchAnalytics/query')) {
        const body = JSON.parse(String(init?.body)) as { dimensions?: string[] };
        if (body.dimensions?.[0] === 'date') return json(200, { rows: [{ keys: ['2026-10-20'], clicks: 10, impressions: 100, ctr: 0.1, position: 4.2 }, { keys: ['2026-10-21'], clicks: 12, impressions: 110, ctr: 0.109, position: 4.0 }] });
        return json(200, { rows: [{ keys: [body.dimensions?.[0] === 'query' ? 'acme widgets' : 'https://acme.test/'], clicks: 22, impressions: 210, ctr: 0.104, position: 4.1 }] });
      }
      return realFetch(input as RequestInfo, init);
    });
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await h?.close();
  });

  async function connect(auth: { authorization: string }, workspaceId: string, tokens: Record<string, unknown>) {
    const start = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/google/start`).set(auth).send({ provider: 'google_search_console' }).expect(201);
    const url = new URL(start.body.data.url);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/webmasters.readonly');
    expect(url.searchParams.get('scope')).not.toContain('analytics');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/app/integrations/google/callback');
    const state = url.searchParams.get('state')!;
    tokenResponses.push(json(200, { access_token: 'at-1', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/webmasters.readonly', id_token: idToken('sub-1', 'owner@acme.test'), ...tokens }));
    const done = await h.api().post('/api/v1/user/integrations/google/callback').set(auth).send({ code: 'code-1', state }).expect(201);
    return { state, data: done.body.data as { id: string; status: string } };
  }

  it('runs the OAuth lifecycle with PKCE and single-use state, keeps refresh tokens, and isolates workspaces', async () => {
    const { user, workspaceId, projectId } = await h.onboard('google', { domain: 'acme.test' });
    const auth = { authorization: user.bearer };

    const { state, data } = await connect(auth, workspaceId, { refresh_token: 'rt-1' });
    expect(data.status).toBe('CONNECTED');
    expect(lastTokenBody!.get('code_verifier')).toMatch(/^[\w-]{43,128}$/);
    // Tokens are encrypted at rest and never returned.
    const token = await h.prisma.integrationToken.findFirstOrThrow({ where: { workspaceIntegrationId: data.id } });
    expect(token.accessSecretRef).toMatch(/^v1\./);
    expect(token.accessSecretRef).not.toContain('rt-1');
    const list = await h.api().get(`/api/v1/user/workspaces/${workspaceId}/integrations`).set(auth).expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/rt-1|at-1/);

    // Replayed state is rejected.
    const replay = await h.api().post('/api/v1/user/integrations/google/callback').set(auth).send({ code: 'code-1', state }).expect(400);
    expect(replay.body.error.code).toBe('INVALID_STATE');
    // Mismatched user is rejected.
    const other = await h.onboard('google-other');
    const start = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/google/start`).set(auth).send({ provider: 'google_search_console' }).expect(201);
    const s2 = new URL(start.body.data.url).searchParams.get('state')!;
    await h.api().post('/api/v1/user/integrations/google/callback').set({ authorization: other.user.bearer }).send({ code: 'c', state: s2 }).expect(400);
    // Expired state is rejected.
    const start3 = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/google/start`).set(auth).send({ provider: 'google_search_console' }).expect(201);
    const s3 = new URL(start3.body.data.url).searchParams.get('state')!;
    await h.prisma.oAuthTransaction.updateMany({ where: { userId: (await h.prisma.user.findFirstOrThrow({ where: { authSubject: user.authSubject } })).id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await h.api().post('/api/v1/user/integrations/google/callback').set(auth).send({ code: 'c', state: s3 }).expect(400);

    // Reconnect without a new refresh token keeps the stored one (same connection).
    const again = await connect(auth, workspaceId, {});
    expect(again.data.id).toBe(data.id);
    tokenResponses.push(json(200, { access_token: 'at-2', expires_in: 3600 }));
    await h.app.get(GoogleService).accessToken(data.id, true);
    expect(lastTokenBody!.get('refresh_token')).toBe('rt-1');

    // Only authorized properties can be linked; another workspace cannot read this connection.
    await h.api().post(`/api/v1/user/projects/${projectId}/data-sources`).set(auth).send({ integrationId: data.id, propertyId: 'https://not-mine.test/' }).expect(400);
    const ds = await h.api().post(`/api/v1/user/projects/${projectId}/data-sources`).set(auth).send({ integrationId: data.id, propertyId: 'sc-domain:acme.test' }).expect(201);
    expect([403, 404]).toContain((await h.api().get(`/api/v1/user/integrations/${data.id}/properties`).set({ authorization: other.user.bearer })).status);
    expect([403, 404]).toContain((await h.api().get(`/api/v1/user/projects/${projectId}/google/overview`).set({ authorization: other.user.bearer })).status);

    // Sync is idempotent: draining twice and re-running the same key does not duplicate rows.
    await h.jobs.drain(['google.sync']);
    const svc = h.app.get(GoogleService);
    const run = await h.prisma.syncRun.findFirstOrThrow({ where: { dataSourceId: ds.body.data.id } });
    expect(run).toMatchObject({ status: 'SUCCEEDED' });
    const count = await h.prisma.googleMetric.count({ where: { dataSourceId: ds.body.data.id } });
    expect(count).toBe(4); // 2 days + 1 query + 1 page
    await svc.syncDataSource(ds.body.data.id, run.syncKey!);
    await svc.syncDataSource(ds.body.data.id, `${run.syncKey}-retry`);
    expect(await h.prisma.googleMetric.count({ where: { dataSourceId: ds.body.data.id } })).toBe(4);
    const overview = await h.api().get(`/api/v1/user/projects/${projectId}/google/overview`).set(auth).expect(200);
    expect(overview.body.data[0]).toMatchObject({ sourceLabel: 'Google Search Console', propertyId: 'sc-domain:acme.test', totals: { clicks: 22, impressions: 210 } });

    // Revoked refresh token → REAUTH_REQUIRED, sync stops, safe message.
    tokenResponses.push(json(400, { error: 'invalid_grant' }));
    await expect(svc.accessToken(data.id, true)).rejects.toMatchObject({ response: { code: 'GOOGLE_REAUTH_REQUIRED' } });
    const status = await h.api().get(`/api/v1/user/integrations/${data.id}/status`).set(auth).expect(200);
    expect(status.body.data).toMatchObject({ status: 'REAUTH_REQUIRED', message: 'Reconnect Google to continue syncing.' });
    await svc.scheduleDueSyncs(new Date(Date.now() + 2 * 86_400_000));
    expect(await h.prisma.backgroundJob.count({ where: { queue: 'google.sync', status: 'QUEUED', jobKey: { startsWith: `gsync:${ds.body.data.id}:` } } })).toBe(0);

    // Disconnect revokes and removes credentials.
    const off = await h.api().delete(`/api/v1/user/integrations/${data.id}`).set(auth).expect(200);
    expect(off.body.data).toMatchObject({ status: 'DISCONNECTED', revoked: true });
    expect(await h.prisma.integrationToken.count({ where: { workspaceIntegrationId: data.id } })).toBe(0);
  });

  it('handles a cancelled consent explicitly', async () => {
    const { user, workspaceId } = await h.onboard('google-cancel');
    const auth = { authorization: user.bearer };
    const start = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/google/start`).set(auth).send({ provider: 'google_analytics' }).expect(201);
    const state = new URL(start.body.data.url).searchParams.get('state')!;
    const res = await h.api().post('/api/v1/user/integrations/google/callback').set(auth).send({ state, error: 'access_denied' }).expect(400);
    expect(res.body.error).toMatchObject({ code: 'GOOGLE_CONSENT_DENIED', message: 'Google connection cancelled.' });
    expect(await h.prisma.workspaceIntegration.count({ where: { workspaceId } })).toBe(0);
  });

  it('spends subscription credits before purchased ones and expires subscription credits (Hybrid pricing)', async () => {
    const { workspaceId } = await h.onboard('lots');
    const credits = h.app.get(CreditsService);
    const soon = new Date(Date.now() + 60_000);
    await h.prisma.$transaction(async (tx) => {
      await credits.applyEntry(tx, { workspaceId, delta: 50, reason: 'PURCHASE', referenceType: 'test', idempotencyKey: `t-buy:${workspaceId}` });
      await credits.applyEntry(tx, { workspaceId, delta: 100, reason: 'PLAN_GRANT', referenceType: 'test', idempotencyKey: `t-plan:${workspaceId}`, grant: { source: 'SUBSCRIPTION', expiresAt: soon } });
    });
    const r = await credits.reserve({ workspaceId, featureKey: 'geo.check', amount: 30, referenceType: 'test', referenceId: workspaceId, idempotencyKey: `t-res:${workspaceId}` });
    await credits.settle(r.id);
    const lots = await credits.lots(workspaceId);
    expect(lots.map((l) => [l.source, l.remaining])).toEqual([['SUBSCRIPTION', 70], ['PURCHASE', 50]]);
    const q = await credits.quote(workspaceId, 'geo.check', 1, 20);
    expect(q).toMatchObject({ cost: 20, available: 120, after: 100, sufficient: true });

    await credits.expireLots(new Date(Date.now() + 120_000));
    expect(Number(await credits.balance(workspaceId))).toBe(50);
    expect((await credits.lots(workspaceId)).map((l) => [l.source, l.remaining])).toEqual([['PURCHASE', 50]]);
    await credits.expireLots(new Date(Date.now() + 120_000));
    expect(Number(await credits.balance(workspaceId))).toBe(50);
  });
});
