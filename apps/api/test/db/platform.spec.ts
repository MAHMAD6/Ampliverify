import { createHmac } from 'crypto';
import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { grantGlobal } from './helpers';
import { startApp, startSite } from './app-harness';

const WEBHOOK_SECRET = 'whsec_test_secret';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

function signed(payload: object) {
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  return { body, header: `t=${t},v1=${sig}` };
}

describe('Platform modules', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let site: Awaited<ReturnType<typeof startSite>>;

  beforeAll(async () => {
    h = await startApp({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40) });
    site = await startSite({
      '/': { body: '<html lang="en"><head><title>Example home page for testing reports</title></head><body><h1>Home</h1><p>Hello</p></body></html>' },
      '/robots.txt': { body: 'User-agent: *\nAllow: /\n', type: 'text/plain' },
    });
  });

  afterAll(async () => {
    await site?.close();
    await h?.close();
  });

  const as = (bearer: string) => ({ authorization: bearer });

  it('invites a member, enforces the last owner and changes roles', async () => {
    const owner = await h.onboard('ws-owner');
    const invitee = await h.provision('ws-invitee');
    const inviteeEmail = (await h.prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).email;

    const invite = await h.api().post(`/api/v1/user/workspaces/${owner.workspaceId}/invitations`).set(as(owner.user.bearer)).send({ email: inviteeEmail, roleKey: 'MEMBER' }).expect(201);
    const token = new URL(invite.body.data.acceptUrl).searchParams.get('token')!;
    const preview = await h.api().get(`/api/v1/public/invitations/${token}`).expect(200);
    expect(preview.body.data.roleKey).toBe('MEMBER');

    const stranger = await h.provision('ws-stranger');
    expect((await h.api().post('/api/v1/user/invitations/accept').set(as(stranger.bearer)).send({ token }).expect(403)).body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
    await h.api().post('/api/v1/user/invitations/accept').set(as(invitee.bearer)).send({ token }).expect(201);
    await h.api().post('/api/v1/user/invitations/accept').set(as(invitee.bearer)).send({ token }).expect(404);

    const members = await h.api().get(`/api/v1/user/workspaces/${owner.workspaceId}/members`).set(as(owner.user.bearer)).expect(200);
    expect(members.body.data.map((m: { role: string }) => m.role).sort()).toEqual(['MEMBER', 'OWNER']);
    // Members can read but not manage.
    await h.api().post(`/api/v1/user/workspaces/${owner.workspaceId}/invitations`).set(as(invitee.bearer)).send({ email: 'x@example.test', roleKey: 'MEMBER' }).expect(403);
    // The last owner cannot leave or be demoted.
    expect((await h.api().delete(`/api/v1/user/workspaces/${owner.workspaceId}/members/${owner.user.id}`).set(as(owner.user.bearer)).expect(409)).body.error.code).toBe('LAST_OWNER');
    await h.api().put(`/api/v1/user/workspaces/${owner.workspaceId}/members/${invitee.id}/role`).set(as(owner.user.bearer)).send({ roleKey: 'OWNER' }).expect(200);
    await h.api().put(`/api/v1/user/workspaces/${owner.workspaceId}/members/${owner.user.id}/role`).set(as(owner.user.bearer)).send({ roleKey: 'MEMBER' }).expect(200);

    const ws = await h.api().patch(`/api/v1/user/workspaces/${owner.workspaceId}`).set(as(invitee.bearer)).send({ timezone: 'Europe/Berlin', language: 'de', settings: { aiGeo: { brandName: 'Acme' } } }).expect(200);
    expect(ws.body.data).toMatchObject({ timezone: 'Europe/Berlin', language: 'de', settings: { aiGeo: { brandName: 'Acme' } } });
    await h.api().patch(`/api/v1/user/workspaces/${owner.workspaceId}`).set(as(invitee.bearer)).send({ timezone: 'Mars/Base' }).expect(400);
  });

  it('applies verified Stripe webhooks idempotently', async () => {
    const { workspaceId } = await h.onboard('payer');
    const bad = await h.api().post('/api/v1/webhooks/stripe').set('stripe-signature', 't=1,v1=00').set('content-type', 'application/json').send('{}').expect(401);
    expect(bad.body.error.code).toBe('INVALID_SIGNATURE');

    const event = { id: `evt_${workspaceId}`, type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: `pi_${workspaceId}`, amount_total: 1900, currency: 'usd', metadata: { workspaceId, kind: 'credits', credits: '500', packCode: 'p500' } } } };
    for (let i = 0; i < 2; i++) {
      const { body, header } = signed(event);
      await h.api().post('/api/v1/webhooks/stripe').set('stripe-signature', header).set('content-type', 'application/json').send(body).expect(200);
    }
    await h.jobs.drain(['billing.webhook']);
    const wallet = await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } });
    expect(Number(wallet.balanceCache)).toBe(500);
    expect(await h.prisma.creditPurchase.count({ where: { workspaceId } })).toBe(1);
  });

  it('lets admins manage plans, entitlements and two-person credit adjustments', async () => {
    const admin = await h.provision('admin-a');
    const admin2 = await h.provision('admin-b');
    await grantGlobal(h.prisma, admin.id, 'SUPER_ADMIN');
    await grantGlobal(h.prisma, admin2.id, 'SUPER_ADMIN');
    const tenant = await h.onboard('tenant', {});

    const code = `starter-${Date.now()}`;
    await h.api().post('/api/v1/admin/plans').set(as(admin.bearer)).send({ code, name: 'Starter', status: 'ACTIVE', isPublic: true }).expect(201);
    await h.api().post(`/api/v1/admin/plans/${code}/prices`).set(as(admin.bearer)).send({ billingInterval: 'MONTHLY', currency: 'USD', amountMinor: 2900 }).expect(201);
    await h.api().put(`/api/v1/admin/plans/${code}/entitlements`).set(as(admin.bearer)).send({ entitlements: [{ featureKey: 'seo.on_page_audit', enabled: false }] }).expect(200);

    // Default plan for workspaces without a subscription → audits become plan-restricted.
    await h.api().put('/api/v1/admin/settings/billing.default_plan_code').set(as(admin.bearer)).send({ value: code }).expect(200);
    try {
      const r = await h.api().post(`/api/v1/user/projects/${tenant.projectId}/audits`).set(as(tenant.user.bearer)).send({ url: `${site.origin}/` }).expect(403);
      expect(r.body.error.code).toBe('PLAN_RESTRICTED');
      const billing = await h.api().get(`/api/v1/user/workspaces/${tenant.workspaceId}/billing`).set(as(tenant.user.bearer)).expect(200);
      expect(billing.body.data.plan.code).toBe(code);
    } finally {
      await h.api().put('/api/v1/admin/settings/billing.default_plan_code').set(as(admin.bearer)).send({ value: null }).expect(200);
    }

    const adj = await h.api().post('/api/v1/admin/credit-adjustments').set(as(admin.bearer)).send({ workspaceId: tenant.workspaceId, type: 'CREDIT', amount: 50, reasonCode: 'GOODWILL', internalNote: 'Test credit' }).expect(201);
    expect((await h.api().post(`/api/v1/admin/credit-adjustments/${adj.body.data.id}/review`).set(as(admin.bearer)).send({ approve: true }).expect(403)).body.error.code).toBe('SELF_APPROVAL_NOT_ALLOWED');
    const applied = await h.api().post(`/api/v1/admin/credit-adjustments/${adj.body.data.id}/review`).set(as(admin2.bearer)).send({ approve: true }).expect(201);
    expect(applied.body.data.status).toBe('APPLIED');
    expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: tenant.workspaceId } })).balanceCache)).toBe(50);
    const reversal = await h.api().post(`/api/v1/admin/credit-adjustments/${adj.body.data.id}/reverse`).set(as(admin.bearer)).send({ note: 'Undo test' }).expect(201);
    await h.api().post(`/api/v1/admin/credit-adjustments/${reversal.body.data.id}/review`).set(as(admin2.bearer)).send({ approve: true }).expect(201);
    expect((await h.prisma.creditAdjustment.findUniqueOrThrow({ where: { id: adj.body.data.id } })).status).toBe('REVERSED');
    expect(Number((await h.prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: tenant.workspaceId } })).balanceCache)).toBe(0);

    await h.api().put('/api/v1/admin/module-controls/geo').set(as(admin.bearer)).send({ enabled: false, reason: 'test' }).expect(200);
    try {
      const r = await h.api().post(`/api/v1/user/projects/${tenant.projectId}/geo/prompts`).set(as(tenant.user.bearer)).send({ prompt: 'best seo tool' }).expect(403);
      expect(r.body.error.code).toBe('MODULE_DISABLED');
    } finally {
      await h.api().put('/api/v1/admin/module-controls/geo').set(as(admin.bearer)).send({ enabled: true }).expect(200);
    }
    const health = await h.api().get('/api/v1/admin/health').set(as(admin.bearer)).expect(200);
    expect(health.body.data.database.status).toBe('UP');
  });

  it('generates reports and serves share links', async () => {
    const { user, projectId } = await h.onboard('reporter', {});
    await h.api().post(`/api/v1/user/projects/${projectId}/audits`).set(as(user.bearer)).send({ url: `${site.origin}/` }).expect(201);
    await h.jobs.drain(['audit.run']);
    const report = await h.api().post(`/api/v1/user/projects/${projectId}/reports`).set(as(user.bearer)).send({ type: 'EXECUTIVE_SUMMARY' }).expect(201);
    await h.jobs.drain(['report.generate']);
    const done = await h.api().get(`/api/v1/user/reports/${report.body.data.id}`).set(as(user.bearer)).expect(200);
    expect(done.body.data.status).toBe('SUCCEEDED');
    expect(done.body.data.files.map((f: { format: string }) => f.format).sort()).toEqual(['csv', 'html', 'pdf']);
    expect(done.body.data.sections.map((s: { sectionKey: string }) => s.sectionKey)).toEqual(['overview', 'audit', 'geo', 'tasks', 'content']);
    const pdf = await h.api().get(`/api/v1/user/reports/${report.body.data.id}/download/pdf`).set(as(user.bearer)).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    const share = await h.api().post(`/api/v1/user/reports/${report.body.data.id}/shares`).set(as(user.bearer)).expect(201);
    const token = share.body.data.url.split('/r/')[1];
    const pub = await h.api().get(`/api/v1/public/reports/${token}`).expect(200);
    expect(pub.body.data.sections.length).toBe(5);
    await h.api().post(`/api/v1/user/report-shares/${share.body.data.id}/revoke`).set(as(user.bearer)).expect(201);
    await h.api().get(`/api/v1/public/reports/${token}`).expect(404);
  });

  it('publishes CMS content and accepts job applications with scanned files', async () => {
    const admin = await h.provision('cms-admin');
    await grantGlobal(h.prisma, admin.id, 'SUPER_ADMIN');
    const slug = `post-${Date.now()}`;
    const post = await h.api().post('/api/v1/admin/content/blog').set(as(admin.bearer)).send({ title: 'Hello world', slug, body: '# Hi', tags: ['seo'] }).expect(201);
    await h.api().get(`/api/v1/public/blog/${slug}`).expect(404);
    await h.api().patch(`/api/v1/admin/content/blog/${post.body.data.id}`).set(as(admin.bearer)).send({ status: 'PUBLISHED' }).expect(200);
    expect((await h.api().get(`/api/v1/public/blog/${slug}`).expect(200)).body.data.body).toBe('# Hi');
    await h.api().delete(`/api/v1/admin/content/blog/${post.body.data.id}`).set(as(admin.bearer)).expect(409);

    const media = await h.api().post('/api/v1/admin/media').set(as(admin.bearer)).attach('file', PNG, 'pixel.png').field('altText', 'Pixel').expect(201);
    expect(media.body.data.mimeType).toBe('image/png');
    await h.api().post('/api/v1/admin/media').set(as(admin.bearer)).attach('file', Buffer.from('<svg/>'), 'x.png').expect(400);
    await h.api().get(`/api/v1/public/media/${media.body.data.id}`).expect(200).expect('content-type', /image\/png/);

    const job = await h.api().post('/api/v1/admin/jobs').set(as(admin.bearer)).send({ title: 'SEO Engineer', employmentType: 'FULL_TIME', description: 'Join us', status: 'PUBLISHED', requireResume: true }).expect(201);
    const jobSlug = job.body.data.slug;
    await h.api().post(`/api/v1/public/careers/${jobSlug}/apply`).field('firstName', 'Ada').field('lastName', 'L').field('email', 'ada@example.test').expect(400);
    await h.api().post(`/api/v1/public/careers/${jobSlug}/apply`).field('firstName', 'Ada').field('lastName', 'L').field('email', 'ada@example.test').attach('resume', Buffer.from('MZ fake exe'), 'cv.pdf').expect(400);
    const applied = await h.api().post(`/api/v1/public/careers/${jobSlug}/apply`).field('firstName', 'Ada').field('lastName', 'L').field('email', 'ada@example.test').field('linkedinUrl', 'https://www.linkedin.com/in/ada').attach('resume', PDF, 'cv.pdf').expect(201);
    const receipt = applied.body.data.receipt;
    await h.api().get(`/api/v1/public/careers/${jobSlug}/applications/${receipt}`).expect(200);
    await h.api().post(`/api/v1/public/careers/${jobSlug}/apply`).field('firstName', 'Ada').field('lastName', 'L').field('email', 'ada@example.test').attach('resume', PDF, 'cv.pdf').expect(409);

    await h.jobs.drain(['careers.scan']);
    const app = await h.api().get(`/api/v1/admin/applications/${receipt}`).set(as(admin.bearer)).expect(200);
    expect(app.body.data.files[0].malwareScanStatus).toBe('PENDING');
    expect((await h.api().get(`/api/v1/admin/applicant-files/${app.body.data.files[0].id}`).set(as(admin.bearer)).expect(403)).body.error.code).toBe('FILE_NOT_SCANNED');
    await h.api().patch(`/api/v1/admin/applications/${receipt}`).set(as(admin.bearer)).send({ status: 'IN_REVIEW' }).expect(200);

    await h.api().post('/api/v1/public/contact').send({ name: 'Bob', email: 'bob@example.test', topic: 'SALES', message: 'Tell me more please' }).expect(201);
    const contacts = await h.api().get('/api/v1/admin/contact-submissions').set(as(admin.bearer)).expect(200);
    expect(contacts.body.data.some((c: { email: string; ipHash?: string }) => c.email === 'bob@example.test' && c.ipHash === undefined)).toBe(true);
  });

  it('runs the editor, content, keyword and GEO workflows without external providers', async () => {
    const { user, projectId, workspaceId } = await h.onboard('creator', {});
    const auth = as(user.bearer);

    const doc = await h.api().post(`/api/v1/user/projects/${projectId}/editor/documents`).set(auth).send({ title: 'Guide', content: { html: '<h1>Guide</h1><p>A short guide about running an SEO audit for small sites.</p>', title: 'Guide', metaDescription: '', focusKeyword: 'guide' } }).expect(201);
    expect(doc.body.data.analysis.keyword).toMatchObject({ inTitle: true, inH1: true });
    expect(doc.body.data.analysis.issues.map((i: { ruleKey: string }) => i.ruleKey)).toContain('content.thin');
    const saved = await h.api().put(`/api/v1/user/editor/documents/${doc.body.data.id}/content`).set(auth).send({ html: '<h1>Guide</h1><p>A longer guide about running an SEO audit for small business sites. <script>alert(1)</script></p>', title: 'Guide v2', metaDescription: 'desc' }).expect(200);
    expect(saved.body.data.versionNo).toBe(2);
    const latest = await h.api().get(`/api/v1/user/editor/documents/${doc.body.data.id}`).set(auth).expect(200);
    expect(latest.body.data.content.html).not.toContain('<script>');
    const ai = await h.api().post(`/api/v1/user/editor/documents/${doc.body.data.id}/suggestions`).set(auth).send({}).expect(503);
    expect(ai.body.error.code).toBe('AI_NOT_CONFIGURED');

    const idea = await h.api().post(`/api/v1/user/projects/${projectId}/content/ideas`).set(auth).send({ title: 'How to audit a site' }).expect(201);
    const brief = await h.api().post(`/api/v1/user/projects/${projectId}/content/briefs`).set(auth).send({ title: 'Audit guide', keyword: 'seo audit', ideaId: idea.body.data.id }).expect(201);
    const plan = await h.api().post(`/api/v1/user/projects/${projectId}/content/plans`).set(auth).send({ name: 'Q4' }).expect(201);
    await h.api().post(`/api/v1/user/content/plans/${plan.body.data.id}/items`).set(auth).send({ title: 'Publish guide', briefId: brief.body.data.id, targetDate: '2026-12-01' }).expect(201);
    const summary = await h.api().get(`/api/v1/user/projects/${projectId}/content/summary`).set(auth).expect(200);
    expect(summary.body.data).toMatchObject({ ideas: 1, briefs: 1, planned: 1 });

    const kw = await h.api().post(`/api/v1/user/projects/${projectId}/keywords/research`).set(auth).send({ tool: 'EXPLORER', query: 'seo audit' }).expect(503);
    expect(kw.body.error.code).toBe('KEYWORD_DATA_NOT_CONFIGURED');
    expect(await h.prisma.keywordQuery.count({ where: { projectId } })).toBe(0);
    const list = await h.api().post(`/api/v1/user/projects/${projectId}/keyword-lists`).set(auth).send({ name: 'Core' }).expect(201);
    await h.api().post(`/api/v1/user/keyword-lists/${list.body.data.id}/keywords`).set(auth).send({ keywords: ['seo audit tool', 'seo audit checklist', 'technical seo audit', 'content strategy template'] }).expect(201);
    const clusters = await h.api().post(`/api/v1/user/projects/${projectId}/keyword-clusters`).set(auth).send({ listId: list.body.data.id }).expect(201);
    expect(clusters.body.data[0].label).toBe('audit');
    await h.api().post(`/api/v1/user/projects/${projectId}/saved-keywords`).set(auth).send({ keywords: ['seo audit tool'] }).expect(201);

    const prompt = await h.api().post(`/api/v1/user/projects/${projectId}/geo/prompts`).set(auth).send({ prompt: 'What is the best SEO audit tool?', cadence: 'WEEKLY', tags: ['tools'] }).expect(201);
    await h.api().post(`/api/v1/user/projects/${projectId}/geo/prompts`).set(auth).send({ prompt: 'what is the best seo audit tool?' }).expect(409);
    const run = await h.api().post(`/api/v1/user/geo/prompts/${prompt.body.data.id}/run`).set(auth).send({}).expect(503);
    expect(run.body.error.code).toBe('GEO_PROVIDERS_NOT_CONFIGURED');
    await h.api().post(`/api/v1/user/projects/${projectId}/geo/competitors`).set(auth).send({ name: 'Rival', domain: 'rival.example' }).expect(201);
    const overview = await h.api().get(`/api/v1/user/projects/${projectId}/geo/overview`).set(auth).expect(200);
    expect(overview.body.data).toMatchObject({ prompts: 1, answers: 0, visibility: null, trend: [] });

    const settings = await h.api().put(`/api/v1/user/projects/${projectId}/settings`).set(auth).send({ auditFrequency: 'WEEKLY', crawlScope: 'SITE' }).expect(200);
    expect(settings.body.data.crawl).toMatchObject({ auditFrequency: 'WEEKLY', crawlScope: 'SITE' });
    const projectSummary = await h.api().get(`/api/v1/user/projects/${projectId}/summary`).set(auth).expect(200);
    expect(projectSummary.body.data.keywords).toMatchObject({ lists: 2, tracked: 5 });
    await h.api().post('/api/v1/user/support-tickets').set(auth).send({ workspaceId, subject: 'Help me', category: 'GENERAL', message: 'I need help with something' }).expect(201);
  });

  it('connects WordPress and publishes editor documents', async () => {
    const received: { path: string; body: string; auth?: string }[] = [];
    const wp: Server = createServer((req: IncomingMessage, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ path: req.url ?? '', body, auth: req.headers.authorization });
        res.setHeader('content-type', 'application/json');
        const ok = req.headers.authorization === `Basic ${Buffer.from('editor:abcd efgh ijkl'.replace(/ (?=efgh|ijkl)/g, '')).toString('base64')}` || req.headers.authorization === `Basic ${Buffer.from('editor:abcdefghijkl').toString('base64')}`;
        if (!ok) {
          res.statusCode = 401;
          return res.end('{}');
        }
        if (req.url?.startsWith('/wp-json/wp/v2/users/me')) return res.end(JSON.stringify({ id: 1, capabilities: { edit_posts: true } }));
        if (req.url?.startsWith('/wp-json/wp/v2/posts')) {
          res.statusCode = req.url === '/wp-json/wp/v2/posts' ? 201 : 200;
          return res.end(JSON.stringify({ id: 42, link: 'http://wp.test/?p=42', status: JSON.parse(body).status }));
        }
        res.statusCode = 404;
        res.end('{}');
      });
    });
    await new Promise<void>((r) => wp.listen(0, '127.0.0.1', r));
    const wpUrl = `http://127.0.0.1:${(wp.address() as AddressInfo).port}`;
    try {
      const { user, projectId, workspaceId } = await h.onboard('publisher', {});
      const auth = as(user.bearer);
      await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/wordpress`).set(auth).send({ siteUrl: wpUrl, username: 'editor', applicationPassword: 'wrong-password' }).expect(400);
      const conn = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/wordpress`).set(auth).send({ siteUrl: wpUrl, username: 'editor', applicationPassword: 'abcd efgh ijkl' }).expect(201);
      const token = await h.prisma.integrationToken.findFirstOrThrow({ where: { workspaceIntegrationId: conn.body.data.id } });
      expect(token.accessSecretRef).not.toContain('abcd');

      const doc = await h.api().post(`/api/v1/user/projects/${projectId}/editor/documents`).set(auth).send({ title: 'Post', content: { html: '<p>Hello</p>', title: 'Post title', metaDescription: 'Desc' } }).expect(201);
      const first = await h.api().post(`/api/v1/user/editor/documents/${doc.body.data.id}/publish`).set(auth).send({ integrationId: conn.body.data.id, status: 'draft' }).expect(201);
      expect(first.body.data.remoteId).toBe(42);
      await h.api().post(`/api/v1/user/editor/documents/${doc.body.data.id}/publish`).set(auth).send({ integrationId: conn.body.data.id, status: 'publish' }).expect(201);
      expect(received.filter((r) => r.path.startsWith('/wp-json/wp/v2/posts')).map((r) => r.path)).toEqual(['/wp-json/wp/v2/posts', '/wp-json/wp/v2/posts/42']);
      const list = await h.api().get(`/api/v1/user/workspaces/${workspaceId}/integrations`).set(auth).expect(200);
      expect(JSON.stringify(list.body.data)).not.toContain('abcd');
    } finally {
      await new Promise((r) => wp.close(r));
    }
  });
});
