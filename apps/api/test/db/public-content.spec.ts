import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PublicContentService } from '../../src/public-content/public-content.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ContentStorageService } from '../../src/storage/content-storage.service';
import { createPrisma, uniq } from './helpers';

describe('public content (publication rules)', () => {
  let prisma: PrismaClient;
  let content: PublicContentService;
  let storage: ContentStorageService;
  const hour = 3_600_000;

  beforeAll(() => {
    prisma = createPrisma();
    storage = new ContentStorageService(new ConfigService({ STORAGE_DIR: mkdtempSync(join(tmpdir(), 'av-pub-')) }));
    content = new PublicContentService(prisma as PrismaService, storage);
  });
  afterAll(() => prisma.$disconnect());

  it('lists only published, already-live blog posts and serves their body', async () => {
    const tag = uniq('post');
    const bodyRef = `cms/blog/${tag}.md`;
    await storage.writeText(bodyRef, '## Live body');
    await prisma.blogPost.createMany({
      data: [
        { slug: `${tag}-live`, title: `${tag} live`, bodyRef, status: 'PUBLISHED', publishedAt: new Date(Date.now() - hour) },
        { slug: `${tag}-draft`, title: `${tag} draft`, bodyRef },
        { slug: `${tag}-scheduled`, title: `${tag} scheduled`, bodyRef, status: 'PUBLISHED', publishedAt: new Date(Date.now() + hour) },
        { slug: `${tag}-archived`, title: `${tag} archived`, bodyRef, status: 'ARCHIVED' },
      ],
    });

    const listed = await content.listBlogPosts({ q: tag });
    expect(listed.map((p) => p.slug)).toEqual([`${tag}-live`]);
    expect(listed[0]).not.toHaveProperty('bodyRef');

    await expect(content.getBlogPost(`${tag}-live`)).resolves.toMatchObject({ body: '## Live body', tags: [] });
    await expect(content.getBlogPost(`${tag}-draft`)).rejects.toMatchObject({ response: { code: 'CONTENT_NOT_FOUND' } });
    await expect(content.getBlogPost(`${tag}-scheduled`)).rejects.toMatchObject({ response: { code: 'CONTENT_NOT_FOUND' } });
  });

  it('careers expose only open, visible roles and no internal fields', async () => {
    const tag = uniq('job');
    const base = { employmentType: 'FULL_TIME', descriptionRef: `jobs/${tag}.md` };
    const past = new Date(Date.now() - hour);
    await prisma.jobOpening.createMany({
      data: [
        { ...base, slug: `${tag}-open`, title: 'Open', status: 'PUBLISHED', publishedAt: past },
        { ...base, slug: `${tag}-hidden`, title: 'Hidden', status: 'PUBLISHED', publishedAt: past, showOnCareersPage: false },
        { ...base, slug: `${tag}-expired`, title: 'Expired', status: 'PUBLISHED', publishedAt: past, applicationDeadline: past },
        { ...base, slug: `${tag}-closed`, title: 'Closed', status: 'CLOSED', publishedAt: past },
      ],
    });
    const slugs = (await content.listJobOpenings()).map((j) => j.slug).filter((s) => s.startsWith(tag));
    expect(slugs).toEqual([`${tag}-open`]);
    const job = await content.getJobOpening(`${tag}-open`);
    expect(job).not.toHaveProperty('descriptionRef');
    expect(job.description).toBeNull();
  });

  it('pricing lists only active public plans with active prices', async () => {
    const code = uniq('plan');
    const plan = await prisma.plan.create({ data: { code, name: 'Pro', status: 'ACTIVE', isPublic: true } });
    await prisma.plan.create({ data: { code: `${code}-hidden`, name: 'Internal', status: 'ACTIVE', isPublic: false } });
    await prisma.planPrice.createMany({
      data: [
        { planId: plan.id, billingInterval: 'MONTHLY', currency: 'USD', amountMinor: 4900n },
        { planId: plan.id, billingInterval: 'ANNUAL', currency: 'USD', amountMinor: 1n, active: false },
      ],
    });
    const plans = (await content.listPlans()).filter((p) => p.code.startsWith(code));
    expect(plans.map((p) => p.code)).toEqual([code]);
    expect(plans[0].prices).toEqual([{ billingInterval: 'MONTHLY', currency: 'USD', amountMinor: 4900n }]);
  });
});
