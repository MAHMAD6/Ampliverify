import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

const TEXT = '# Privacy Policy\n\nWe collect only the data needed to run AmpliVerify. This is test text for the legal CMS.';

describe('Legal pages (CMS revisions)', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let admin: { authorization: string };
  let user: { authorization: string };

  beforeAll(async () => {
    h = await startApp();
    const a = await h.provision('legal-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
    user = { authorization: (await h.provision('legal-user')).bearer };
  });
  afterAll(async () => {
    await h?.prisma.systemSetting.deleteMany({ where: { key: { startsWith: 'legal.page.' } } });
    await h?.close();
  });

  it('shows the built-in text until a version is published', async () => {
    expect((await h.api().get('/api/v1/public/legal/privacy').expect(200)).body.data).toBeNull();
    await h.api().get('/api/v1/public/legal/unknown').expect(404);
    await h.api().get('/api/v1/admin/legal').expect(401);
    await h.api().get('/api/v1/admin/legal').set(user).expect(403);
    await h.api().put('/api/v1/admin/legal/privacy').set(user).send({ body: TEXT, publish: true }).expect(403);
    const list = (await h.api().get('/api/v1/admin/legal').set(admin).expect(200)).body.data;
    expect(list.map((d: { key: string }) => d.key)).toEqual(['privacy', 'terms', 'cookies', 'dpa', 'refund', 'seller', 'regional']);
  });

  it('keeps drafts private and numbers each published version', async () => {
    await h.api().put('/api/v1/admin/legal/privacy').set(admin).send({ body: 'too short' }).expect(400);
    const draft = (await h.api().put('/api/v1/admin/legal/privacy').set(admin).send({ body: TEXT }).expect(200)).body.data;
    expect(draft.draft.body).toBe(TEXT);
    expect((await h.api().get('/api/v1/public/legal/privacy').expect(200)).body.data).toBeNull();

    await h.api().put('/api/v1/admin/legal/privacy').set(admin).send({ body: TEXT, summary: 'First version', publish: true }).expect(200);
    await h.api().put('/api/v1/admin/legal/privacy').set(admin).send({ body: `${TEXT}\n\nRetention: 30 days.`, summary: 'Retention', publish: true }).expect(200);
    const pub = (await h.api().get('/api/v1/public/legal/privacy').expect(200)).body.data;
    expect(pub).toMatchObject({ version: 2 });
    expect(pub.body).toContain('Retention: 30 days.');

    const doc = (await h.api().get('/api/v1/admin/legal').set(admin).expect(200)).body.data.find((d: { key: string }) => d.key === 'privacy');
    expect(doc.draft).toBeNull();
    expect(doc.history.map((r: { version: number; summary: string }) => [r.version, r.summary])).toEqual([
      [2, 'Retention'],
      [1, 'First version'],
    ]);
    expect(await h.prisma.auditLog.count({ where: { eventType: 'legal.publish' } })).toBeGreaterThanOrEqual(2);
  });
});
