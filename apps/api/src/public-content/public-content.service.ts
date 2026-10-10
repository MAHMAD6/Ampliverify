import { Injectable, NotFoundException } from '@nestjs/common';
import { CmsContentType, JobStatus, PlanStatus, Prisma, PublishStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContentStorageService } from '../storage/content-storage.service';

const MAX_LIMIT = 50;

export type ListQuery = { q?: string; category?: string; limit?: number };

const categorySelect = { select: { name: true, slug: true } } as const;

/**
 * Read-only content for the public website. Every query applies the
 * publication rule (guide §14): status = PUBLISHED AND published_at <= now().
 * Drafts, scheduled items and internal fields are never returned.
 */
@Injectable()
export class PublicContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ContentStorageService,
  ) {}

  private live(now = new Date()) {
    return { status: PublishStatus.PUBLISHED, publishedAt: { lte: now } };
  }

  private searchFilter(q?: string) {
    const term = q?.trim();
    if (!term) return {};
    return {
      OR: [
        { title: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { excerpt: { contains: term, mode: Prisma.QueryMode.insensitive } },
      ],
    };
  }

  private take(limit?: number) {
    return Math.min(Math.max(limit ?? 24, 1), MAX_LIMIT);
  }

  listCategories(contentType: CmsContentType) {
    return this.prisma.cmsCategory.findMany({
      where: { contentType },
      select: { name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  listBlogPosts(query: ListQuery) {
    return this.prisma.blogPost.findMany({
      where: {
        ...this.live(),
        ...this.searchFilter(query.q),
        ...(query.category && { category: { slug: query.category } }),
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        featuredMediaId: true,
        category: categorySelect,
        author: { select: { displayName: true, slug: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: this.take(query.limit),
    });
  }

  async getBlogPost(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, ...this.live() },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        seoTitle: true,
        metaDescription: true,
        publishedAt: true,
        updatedAt: true,
        bodyRef: true,
        featuredMediaId: true,
        category: categorySelect,
        author: { select: { displayName: true, slug: true, bio: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    });
    if (!post) throw this.notFound();
    const { bodyRef, tags, ...rest } = post;
    return { ...rest, tags: tags.map((t) => t.tag), body: await this.storage.readText(bodyRef) };
  }

  listGuides(query: ListQuery) {
    return this.prisma.guide.findMany({
      where: { ...this.live(), ...this.searchFilter(query.q), ...(query.category && { category: { slug: query.category } }) },
      select: { slug: true, title: true, excerpt: true, publishedAt: true, updatedAt: true, category: categorySelect },
      orderBy: { publishedAt: 'desc' },
      take: this.take(query.limit),
    });
  }

  async getGuide(slug: string) {
    const guide = await this.prisma.guide.findFirst({
      where: { slug, ...this.live() },
      select: {
        slug: true, title: true, excerpt: true, seoTitle: true, metaDescription: true,
        publishedAt: true, updatedAt: true, bodyRef: true, category: categorySelect,
      },
    });
    if (!guide) throw this.notFound();
    const { bodyRef, ...rest } = guide;
    return { ...rest, body: await this.storage.readText(bodyRef) };
  }

  listHelpArticles(query: ListQuery) {
    return this.prisma.helpArticle.findMany({
      where: { ...this.live(), ...this.searchFilter(query.q), ...(query.category && { category: { slug: query.category } }) },
      select: { slug: true, title: true, excerpt: true, publishedAt: true, updatedAt: true, category: categorySelect },
      orderBy: { publishedAt: 'desc' },
      take: this.take(query.limit),
    });
  }

  async getHelpArticle(slug: string) {
    const article = await this.prisma.helpArticle.findFirst({
      where: { slug, ...this.live() },
      select: {
        slug: true, title: true, excerpt: true, seoTitle: true, metaDescription: true,
        publishedAt: true, updatedAt: true, bodyRef: true, category: categorySelect,
      },
    });
    if (!article) throw this.notFound();
    const { bodyRef, ...rest } = article;
    return { ...rest, body: await this.storage.readText(bodyRef) };
  }

  private openJobs(now = new Date()): Prisma.JobOpeningWhereInput {
    return {
      status: JobStatus.PUBLISHED,
      publishedAt: { lte: now },
      showOnCareersPage: true,
      OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: now } }],
    };
  }

  /** Only approved public fields — never applicant data or internal notes. */
  private jobFields = {
    slug: true,
    title: true,
    department: true,
    locationText: true,
    employmentType: true,
    workArrangement: true,
    compensationText: true,
    summary: true,
    applicationDeadline: true,
    requireResume: true,
    requireCoverLetter: true,
    publishedAt: true,
  } as const;

  listJobOpenings() {
    return this.prisma.jobOpening.findMany({
      where: this.openJobs(),
      select: this.jobFields,
      orderBy: { publishedAt: 'desc' },
      take: MAX_LIMIT,
    });
  }

  async getJobOpening(slug: string) {
    const job = await this.prisma.jobOpening.findFirst({
      where: { slug, ...this.openJobs() },
      select: { ...this.jobFields, seoTitle: true, metaDescription: true, descriptionRef: true },
    });
    if (!job) throw this.notFound();
    const { descriptionRef, ...rest } = job;
    return { ...rest, description: await this.storage.readText(descriptionRef) };
  }

  /** Public pricing reads the same plan configuration Super Admin edits (guide §12). */
  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { status: PlanStatus.ACTIVE, isPublic: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        code: true,
        name: true,
        description: true,
        isFeatured: true,
        prices: {
          where: { active: true },
          select: { billingInterval: true, currency: true, amountMinor: true },
          orderBy: { billingInterval: 'asc' },
        },
        entitlements: {
          select: {
            enabled: true,
            limitNumeric: true,
            feature: { select: { key: true, name: true, valueType: true, moduleKey: true } },
          },
        },
      },
    });
    return plans;
  }

  listIntegrations() {
    return this.prisma.integrationProvider.findMany({
      where: { active: true },
      select: { key: true, name: true, authType: true },
      orderBy: { name: 'asc' },
    });
  }

  /** AI search platforms enabled in the backend registry (guide §9: never hard-coded in the UI). */
  listGeoPlatforms() {
    return this.prisma.geoPlatform.findMany({
      where: { isActive: true },
      select: { key: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listVideos(limit?: number) {
    return this.prisma.cmsVideo.findMany({
      where: this.live(),
      select: { slug: true, title: true, description: true, videoUrl: true, thumbnailId: true, durationSec: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: this.take(limit),
    });
  }

  /** Upcoming and recent published events (webinars). */
  listEvents(limit?: number) {
    return this.prisma.cmsEvent.findMany({
      where: this.live(),
      select: { slug: true, title: true, summary: true, eventType: true, startsAt: true, endsAt: true, timezone: true, locationText: true, registrationUrl: true },
      orderBy: { startsAt: 'desc' },
      take: this.take(limit),
    });
  }

  listCaseStudies(limit?: number) {
    return this.prisma.caseStudy.findMany({
      where: this.live(),
      select: { slug: true, title: true, customerName: true, industry: true, summary: true, coverMediaId: true, resultsJson: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: this.take(limit),
    });
  }

  async getCaseStudy(slug: string) {
    const row = await this.prisma.caseStudy.findFirst({
      where: { slug, ...this.live() },
      select: { slug: true, title: true, customerName: true, industry: true, summary: true, coverMediaId: true, resultsJson: true, seoTitle: true, metaDescription: true, publishedAt: true, updatedAt: true, bodyRef: true },
    });
    if (!row) throw this.notFound();
    const { bodyRef, ...rest } = row;
    return { ...rest, body: await this.storage.readText(bodyRef) };
  }

  private notFound() {
    return new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: 'Content not found.' });
  }
}
