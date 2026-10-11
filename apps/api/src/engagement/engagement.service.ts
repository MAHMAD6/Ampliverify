import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommentStatus, Prisma, PublishStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';
import { RequestMeta } from '../common/types/request-meta.type';

export type ArticleType = 'BLOG' | 'GUIDE';
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/**
 * Reader engagement on the public website: moderated comments, "Was this
 * helpful?" votes and a double opt-in newsletter. Visitors are identified only
 * by salted hashes of their IP address.
 */
@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  private visitor(ip: string | undefined, purpose: string) {
    return sha(`${this.config.get<string>('AUTH_SYNC_SECRET') ?? ''}:${purpose}:${ip ?? 'unknown'}`).slice(0, 40);
  }

  /** A published article of the given type, or 404. */
  private async article(type: ArticleType, slug: string) {
    const live = { status: PublishStatus.PUBLISHED, publishedAt: { lte: new Date() } };
    const row =
      type === 'BLOG'
        ? await this.prisma.blogPost.findFirst({ where: { slug, ...live }, select: { id: true, title: true, allowComments: true } })
        : await this.prisma.guide.findFirst({ where: { slug, ...live }, select: { id: true, title: true, allowComments: true } });
    if (!row) throw new NotFoundException({ code: 'ARTICLE_NOT_FOUND', message: 'Article not found.' });
    return row;
  }

  // ── Comments ───────────────────────────────────────────────────────────

  async approvedComments(type: ArticleType, slug: string) {
    const a = await this.article(type, slug);
    if (!a.allowComments) return { allowComments: false, comments: [] };
    const comments = await this.prisma.articleComment.findMany({
      where: { contentType: type, articleId: a.id, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, authorName: true, body: true, createdAt: true },
    });
    return { allowComments: true, comments };
  }

  async submitComment(type: ArticleType, slug: string, input: { name: string; email: string; body: string; website?: string }, meta?: RequestMeta) {
    const a = await this.article(type, slug);
    if (!a.allowComments) throw new BadRequestException({ code: 'COMMENTS_CLOSED', message: 'Comments are closed for this article.' });
    // Honeypot: bots fill the hidden "website" field. Accept silently, store nothing.
    if (input.website?.trim()) return { received: true, status: 'PENDING' };
    const body = input.body.trim();
    if (body.length < 2) throw new BadRequestException({ code: 'COMMENT_EMPTY', message: 'Write a comment first.' });
    const ipHash = this.visitor(meta?.ipAddress, 'comment');
    const recent = await this.prisma.articleComment.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recent >= 5) throw new BadRequestException({ code: 'COMMENT_RATE_LIMIT', message: 'Too many comments. Please try again later.' });
    await this.prisma.articleComment.create({ data: { contentType: type, articleId: a.id, authorName: input.name.trim().slice(0, 80), authorEmail: input.email.trim().toLowerCase(), body: body.slice(0, 3000), ipHash } });
    return { received: true, status: 'PENDING' };
  }

  async adminComments(userId: string, q: { status?: string; take?: number }) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const status = q.status && ['PENDING', 'APPROVED', 'REJECTED', 'SPAM'].includes(q.status) ? (q.status as CommentStatus) : undefined;
    const rows = await this.prisma.articleComment.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: Math.min(q.take ?? 100, 300) });
    const blogIds = rows.filter((r) => r.contentType === 'BLOG').map((r) => r.articleId);
    const guideIds = rows.filter((r) => r.contentType === 'GUIDE').map((r) => r.articleId);
    const [posts, guides, counts] = await Promise.all([
      this.prisma.blogPost.findMany({ where: { id: { in: blogIds } }, select: { id: true, title: true, slug: true } }),
      this.prisma.guide.findMany({ where: { id: { in: guideIds } }, select: { id: true, title: true, slug: true } }),
      this.prisma.articleComment.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const titles = new Map<string, { id: string; title: string; slug: string; base: string }>([...posts.map((p) => [p.id, { ...p, base: '/blog' }] as [string, { id: string; title: string; slug: string; base: string }]), ...guides.map((g) => [g.id, { ...g, base: '/guides' }] as [string, { id: string; title: string; slug: string; base: string }])]);
    return {
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      rows: rows.map(({ ipHash: _ip, ...r }) => ({ ...r, article: titles.get(r.articleId) ?? null })),
    };
  }

  async moderate(userId: string, id: string, status: CommentStatus, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const c = await this.prisma.articleComment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found.' });
    const saved = await this.prisma.articleComment.update({ where: { id }, data: { status, moderatedBy: userId, moderatedAt: new Date() } });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'content.comment.moderate', targetType: 'article_comment', targetId: id, beforeState: { status: c.status }, afterState: { status }, requestMeta: meta });
    return saved;
  }

  async deleteComment(userId: string, id: string, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const c = await this.prisma.articleComment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found.' });
    await this.prisma.articleComment.delete({ where: { id } });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'content.comment.delete', targetType: 'article_comment', targetId: id, requestMeta: meta });
    return { id, deleted: true };
  }

  // ── Feedback ───────────────────────────────────────────────────────────

  /** One vote per visitor per article; voting again changes the vote. */
  async vote(type: ArticleType, slug: string, helpful: boolean, meta?: RequestMeta) {
    const a = await this.article(type, slug);
    const voterHash = this.visitor(meta?.ipAddress, `feedback:${type}`);
    await this.prisma.articleFeedback.upsert({
      where: { contentType_articleId_voterHash: { contentType: type, articleId: a.id, voterHash } },
      create: { contentType: type, articleId: a.id, helpful, voterHash },
      update: { helpful },
    });
    return { recorded: true, helpful };
  }

  /** Helpful / not-helpful totals per article (admin lists). */
  async feedbackTotals(userId: string, type: ArticleType) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const rows = await this.prisma.articleFeedback.groupBy({ by: ['articleId', 'helpful'], where: { contentType: type }, _count: { _all: true } });
    const out: Record<string, { yes: number; no: number }> = {};
    for (const r of rows) {
      const t = (out[r.articleId] ??= { yes: 0, no: 0 });
      if (r.helpful) t.yes += r._count._all;
      else t.no += r._count._all;
    }
    return out;
  }

  // ── Newsletter ─────────────────────────────────────────────────────────

  async subscribe(input: { email: string; source?: string; website?: string }, meta?: RequestMeta) {
    if (input.website?.trim()) return { received: true };
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    // Never reveal whether an address is already subscribed.
    if (existing?.status === 'SUBSCRIBED') return { received: true };
    if (!this.email.configured) throw new ServiceUnavailableException({ code: 'EMAIL_NOT_CONFIGURED', message: 'Newsletter sign-up is not available yet.' });
    if (existing && existing.createdAt > new Date(Date.now() - 5 * 60_000) && existing.status === 'PENDING') return { received: true };
    const token = randomBytes(24).toString('base64url');
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, tokenHash: sha(token), source: input.source?.slice(0, 60) ?? null },
      update: { status: 'PENDING', tokenHash: sha(token), source: input.source?.slice(0, 60) ?? existing?.source ?? null, createdAt: new Date(), unsubscribedAt: null },
    });
    const link = `${this.webUrl}/newsletter/confirm?token=${token}`;
    try {
      await this.email.send({
        to: email,
        subject: 'Confirm your AmpliVerify newsletter subscription',
        text: `Please confirm that you want SEO tips, guides and product updates from AmpliVerify:\n\n${link}\n\nIf you didn't sign up, ignore this email and you won't be subscribed.`,
      });
    } catch (e) {
      this.logger.warn(`Newsletter confirmation email failed: ${(e as Error).message}`);
    }
    void meta;
    return { received: true };
  }

  async confirm(token: string) {
    const row = await this.prisma.newsletterSubscriber.findUnique({ where: { tokenHash: sha(token) } });
    if (!row || row.status === 'UNSUBSCRIBED') throw new NotFoundException({ code: 'TOKEN_INVALID', message: 'This confirmation link is invalid or has expired.' });
    // Rotate the token: the confirmed token becomes the unsubscribe token.
    const unsub = randomBytes(24).toString('base64url');
    await this.prisma.newsletterSubscriber.update({ where: { id: row.id }, data: { status: 'SUBSCRIBED', confirmedAt: row.confirmedAt ?? new Date(), tokenHash: sha(unsub) } });
    return { subscribed: true, unsubscribeToken: unsub };
  }

  async unsubscribe(token: string) {
    const row = await this.prisma.newsletterSubscriber.findUnique({ where: { tokenHash: sha(token) } });
    if (!row) throw new NotFoundException({ code: 'TOKEN_INVALID', message: 'This link is invalid.' });
    await this.prisma.newsletterSubscriber.update({ where: { id: row.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } });
    return { unsubscribed: true };
  }

  async subscribers(userId: string, q: { status?: string }) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const where: Prisma.NewsletterSubscriberWhereInput = q.status && ['PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED'].includes(q.status) ? { status: q.status as never } : {};
    const [rows, counts] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, email: true, status: true, source: true, createdAt: true, confirmedAt: true, unsubscribedAt: true } }),
      this.prisma.newsletterSubscriber.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), rows };
  }

  async exportSubscribers(userId: string, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const rows = await this.prisma.newsletterSubscriber.findMany({ where: { status: 'SUBSCRIBED' }, orderBy: { confirmedAt: 'asc' } });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'newsletter.export', targetType: 'newsletter_subscriber', targetId: null, afterState: { count: rows.length }, requestMeta: meta });
    return ['email,confirmed_at,source', ...rows.map((r) => [r.email, r.confirmedAt?.toISOString() ?? '', r.source ?? ''].map(csvCell).join(','))].join('\n');
  }

  async deleteSubscriber(userId: string, id: string, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    await this.prisma.newsletterSubscriber.delete({ where: { id } }).catch(() => {
      throw new NotFoundException({ code: 'SUBSCRIBER_NOT_FOUND', message: 'Subscriber not found.' });
    });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'newsletter.delete', targetType: 'newsletter_subscriber', targetId: id, requestMeta: meta });
    return { id, deleted: true };
  }
}

export const ARTICLE_TYPES: Record<string, ArticleType> = { blog: 'BLOG', guides: 'GUIDE' };
