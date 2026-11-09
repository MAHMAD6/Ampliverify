import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceTransactionStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplaceService } from './marketplace.service';

const OPEN_OFFER = ['SUBMITTED', 'COUNTERED'] as const;
const ACTIVE_DEAL: MarketplaceTransactionStatus[] = ['AGREEMENT_PENDING', 'DUE_DILIGENCE', 'TRANSFER_IN_PROGRESS'];

/**
 * Business acquisitions (V2 guide §3.2): offers and counteroffers are
 * versioned (stale updates are rejected), an accepted offer opens a deal that
 * moves through agreement → due diligence → transfer → buyer confirmation.
 * AmpliVerify tracks the deal; it does not hold acquisition funds, and
 * completing a deal never marks the asset as owned in a portfolio by itself.
 */
@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly market: MarketplaceService,
  ) {}

  private view(o: Prisma.MarketplaceOfferGetPayload<{ include: { listing: { select: { id: true; title: true; workspaceId: true } }; revisions: true; transaction: { select: { id: true; status: true } } } }>, userId: string) {
    const role = o.buyerId === userId ? 'BUYER' : 'SELLER';
    return {
      id: o.id,
      role,
      listing: { id: o.listing.id, title: o.listing.title },
      status: o.status,
      version: o.version,
      amountMinor: Number(o.amountMinor),
      currency: o.currency,
      terms: o.terms,
      // The party who did not make the latest move answers it.
      awaitingMe: (OPEN_OFFER as readonly string[]).includes(o.status) && o.lastActorId !== userId,
      inquiryId: o.inquiryId,
      transaction: o.transaction,
      history: o.revisions.sort((a, b) => a.version - b.version || a.createdAt.getTime() - b.createdAt.getTime()).map((r) => ({ version: r.version, action: r.action, amountMinor: Number(r.amountMinor), terms: r.terms, byMe: r.actorId === userId, createdAt: r.createdAt })),
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }

  private include = { listing: { select: { id: true, title: true, workspaceId: true } }, revisions: true, transaction: { select: { id: true, status: true } } } as const;

  async offers(userId: string, role: 'buyer' | 'seller') {
    const rows = await this.prisma.marketplaceOffer.findMany({ where: role === 'buyer' ? { buyerId: userId } : { sellerId: userId }, orderBy: { updatedAt: 'desc' }, take: 200, include: this.include });
    return rows.map((o) => this.view(o, userId));
  }

  async offer(userId: string, id: string) {
    const o = await this.prisma.marketplaceOffer.findUnique({ where: { id }, include: this.include });
    if (!o || (o.buyerId !== userId && o.sellerId !== userId)) throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: 'Offer not found.' });
    return this.view(o, userId);
  }

  async createOffer(userId: string, listingId: string, input: { amountMinor: number; terms?: string }) {
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!l || l.status !== 'PUBLISHED') throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.kind !== 'BUSINESS') throw new BadRequestException({ code: 'NOT_NEGOTIABLE', message: 'Digital products are bought at the listed price.' });
    if (l.sellerId === userId) throw new BadRequestException({ code: 'OWN_LISTING', message: 'You cannot make an offer on your own listing.' });
    const intro = await this.prisma.marketplaceInquiry.findFirst({ where: { listingId, buyerId: userId, introStatus: 'APPROVED', status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' } });
    if (!intro) throw new ForbiddenException({ code: 'INTRO_REQUIRED', message: 'Offers open once the seller accepts your introduction.' });
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 100) throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'Enter an offer amount.' });
    const existing = await this.prisma.marketplaceOffer.findFirst({ where: { listingId, buyerId: userId, status: { in: [...OPEN_OFFER, 'ACCEPTED'] } } });
    if (existing) throw new ConflictException({ code: 'OFFER_EXISTS', message: 'You already have an active offer on this listing.' });
    const terms = input.terms?.trim().slice(0, 4000) || null;
    const o = await this.prisma.marketplaceOffer.create({
      data: { listingId, inquiryId: intro.id, buyerId: userId, sellerId: l.sellerId, amountMinor: BigInt(input.amountMinor), currency: l.currency, terms, lastActorId: userId, revisions: { create: { version: 1, action: 'SUBMIT', amountMinor: BigInt(input.amountMinor), terms, actorId: userId } } },
      include: this.include,
    });
    this.market.notify(l.workspaceId, l.sellerId, 'marketplace.offer', 'New offer received', `A buyer made an offer on “${l.title}”.`);
    await this.audit.record({ actorUserId: userId, workspaceId: l.workspaceId, action: 'marketplace.offer.submit', targetType: 'marketplace_offer', targetId: o.id, afterState: { amountMinor: String(input.amountMinor) } });
    return this.view(o, userId);
  }

  /** Version-checked move on an open offer. */
  private async openFor(userId: string, id: string, expectedVersion: number) {
    const o = await this.prisma.marketplaceOffer.findUnique({ where: { id }, include: { listing: true } });
    if (!o || (o.buyerId !== userId && o.sellerId !== userId)) throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: 'Offer not found.' });
    if (!(OPEN_OFFER as readonly string[]).includes(o.status)) throw new BadRequestException({ code: 'OFFER_CLOSED', message: 'This offer is no longer open.' });
    if (o.version !== expectedVersion) throw new ConflictException({ code: 'OFFER_STALE', message: 'The offer changed while you were viewing it. Reload to see the latest terms.' });
    return o;
  }

  private async move(o: { id: string; version: number }, data: Prisma.MarketplaceOfferUpdateManyMutationInput) {
    // Compare-and-set on version so two simultaneous answers cannot both win.
    const res = await this.prisma.marketplaceOffer.updateMany({ where: { id: o.id, version: o.version }, data });
    if (res.count !== 1) throw new ConflictException({ code: 'OFFER_STALE', message: 'The offer changed while you were viewing it. Reload to see the latest terms.' });
  }

  async counter(userId: string, id: string, input: { expectedVersion: number; amountMinor: number; terms?: string }) {
    const o = await this.openFor(userId, id, input.expectedVersion);
    if (o.lastActorId === userId) throw new BadRequestException({ code: 'AWAITING_OTHER_PARTY', message: 'Wait for the other party to respond.' });
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 100) throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'Enter an amount.' });
    const version = o.version + 1;
    const terms = input.terms?.trim().slice(0, 4000) || o.terms;
    await this.move(o, { status: 'COUNTERED', version, amountMinor: BigInt(input.amountMinor), terms, lastActorId: userId });
    await this.prisma.marketplaceOfferRevision.create({ data: { offerId: id, version, action: 'COUNTER', amountMinor: BigInt(input.amountMinor), terms, actorId: userId } });
    const other = o.buyerId === userId ? o.sellerId : o.buyerId;
    this.market.notify(o.listing.workspaceId, other, 'marketplace.offer', 'Counteroffer received', `New terms on “${o.listing.title}”.`);
    return this.offer(userId, id);
  }

  async accept(userId: string, id: string, expectedVersion: number) {
    const o = await this.openFor(userId, id, expectedVersion);
    if (o.lastActorId === userId) throw new BadRequestException({ code: 'AWAITING_OTHER_PARTY', message: 'The other party must accept your latest terms.' });
    await this.move(o, { status: 'ACCEPTED', lastActorId: userId });
    await this.prisma.marketplaceOfferRevision.create({ data: { offerId: id, version: o.version, action: 'ACCEPT', amountMinor: o.amountMinor, terms: o.terms, actorId: userId } });
    const tx = await this.prisma.marketplaceTransaction.create({
      data: { listingId: o.listingId, buyerId: o.buyerId, sellerId: o.sellerId, amountMinor: o.amountMinor, currency: o.currency, status: 'AGREEMENT_PENDING', offerId: o.id, provider: 'offline' },
    });
    // Other open offers on the same listing stay open; the seller decides them separately.
    const other = o.buyerId === userId ? o.sellerId : o.buyerId;
    this.market.notify(o.listing.workspaceId, other, 'marketplace.offer', 'Offer accepted', `Terms agreed on “${o.listing.title}”. Next: confirm the purchase agreement.`);
    await this.audit.record({ actorUserId: userId, workspaceId: o.listing.workspaceId, action: 'marketplace.offer.accept', targetType: 'marketplace_offer', targetId: id, afterState: { transactionId: tx.id, amountMinor: o.amountMinor.toString() } });
    return this.offer(userId, id);
  }

  async decline(userId: string, id: string, expectedVersion: number, withdraw: boolean) {
    const o = await this.openFor(userId, id, expectedVersion);
    if (withdraw && o.lastActorId !== userId) throw new BadRequestException({ code: 'NOT_YOUR_OFFER', message: 'You can only withdraw your own latest terms. Decline instead.' });
    if (!withdraw && o.lastActorId === userId) throw new BadRequestException({ code: 'AWAITING_OTHER_PARTY', message: 'Withdraw your own terms instead.' });
    await this.move(o, { status: withdraw ? 'WITHDRAWN' : 'DECLINED', lastActorId: userId });
    await this.prisma.marketplaceOfferRevision.create({ data: { offerId: id, version: o.version, action: withdraw ? 'WITHDRAW' : 'DECLINE', amountMinor: o.amountMinor, terms: o.terms, actorId: userId } });
    const other = o.buyerId === userId ? o.sellerId : o.buyerId;
    this.market.notify(o.listing.workspaceId, other, 'marketplace.offer', withdraw ? 'Offer withdrawn' : 'Offer declined', `On “${o.listing.title}”.`);
    return this.offer(userId, id);
  }

  // ── Deals (acquisition transactions) ────────────────────────────────────

  async transactions(userId: string, role: 'buyer' | 'seller' | 'all') {
    const where: Prisma.MarketplaceTransactionWhereInput = role === 'buyer' ? { buyerId: userId } : role === 'seller' ? { sellerId: userId } : { OR: [{ buyerId: userId }, { sellerId: userId }] };
    const rows = await this.prisma.marketplaceTransaction.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200, include: { listing: { select: { id: true, title: true } } } });
    return rows.map((t) => this.deal(t, userId));
  }

  private deal(t: Prisma.MarketplaceTransactionGetPayload<{ include: { listing: { select: { id: true; title: true } } } }>, userId: string) {
    return {
      id: t.id,
      kind: 'ACQUISITION' as const,
      listing: t.listing,
      role: t.buyerId === userId ? 'BUYER' : 'SELLER',
      amountMinor: Number(t.amountMinor),
      currency: t.currency,
      status: t.status,
      buyerAgreedAt: t.buyerAgreedAt,
      sellerAgreedAt: t.sellerAgreedAt,
      transferStartedAt: t.transferStartedAt,
      buyerConfirmedAt: t.buyerConfirmedAt,
      completedAt: t.completedAt,
      notes: Array.isArray(t.notes) ? t.notes : [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async transaction(userId: string, id: string) {
    const t = await this.prisma.marketplaceTransaction.findUnique({ where: { id }, include: { listing: { select: { id: true, title: true } } } });
    if (!t || (t.buyerId !== userId && t.sellerId !== userId)) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' });
    const cases = await this.prisma.marketplaceCase.findMany({ where: { transactionId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, status: true, reason: true, createdAt: true } });
    return { ...this.deal(t, userId), cases };
  }

  /**
   * Stage moves: both parties agree → due diligence; seller starts transfer;
   * buyer confirms receipt → completed (listing sold). Either may cancel
   * before completion, with a reason.
   */
  async advance(userId: string, id: string, action: 'AGREE' | 'START_TRANSFER' | 'CONFIRM_RECEIPT' | 'CANCEL' | 'NOTE', note?: string) {
    const t = await this.prisma.marketplaceTransaction.findUnique({ where: { id }, include: { listing: true } });
    if (!t || (t.buyerId !== userId && t.sellerId !== userId)) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' });
    const isBuyer = t.buyerId === userId;
    if (!ACTIVE_DEAL.includes(t.status)) throw new BadRequestException({ code: 'DEAL_CLOSED', message: 'This transaction is closed.' });
    const notes = Array.isArray(t.notes) ? (t.notes as Prisma.JsonArray) : [];
    const entry = (text: string) => [...notes, { by: isBuyer ? 'BUYER' : 'SELLER', text: text.slice(0, 2000), at: new Date().toISOString() }].slice(-100);
    let data: Prisma.MarketplaceTransactionUpdateInput;
    switch (action) {
      case 'AGREE': {
        if (t.status !== 'AGREEMENT_PENDING') throw new BadRequestException({ code: 'WRONG_STAGE', message: 'The agreement is already confirmed.' });
        const buyerAgreedAt = isBuyer ? new Date() : t.buyerAgreedAt;
        const sellerAgreedAt = isBuyer ? t.sellerAgreedAt : new Date();
        data = { buyerAgreedAt, sellerAgreedAt, ...(buyerAgreedAt && sellerAgreedAt ? { status: 'DUE_DILIGENCE' } : {}) };
        break;
      }
      case 'START_TRANSFER':
        if (isBuyer) throw new ForbiddenException({ code: 'SELLER_ONLY', message: 'Only the seller starts the transfer.' });
        if (t.status !== 'DUE_DILIGENCE') throw new BadRequestException({ code: 'WRONG_STAGE', message: 'Finish due diligence first.' });
        data = { status: 'TRANSFER_IN_PROGRESS', transferStartedAt: new Date(), ...(note?.trim() ? { notes: entry(note.trim()) } : {}) };
        break;
      case 'CONFIRM_RECEIPT':
        if (!isBuyer) throw new ForbiddenException({ code: 'BUYER_ONLY', message: 'Only the buyer confirms receipt.' });
        if (t.status !== 'TRANSFER_IN_PROGRESS') throw new BadRequestException({ code: 'WRONG_STAGE', message: 'The transfer has not started.' });
        data = { status: 'COMPLETED', buyerConfirmedAt: new Date(), completedAt: new Date() };
        break;
      case 'CANCEL':
        if (!note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give a reason for cancelling.' });
        data = { status: 'CANCELED', notes: entry(`Canceled: ${note.trim()}`) };
        break;
      case 'NOTE':
        if (!note?.trim()) throw new BadRequestException({ code: 'NOTE_REQUIRED', message: 'Write a note.' });
        data = { notes: entry(note.trim()) };
        break;
    }
    const res = await this.prisma.marketplaceTransaction.updateMany({ where: { id, status: t.status, updatedAt: t.updatedAt }, data: data as Prisma.MarketplaceTransactionUpdateManyMutationInput });
    if (res.count !== 1) throw new ConflictException({ code: 'TRANSACTION_STALE', message: 'The transaction changed. Reload and try again.' });
    if (action === 'CONFIRM_RECEIPT') await this.prisma.marketplaceListing.update({ where: { id: t.listingId }, data: { status: 'SOLD' } });
    if (action !== 'NOTE') {
      const other = isBuyer ? t.sellerId : t.buyerId;
      this.market.notify(t.listing.workspaceId, other, 'marketplace.transaction', 'Transaction updated', `“${t.listing.title}”: ${action.replace('_', ' ').toLowerCase()}.`);
      await this.audit.record({ actorUserId: userId, workspaceId: t.listing.workspaceId, action: `marketplace.transaction.${action.toLowerCase()}`, targetType: 'marketplace_transaction', targetId: id });
    }
    return this.transaction(userId, id);
  }
}
