import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceAssetType, MarketplaceInquiryStatus, MarketplaceListingStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { normalizeHost } from '../common/utils/domain';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

/** Approved business rule: seller earnings become payable from $50 (Marketplace launcher notes §5). */
export const PAYOUT_THRESHOLD_MINOR = 5_000;

export type ListingInput = {
  workspaceId: string;
  title: string;
  assetType: MarketplaceAssetType;
  url?: string | null;
  summary: string;
  description: string;
  askingPriceMinor: number;
  currency?: string;
  monthlyRevenueMinor?: number | null;
  monthlyVisitors?: number | null;
};

const PUBLIC_LISTING = {
  id: true,
  title: true,
  assetType: true,
  url: true,
  summary: true,
  askingPriceMinor: true,
  currency: true,
  monthlyRevenueMinor: true,
  monthlyVisitors: true,
  publishedAt: true,
} satisfies Prisma.MarketplaceListingSelect;

const money = (v: bigint | null | undefined) => (v === null || v === undefined ? null : Number(v));

/**
 * Marketplace for digital assets. Anyone signed in may browse published
 * listings, submit a listing (reviewed by staff before it is public) and send
 * inquiries. Sales, escrow and payouts are not created here: transactions are
 * written only by the verified payment workflow, so lists stay empty until then.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Dashboard ───────────────────────────────────────────────────────────

  async summary(userId: string) {
    const [listings, received, sent, purchases, sales] = await Promise.all([
      this.prisma.marketplaceListing.groupBy({ by: ['status'], where: { sellerId: userId }, _count: true }),
      this.prisma.marketplaceInquiry.count({ where: { listing: { sellerId: userId }, status: 'OPEN' } }),
      this.prisma.marketplaceInquiry.count({ where: { buyerId: userId } }),
      this.prisma.marketplaceTransaction.count({ where: { buyerId: userId } }),
      this.prisma.marketplaceTransaction.groupBy({ by: ['currency'], where: { sellerId: userId, status: 'COMPLETED' }, _sum: { amountMinor: true }, _count: true }),
    ]);
    const byStatus = Object.fromEntries(listings.map((l) => [l.status, l._count])) as Partial<Record<MarketplaceListingStatus, number>>;
    const published = await this.prisma.marketplaceListing.count({ where: { status: 'PUBLISHED' } });
    return {
      marketplace: { publishedListings: published },
      seller: {
        listings: listings.reduce((t, l) => t + l._count, 0),
        byStatus,
        openInquiries: received,
        completedSales: sales.reduce((t, s) => t + s._count, 0),
        // Earnings are recorded sales only; payouts need the verified provider workflow.
        earnings: sales.map((s) => ({ currency: s.currency, amountMinor: money(s._sum.amountMinor) ?? 0 })),
        payoutThresholdMinor: PAYOUT_THRESHOLD_MINOR,
        payoutsAvailable: false,
      },
      buyer: { inquiriesSent: sent, purchases },
    };
  }

  // ── Browse ──────────────────────────────────────────────────────────────

  async browse(filters: { q?: string; assetType?: MarketplaceAssetType; page?: number }) {
    const take = 24;
    const page = Math.max(1, Math.min(filters.page ?? 1, 500));
    const where: Prisma.MarketplaceListingWhereInput = {
      status: 'PUBLISHED',
      ...(filters.assetType ? { assetType: filters.assetType } : {}),
      ...(filters.q?.trim() ? { OR: [{ title: { contains: filters.q.trim(), mode: 'insensitive' } }, { summary: { contains: filters.q.trim(), mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({ where, select: PUBLIC_LISTING, orderBy: { publishedAt: 'desc' }, take, skip: (page - 1) * take }),
      this.prisma.marketplaceListing.count({ where }),
    ]);
    return { items: rows.map((r) => this.money(r)), total, page, pageSize: take };
  }

  /** A published listing, or any of the caller's own listings. */
  async listing(userId: string, id: string) {
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id } });
    if (!l || (l.status !== 'PUBLISHED' && l.sellerId !== userId)) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    const own = l.sellerId === userId;
    const myInquiry = own ? null : await this.prisma.marketplaceInquiry.findFirst({ where: { listingId: id, buyerId: userId }, orderBy: { createdAt: 'desc' } });
    return {
      id: l.id,
      title: l.title,
      assetType: l.assetType,
      url: l.url,
      summary: l.summary,
      description: l.description,
      askingPriceMinor: money(l.askingPriceMinor),
      currency: l.currency,
      monthlyRevenueMinor: money(l.monthlyRevenueMinor),
      monthlyVisitors: l.monthlyVisitors,
      publishedAt: l.publishedAt,
      own,
      ...(own ? { status: l.status, reviewNote: l.reviewNote } : {}),
      myInquiry,
    };
  }

  // ── Selling ─────────────────────────────────────────────────────────────

  async createListing(userId: string, input: ListingInput) {
    await this.rbac.requireWorkspace(userId, input.workspaceId, 'project.read');
    const data = this.validate(input);
    const row = await this.prisma.marketplaceListing.create({ data: { ...data, sellerId: userId, workspaceId: input.workspaceId, status: 'PENDING_REVIEW' } });
    await this.audit.record({ actorUserId: userId, workspaceId: input.workspaceId, action: 'marketplace.listing.create', targetType: 'marketplace_listing', targetId: row.id, afterState: { title: row.title, askingPriceMinor: data.askingPriceMinor.toString() } });
    return this.own(row);
  }

  async myListings(userId: string) {
    const rows = await this.prisma.marketplaceListing.findMany({ where: { sellerId: userId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { inquiries: true } } } });
    return rows.map((r) => ({ ...this.own(r), inquiries: r._count.inquiries }));
  }

  /** Edits resubmit the listing for review; sold listings are final. */
  async updateListing(userId: string, id: string, input: Partial<ListingInput> & { withdraw?: boolean }) {
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id } });
    if (!l || l.sellerId !== userId) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.status === 'SOLD') throw new BadRequestException({ code: 'LISTING_SOLD', message: 'Sold listings cannot be changed.' });
    if (input.withdraw) {
      const row = await this.prisma.marketplaceListing.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      await this.audit.record({ actorUserId: userId, workspaceId: l.workspaceId, action: 'marketplace.listing.withdraw', targetType: 'marketplace_listing', targetId: id });
      return this.own(row);
    }
    const current: ListingInput = {
      workspaceId: l.workspaceId,
      title: l.title,
      assetType: l.assetType,
      url: l.url,
      summary: l.summary,
      description: l.description,
      askingPriceMinor: Number(l.askingPriceMinor),
      currency: l.currency,
      monthlyRevenueMinor: money(l.monthlyRevenueMinor),
      monthlyVisitors: l.monthlyVisitors,
    };
    const data = this.validate({ ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)), workspaceId: l.workspaceId } as ListingInput);
    const row = await this.prisma.marketplaceListing.update({ where: { id }, data: { ...data, status: 'PENDING_REVIEW', reviewNote: null, publishedAt: null } });
    await this.audit.record({ actorUserId: userId, workspaceId: l.workspaceId, action: 'marketplace.listing.update', targetType: 'marketplace_listing', targetId: id });
    return this.own(row);
  }

  // ── Inquiries ───────────────────────────────────────────────────────────

  async inquire(userId: string, listingId: string, input: { workspaceId: string; message: string }) {
    await this.rbac.requireWorkspace(userId, input.workspaceId, 'project.read');
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!l || l.status !== 'PUBLISHED') throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.sellerId === userId) throw new BadRequestException({ code: 'OWN_LISTING', message: 'You cannot send an inquiry about your own listing.' });
    const message = input.message.trim();
    if (message.length < 10) throw new BadRequestException({ code: 'MESSAGE_TOO_SHORT', message: 'Please write at least 10 characters.' });
    const open = await this.prisma.marketplaceInquiry.findFirst({ where: { listingId, buyerId: userId, status: { not: 'CLOSED' } } });
    if (open) throw new BadRequestException({ code: 'INQUIRY_EXISTS', message: 'You already have an open inquiry for this listing. Wait for the seller to reply.' });
    const row = await this.prisma.marketplaceInquiry.create({ data: { listingId, buyerId: userId, workspaceId: input.workspaceId, message } });
    void this.notifications.notify({ workspaceId: l.workspaceId, userId: l.sellerId, eventKey: 'marketplace.inquiry', title: 'New marketplace inquiry', body: `Someone asked about “${l.title}”.` }).catch(() => undefined);
    return row;
  }

  async inquiries(userId: string, role: 'received' | 'sent') {
    const where: Prisma.MarketplaceInquiryWhereInput = role === 'received' ? { listing: { sellerId: userId } } : { buyerId: userId };
    const rows = await this.prisma.marketplaceInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { listing: { select: { id: true, title: true, status: true } }, buyer: { select: { displayName: true } } },
    });
    // Buyers' email addresses are not shared; sellers see a display name only.
    return rows.map((r) => ({
      id: r.id,
      listing: r.listing,
      message: r.message,
      reply: r.reply,
      repliedAt: r.repliedAt,
      status: r.status,
      createdAt: r.createdAt,
      from: role === 'received' ? (r.buyer.displayName ?? 'A buyer') : undefined,
    }));
  }

  async reply(userId: string, id: string, message: string) {
    const r = await this.prisma.marketplaceInquiry.findUnique({ where: { id }, include: { listing: true } });
    if (!r || r.listing.sellerId !== userId) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });
    if (r.status === 'CLOSED') throw new BadRequestException({ code: 'INQUIRY_CLOSED', message: 'This inquiry is closed.' });
    const text = message.trim();
    if (text.length < 2) throw new BadRequestException({ code: 'MESSAGE_TOO_SHORT', message: 'Please write a reply.' });
    const row = await this.prisma.marketplaceInquiry.update({ where: { id }, data: { reply: text, repliedAt: new Date(), status: 'REPLIED' } });
    void this.notifications.notify({ workspaceId: r.workspaceId, userId: r.buyerId, eventKey: 'marketplace.inquiry_reply', title: 'The seller replied', body: `The seller of “${r.listing.title}” replied to your inquiry.` }).catch(() => undefined);
    return row;
  }

  async closeInquiry(userId: string, id: string) {
    const r = await this.prisma.marketplaceInquiry.findUnique({ where: { id }, include: { listing: true } });
    if (!r || (r.buyerId !== userId && r.listing.sellerId !== userId)) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });
    return this.prisma.marketplaceInquiry.update({ where: { id }, data: { status: MarketplaceInquiryStatus.CLOSED } });
  }

  // ── Purchases and transactions (read-only) ──────────────────────────────

  async transactions(userId: string, role: 'buyer' | 'all') {
    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: role === 'buyer' ? { buyerId: userId } : { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { listing: { select: { id: true, title: true } } },
    });
    return rows.map((t) => ({ id: t.id, listing: t.listing, role: t.buyerId === userId ? 'BUYER' : 'SELLER', amountMinor: money(t.amountMinor), currency: t.currency, status: t.status, completedAt: t.completedAt, createdAt: t.createdAt }));
  }

  // ── Admin review ────────────────────────────────────────────────────────

  async adminList(userId: string, status?: MarketplaceListingStatus) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const rows = await this.prisma.marketplaceListing.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { seller: { select: { email: true, displayName: true } } },
    });
    return rows.map((r) => ({ ...this.own(r), description: r.description, seller: r.seller }));
  }

  async review(userId: string, id: string, decision: 'APPROVE' | 'REJECT', note?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id } });
    if (!l) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.status !== 'PENDING_REVIEW') throw new BadRequestException({ code: 'NOT_PENDING', message: 'Only listings waiting for review can be approved or rejected.' });
    if (decision === 'REJECT' && !note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give the seller a reason for the rejection.' });
    const approved = decision === 'APPROVE';
    const row = await this.prisma.marketplaceListing.update({
      where: { id },
      data: { status: approved ? 'PUBLISHED' : 'REJECTED', reviewNote: note?.trim() || null, reviewedBy: userId, reviewedAt: new Date(), publishedAt: approved ? new Date() : null },
    });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', workspaceId: l.workspaceId, action: approved ? 'marketplace.listing.approve' : 'marketplace.listing.reject', targetType: 'marketplace_listing', targetId: id, afterState: { note: note ?? null } });
    void this.notifications
      .notify({ workspaceId: l.workspaceId, userId: l.sellerId, eventKey: 'marketplace.listing_reviewed', title: approved ? 'Your listing is live' : 'Your listing needs changes', body: approved ? `“${l.title}” is now visible in the Marketplace.` : `“${l.title}” was not approved: ${note}` })
      .catch(() => undefined);
    return this.own(row);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private validate(input: ListingInput) {
    const title = input.title?.trim();
    if (!title || title.length < 5) throw new BadRequestException({ code: 'TITLE_REQUIRED', message: 'Give the listing a title of at least 5 characters.' });
    let url: string | null = null;
    if (input.url?.trim()) {
      const host = normalizeHost(input.url);
      if (!host) throw new BadRequestException({ code: 'URL_INVALID', message: 'Enter a valid public website address.' });
      url = `https://${host}`;
    }
    if (!Number.isInteger(input.askingPriceMinor) || input.askingPriceMinor < 100) throw new BadRequestException({ code: 'PRICE_INVALID', message: 'Asking price must be at least 1.00.' });
    const currency = (input.currency ?? 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException({ code: 'CURRENCY_INVALID', message: 'Use a 3-letter currency code.' });
    for (const [k, v] of [['monthlyRevenueMinor', input.monthlyRevenueMinor], ['monthlyVisitors', input.monthlyVisitors]] as const) {
      if (v !== null && v !== undefined && (!Number.isInteger(v) || v < 0)) throw new BadRequestException({ code: 'METRIC_INVALID', message: `${k === 'monthlyVisitors' ? 'Monthly visitors' : 'Monthly revenue'} must be a whole, non-negative number.` });
    }
    return {
      title: title.slice(0, 160),
      assetType: input.assetType,
      url,
      summary: input.summary.trim().slice(0, 300),
      description: input.description.trim().slice(0, 10_000),
      askingPriceMinor: BigInt(input.askingPriceMinor),
      currency,
      monthlyRevenueMinor: input.monthlyRevenueMinor === null || input.monthlyRevenueMinor === undefined ? null : BigInt(input.monthlyRevenueMinor),
      monthlyVisitors: input.monthlyVisitors ?? null,
    };
  }

  private money<T extends { askingPriceMinor: bigint; monthlyRevenueMinor: bigint | null }>(r: T) {
    return { ...r, askingPriceMinor: money(r.askingPriceMinor)!, monthlyRevenueMinor: money(r.monthlyRevenueMinor) };
  }

  private own(r: { id: string; title: string; assetType: MarketplaceAssetType; url: string | null; summary: string; askingPriceMinor: bigint; currency: string; monthlyRevenueMinor: bigint | null; monthlyVisitors: number | null; status: MarketplaceListingStatus; reviewNote: string | null; publishedAt: Date | null; createdAt: Date; updatedAt: Date }) {
    return {
      id: r.id,
      title: r.title,
      assetType: r.assetType,
      url: r.url,
      summary: r.summary,
      askingPriceMinor: money(r.askingPriceMinor)!,
      currency: r.currency,
      monthlyRevenueMinor: money(r.monthlyRevenueMinor),
      monthlyVisitors: r.monthlyVisitors,
      status: r.status,
      reviewNote: r.reviewNote,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
