import { createHash } from 'crypto';
import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

describe('Guides, comments, feedback and newsletter', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let admin: { authorization: string };

  beforeAll(async () => {
    h = await startApp({ EMAIL_LOG_ONLY: 'true' });
    const a = await h.provision('content-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
  });
  afterAll(async () => {
    await h?.close();
  });

  it('publishes a guide with author, tags, settings and hand-picked related guides', async () => {
    const author = await h.api().post('/api/v1/admin/authors').set(admin).send({ displayName: 'AmpliVerify Team' }).expect(201);
    const other = await h.api().post('/api/v1/admin/content/guides').set(admin).send({ title: 'What Is GEO?', body: '## Intro\n\nText', status: 'PUBLISHED' }).expect(201);
    const g = await h.api()
      .post('/api/v1/admin/content/guides')
      .set(admin)
      .send({ title: 'Prioritizing SEO Fixes', body: '## Why\n\n' + 'word '.repeat(900), excerpt: 'Score every issue', status: 'PUBLISHED', authorId: author.body.data.id, tags: ['Technical SEO', 'Prioritization'], readingMinutes: 12, showToc: true, allowComments: true, relatedIds: [other.body.data.id] })
      .expect(201);
    expect(g.body.data).toMatchObject({ readingMinutes: 12, allowComments: true, authorId: author.body.data.id });
    expect(g.body.data.tags.map((t: { tag: { name: string } }) => t.tag.name).sort()).toEqual(['Prioritization', 'Technical SEO']);

    const pub = await h.api().get(`/api/v1/public/guides/${g.body.data.slug}`).expect(200);
    expect(pub.body.data).toMatchObject({ readingMinutes: 12, showToc: true, allowComments: true, author: { displayName: 'AmpliVerify Team', avatarUrl: null } });
    expect(pub.body.data.related[0]).toMatchObject({ slug: other.body.data.slug, title: 'What Is GEO?' });
    expect(pub.body.data).not.toHaveProperty('bodyRef');

    // A guide cannot be related to itself.
    await h.api().patch(`/api/v1/admin/content/guides/${g.body.data.id}`).set(admin).send({ relatedIds: [g.body.data.id] }).expect(200);
    const again = await h.api().get(`/api/v1/admin/content/guides/${g.body.data.id}`).set(admin).expect(200);
    expect(again.body.data.related).toEqual([]);
  });

  it('holds comments for moderation and only shows approved ones', async () => {
    const g = await h.api().post('/api/v1/admin/content/guides').set(admin).send({ title: 'Comment Guide', body: 'Body', status: 'PUBLISHED', allowComments: true }).expect(201);
    const slug = g.body.data.slug;
    await h.api().post(`/api/v1/public/guides/${slug}/comments`).send({ name: 'Ann', email: 'ann@example.test', body: 'Very useful, thanks!' }).expect(201);
    // Honeypot submissions are accepted silently and not stored.
    await h.api().post(`/api/v1/public/guides/${slug}/comments`).send({ name: 'Bot', email: 'bot@example.test', body: 'spam', website: 'http://spam.example' }).expect(201);
    expect((await h.api().get(`/api/v1/public/guides/${slug}/comments`).expect(200)).body.data.comments).toEqual([]);

    const queue = await h.api().get('/api/v1/admin/comments?status=PENDING').set(admin).expect(200);
    const mine = queue.body.data.rows.filter((r: { article: { slug: string } | null }) => r.article?.slug === slug);
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toHaveProperty('ipHash');
    await h.api().patch(`/api/v1/admin/comments/${mine[0].id}`).set(admin).send({ status: 'APPROVED' }).expect(200);
    const list = await h.api().get(`/api/v1/public/guides/${slug}/comments`).expect(200);
    expect(list.body.data.comments).toEqual([expect.objectContaining({ authorName: 'Ann', body: 'Very useful, thanks!' })]);
    expect(list.body.data.comments[0]).not.toHaveProperty('authorEmail');

    // Closed articles refuse comments.
    const closed = await h.api().post('/api/v1/admin/content/blog').set(admin).send({ title: 'Closed Post', body: 'Body', status: 'PUBLISHED' }).expect(201);
    await h.api().post(`/api/v1/public/blog/${closed.body.data.slug}/comments`).send({ name: 'Ann', email: 'ann@example.test', body: 'Hello there' }).expect(400);
    // Regular users cannot moderate.
    const user = await h.provision('reader');
    await h.api().get('/api/v1/admin/comments').set({ authorization: user.bearer }).expect(403);
  });

  it('records one helpful vote per visitor and counts them', async () => {
    const post = await h.api().post('/api/v1/admin/content/blog').set(admin).send({ title: 'Vote Post', body: 'Body', status: 'PUBLISHED' }).expect(201);
    const slug = post.body.data.slug;
    await h.api().post(`/api/v1/public/blog/${slug}/feedback`).set('x-forwarded-for', '203.0.113.20').send({ helpful: true }).expect(201);
    await h.api().post(`/api/v1/public/blog/${slug}/feedback`).set('x-forwarded-for', '203.0.113.20').send({ helpful: false }).expect(201);
    await h.api().post(`/api/v1/public/blog/${slug}/feedback`).set('x-forwarded-for', '203.0.113.21').send({ helpful: true }).expect(201);
    const totals = await h.api().get('/api/v1/admin/feedback/blog').set(admin).expect(200);
    expect(totals.body.data[post.body.data.id]).toEqual({ yes: 1, no: 1 });
  });

  it('runs a double opt-in newsletter with unsubscribe and export', async () => {
    await h.api().post('/api/v1/public/newsletter').send({ email: 'Reader@Example.test', source: 'blog' }).expect(201);
    const row = await h.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: 'reader@example.test' } });
    expect(row.status).toBe('PENDING');
    // Simulate clicking the emailed link: issue a known token.
    const token = 'known-token-0123456789abcdef';
    await h.prisma.newsletterSubscriber.update({ where: { id: row.id }, data: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    const c = await h.api().post('/api/v1/public/newsletter/confirm').send({ token }).expect(201);
    expect(c.body.data.subscribed).toBe(true);
    await h.api().post('/api/v1/public/newsletter/confirm').send({ token }).expect(404);

    const csv = await h.api().get('/api/v1/admin/newsletter/export').set(admin).expect(200);
    expect(csv.text).toContain('reader@example.test');

    await h.api().post('/api/v1/public/newsletter/unsubscribe').send({ token: c.body.data.unsubscribeToken }).expect(201);
    expect((await h.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('UNSUBSCRIBED');
  });
});
