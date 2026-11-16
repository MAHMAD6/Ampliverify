import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ScopeType } from '@prisma/client';
import { startApp, startSite } from './app-harness';
import { addWorkspaceMember } from './helpers';

const ORIGIN = 'https://app.studio.test';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 4, 0, 0, 0, 3]), Buffer.alloc(40)]);

describe('SEO Editor Studio (V13 NestJS routes)', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let owner: Awaited<ReturnType<typeof h.onboard>>;
  let ownerAuth: { authorization: string };
  let memberAuth: { authorization: string };
  let outsiderAuth: { authorization: string };
  let base: string;

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40), PUBLIC_FORM_ORIGIN: ORIGIN, EDITOR_MEDIA_SCAN: 'off', STORAGE_DIR: mkdtempSync(join(tmpdir(), 'av-studio-')) });
    owner = await h.onboard('studio-owner');
    ownerAuth = { authorization: owner.user.bearer };
    base = `/api/v1/workspaces/${owner.workspaceId}`;
    const member = await h.provision('studio-member');
    await addWorkspaceMember(h.prisma, member.id, owner.workspaceId, owner.organizationId);
    const role = await h.prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });
    await h.prisma.roleAssignment.create({ data: { userId: member.id, roleId: role.id, scopeType: ScopeType.WORKSPACE, workspaceId: owner.workspaceId, createdBy: owner.user.id } });
    memberAuth = { authorization: member.bearer };
    outsiderAuth = { authorization: (await h.onboard('studio-outsider')).user.bearer };
  });
  afterAll(async () => {
    await h?.close();
  });

  it('saves drafts with revision compare-and-swap and restores revisions', async () => {
    const key = 'article-0001';
    await h.api().get(`${base}/articles/${key}`).set(ownerAuth).expect(404);
    const first = await h.api().put(`${base}/articles/${key}`).set(ownerAuth).send({ title: 'Guide', html: '<h1>Guide</h1><p>First</p><script>x</script>', description: 'd', keyword: 'k', expected_revision: 0 }).expect(200);
    expect(first.body.data).toEqual({ article_key: key, revision: 1 });
    // A second writer with a stale revision never overwrites silently.
    await h.api().put(`${base}/articles/${key}`).set(ownerAuth).send({ html: '<p>Stale</p>', expected_revision: 0 }).expect(409);
    await h.api().put(`${base}/articles/${key}`).set(ownerAuth).send({ title: 'Guide', html: '<h1>Guide</h1><p>Second</p><div class="av-form-block" data-form-schema="x" data-form-status="draft"></div>', expected_revision: 1 }).expect(200);
    const draft = (await h.api().get(`${base}/articles/${key}`).set(memberAuth).expect(200)).body.data;
    expect(draft).toMatchObject({ revision: 2, metadata: { description: '', keyword: '' } });
    expect(draft.html).toContain('data-form-schema="x"');
    expect(draft.html).not.toContain('<script');

    // Viewers read but cannot write; other workspaces see nothing.
    await h.api().put(`${base}/articles/${key}`).set(memberAuth).send({ html: '<p>x</p>', expected_revision: 2 }).expect(403);
    await h.api().get(`${base}/articles/${key}`).set(outsiderAuth).expect(403);

    const revisions = (await h.api().get(`${base}/articles/${key}/revisions`).set(ownerAuth).expect(200)).body.data;
    expect(revisions.map((r: { revision: number }) => r.revision)).toEqual([2, 1]);
    const restored = (await h.api().post(`${base}/articles/${key}/revisions/1/restore`).set(ownerAuth).send({ expected_revision: 2 }).expect(201)).body.data;
    expect(restored.revision).toBe(3);
    expect((await h.api().get(`${base}/articles/${key}`).set(ownerAuth).expect(200)).body.data.html).toContain('First');
    expect((await h.api().get(`${base}/articles`).set(ownerAuth).expect(200)).body.data[0]).toMatchObject({ article_key: key, revision: 3 });
  });

  it('stores encrypted connections and publishes idempotently to a Custom API destination', async () => {
    const site = await startSite({ '/publish': { body: JSON.stringify({ id: 'ext-1', status: 'draft', url: 'https://example.test/post' }), type: 'application/json' } });

    await h.api().post(`${base}/connections`).set(memberAuth).send({ provider: 'custom', name: 'Hook', config: { endpoint: `${site.origin}/publish`, token: 'secret-token' } }).expect(403);
    await h.api().post(`${base}/connections`).set(ownerAuth).send({ provider: 'myspace', name: 'X', config: {} }).expect(400);
    const conn = (await h.api().post(`${base}/connections`).set(ownerAuth).send({ provider: 'custom', name: 'Hook', config: { endpoint: `${site.origin}/publish`, token: 'secret-token' } }).expect(201)).body.data;
    const stored = await h.prisma.editorCmsConnection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(stored.credentialCiphertext).not.toContain('secret-token');
    const listed = (await h.api().get(`${base}/connections`).set(memberAuth).expect(200)).body.data;
    expect(JSON.stringify(listed)).not.toContain('secret-token');

    const article = { article_key: 'article-0002', title: 'Post', html: '<h1>Post</h1><p>Body</p>', description: 'Desc', status: 'draft' };
    // Offline forms and local media block publication.
    await h.api().post(`${base}/connections/${conn.id}/publish`).set(ownerAuth).send({ ...article, html: `${article.html}<div class="av-form-block" data-form-status="draft"></div>` }).expect(400);
    await h.api().post(`${base}/connections/${conn.id}/publish`).set(ownerAuth).send({ ...article, html: `${article.html}<figure class="media-block" data-av-local-id="avmedia-1"></figure>` }).expect(400);
    // Live publishing needs the publisher permission.
    await h.api().post(`${base}/connections/${conn.id}/publish`).set(memberAuth).send({ ...article, status: 'publish' }).expect(403);

    const res = (await h.api().post(`${base}/connections/${conn.id}/publish`).set(ownerAuth).send(article).expect(200)).body.data;
    expect(res).toMatchObject({ id: 'ext-1', state: 'draft', provider: 'custom' });
    const pub = await h.prisma.editorCmsPublication.findFirstOrThrow({ where: { connectionId: conn.id } });
    expect(pub).toMatchObject({ externalId: 'ext-1', state: 'draft' });

    // An uncertain outcome (server error) requires reconciliation before retrying.
    site.routes['/publish'] = { status: 503, body: '{}', type: 'application/json' };
    await h.api().post(`${base}/connections/${conn.id}/publish`).set(ownerAuth).send(article).expect(409);
    site.routes['/publish'] = { body: JSON.stringify({ id: 'ext-1', status: 'published' }), type: 'application/json' };
    const blocked = await h.api().post(`${base}/connections/${conn.id}/publish`).set(ownerAuth).send(article).expect(409);
    expect(blocked.body.error.code).toBe('PUBLICATION_NEEDS_RECONCILIATION');
    await h.api().post(`${base}/connections/${conn.id}/publications/article-0002/reconcile`).set(ownerAuth).send({}).expect(200);
    await h.api().post(`${base}/connections/${conn.id}/publish`).set(ownerAuth).send({ ...article, status: 'publish' }).expect(200);

    await h.api().delete(`${base}/connections/${conn.id}`).set(ownerAuth).expect(200);
    await site.close();
    expect(await h.prisma.auditLog.count({ where: { workspaceId: owner.workspaceId, eventType: { startsWith: 'editor.publication.' } } })).toBeGreaterThanOrEqual(3);
  });

  it('activates versioned hosted forms and stores encrypted submissions', async () => {
    const schema = { name: 'Contact us', submit_label: 'Send', success_message: 'Thanks!', consent_required: true, fields: [{ key: 'email', label: 'Email', kind: 'email', required: true }, { key: 'topic', label: 'Topic', kind: 'select', options: ['Sales', 'Support'] }], style: { width: 70, height: 420, button: '#123456' } };
    await h.api().post(`${base}/forms`).set(ownerAuth).send({ ...schema, style: { height: 90 } }).expect(400);
    const form = (await h.api().post(`${base}/forms`).set(ownerAuth).send(schema).expect(201)).body.data;
    expect(form).toMatchObject({ version: 1, public_path: `/forms/public/${form.id}`, public_url: `${ORIGIN}/forms/public/${form.id}` });
    const v2 = (await h.api().post(`${base}/forms`).set(ownerAuth).send({ ...schema, previous_form_id: form.id }).expect(201)).body.data;
    expect(v2).toMatchObject({ version: 2, previous_form_id: form.id });

    const page = await h.api().get(`/api/v1/forms/public/${form.id}`).expect(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.headers['content-security-policy']).toContain('frame-ancestors');
    expect(page.text).toContain('width:70%');
    expect((await h.api().get(`/api/v1/forms/public/${form.id}/schema`).expect(200)).body.data.fields).toHaveLength(2);

    await h.api().post(`/api/v1/forms/public/${form.id}/submit`).send({ values: { email: 'a@example.test' } }).expect(400);
    await h.api().post(`/api/v1/forms/public/${form.id}/submit`).send({ values: { email: 'nope' }, consent: true }).expect(400);
    await h.api().post(`/api/v1/forms/public/${form.id}/submit`).send({ values: { email: 'a@example.test', topic: 'Other' }, consent: true }).expect(400);
    const ok = await h.api().post(`/api/v1/forms/public/${form.id}/submit`).send({ values: { email: 'a@example.test', topic: 'Sales' }, consent: true }).expect(200);
    expect(ok.body.data).toEqual({ success: true, message: 'Thanks!' });
    const row = await h.prisma.hostedFormSubmission.findFirstOrThrow({ where: { formId: form.id } });
    expect(row.encryptedPayload).not.toContain('a@example.test');

    await h.api().get(`${base}/forms/${form.id}/submissions`).set(memberAuth).expect(403);
    const subs = (await h.api().get(`${base}/forms/${form.id}/submissions`).set(ownerAuth).expect(200)).body.data;
    expect(subs[0].values).toEqual({ email: 'a@example.test', topic: 'Sales' });

    // Active forms become embeds when publishing/exporting; deactivated ones disappear publicly.
    const embedHtml = `<h1>T</h1><div class="av-form-block" data-form-status="active" data-form-url="${ORIGIN}/forms/public/${form.id}"></div>`;
    const exported = await h.api().post(`${base}/exports`).set(ownerAuth).send({ title: 'T', html: embedHtml, format: 'html' }).expect(200);
    expect(exported.text).toContain(`<iframe src="${ORIGIN}/forms/public/${form.id}"`);
    await h.api().delete(`${base}/forms/${form.id}`).set(ownerAuth).expect(200);
    await h.api().get(`/api/v1/forms/public/${form.id}`).expect(404);
  });

  it('moves media through quarantine and processing to approval, then resolves and exports it', async () => {
    await h.api().post(`${base}/media/init`).set(ownerAuth).send({ filename: 'x.exe', content_type: 'application/octet-stream', size: 10 }).expect(400);
    await h.api().post(`${base}/media/init`).set(memberAuth).send({ filename: 'a.png', content_type: 'image/png', size: PNG.length }).expect(403);
    const init = (await h.api().post(`${base}/media/init`).set(ownerAuth).send({ filename: 'chart.png', content_type: 'image/png', size: PNG.length }).expect(201)).body.data;
    expect(init.upload_url).toBe(`${ORIGIN}/api/editor-uploads/${init.upload_id}`);

    // The signed upload target rejects tampered signatures and size mismatches.
    await h.api().post(`/api/v1/studio/uploads/${init.upload_id}`).field('expires', init.fields.expires).field('signature', 'bad').attach('file', PNG, 'chart.png').expect(403);
    await h.api().post(`/api/v1/studio/uploads/${init.upload_id}`).field('expires', init.fields.expires).field('signature', init.fields.signature).attach('file', PNG.subarray(0, 20), 'chart.png').expect(400);
    await h.api().post(`/api/v1/studio/uploads/${init.upload_id}`).field('expires', init.fields.expires).field('signature', init.fields.signature).attach('file', PNG, 'chart.png').expect(200);
    await h.api().post(`/api/v1/studio/uploads/${init.upload_id}`).field('expires', init.fields.expires).field('signature', init.fields.signature).attach('file', PNG, 'chart.png').expect(409);

    const done = (await h.api().post(`${base}/media/complete`).set(ownerAuth).send({ upload_id: init.upload_id, content_type: 'image/png', size: PNG.length }).expect(200)).body.data;
    expect(done).toMatchObject({ status: 'quarantine', url: null });
    await h.api().get(`/api/v1/studio/media/${init.upload_id}.png`).expect(404);
    await h.api().post(`${base}/media/${init.upload_id}/resolve`).set(ownerAuth).send({ article_key: 'article-0003', local_ref: 'avmedia-1' }).expect(409);

    await h.jobs.drain(['editor.media.process']);
    const status = (await h.api().get(`${base}/media/${init.upload_id}/status`).set(memberAuth).expect(200)).body.data;
    expect(status).toMatchObject({ status: 'approved', width: 4, height: 3, url: `${ORIGIN}/media/e/${init.upload_id}.png` });
    await h.api().get(`/api/v1/workspaces/${owner.workspaceId}/media/${init.upload_id}/status`).set(outsiderAuth).expect(403);

    const served = await h.api().get(`/api/v1/studio/media/${init.upload_id}.png`).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(served.body as Buffer, PNG)).toBe(0);
    await h.api().get(`/api/v1/studio/media/${init.upload_id}.png`).set('range', 'bytes=0-7').expect(206);

    await h.api().post(`${base}/media/${init.upload_id}/resolve`).set(ownerAuth).send({ article_key: 'article-0003', local_ref: 'avmedia-1' }).expect(200);
    expect(await h.prisma.articleAssetReference.count({ where: { mediaId: init.upload_id } })).toBe(1);

    // Content that does not match its declared type is rejected.
    const fake = Buffer.from('not really a png at all, just text bytes');
    const bad = (await h.api().post(`${base}/media/init`).set(ownerAuth).send({ filename: 'fake.png', content_type: 'image/png', size: fake.length }).expect(201)).body.data;
    await h.api().post(`/api/v1/studio/uploads/${bad.upload_id}`).field('expires', bad.fields.expires).field('signature', bad.fields.signature).attach('file', fake, 'fake.png').expect(200);
    await h.api().post(`${base}/media/complete`).set(ownerAuth).send({ upload_id: bad.upload_id, content_type: 'image/png', size: fake.length }).expect(200);
    await h.jobs.drain(['editor.media.process']);
    expect((await h.api().get(`${base}/media/${bad.upload_id}/status`).set(ownerAuth).expect(200)).body.data).toMatchObject({ status: 'rejected', error: { code: 'TYPE_MISMATCH' } });

    // ZIP export packages approved workspace media and rewrites its path.
    const zip = await h.api().post(`${base}/exports`).set(ownerAuth).send({ title: 'Media', html: `<h1>Media</h1><figure><img src="${status.url}" alt="Chart"></figure>`, format: 'zip', include_media: true }).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(zip.headers['content-type']).toBe('application/zip');
    expect((zip.body as Buffer).includes(Buffer.from('media/001-chart.png'))).toBe(true);
    // Local (browser-only) media is never exported.
    await h.api().post(`${base}/exports`).set(ownerAuth).send({ title: 'T', html: '<figure class="media-block" data-av-local-id="avmedia-2"><img src="blob:x"></figure>', format: 'docx' }).expect(400);
  });

  it('lists the eight providers publicly', async () => {
    const res = await h.api().get('/api/v1/studio/providers').expect(200);
    expect(res.body.data.providers).toEqual(['wordpress', 'shopify', 'webflow', 'ghost', 'drupal', 'joomla', 'strapi', 'custom']);
  });
});
