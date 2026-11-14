import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

const BODY = '## Partner program\n\nJoin the AmpliVerify partner program.';

describe('Public pages CMS', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let admin: { authorization: string };
  let user: { authorization: string };

  beforeAll(async () => {
    h = await startApp();
    const a = await h.provision('pages-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
    user = { authorization: (await h.provision('pages-user')).bearer };
  });
  afterAll(async () => {
    await h?.prisma.systemSetting.deleteMany({ where: { key: 'cms.public_pages' } });
    await h?.close();
  });

  it('keeps drafts private until published and protects live pages', async () => {
    const page = { slug: 'partner-program', title: 'Partner program', description: 'Earn with AmpliVerify', body: BODY };
    await h.api().post('/api/v1/admin/public-pages').set(user).send(page).expect(403);
    await h.api().post('/api/v1/admin/public-pages').set(admin).send({ ...page, slug: 'Bad Slug' }).expect(400);
    const created = (await h.api().post('/api/v1/admin/public-pages').set(admin).send(page).expect(201)).body.data;
    expect(created.status).toBe('DRAFT');
    await h.api().post('/api/v1/admin/public-pages').set(admin).send(page).expect(409);

    // Drafts are not public.
    await h.api().get('/api/v1/public/pages/partner-program').expect(404);
    expect((await h.api().get('/api/v1/public/pages').expect(200)).body.data).toEqual([]);

    await h.api().post('/api/v1/admin/public-pages/partner-program/publish').set(admin).expect(201);
    expect((await h.api().get('/api/v1/public/pages/partner-program').expect(200)).body.data).toMatchObject({ title: 'Partner program', body: BODY });

    // Edits stay in draft; the live page is unchanged until published again.
    const edited = (await h.api().put('/api/v1/admin/public-pages/partner-program').set(admin).send({ title: 'Partner program 2027', body: `${BODY}\n\nNew tiers.` }).expect(200)).body.data;
    expect(edited.status).toBe('PUBLISHED_WITH_CHANGES');
    expect((await h.api().get('/api/v1/public/pages/partner-program').expect(200)).body.data.title).toBe('Partner program');
    await h.api().post('/api/v1/admin/public-pages/partner-program/publish').set(admin).expect(201);
    expect((await h.api().get('/api/v1/public/pages/partner-program').expect(200)).body.data.title).toBe('Partner program 2027');

    // A live page must be unpublished before it can be deleted.
    await h.api().delete('/api/v1/admin/public-pages/partner-program').set(admin).expect(400);
    await h.api().post('/api/v1/admin/public-pages/partner-program/unpublish').set(admin).expect(201);
    await h.api().get('/api/v1/public/pages/partner-program').expect(404);
    await h.api().delete('/api/v1/admin/public-pages/partner-program').set(user).expect(403);
    await h.api().delete('/api/v1/admin/public-pages/partner-program').set(admin).expect(200);
    expect((await h.api().get('/api/v1/admin/public-pages').set(admin).expect(200)).body.data).toEqual([]);
    expect(await h.prisma.auditLog.count({ where: { eventType: { startsWith: 'public_page.' } } })).toBeGreaterThanOrEqual(6);
  });
});
