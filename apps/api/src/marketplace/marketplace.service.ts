import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceAssetType, MarketplaceListingKind, MarketplaceListingStatus, MarketplaceUrlVisibility, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { normalizeHost } from '../common/utils/domain';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { detectFileType, DOCUMENT_TYPES, IMAGE_TYPES, VIDEO_TYPES } from '../storage/file-safety';

/** Approved business rule: seller earnings become payable from $50 (V2 guide §1.3). */
export const PAYOUT_THRESHOLD_MINOR = 5_000;

export const LISTING_CATEGORIES = ['SaaS Businesses', 'AI Apps', 'eCommerce Businesses', 'Content Websites', 'Mobile Apps', 'Lead Generation', 'Online Courses', 'Agencies', 'Templates & Themes', 'eBooks & Guides', 'Plugins & Scripts', 'Graphics & Media', 'Other'];

export type ListingInput = {
  workspaceId?: string;
  kind?: MarketplaceListingKind;
  title: string;
  assetType: MarketplaceAssetType;
  category?: string | null;
  stage?: string | null;
  url?: string | null;
  urlVisibility?: MarketplaceUrlVisibility;
  location?: string | null;
  language?: string | null;
  summary: string;
  description: string;
  askingPriceMinor: number;
  currency?: string;
  monthlyRevenueMinor?: number | null;
  monthlyVisitors?: number | null;
  aiGenerated?: boolean;
  aiDisclosure?: string | null;
  licenseTerms?: string | null;
  highlights?: string[] | null;
};

export type BrowseFilters = { q?: string; assetType?: MarketplaceAssetType; kind?: MarketplaceListingKind; category?: string; minPrice?: number; maxPrice?: number; sort?: 'newest' | 'price_asc' | 'price_desc'; page?: number };

const EDITABLE: MarketplaceListingStatus[] = ['DRAFT', 'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED', 'PENDING_REVIEW', 'WITHDRAWN'];
const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
const DELIVERABLE_TYPES = [...DOCUMENT_TYPES, ...IMAGE_TYPES, ...VIDEO_TYPES, 'application/zip'];
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const num = (v: bigint | null | undefined) => (v === null || v === undefined ? null : Number(v));

type ListingRow = Prisma.MarketplaceListingGetPayload<object>;

/**
 * Marketplace listings, saved listings, introductions, messages and listing
 * moderation (V2 guide §1–§3). Only PUBLISHED listings are visible to others;
 * AI screening never approves a listing — a staff decision is always recorded.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly storage: ContentStorageService,
  ) {}

  /** The user's first workspace: marketplace records need one for ownership and notifications. */
  async defaultWorkspace(userId: string, preferred?: string) {
    if (preferred) {
      await this.rbac.requireWorkspace(userId, preferred, 'project.read');
      return preferred;
    }
    const m = await this.prisma.workspaceMembership.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' }, select: { workspaceId: true } });
    if (!m) throw new BadRequestException({ code: 'NO_WORKSPACE', message: 'Finish setting up your account first.' });
    return m.workspaceId;
  }

  notify(workspaceId: string, userId: string, eventKey: string, title: string, body: string) {
    void this.notifications.notify({ workspaceId, userId, eventKey, title, body }).catch(() => undefined);
  }

  // ── Dashboards ──────────────────────────────────────────────────────────

  async summary(userId: string) {
    const [listings, intros, unread, offersIn, offersOut, saved, sentInquiries, orders, entitlements, deals, seller, published] = await Promise.all([
      this.prisma.marketplaceListing.groupBy({ by: ['status'], where: { sellerId: userId }, _count: true }),
      this.prisma.marketplaceInquiry.count({ where: { listing: { sellerId: userId }, status: { not: 'CLOSED' }, introStatus: 'PENDING' } }),
      this.prisma.marketplaceMessage.count({ where: { readAt: null, senderId: { not: userId }, inquiry: { OR: [{ buyerId: userId }, { listing: { sellerId: userId } }] } } }),
      this.prisma.marketplaceOffer.count({ where: { sellerId: userId, status: { in: ['SUBMITTED', 'COUNTERED'] } } }),
      this.prisma.marketplaceOffer.count({ where: { buyerId: userId, status: { in: ['SUBMITTED', 'COUNTERED'] } } }),
      this.prisma.marketplaceSavedListing.count({ where: { userId } }),
      this.prisma.marketplaceInquiry.count({ where: { buyerId: userId, status: { not: 'CLOSED' } } }),
      this.prisma.marketplaceOrder.count({ where: { buyerId: userId, status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } }),
      this.prisma.marketplaceDownloadEntitlement.count({ where: { buyerId: userId, status: 'ACTIVE', order: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } } }),
      this.prisma.marketplaceTransaction.count({ where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: ['AGREEMENT_PENDING', 'DUE_DILIGENCE', 'TRANSFER_IN_PROGRESS'] } } }),
      this.prisma.sellerProfile.findUnique({ where: { userId } }),
      this.prisma.marketplaceListing.count({ where: { status: 'PUBLISHED' } }),
    ]);
    const byStatus = Object.fromEntries(listings.map((l) => [l.status, l._count])) as Partial<Record<MarketplaceListingStatus, number>>;
    const views = await this.prisma.marketplaceListing.aggregate({ where: { sellerId: userId }, _sum: { viewCount: true } });
    return {
      marketplace: { publishedListings: published },
      buyer: { saved, activeInquiries: sentInquiries, activeOffers: offersOut, purchases: orders, downloads: entitlements, activeTransactions: deals, unreadMessages: unread },
      seller: {
        enabled: !!seller,
        status: seller?.status ?? null,
        verification: seller ? { identity: seller.identityStatus, business: seller.businessStatus, payout: seller.payoutStatus } : null,
        listings: listings.reduce((t, l) => t + l._count, 0),
        byStatus,
        listingViews: views._sum.viewCount ?? 0,
        pendingIntroductions: intros,
        activeOffers: offersIn,
        payoutThresholdMinor: PAYOUT_THRESHOLD_MINOR,
      },
    };
  }

  // ── Browse (public) ─────────────────────────────────────────────────────

  async browse(filters: BrowseFilters, viewerId?: string) {
    const take = 24;
    const page = Math.max(1, Math.min(filters.page ?? 1, 500));
    const q = filters.q?.trim();
    const price: Prisma.BigIntFilter = {};
    if (filters.minPrice !== undefined) price.gte = BigInt(filters.minPrice);
    if (filters.maxPrice !== undefined) price.lte = BigInt(filters.maxPrice);
    const where: Prisma.MarketplaceListingWhereInput = {
      status: 'PUBLISHED',
      ...(filters.assetType ? { assetType: filters.assetType } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(Object.keys(price).length ? { askingPriceMinor: price } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy: Prisma.MarketplaceListingOrderByWithRelationInput = filters.sort === 'price_asc' ? { askingPriceMinor: 'asc' } : filters.sort === 'price_desc' ? { askingPriceMinor: 'desc' } : { publishedAt: 'desc' };
    const [rows, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({ where, orderBy, take, skip: (page - 1) * take, include: { files: { where: { role: 'MEDIA' }, take: 1, orderBy: { createdAt: 'asc' } } } }),
      this.prisma.marketplaceListing.count({ where }),
    ]);
    const savedIds = viewerId ? new Set((await this.prisma.marketplaceSavedListing.findMany({ where: { userId: viewerId, listingId: { in: rows.map((r) => r.id) } }, select: { listingId: true } })).map((s) => s.listingId)) : new Set<string>();
    const sellers = await this.sellerNames(rows.map((r) => r.sellerId));
    return { items: rows.map((r) => ({ ...this.card(r), cover: r.files[0] ? `/marketplace/media/${r.files[0].id}` : null, seller: sellers.get(r.sellerId) ?? null, saved: savedIds.has(r.id) })), total, page, pageSize: take };
  }

  /**
   * A published listing (or the viewer's own). The website address follows the
   * seller's visibility choice; confidential fields never leave the API.
   */
  async listing(viewerId: string | null, idOrSlug: string) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const l = await this.prisma.marketplaceListing.findFirst({ where: isUuid ? { id: idOrSlug } : { slug: idOrSlug }, include: { files: { orderBy: { createdAt: 'asc' } } } });
    const own = !!viewerId && l?.sellerId === viewerId;
    if (!l || (l.status !== 'PUBLISHED' && !own)) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (!own) await this.prisma.marketplaceListing.update({ where: { id: l.id }, data: { viewCount: { increment: 1 } } });

    const [inquiry, deal, saved, order, offer] = viewerId && !own
      ? await Promise.all([
          this.prisma.marketplaceInquiry.findFirst({ where: { listingId: l.id, buyerId: viewerId }, orderBy: { createdAt: 'desc' } }),
          this.prisma.marketplaceTransaction.findFirst({ where: { listingId: l.id, buyerId: viewerId, status: { in: ['DUE_DILIGENCE', 'TRANSFER_IN_PROGRESS', 'COMPLETED'] } } }),
          this.prisma.marketplaceSavedListing.findUnique({ where: { userId_listingId: { userId: viewerId, listingId: l.id } } }),
          this.prisma.marketplaceOrder.findFirst({ where: { listingId: l.id, buyerId: viewerId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }, select: { id: true } }),
          this.prisma.marketplaceOffer.findFirst({ where: { listingId: l.id, buyerId: viewerId, status: { in: ['SUBMITTED', 'COUNTERED', 'ACCEPTED'] } }, select: { id: true, status: true } }),
        ])
      : [null, null, null, null, null];
    const urlVisible = own || l.urlVisibility === 'PUBLIC' || (l.urlVisibility === 'AFTER_INTRODUCTION' && inquiry?.introStatus === 'APPROVED') || (l.urlVisibility === 'AFTER_DILIGENCE' && !!deal);
    const seller = await this.publicSeller(l.sellerId);
    const deliverables = l.files.filter((f) => f.role === 'DELIVERABLE');
    return {
      ...this.card(l),
      url: urlVisible ? l.url : null,
      urlHidden: !urlVisible && !!l.url,
      description: l.description,
      location: l.location,
      language: l.language,
      licenseTerms: l.licenseTerms,
      aiGenerated: l.aiGenerated,
      aiDisclosure: l.aiDisclosure,
      highlights: Array.isArray(l.highlights) ? l.highlights : [],
      media: l.files.filter((f) => f.role === 'MEDIA').map((f) => ({ id: f.id, url: `/marketplace/media/${f.id}`, contentType: f.contentType, filename: f.filename })),
      deliverables: deliverables.map((f) => ({ filename: f.filename, sizeBytes: f.sizeBytes, contentType: f.contentType })),
      seller,
      own,
      ...(own ? { status: l.status, reviewNote: l.reviewNote, viewCount: l.viewCount } : {}),
      viewer: viewerId && !own ? { saved: !!saved, inquiry: inquiry ? { id: inquiry.id, status: inquiry.status, introStatus: inquiry.introStatus } : null, purchasedOrderId: order?.id ?? null, offer } : null,
    };
  }

  async publicSeller(sellerUserId: string) {
    const p = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!p) return null;
    const [live, sold] = await Promise.all([
      this.prisma.marketplaceListing.count({ where: { sellerId: sellerUserId, status: 'PUBLISHED' } }),
      this.prisma.marketplaceListing.count({ where: { sellerId: sellerUserId, status: 'SOLD' } }),
    ]);
    return {
      id: p.id,
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      website: p.website,
      location: p.location,
      memberSince: p.createdAt,
      // Each check is shown separately; "verified" is never a single blended label.
      checks: { identity: p.identityStatus === 'APPROVED', business: p.businessStatus === 'APPROVED' },
      liveListings: live,
      soldListings: sold,
    };
  }

  async sellerPage(profileId: string) {
    const p = await this.prisma.sellerProfile.findUnique({ where: { id: profileId } });
    if (!p || p.status === 'SUSPENDED') throw new NotFoundException({ code: 'SELLER_NOT_FOUND', message: 'Seller not found.' });
    const listings = await this.prisma.marketplaceListing.findMany({ where: { sellerId: p.userId, status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 48 });
    return { seller: await this.publicSeller(p.userId), listings: listings.map((r) => this.card(r)) };
  }

  async mediaFile(fileId: string, viewerId: string | null) {
    const f = await this.prisma.marketplaceListingFile.findUnique({ where: { id: fileId }, include: { listing: { select: { status: true, sellerId: true } } } });
    if (!f || f.role !== 'MEDIA' || (f.listing.status !== 'PUBLISHED' && f.listing.sellerId !== viewerId)) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    const signed = await this.storage.signedUrl(f.storageKey, { filename: f.filename, contentType: f.contentType, inline: true });
    if (signed) return { signedUrl: signed.url };
    const body = await this.storage.readBuffer(f.storageKey);
    if (!body) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    return { body, contentType: f.contentType, filename: f.filename };
  }

  // ── Selling ─────────────────────────────────────────────────────────────

  async createListing(userId: string, input: ListingInput) {
    const workspaceId = await this.defaultWorkspace(userId, input.workspaceId);
    const data = this.validate(input);
    const row = await this.prisma.marketplaceListing.create({ data: { ...data, sellerId: userId, workspaceId, status: 'DRAFT', slug: this.slug(data.title) } });
    await this.audit.record({ actorUserId: userId, workspaceId, action: 'marketplace.listing.create', targetType: 'marketplace_listing', targetId: row.id, afterState: { title: row.title, kind: row.kind } });
    return this.own(row);
  }

  async myListings(userId: string, status?: MarketplaceListingStatus) {
    const rows = await this.prisma.marketplaceListing.findMany({
      where: { sellerId: userId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { inquiries: true, offers: true, saves: true, files: true } } },
    });
    return rows.map((r) => ({ ...this.own(r), inquiries: r._count.inquiries, offers: r._count.offers, saves: r._count.saves, files: r._count.files }));
  }

  async myListing(userId: string, id: string) {
    const l = await this.ownListing(userId, id);
    const files = await this.prisma.marketplaceListingFile.findMany({ where: { listingId: id }, orderBy: { createdAt: 'asc' } });
    const [inquiries, offers, saves, orders] = await Promise.all([
      this.prisma.marketplaceInquiry.count({ where: { listingId: id } }),
      this.prisma.marketplaceOffer.count({ where: { listingId: id } }),
      this.prisma.marketplaceSavedListing.count({ where: { listingId: id } }),
      this.prisma.marketplaceOrder.count({ where: { listingId: id, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } }),
    ]);
    return {
      ...this.own(l),
      description: l.description,
      location: l.location,
      language: l.language,
      licenseTerms: l.licenseTerms,
      aiGenerated: l.aiGenerated,
      aiDisclosure: l.aiDisclosure,
      highlights: Array.isArray(l.highlights) ? l.highlights : [],
      files: files.map((f) => ({ id: f.id, role: f.role, filename: f.filename, contentType: f.contentType, sizeBytes: f.sizeBytes, createdAt: f.createdAt })),
      analytics: { views: l.viewCount, saves, inquiries, offers, sales: orders },
    };
  }

  /** Editing a live or submitted listing sends it back to review; sold listings are final. */
  async updateListing(userId: string, id: string, input: Partial<ListingInput>) {
    const l = await this.ownListing(userId, id);
    if (!EDITABLE.includes(l.status)) throw new BadRequestException({ code: 'LISTING_LOCKED', message: 'This listing can no longer be changed.' });
    const current: ListingInput = {
      kind: l.kind,
      title: l.title,
      assetType: l.assetType,
      category: l.category,
      stage: l.stage,
      url: l.url,
      urlVisibility: l.urlVisibility,
      location: l.location,
      language: l.language,
      summary: l.summary,
      description: l.description,
      askingPriceMinor: Number(l.askingPriceMinor),
      currency: l.currency,
      monthlyRevenueMinor: num(l.monthlyRevenueMinor),
      monthlyVisitors: l.monthlyVisitors,
      aiGenerated: l.aiGenerated,
      aiDisclosure: l.aiDisclosure,
      licenseTerms: l.licenseTerms,
      highlights: Array.isArray(l.highlights) ? (l.highlights as string[]) : null,
    };
    const data = this.validate({ ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } as ListingInput);
    const resubmit = l.status === 'PUBLISHED' || l.status === 'PENDING_REVIEW';
    const row = await this.prisma.marketplaceListing.update({ where: { id }, data: { ...data, ...(resubmit ? { status: 'PENDING_REVIEW', submittedAt: new Date(), publishedAt: null } : {}) } });
    await this.audit.record({ actorUserId: userId, workspaceId: l.workspaceId, action: 'marketplace.listing.update', targetType: 'marketplace_listing', targetId: id, afterState: { resubmitted: resubmit } });
    return this.own(row);
  }

  /** Submit for staff review. Requires a seller profile with identity verification at least submitted. */
  async submitListing(userId: string, id: string) {
    const l = await this.ownListing(userId, id);
    if (!['DRAFT', 'CHANGES_REQUESTED', 'REJECTED', 'WITHDRAWN'].includes(l.status)) throw new BadRequestException({ code: 'NOT_SUBMITTABLE', message: 'This listing is already submitted or live.' });
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) throw new ForbiddenException({ code: 'SELLER_PROFILE_REQUIRED', message: 'Create your seller profile before submitting a listing.' });
    if (seller.status === 'SUSPENDED') throw new ForbiddenException({ code: 'SELLER_SUSPENDED', message: 'Your seller account is suspended.' });
    if (seller.identityStatus === 'NOT_STARTED' || seller.identityStatus === 'REJECTED') throw new ForbiddenException({ code: 'IDENTITY_VERIFICATION_REQUIRED', message: 'Submit identity verification before listing.' });
    if (l.kind === 'DIGITAL_PRODUCT') {
      const files = await this.prisma.marketplaceListingFile.count({ where: { listingId: id, role: 'DELIVERABLE' } });
      if (!files) throw new BadRequestException({ code: 'DELIVERABLE_REQUIRED', message: 'Upload at least one file the buyer will receive.' });
      if (!l.licenseTerms?.trim()) throw new BadRequestException({ code: 'LICENSE_REQUIRED', message: 'Describe the licence the buyer receives.' });
    }
    if (l.aiGenerated && !l.aiDisclosure?.trim()) throw new BadRequestException({ code: 'AI_DISCLOSURE_REQUIRED', message: 'Explain which parts were created with AI.' });
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.marketplaceListing.update({ where: { id }, data: { status: 'PENDING_REVIEW', submittedAt: new Date(), reviewNote: null } });
      // Business listings carry an ownership check that staff decide separately.
      if (l.kind === 'BUSINESS' && l.url) {
        const open = await tx.sellerVerificationCase.findFirst({ where: { listingId: id, kind: 'OWNERSHIP', status: { in: ['PENDING', 'APPROVED'] } } });
        if (!open) await tx.sellerVerificationCase.create({ data: { sellerProfileId: seller.id, listingId: id, kind: 'OWNERSHIP', status: 'PENDING', details: { url: l.url } } });
      }
      return updated;
    });
    await this.audit.record({ actorUserId: userId, workspaceId: l.workspaceId, action: 'marketplace.listing.submit', targetType: 'marketplace_listing', targetId: id });
    return this.own(row);
  }

  async withdrawListing(userId: string, id: string) {
    const l = await this.ownListing(userId, id);
    if (l.status === 'SOLD') throw new BadRequestException({ code: 'LISTING_SOLD', message: 'Sold listings cannot be changed.' });
    const row = await this.prisma.marketplaceListing.update({ where: { id }, data: { status: 'WITHDRAWN', publishedAt: null } });
    await this.audit.record({ actorUserId: userId, workspaceId: l.workspaceId, action: 'marketplace.listing.withdraw', targetType: 'marketplace_listing', targetId: id });
    return this.own(row);
  }

  async deleteDraft(userId: string, id: string) {
    const l = await this.ownListing(userId, id);
    if (l.status !== 'DRAFT') throw new BadRequestException({ code: 'NOT_DRAFT', message: 'Only drafts can be deleted. Withdraw the listing instead.' });
    const files = await this.prisma.marketplaceListingFile.findMany({ where: { listingId: id } });
    await this.prisma.marketplaceListing.delete({ where: { id } });
    await Promise.all(files.map((f) => this.storage.delete(f.storageKey).catch(() => undefined)));
    return { deleted: true };
  }

  async uploadFile(userId: string, id: string, role: string, file: { buffer: Buffer; originalname: string; size: number } | undefined) {
    const l = await this.ownListing(userId, id);
    if (!EDITABLE.includes(l.status)) throw new BadRequestException({ code: 'LISTING_LOCKED', message: 'This listing can no longer be changed.' });
    if (role !== 'MEDIA' && role !== 'DELIVERABLE') throw new BadRequestException({ code: 'ROLE_INVALID', message: 'Unknown file role.' });
    if (role === 'DELIVERABLE' && l.kind !== 'DIGITAL_PRODUCT') throw new BadRequestException({ code: 'NOT_DIGITAL', message: 'Only digital products have downloadable files.' });
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Choose a file.' });
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Files can be up to 50 MB.' });
    let type = detectFileType(file.buffer, role === 'MEDIA' ? MEDIA_TYPES : DELIVERABLE_TYPES);
    // DOCX and ZIP share a container signature; trust the name only to tell them apart.
    if (type?.ext === 'docx' && /\.zip$/i.test(file.originalname)) type = { mime: 'application/zip', ext: 'zip' };
    if (!type) throw new BadRequestException({ code: 'FILE_TYPE', message: role === 'MEDIA' ? 'Use a PNG, JPEG, GIF, WebP, MP4 or WebM file.' : 'Use a PDF, ZIP, Word, image or video file.' });
    const count = await this.prisma.marketplaceListingFile.count({ where: { listingId: id, role } });
    if (count >= 20) throw new BadRequestException({ code: 'TOO_MANY_FILES', message: 'A listing can have up to 20 files of each kind.' });
    const key = `marketplace/${role === 'MEDIA' ? 'media' : 'deliverables'}/${id}/${randomBytes(12).toString('hex')}.${type.ext}`;
    await this.storage.writeBuffer(key, file.buffer, type.mime);
    const filename = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 160) || `file.${type.ext}`;
    const row = await this.prisma.marketplaceListingFile.create({ data: { listingId: id, role, storageKey: key, filename, contentType: type.mime, sizeBytes: file.size } });
    // A live listing with new material goes back to review.
    if (l.status === 'PUBLISHED') await this.prisma.marketplaceListing.update({ where: { id }, data: { status: 'PENDING_REVIEW', submittedAt: new Date(), publishedAt: null } });
    return { id: row.id, role: row.role, filename: row.filename, contentType: row.contentType, sizeBytes: row.sizeBytes };
  }

  async deleteFile(userId: string, listingId: string, fileId: string) {
    await this.ownListing(userId, listingId);
    const f = await this.prisma.marketplaceListingFile.findFirst({ where: { id: fileId, listingId }, include: { _count: { select: { entitlements: true } } } });
    if (!f) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    // Buyers keep access to what they paid for.
    if (f._count.entitlements) throw new BadRequestException({ code: 'FILE_PURCHASED', message: 'Buyers have purchased this file, so it cannot be removed.' });
    await this.prisma.marketplaceListingFile.delete({ where: { id: fileId } });
    await this.storage.delete(f.storageKey).catch(() => undefined);
    return { deleted: true };
  }

  // ── Saved listings ──────────────────────────────────────────────────────

  async save(userId: string, listingId: string, saved: boolean) {
    if (saved) {
      const l = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId }, select: { status: true } });
      if (!l || l.status !== 'PUBLISHED') throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
      await this.prisma.marketplaceSavedListing.upsert({ where: { userId_listingId: { userId, listingId } }, create: { userId, listingId }, update: {} });
    } else {
      await this.prisma.marketplaceSavedListing.deleteMany({ where: { userId, listingId } });
    }
    return { saved };
  }

  async savedListings(userId: string) {
    const rows = await this.prisma.marketplaceSavedListing.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { listing: true } });
    return rows.map((r) => ({ savedAt: r.createdAt, available: r.listing.status === 'PUBLISHED', listing: this.card(r.listing) }));
  }

  // ── Introductions, inquiries and messages ───────────────────────────────

  /**
   * Business listings: an introduction request the seller approves before
   * messaging opens. Digital products: a question, answered directly.
   */
  async inquire(userId: string, listingId: string, input: { workspaceId?: string; message: string; buyerRole?: string; budget?: string }) {
    const workspaceId = await this.defaultWorkspace(userId, input.workspaceId);
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!l || l.status !== 'PUBLISHED') throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.sellerId === userId) throw new BadRequestException({ code: 'OWN_LISTING', message: 'You cannot send an inquiry about your own listing.' });
    const message = input.message.trim();
    if (message.length < 10) throw new BadRequestException({ code: 'MESSAGE_TOO_SHORT', message: 'Please write at least 10 characters.' });
    const open = await this.prisma.marketplaceInquiry.findFirst({ where: { listingId, buyerId: userId, status: { not: 'CLOSED' } } });
    if (open) throw new BadRequestException({ code: 'INQUIRY_EXISTS', message: 'You already have an open inquiry for this listing.' });
    const row = await this.prisma.marketplaceInquiry.create({
      data: { listingId, buyerId: userId, workspaceId, message, buyerRole: input.buyerRole?.trim().slice(0, 80) || null, budget: input.budget?.trim().slice(0, 80) || null, introStatus: l.kind === 'DIGITAL_PRODUCT' ? 'APPROVED' : 'PENDING' },
    });
    this.notify(l.workspaceId, l.sellerId, 'marketplace.inquiry', l.kind === 'BUSINESS' ? 'New introduction request' : 'New marketplace question', `A buyer asked about “${l.title}”.`);
    return row;
  }

  async inquiries(userId: string, role: 'received' | 'sent') {
    const where: Prisma.MarketplaceInquiryWhereInput = role === 'received' ? { listing: { sellerId: userId } } : { buyerId: userId };
    const rows = await this.prisma.marketplaceInquiry.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { listing: { select: { id: true, title: true, status: true, kind: true } }, buyer: { select: { displayName: true } }, _count: { select: { messages: true } } },
    });
    // Buyers' email addresses are not shared; sellers see a display name only.
    return rows.map((r) => ({
      id: r.id,
      listing: r.listing,
      message: r.message,
      reply: r.reply,
      repliedAt: r.repliedAt,
      status: r.status,
      introStatus: r.introStatus,
      buyerRole: r.buyerRole,
      budget: r.budget,
      messages: r._count.messages,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      from: role === 'received' ? (r.buyer.displayName ?? 'A buyer') : undefined,
    }));
  }

  private async participantInquiry(userId: string, id: string) {
    const r = await this.prisma.marketplaceInquiry.findUnique({ where: { id }, include: { listing: true, buyer: { select: { displayName: true } } } });
    if (!r || (r.buyerId !== userId && r.listing.sellerId !== userId)) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });
    return r;
  }

  async thread(userId: string, id: string) {
    const r = await this.participantInquiry(userId, id);
    const isSeller = r.listing.sellerId === userId;
    const messages = await this.prisma.marketplaceMessage.findMany({ where: { inquiryId: id }, orderBy: { createdAt: 'asc' }, take: 500 });
    await this.prisma.marketplaceMessage.updateMany({ where: { inquiryId: id, senderId: { not: userId }, readAt: null }, data: { readAt: new Date() } });
    const seller = await this.publicSeller(r.listing.sellerId);
    const offers = await this.prisma.marketplaceOffer.findMany({ where: { inquiryId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, amountMinor: true, currency: true, version: true } });
    return {
      id: r.id,
      role: isSeller ? 'SELLER' : 'BUYER',
      listing: { id: r.listing.id, title: r.listing.title, kind: r.listing.kind, status: r.listing.status, askingPriceMinor: Number(r.listing.askingPriceMinor), currency: r.listing.currency },
      counterpart: isSeller ? (r.buyer.displayName ?? 'Buyer') : (seller?.displayName ?? 'Seller'),
      message: r.message,
      buyerRole: r.buyerRole,
      budget: r.budget,
      reply: r.reply,
      status: r.status,
      introStatus: r.introStatus,
      canMessage: r.introStatus === 'APPROVED' && r.status !== 'CLOSED',
      createdAt: r.createdAt,
      offers: offers.map((o) => ({ ...o, amountMinor: Number(o.amountMinor) })),
      messages: messages.map((m) => ({ id: m.id, mine: m.senderId === userId, body: m.body, createdAt: m.createdAt, readAt: m.readAt })),
    };
  }

  async decideIntroduction(userId: string, id: string, approve: boolean, note?: string) {
    const r = await this.participantInquiry(userId, id);
    if (r.listing.sellerId !== userId) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });
    if (r.introStatus !== 'PENDING') throw new BadRequestException({ code: 'ALREADY_DECIDED', message: 'This introduction has already been answered.' });
    const row = await this.prisma.marketplaceInquiry.update({ where: { id }, data: { introStatus: approve ? 'APPROVED' : 'DECLINED', ...(approve ? {} : { status: 'CLOSED' }), reply: note?.trim() || r.reply, repliedAt: new Date() } });
    if (approve && note?.trim()) await this.prisma.marketplaceMessage.create({ data: { inquiryId: id, senderId: userId, body: note.trim().slice(0, 4000) } });
    this.notify(r.workspaceId, r.buyerId, 'marketplace.inquiry_reply', approve ? 'Introduction approved' : 'Introduction declined', approve ? `The seller of “${r.listing.title}” accepted your introduction. You can now message them.` : `The seller of “${r.listing.title}” declined your introduction.`);
    await this.audit.record({ actorUserId: userId, workspaceId: r.listing.workspaceId, action: approve ? 'marketplace.intro.approve' : 'marketplace.intro.decline', targetType: 'marketplace_inquiry', targetId: id });
    return row;
  }

  /** Messaging opens only after an approved introduction (V2 guide §3.6). */
  async sendMessage(userId: string, id: string, body: string) {
    const r = await this.participantInquiry(userId, id);
    if (r.introStatus !== 'APPROVED') throw new ForbiddenException({ code: 'INTRO_NOT_APPROVED', message: 'Messaging opens once the seller accepts the introduction.' });
    if (r.status === 'CLOSED') throw new BadRequestException({ code: 'INQUIRY_CLOSED', message: 'This conversation is closed.' });
    const text = body.trim();
    if (text.length < 1) throw new BadRequestException({ code: 'MESSAGE_EMPTY', message: 'Write a message.' });
    const recent = await this.prisma.marketplaceMessage.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
    if (recent >= 20) throw new BadRequestException({ code: 'SLOW_DOWN', message: 'You are sending messages too quickly.' });
    const isSeller = r.listing.sellerId === userId;
    const msg = await this.prisma.marketplaceMessage.create({ data: { inquiryId: id, senderId: userId, body: text.slice(0, 4000) } });
    await this.prisma.marketplaceInquiry.update({ where: { id }, data: isSeller ? { status: 'REPLIED', reply: r.reply ?? text.slice(0, 4000), repliedAt: r.repliedAt ?? new Date() } : { updatedAt: new Date() } });
    if (isSeller) this.notify(r.workspaceId, r.buyerId, 'marketplace.inquiry_reply', 'New message from the seller', `About “${r.listing.title}”.`);
    else this.notify(r.listing.workspaceId, r.listing.sellerId, 'marketplace.inquiry', 'New message from a buyer', `About “${r.listing.title}”.`);
    return { id: msg.id, mine: true, body: msg.body, createdAt: msg.createdAt };
  }

  /** Legacy single reply: kept as a message in the thread. */
  async reply(userId: string, id: string, message: string) {
    const r = await this.participantInquiry(userId, id);
    if (r.listing.sellerId !== userId) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND', message: 'Inquiry not found.' });
    if (r.introStatus === 'PENDING') await this.decideIntroduction(userId, id, true, message);
    else await this.sendMessage(userId, id, message);
    return this.prisma.marketplaceInquiry.findUniqueOrThrow({ where: { id } });
  }

  async closeInquiry(userId: string, id: string) {
    await this.participantInquiry(userId, id);
    return this.prisma.marketplaceInquiry.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async conversations(userId: string) {
    const rows = await this.prisma.marketplaceInquiry.findMany({
      where: { introStatus: 'APPROVED', OR: [{ buyerId: userId }, { listing: { sellerId: userId } }] },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { listing: { select: { id: true, title: true, sellerId: true } }, buyer: { select: { displayName: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const unread = await this.prisma.marketplaceMessage.groupBy({ by: ['inquiryId'], where: { inquiryId: { in: rows.map((r) => r.id) }, senderId: { not: userId }, readAt: null }, _count: true });
    const unreadMap = new Map(unread.map((u) => [u.inquiryId, u._count]));
    const sellers = await this.sellerNames(rows.map((r) => r.listing.sellerId));
    return rows.map((r) => {
      const isSeller = r.listing.sellerId === userId;
      return {
        id: r.id,
        listing: { id: r.listing.id, title: r.listing.title },
        role: isSeller ? 'SELLER' : 'BUYER',
        counterpart: isSeller ? (r.buyer.displayName ?? 'Buyer') : (sellers.get(r.listing.sellerId)?.displayName ?? 'Seller'),
        status: r.status,
        lastMessage: r.messages[0] ? { body: r.messages[0].body.slice(0, 160), createdAt: r.messages[0].createdAt, mine: r.messages[0].senderId === userId } : null,
        unread: unreadMap.get(r.id) ?? 0,
        updatedAt: r.updatedAt,
      };
    });
  }

  // ── Admin moderation ────────────────────────────────────────────────────

  async adminOverview(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const [sellers, active, pendingListings, pendingChecks, completedDeals, paidOrders, payouts, openCases] = await Promise.all([
      this.prisma.sellerProfile.count(),
      this.prisma.marketplaceListing.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.marketplaceListing.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.sellerVerificationCase.count({ where: { status: 'PENDING' } }),
      this.prisma.marketplaceTransaction.count({ where: { status: 'COMPLETED' } }),
      this.prisma.marketplaceOrder.count({ where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } }),
      this.prisma.sellerPayout.aggregate({ where: { status: 'PAID' }, _count: true, _sum: { amountMinor: true } }),
      this.prisma.marketplaceCase.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);
    const [recentChecks, recentListings, recentOrders, recentPayouts] = await Promise.all([
      this.prisma.sellerVerificationCase.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 5, include: { seller: { select: { displayName: true } } } }),
      this.prisma.marketplaceListing.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { submittedAt: 'desc' }, take: 5, include: { seller: { select: { displayName: true, email: true } } } }),
      this.prisma.marketplaceOrder.findMany({ where: { status: { not: 'PENDING_PAYMENT' } }, orderBy: { createdAt: 'desc' }, take: 5, include: { listing: { select: { title: true } }, buyer: { select: { displayName: true } }, seller: { select: { displayName: true } } } }),
      this.prisma.sellerPayout.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { seller: { select: { displayName: true, email: true } } } }),
    ]);
    return {
      totals: { sellers, activeListings: active, pendingReview: pendingListings + pendingChecks, completedTransactions: completedDeals + paidOrders, payoutsProcessed: payouts._count, payoutsMinor: num(payouts._sum.amountMinor) ?? 0, openCases },
      recentChecks: recentChecks.map((c) => ({ id: c.id, kind: c.kind, seller: c.seller.displayName, status: c.status, createdAt: c.createdAt })),
      recentListings: recentListings.map((l) => ({ id: l.id, title: l.title, kind: l.kind, category: l.category, seller: l.seller.displayName ?? l.seller.email, submittedAt: l.submittedAt })),
      recentOrders: recentOrders.map((o) => ({ id: o.id, listing: o.listing.title, buyer: o.buyer.displayName, seller: o.seller.displayName, amountMinor: Number(o.amountMinor), currency: o.currency, status: o.status, createdAt: o.createdAt })),
      recentPayouts: recentPayouts.map((p) => ({ id: p.id, seller: p.seller.displayName ?? p.seller.email, amountMinor: Number(p.amountMinor), currency: p.currency, status: p.status, createdAt: p.createdAt })),
    };
  }

  async adminList(userId: string, status?: MarketplaceListingStatus) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const rows = await this.prisma.marketplaceListing.findMany({
      where: status ? { status } : { status: { not: 'DRAFT' } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { seller: { select: { email: true, displayName: true, sellerProfile: { select: { id: true, identityStatus: true, businessStatus: true } } } }, files: { select: { id: true, role: true, filename: true, sizeBytes: true } }, verifications: { select: { id: true, kind: true, status: true } } },
    });
    return rows.map((r) => ({
      ...this.own(r),
      description: r.description,
      licenseTerms: r.licenseTerms,
      aiGenerated: r.aiGenerated,
      aiDisclosure: r.aiDisclosure,
      seller: { email: r.seller.email, displayName: r.seller.displayName, profileId: r.seller.sellerProfile?.id ?? null, identity: r.seller.sellerProfile?.identityStatus ?? 'NOT_STARTED', business: r.seller.sellerProfile?.businessStatus ?? 'NOT_STARTED' },
      files: r.files,
      checks: r.verifications,
    }));
  }

  /** Staff decision: approve (publish), request changes or reject. Each needs a human; notes required unless approving. */
  async review(userId: string, id: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', note?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id } });
    if (!l) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.status !== 'PENDING_REVIEW') throw new BadRequestException({ code: 'NOT_PENDING', message: 'Only listings waiting for review can be decided.' });
    if (decision !== 'APPROVE' && !note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give the seller a reason.' });
    if (decision === 'APPROVE') {
      const seller = await this.prisma.sellerProfile.findUnique({ where: { userId: l.sellerId } });
      if (seller?.identityStatus !== 'APPROVED') throw new BadRequestException({ code: 'SELLER_NOT_VERIFIED', message: "Approve the seller's identity verification before publishing their listing." });
      if (seller.status === 'SUSPENDED') throw new BadRequestException({ code: 'SELLER_SUSPENDED', message: 'This seller is suspended.' });
    }
    const status: MarketplaceListingStatus = decision === 'APPROVE' ? 'PUBLISHED' : decision === 'REQUEST_CHANGES' ? 'CHANGES_REQUESTED' : 'REJECTED';
    const row = await this.prisma.marketplaceListing.update({
      where: { id },
      data: { status, reviewNote: note?.trim() || null, reviewedBy: userId, reviewedAt: new Date(), publishedAt: status === 'PUBLISHED' ? new Date() : null },
    });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', workspaceId: l.workspaceId, action: `marketplace.listing.${decision.toLowerCase()}`, targetType: 'marketplace_listing', targetId: id, afterState: { note: note ?? null } });
    const title = status === 'PUBLISHED' ? 'Your listing is live' : status === 'CHANGES_REQUESTED' ? 'Changes requested on your listing' : 'Your listing was not approved';
    this.notify(l.workspaceId, l.sellerId, 'marketplace.listing_reviewed', title, status === 'PUBLISHED' ? `“${l.title}” is now visible in the Marketplace.` : `“${l.title}”: ${note}`);
    return this.own(row);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async ownListing(userId: string, id: string) {
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id } });
    if (!l || l.sellerId !== userId) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    return l;
  }

  async sellerNames(userIds: string[]) {
    const profiles = await this.prisma.sellerProfile.findMany({ where: { userId: { in: [...new Set(userIds)] } }, select: { id: true, userId: true, displayName: true, identityStatus: true } });
    return new Map(profiles.map((p) => [p.userId, { id: p.id, displayName: p.displayName, identityVerified: p.identityStatus === 'APPROVED' }]));
  }

  private slug(title: string) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'listing';
    return `${base}-${randomBytes(3).toString('hex')}`;
  }

  validate(input: ListingInput) {
    const title = input.title?.trim();
    if (!title || title.length < 5) throw new BadRequestException({ code: 'TITLE_REQUIRED', message: 'Give the listing a title of at least 5 characters.' });
    let url: string | null = null;
    if (input.url?.trim()) {
      const host = normalizeHost(input.url);
      if (!host) throw new BadRequestException({ code: 'URL_INVALID', message: 'Enter a valid public website address.' });
      url = `https://${host}`;
    }
    if (!Number.isInteger(input.askingPriceMinor) || input.askingPriceMinor < 100) throw new BadRequestException({ code: 'PRICE_INVALID', message: 'Price must be at least 1.00.' });
    const currency = (input.currency ?? 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException({ code: 'CURRENCY_INVALID', message: 'Use a 3-letter currency code.' });
    for (const [k, v] of [['monthlyRevenueMinor', input.monthlyRevenueMinor], ['monthlyVisitors', input.monthlyVisitors]] as const) {
      if (v !== null && v !== undefined && (!Number.isInteger(v) || v < 0)) throw new BadRequestException({ code: 'METRIC_INVALID', message: `${k === 'monthlyVisitors' ? 'Monthly visitors' : 'Monthly revenue'} must be a whole, non-negative number.` });
    }
    if (input.category && !LISTING_CATEGORIES.includes(input.category)) throw new BadRequestException({ code: 'CATEGORY_INVALID', message: 'Choose a category from the list.' });
    const highlights = (input.highlights ?? []).map((h) => String(h).trim().slice(0, 140)).filter(Boolean).slice(0, 8);
    return {
      kind: input.kind ?? 'BUSINESS',
      title: title.slice(0, 120),
      assetType: input.assetType,
      category: input.category ?? null,
      stage: input.stage?.slice(0, 40) ?? null,
      url,
      urlVisibility: input.urlVisibility ?? 'PUBLIC',
      location: input.location?.trim().slice(0, 80) || null,
      language: input.language?.trim().slice(0, 40) || null,
      summary: (input.summary ?? '').trim().slice(0, 300),
      description: (input.description ?? '').trim().slice(0, 10_000),
      askingPriceMinor: BigInt(input.askingPriceMinor),
      currency,
      monthlyRevenueMinor: input.monthlyRevenueMinor === null || input.monthlyRevenueMinor === undefined ? null : BigInt(input.monthlyRevenueMinor),
      monthlyVisitors: input.monthlyVisitors ?? null,
      aiGenerated: !!input.aiGenerated,
      aiDisclosure: input.aiDisclosure?.trim().slice(0, 2000) || null,
      licenseTerms: input.licenseTerms?.trim().slice(0, 5000) || null,
      highlights: highlights.length ? highlights : Prisma.DbNull,
    };
  }

  card(r: ListingRow) {
    return {
      id: r.id,
      slug: r.slug,
      kind: r.kind,
      title: r.title,
      assetType: r.assetType,
      category: r.category,
      stage: r.stage,
      summary: r.summary,
      askingPriceMinor: Number(r.askingPriceMinor),
      currency: r.currency,
      monthlyRevenueMinor: num(r.monthlyRevenueMinor),
      monthlyVisitors: r.monthlyVisitors,
      aiGenerated: r.aiGenerated,
      publishedAt: r.publishedAt,
    };
  }

  own(r: ListingRow) {
    return { ...this.card(r), url: r.url, urlVisibility: r.urlVisibility, status: r.status, reviewNote: r.reviewNote, viewCount: r.viewCount, submittedAt: r.submittedAt, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }
}

