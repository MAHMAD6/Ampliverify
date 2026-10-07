import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CmsContentType, Prisma, PublishStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { slugify } from '../common/utils/slug';
import { detectFileType, IMAGE_TYPES } from '../storage/file-safety';

export type ArticleKind = 'BLOG' | 'GUIDE' | 'HELP' | 'CASE_STUDY';

export type ArticleInput = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  body?: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  categoryId?: string | null;
  authorId?: string | null;
  featuredMediaId?: string | null;
  tags?: string[];
  status?: PublishStatus;
  publishedAt?: string | null;
  customerName?: string;
  industry?: string | null;
  results?: { label: string; value: string }[];
};

const delegate = (prisma: PrismaService, kind: ArticleKind) =>
  ({ BLOG: prisma.blogPost, GUIDE: prisma.guide, HELP: prisma.helpArticle, CASE_STUDY: prisma.caseStudy })[kind] as unknown as {
    findMany: (a: object) => Promise<Record<string, unknown>[]>;
    findUnique: (a: object) => Promise<Record<string, unknown> | null>;
    create: (a: object) => Promise<Record<string, unknown>>;
    update: (a: object) => Promise<Record<string, unknown>>;
    delete: (a: object) => Promise<unknown>;
    count: (a: object) => Promise<number>;
    groupBy: (a: object) => Promise<{ status: PublishStatus; _count: number }[]>;
  };

/**
 * Super Admin content management (permission `cms.manage`): blog posts,
 * guides, help articles, case studies, videos, events, categories, tags,
 * authors and the media library. Bodies are markdown in content storage;
 * publishing sets `published_at`, which the public site honours.
 */
@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly storage: ContentStorageService,
  ) {}

  private guard(userId: string) {
    return this.rbac.assertGlobalPermission(userId, 'cms.manage');
  }

  private audit(userId: string, action: string, targetType: string, targetId: string | null, after?: Prisma.InputJsonObject, meta?: RequestMeta) {
    return this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action, targetType, targetId, afterState: after ?? null, requestMeta: meta });
  }

  async overview(userId: string) {
    await this.guard(userId);
    const counts = async (kind: ArticleKind) => {
      const rows = await delegate(this.prisma, kind).groupBy({ by: ['status'], _count: true });
      return { draft: rows.find((r) => r.status === 'DRAFT')?._count ?? 0, published: rows.find((r) => r.status === 'PUBLISHED')?._count ?? 0, archived: rows.find((r) => r.status === 'ARCHIVED')?._count ?? 0 };
    };
    const [blog, guides, help, caseStudies, videos, events, media, jobs, recent] = await Promise.all([
      counts('BLOG'),
      counts('GUIDE'),
      counts('HELP'),
      counts('CASE_STUDY'),
      this.prisma.cmsVideo.count(),
      this.prisma.cmsEvent.count(),
      this.prisma.mediaAsset.count(),
      this.prisma.jobOpening.groupBy({ by: ['status'], _count: true }),
      this.prisma.auditLog.findMany({ where: { eventType: { startsWith: 'content.' } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    return { blog, guides, help, caseStudies, videos, events, media, jobs: Object.fromEntries(jobs.map((j) => [j.status, j._count])), recent };
  }

  // ── Articles (blog, guides, help, case studies) ────────────────────────

  async listArticles(userId: string, kind: ArticleKind, filters: { status?: string; q?: string; category?: string } = {}) {
    await this.guard(userId);
    const rows = await delegate(this.prisma, kind).findMany({
      where: {
        ...(filters.status && filters.status in PublishStatus ? { status: filters.status } : {}),
        ...(filters.q ? { title: { contains: filters.q, mode: 'insensitive' } } : {}),
        ...(filters.category && kind !== 'CASE_STUDY' ? { categoryId: filters.category } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      ...(kind === 'BLOG' ? { include: { author: { select: { id: true, displayName: true } }, category: true, tags: { include: { tag: true } } } } : kind === 'CASE_STUDY' ? {} : { include: { category: true } }),
    });
    return rows.map((r) => {
      const { bodyRef: _b, ...rest } = r as Record<string, unknown> & { bodyRef?: string };
      return rest;
    });
  }

  async getArticle(userId: string, kind: ArticleKind, id: string) {
    await this.guard(userId);
    const row = await delegate(this.prisma, kind).findUnique({
      where: { id },
      ...(kind === 'BLOG' ? { include: { author: true, category: true, tags: { include: { tag: true } }, featuredMedia: true } } : kind === 'CASE_STUDY' ? {} : { include: { category: true } }),
    });
    if (!row) throw new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: 'Content not found.' });
    const { bodyRef, ...rest } = row as Record<string, unknown> & { bodyRef: string };
    return { ...rest, body: (await this.storage.readText(bodyRef)) ?? '' };
  }

  private async uniqueSlug(kind: ArticleKind, wanted: string, exceptId?: string) {
    let slug = slugify(wanted, `item-${Date.now()}`);
    for (let i = 2; i < 50; i++) {
      const existing = await delegate(this.prisma, kind).findUnique({ where: { slug } });
      if (!existing || existing.id === exceptId) return slug;
      slug = `${slugify(wanted, 'item')}-${i}`;
    }
    throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Choose a different URL slug.' });
  }

  private publishFields(input: ArticleInput, current?: { status: PublishStatus; publishedAt: Date | null }) {
    if (input.status === undefined && input.publishedAt === undefined) return {};
    const status = input.status ?? current?.status ?? 'DRAFT';
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : status === 'PUBLISHED' ? current?.publishedAt ?? new Date() : current?.publishedAt ?? null;
    return { status, publishedAt };
  }

  async createArticle(userId: string, kind: ArticleKind, input: ArticleInput, meta?: RequestMeta) {
    await this.guard(userId);
    if (!input.title?.trim()) throw new BadRequestException({ code: 'TITLE_REQUIRED', message: 'Enter a title.' });
    if (kind === 'CASE_STUDY' && !input.customerName?.trim()) throw new BadRequestException({ code: 'CUSTOMER_REQUIRED', message: 'Enter the customer name.' });
    const id = randomUUID();
    const bodyRef = `cms/${kind.toLowerCase()}/${id}.md`;
    await this.storage.writeText(bodyRef, input.body ?? '');
    const slug = await this.uniqueSlug(kind, input.slug || input.title);
    const data: Record<string, unknown> = {
      id,
      title: input.title.trim(),
      slug,
      bodyRef,
      excerpt: kind === 'CASE_STUDY' ? undefined : input.excerpt ?? null,
      seoTitle: input.seoTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      ...this.publishFields(input),
    };
    if (kind !== 'CASE_STUDY') data.categoryId = input.categoryId ?? null;
    if (kind === 'BLOG') {
      data.authorId = input.authorId ?? null;
      data.featuredMediaId = input.featuredMediaId ?? null;
    }
    if (kind === 'CASE_STUDY') {
      Object.assign(data, { customerName: input.customerName!.trim(), industry: input.industry ?? null, summary: input.excerpt ?? null, coverMediaId: input.featuredMediaId ?? null, resultsJson: input.results ?? Prisma.DbNull });
      delete data.excerpt;
    }
    const row = await delegate(this.prisma, kind).create({ data });
    if (kind === 'BLOG' && input.tags) await this.setTags(id, input.tags);
    await this.audit(userId, `content.${kind.toLowerCase()}.create`, kind.toLowerCase(), id, { title: data.title as string, status: String(row.status) }, meta);
    return this.getArticle(userId, kind, id);
  }

  async updateArticle(userId: string, kind: ArticleKind, id: string, input: ArticleInput, meta?: RequestMeta) {
    await this.guard(userId);
    const current = (await delegate(this.prisma, kind).findUnique({ where: { id } })) as (Record<string, unknown> & { bodyRef: string; status: PublishStatus; publishedAt: Date | null; title: string }) | null;
    if (!current) throw new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: 'Content not found.' });
    if (input.body !== undefined) await this.storage.writeText(current.bodyRef, input.body);
    const data: Record<string, unknown> = {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.slug !== undefined && { slug: await this.uniqueSlug(kind, input.slug, id) }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.metaDescription !== undefined && { metaDescription: input.metaDescription }),
      ...this.publishFields(input, current),
    };
    if (kind === 'CASE_STUDY') {
      Object.assign(data, {
        ...(input.excerpt !== undefined && { summary: input.excerpt }),
        ...(input.customerName !== undefined && { customerName: input.customerName }),
        ...(input.industry !== undefined && { industry: input.industry }),
        ...(input.results !== undefined && { resultsJson: input.results }),
        ...(input.featuredMediaId !== undefined && { coverMediaId: input.featuredMediaId }),
      });
    } else {
      Object.assign(data, { ...(input.excerpt !== undefined && { excerpt: input.excerpt }), ...(input.categoryId !== undefined && { categoryId: input.categoryId }) });
    }
    if (kind === 'BLOG') Object.assign(data, { ...(input.authorId !== undefined && { authorId: input.authorId }), ...(input.featuredMediaId !== undefined && { featuredMediaId: input.featuredMediaId }) });
    // Touch updatedAt even when only the body changed.
    data.updatedAt = new Date();
    await delegate(this.prisma, kind).update({ where: { id }, data });
    if (kind === 'BLOG' && input.tags) await this.setTags(id, input.tags);
    const action = input.status === 'PUBLISHED' && current.status !== 'PUBLISHED' ? 'publish' : input.status === 'ARCHIVED' ? 'archive' : 'update';
    await this.audit(userId, `content.${kind.toLowerCase()}.${action}`, kind.toLowerCase(), id, { title: (data.title as string) ?? current.title, status: (data.status as string) ?? current.status }, meta);
    return this.getArticle(userId, kind, id);
  }

  async deleteArticle(userId: string, kind: ArticleKind, id: string, meta?: RequestMeta) {
    await this.guard(userId);
    const current = (await delegate(this.prisma, kind).findUnique({ where: { id } })) as { bodyRef: string; status: PublishStatus; title: string } | null;
    if (!current) throw new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: 'Content not found.' });
    if (current.status === 'PUBLISHED') throw new ConflictException({ code: 'CONTENT_PUBLISHED', message: 'Unpublish or archive the item before deleting it.' });
    if (kind === 'BLOG') await this.prisma.blogPostTag.deleteMany({ where: { postId: id } });
    await delegate(this.prisma, kind).delete({ where: { id } });
    await this.storage.delete(current.bodyRef).catch(() => undefined);
    await this.audit(userId, `content.${kind.toLowerCase()}.delete`, kind.toLowerCase(), id, { title: current.title }, meta);
    return { id, deleted: true };
  }

  private async setTags(postId: string, names: string[]) {
    const tags = [];
    for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 20)) {
      const slug = slugify(name, 'tag');
      tags.push(await this.prisma.cmsTag.upsert({ where: { slug }, create: { name, slug }, update: {} }));
    }
    await this.prisma.$transaction([
      this.prisma.blogPostTag.deleteMany({ where: { postId } }),
      this.prisma.blogPostTag.createMany({ data: tags.map((t) => ({ postId, tagId: t.id })) }),
    ]);
  }

  // ── Taxonomy ───────────────────────────────────────────────────────────

  async categories(userId: string, type?: CmsContentType) {
    await this.guard(userId);
    return this.prisma.cmsCategory.findMany({
      where: type ? { contentType: type } : {},
      orderBy: [{ contentType: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { blogPosts: true, guides: true, helpArticles: true } } },
    });
  }

  async createCategory(userId: string, input: { contentType: CmsContentType; name: string; slug?: string }, meta?: RequestMeta) {
    await this.guard(userId);
    const slug = slugify(input.slug || input.name, 'category');
    try {
      const c = await this.prisma.cmsCategory.create({ data: { contentType: input.contentType, name: input.name.trim(), slug } });
      await this.audit(userId, 'content.category.create', 'cms_category', c.id, { name: c.name, contentType: c.contentType }, meta);
      return c;
    } catch {
      throw new ConflictException({ code: 'CATEGORY_EXISTS', message: 'A category with this slug already exists.' });
    }
  }

  async updateCategory(userId: string, id: string, input: { name?: string; slug?: string }) {
    await this.guard(userId);
    return this.prisma.cmsCategory.update({ where: { id }, data: { ...(input.name && { name: input.name.trim() }), ...(input.slug && { slug: slugify(input.slug, 'category') }) } });
  }

  async deleteCategory(userId: string, id: string, meta?: RequestMeta) {
    await this.guard(userId);
    await this.prisma.cmsCategory.delete({ where: { id } });
    await this.audit(userId, 'content.category.delete', 'cms_category', id, undefined, meta);
    return { id, deleted: true };
  }

  async tags(userId: string) {
    await this.guard(userId);
    return this.prisma.cmsTag.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { posts: true } } } });
  }

  async authors(userId: string) {
    await this.guard(userId);
    return this.prisma.cmsAuthor.findMany({ orderBy: { displayName: 'asc' }, include: { _count: { select: { blogPosts: true } }, user: { select: { id: true, email: true } } } });
  }

  async upsertAuthor(userId: string, id: string | null, input: { displayName: string; slug?: string; bio?: string | null; userId?: string | null }, meta?: RequestMeta) {
    await this.guard(userId);
    const data = { displayName: input.displayName.trim(), slug: slugify(input.slug || input.displayName, 'author'), bio: input.bio ?? null, userId: input.userId ?? null };
    try {
      const a = id ? await this.prisma.cmsAuthor.update({ where: { id }, data }) : await this.prisma.cmsAuthor.create({ data });
      await this.audit(userId, id ? 'content.author.update' : 'content.author.create', 'cms_author', a.id, { displayName: a.displayName }, meta);
      return a;
    } catch {
      throw new ConflictException({ code: 'AUTHOR_EXISTS', message: 'An author with this slug or user already exists.' });
    }
  }

  async deleteAuthor(userId: string, id: string) {
    await this.guard(userId);
    await this.prisma.cmsAuthor.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Media ──────────────────────────────────────────────────────────────

  async media(userId: string, q?: string) {
    await this.guard(userId);
    const rows = await this.prisma.mediaAsset.findMany({
      where: q ? { OR: [{ altText: { contains: q, mode: 'insensitive' } }, { storageKey: { contains: q, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { uploader: { select: { displayName: true, email: true } }, _count: { select: { blogPosts: true } } },
    });
    return rows.map((m) => ({ ...m, url: `/api/v1/public/media/${m.id}` }));
  }

  async upload(userId: string, file: { buffer: Buffer; originalname: string; size: number } | undefined, altText: string | undefined, meta?: RequestMeta) {
    await this.guard(userId);
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Choose an image to upload.' });
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Images must be 10 MB or smaller.' });
    const type = detectFileType(file.buffer, IMAGE_TYPES);
    if (!type) throw new BadRequestException({ code: 'UNSUPPORTED_FILE', message: 'Upload a PNG, JPEG, GIF or WebP image.' });
    const id = randomUUID();
    const storageKey = `media/${id}.${type.ext}`;
    await this.storage.writeBuffer(storageKey, file.buffer, type.mime);
    const asset = await this.prisma.mediaAsset.create({ data: { id, storageKey, mimeType: type.mime, sizeBytes: BigInt(file.size), altText: altText?.trim() || null, uploadedBy: userId } });
    await this.audit(userId, 'content.media.upload', 'media_asset', id, { mimeType: type.mime, size: file.size }, meta);
    return { ...asset, url: `/api/v1/public/media/${id}` };
  }

  async updateMedia(userId: string, id: string, altText: string | null) {
    await this.guard(userId);
    return this.prisma.mediaAsset.update({ where: { id }, data: { altText } });
  }

  async deleteMedia(userId: string, id: string, meta?: RequestMeta) {
    await this.guard(userId);
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id }, include: { _count: { select: { blogPosts: true } } } });
    if (!asset) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'File not found.' });
    if (asset._count.blogPosts) throw new ConflictException({ code: 'MEDIA_IN_USE', message: 'This image is used by a blog post.' });
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.storage.delete(asset.storageKey).catch(() => undefined);
    await this.audit(userId, 'content.media.delete', 'media_asset', id, undefined, meta);
    return { id, deleted: true };
  }

  /** Public delivery of library images (used on published pages). */
  async mediaFile(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'File not found.' });
    const body = await this.storage.readBuffer(asset.storageKey);
    if (!body) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'File not found.' });
    return { body, mimeType: asset.mimeType };
  }

  // ── Videos & events ────────────────────────────────────────────────────

  async videos(userId: string) {
    await this.guard(userId);
    return this.prisma.cmsVideo.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async saveVideo(userId: string, id: string | null, input: { title: string; slug?: string; description?: string | null; videoUrl: string; thumbnailId?: string | null; durationSec?: number | null; status?: PublishStatus }, meta?: RequestMeta) {
    await this.guard(userId);
    const url = new URL(input.videoUrl);
    if (url.protocol !== 'https:') throw new BadRequestException({ code: 'INVALID_URL', message: 'Use an https video URL.' });
    const current = id ? await this.prisma.cmsVideo.findUnique({ where: { id } }) : null;
    const data = {
      title: input.title.trim(),
      slug: slugify(input.slug || input.title, 'video'),
      description: input.description ?? null,
      videoUrl: url.toString(),
      thumbnailId: input.thumbnailId ?? null,
      durationSec: input.durationSec ?? null,
      ...(input.status && { status: input.status, publishedAt: input.status === 'PUBLISHED' ? current?.publishedAt ?? new Date() : current?.publishedAt ?? null }),
    };
    try {
      const v = id ? await this.prisma.cmsVideo.update({ where: { id }, data }) : await this.prisma.cmsVideo.create({ data });
      await this.audit(userId, id ? 'content.video.update' : 'content.video.create', 'cms_video', v.id, { title: v.title, status: v.status }, meta);
      return v;
    } catch {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Choose a different URL slug.' });
    }
  }

  async deleteVideo(userId: string, id: string) {
    await this.guard(userId);
    await this.prisma.cmsVideo.delete({ where: { id } });
    return { id, deleted: true };
  }

  async events(userId: string) {
    await this.guard(userId);
    return this.prisma.cmsEvent.findMany({ orderBy: { startsAt: 'desc' } });
  }

  async saveEvent(
    userId: string,
    id: string | null,
    input: { title: string; slug?: string; summary?: string | null; eventType?: string; startsAt: string; endsAt?: string | null; timezone?: string; locationText?: string | null; registrationUrl?: string | null; status?: PublishStatus },
    meta?: RequestMeta,
  ) {
    await this.guard(userId);
    if (input.registrationUrl && new URL(input.registrationUrl).protocol !== 'https:') throw new BadRequestException({ code: 'INVALID_URL', message: 'Use an https registration URL.' });
    const current = id ? await this.prisma.cmsEvent.findUnique({ where: { id } }) : null;
    const data = {
      title: input.title.trim(),
      slug: slugify(input.slug || input.title, 'event'),
      summary: input.summary ?? null,
      eventType: input.eventType ?? 'WEBINAR',
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      timezone: input.timezone ?? 'UTC',
      locationText: input.locationText ?? null,
      registrationUrl: input.registrationUrl ?? null,
      ...(input.status && { status: input.status, publishedAt: input.status === 'PUBLISHED' ? current?.publishedAt ?? new Date() : current?.publishedAt ?? null }),
    };
    try {
      const e = id ? await this.prisma.cmsEvent.update({ where: { id }, data }) : await this.prisma.cmsEvent.create({ data });
      await this.audit(userId, id ? 'content.event.update' : 'content.event.create', 'cms_event', e.id, { title: e.title, status: e.status }, meta);
      return e;
    } catch {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Choose a different URL slug.' });
    }
  }

  async deleteEvent(userId: string, id: string) {
    await this.guard(userId);
    await this.prisma.cmsEvent.delete({ where: { id } });
    return { id, deleted: true };
  }
}
