import { startApp, startSite } from './app-harness';

const BAD_PAGE = `<html><head></head><body><p>Short page.</p><img src="/x.png"><a href="/missing">click here</a></body></html>`;
const FIXED_PAGE = `<!doctype html><html lang="en"><head><title>Fixed page title for the audit test</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><h1>Fixed</h1><p>Short page.</p><img src="/x.png" alt="x"><a href="/about">About us</a></body></html>`;

describe('SEO audits and Optimization Center', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let site: Awaited<ReturnType<typeof startSite>>;

  beforeAll(async () => {
    h = await startApp();
    site = await startSite({
      '/': { body: BAD_PAGE },
      '/about': { body: '<html><head><title>About</title></head><body><h1>About</h1></body></html>' },
      '/robots.txt': { body: 'User-agent: *\nDisallow: /private\n', type: 'text/plain' },
      '/private': { body: '<html></html>' },
    });
  });

  afterAll(async () => {
    await site?.close();
    await h?.close();
  });

  it('audits a page, recommends fixes and verifies them', async () => {
    const { user, projectId } = await h.onboard('auditor', {});
    const auth = { authorization: user.bearer };

    const run = await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(auth).send({ url: `${site.origin}/`, mode: 'BOTH' }).expect(201);
    expect(run.body.data).toMatchObject({ status: 'QUEUED', request: { scope: 'PAGE', mode: 'BOTH' } });
    expect(await h.jobs.drain(['audit.run'])).toBe(1);

    const done = await h.api().get(`/api/v1/user/audits/${run.body.data.id}`).set(auth).expect(200);
    expect(done.body.data.status).toBe('SUCCEEDED');
    expect(done.body.data.scores.overall).toBeLessThan(100);
    const findings = done.body.data.pages[0].findings as { id: string; ruleKey: string; status: string }[];
    const ruleKeys = findings.map((f) => f.ruleKey);
    expect(ruleKeys).toEqual(
      expect.arrayContaining(['seo.title_missing', 'seo.h1_missing', 'content.broken_internal_link', 'content.generic_anchor', 'crawl.sitemap_missing', 'tech.not_https']),
    );
    expect(ruleKeys).not.toContain('crawl.robots_txt_missing');

    const latest = await h.api().get(`/api/v1/user/projects/${projectId}/audits/latest`).query({ url: `${site.origin}/` }).set(auth).expect(200);
    expect(latest.body.data.id).toBe(run.body.data.id);

    // Optimization Center
    const recs = await h.api().get(`/api/v1/user/projects/${projectId}/recommendations`).set(auth).expect(200);
    expect(recs.body.data.summary.high).toBeGreaterThan(0);
    const titleFinding = recs.body.data.items.find((i: { ruleKey: string }) => i.ruleKey === 'seo.title_missing');
    expect(titleFinding).toMatchObject({ category: 'SEO', priority: 1, pageUrl: `${site.origin}/` });
    const techOnly = await h.api().get(`/api/v1/user/projects/${projectId}/recommendations`).query({ category: 'Technical' }).set(auth).expect(200);
    expect(techOnly.body.data.items.every((i: { category: string }) => i.category === 'TECHNICAL')).toBe(true);

    const task = await h.api().post(`/api/v1/user/projects/${projectId}/tasks`).set(auth).send({ findingId: titleFinding.id }).expect(201);
    expect(task.body.data).toMatchObject({ status: 'OPEN', priority: 1, finding: { ruleKey: 'seo.title_missing', status: 'IN_PROGRESS' } });
    await h.api().post(`/api/v1/user/projects/${projectId}/tasks`).set(auth).send({ findingId: titleFinding.id }).expect(409);

    // Not fixed yet → verification fails.
    await h.api().post(`/api/v1/user/tasks/${task.body.data.id}/verify`).set(auth).expect(201);
    await h.jobs.drain(['audit.run']);
    let t = await h.api().get(`/api/v1/user/tasks/${task.body.data.id}`).set(auth).expect(200);
    expect(t.body.data.verifications[0]).toMatchObject({ status: 'SUCCEEDED', result: 'FAILED' });
    expect(t.body.data.status).toBe('OPEN');

    // Fix the page → verification passes, task done, old finding resolved.
    site.routes['/'] = { body: FIXED_PAGE };
    await h.api().post(`/api/v1/user/tasks/${task.body.data.id}/verify`).set(auth).expect(201);
    await h.jobs.drain(['audit.run']);
    t = await h.api().get(`/api/v1/user/tasks/${task.body.data.id}`).set(auth).expect(200);
    expect(t.body.data.verifications[0]).toMatchObject({ result: 'PASSED' });
    expect(t.body.data.status).toBe('DONE');

    const after = await h.api().get(`/api/v1/user/projects/${projectId}/recommendations`).set(auth).expect(200);
    expect(after.body.data.summary.verified).toBe(1);
    expect(after.body.data.items.map((i: { ruleKey: string }) => i.ruleKey)).not.toContain('seo.title_missing');

    // Ignoring a finding keeps it ignored on the next run.
    const thin = after.body.data.items.find((i: { ruleKey: string }) => i.ruleKey === 'content.thin');
    await h.api().patch(`/api/v1/user/findings/${thin.id}`).set(auth).send({ status: 'IGNORED' }).expect(200);
    const rerun = await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(auth).send({ url: `${site.origin}/` }).expect(201);
    await h.jobs.drain(['audit.run']);
    const rerunDone = await h.api().get(`/api/v1/user/audits/${rerun.body.data.id}`).set(auth).expect(200);
    expect(rerunDone.body.data.pages[0].findings.find((f: { ruleKey: string }) => f.ruleKey === 'content.thin').status).toBe('IGNORED');

    // In-app notifications were created for the requester.
    const notes = await h.api().get('/api/v1/user/notifications').set(auth).expect(200);
    expect(notes.body.data.some((n: { eventKey: string }) => n.eventKey === 'audit.completed')).toBe(true);
  });

  it('crawls a site within scope and respects robots.txt', async () => {
    const { user, projectId } = await h.onboard('crawler', {});
    const auth = { authorization: user.bearer };
    site.routes['/'] = { body: `<html><head><title>Home</title></head><body><a href="/about">About</a><a href="/private">P</a><a href="/about">About</a></body></html>` };
    const run = await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(auth).send({ url: `${site.origin}/`, scope: 'SITE', maxPages: 10 }).expect(201);
    await h.jobs.drain(['audit.run']);
    const done = await h.api().get(`/api/v1/user/audits/${run.body.data.id}`).set(auth).expect(200);
    const urls = done.body.data.pages.map((p: { url: string }) => p.url).sort();
    expect(urls).toEqual([`${site.origin}/`, `${site.origin}/about`]);
  });

  it('enforces tenancy, project domains and SSRF rules', async () => {
    const owner = await h.onboard('owner', {});
    const other = await h.onboard('intruder', {});
    await h.api().post(`/api/v1/user/projects/${owner.projectId}/audits`).set({ authorization: other.user.bearer }).send({ url: `${site.origin}/` }).expect(403);

    await h.api().post(`/api/v1/user/projects/${owner.projectId}/audits`).set({ authorization: owner.user.bearer }).send({ url: `${site.origin}/` }).expect(201);
    const outside = await h.api().post(`/api/v1/user/projects/${owner.projectId}/audits`).set({ authorization: owner.user.bearer }).send({ url: 'https://example.org/' }).expect(400);
    expect(outside.body.error.code).toBe('URL_OUTSIDE_PROJECT');
    const bad = await h.api().post(`/api/v1/user/projects/${owner.projectId}/audits`).set({ authorization: owner.user.bearer }).send({ url: 'file:///etc/passwd' }).expect(400);
    expect(bad.body.error.code).toBe('INVALID_URL');
    await h.jobs.drain(['audit.run']);
  });

  it('charges credits when a cost is configured and refunds failed audits', async () => {
    const { user, projectId, workspaceId } = await h.onboard('payer', {});
    const auth = { authorization: user.bearer };
    await h.prisma.systemSetting.upsert({ where: { key: 'credits.costs' }, create: { key: 'credits.costs', valueJson: { 'seo.audit_run': 5 } }, update: { valueJson: { 'seo.audit_run': 5 } } });
    try {
      const denied = await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(auth).send({ url: `${site.origin}/` }).expect(402);
      expect(denied.body.error.code).toBe('INSUFFICIENT_CREDITS');

      const wallet = await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } });
      await h.prisma.creditLedger.create({ data: { walletId: wallet.id, delta: 12, reason: 'PROMOTIONAL', idempotencyKey: `test-grant-${wallet.id}` } });
      await h.prisma.creditWallet.update({ where: { id: wallet.id }, data: { balanceCache: 12 } });

      await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(auth).send({ url: `${site.origin}/` }).expect(201);
      expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(7);

      // A page that cannot be fetched fails the run and refunds.
      const failing = await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(auth).send({ url: `${site.origin.replace(/:\d+$/, ':1')}/` }).expect(201);
      expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(2);
      await h.jobs.drain(['audit.run']);
      const failed = await h.api().get(`/api/v1/user/audits/${failing.body.data.id}`).set(auth).expect(200);
      expect(failed.body.data.status).toBe('FAILED');
      expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } })).balanceCache)).toBe(7);
      const sum = await h.prisma.creditLedger.aggregate({ where: { walletId: wallet.id }, _sum: { delta: true } });
      expect(Number(sum._sum.delta)).toBe(7);
    } finally {
      await h.prisma.systemSetting.delete({ where: { key: 'credits.costs' } });
    }
  });
});
