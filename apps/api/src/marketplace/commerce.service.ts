import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCaseKind, Prisma, SellerCheckStatus, SellerLedgerType, VerificationKind } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { StripeClient } from '../billing/stripe.client';
import { StripeEventHooks } from '../billing/stripe-event-hooks';
import { SettingsService } from '../commerce/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { detectFileType, DOCUMENT_TYPES, IMAGE_TYPES } from '../storage/file-safety';
import { MarketplaceService, PAYOUT_THRESHOLD_MINOR } from './marketplace.service';

/** Admin-configurable marketplace terms (V2 guide §4.3: commission and payout timing need approval before go-live). */
export const MARKET_SETTING = 'marketplace.terms';
export type MarketTerms = { commissionBps: number; holdDays: number; reportingWindowDays: number; checkoutEnabled: boolean };
const DEFAULT_TERMS: MarketTerms = { commissionBps: 0, holdDays: 7, reportingWindowDays: 7, checkoutEnabled: false };

type StripeObject = Record<string, unknown> & { id: string };
type StripeEvent = { id: string; type: string; data: { object: StripeObject } };

const num = (v: bigint | null | undefined) => (v === null || v === undefined ? null : Number(v));
const SELLER_KINDS: VerificationKind[] = ['IDENTITY', 'BUSINESS'];

/**
 * Money and trust for the Marketplace (V2 guide §1.2–§1.7, §3.3–§3.7):
 * seller profiles and separate verification checks, digital-product checkout
 * (fulfilled only from a verified Stripe webhook whose amount and currency
 * match the order), download entitlements with short-lived access, an
 * append-only seller ledger, payouts from $50 with dual control and
 * idempotent transfers, and refund / dispute cases.
 */
@Injectable()
export class CommerceService implements OnModuleInit {
  private readonly logger = new Logger(CommerceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly stripe: StripeClient,
    private readonly settings: SettingsService,
    private readonly storage: ContentStorageService,
    private readonly market: MarketplaceService,
    private readonly config: ConfigService,
    private readonly hooks: StripeEventHooks,
  ) {}

  onModuleInit() {
    this.hooks.register((event) => this.handleStripeEvent(event as StripeEvent));
  }

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  async terms(): Promise<MarketTerms> {
    return { ...DEFAULT_TERMS, ...(await this.settings.get<Partial<MarketTerms>>(MARKET_SETTING, {})) };
  }

  async publicTerms() {
    const t = await this.terms();
    return { ...t, payoutThresholdMinor: PAYOUT_THRESHOLD_MINOR, paymentsConfigured: this.stripe.configured, payoutCountries: this.payoutCountries() };
  }

  async adminTerms(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    return this.publicTerms();
  }

  async setTerms(userId: string, input: Partial<MarketTerms>) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.payouts');
    const current = await this.terms();
    const next: MarketTerms = {
      commissionBps: input.commissionBps ?? current.commissionBps,
      holdDays: input.holdDays ?? current.holdDays,
      reportingWindowDays: input.reportingWindowDays ?? current.reportingWindowDays,
      checkoutEnabled: input.checkoutEnabled ?? current.checkoutEnabled,
    };
    if (next.commissionBps < 0 || next.commissionBps > 5000) throw new BadRequestException({ code: 'COMMISSION_INVALID', message: 'Commission must be between 0% and 50%.' });
    if (next.holdDays < 0 || next.holdDays > 90) throw new BadRequestException({ code: 'HOLD_INVALID', message: 'Hold must be 0–90 days.' });
    await this.settings.set(MARKET_SETTING, next, userId);
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'marketplace.terms.update', targetType: 'system_setting', targetId: null, beforeState: current, afterState: next });
    return next;
  }

  // ── Seller profile & verification ───────────────────────────────────────

  async sellerProfile(userId: string) {
    const p = await this.prisma.sellerProfile.findUnique({ where: { userId }, include: { verifications: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!p) return null;
    return {
      id: p.id,
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      website: p.website,
      location: p.location,
      status: p.status,
      checks: { identity: p.identityStatus, business: p.businessStatus, payout: p.payoutStatus },
      payoutsEnabled: p.payoutsEnabled,
      payoutAccountConnected: !!p.stripeAccountId,
      verifications: p.verifications.map((v) => ({ id: v.id, kind: v.kind, status: v.status, listingId: v.listingId, decisionNote: v.decisionNote, files: Array.isArray(v.evidence) ? (v.evidence as { filename: string }[]).map((e) => e.filename) : [], createdAt: v.createdAt, reviewedAt: v.reviewedAt })),
      createdAt: p.createdAt,
    };
  }

  async upsertSellerProfile(userId: string, input: { displayName: string; headline?: string; bio?: string; website?: string; location?: string }) {
    const displayName = input.displayName.trim().slice(0, 80);
    if (displayName.length < 2) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Enter the name buyers will see.' });
    const data = { displayName, headline: input.headline?.trim().slice(0, 140) || null, bio: input.bio?.trim().slice(0, 2000) || null, website: input.website?.trim().slice(0, 200) || null, location: input.location?.trim().slice(0, 80) || null };
    const existing = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (existing?.status === 'SUSPENDED') throw new ForbiddenException({ code: 'SELLER_SUSPENDED', message: 'Your seller account is suspended.' });
    await this.prisma.sellerProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    if (!existing) await this.audit.record({ actorUserId: userId, action: 'marketplace.seller.onboard', targetType: 'seller_profile', targetId: userId });
    return this.sellerProfile(userId);
  }

  private async requireSeller(userId: string) {
    const p = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!p) throw new ForbiddenException({ code: 'SELLER_PROFILE_REQUIRED', message: 'Start selling first: create your seller profile.' });
    return p;
  }

  /** Identity or business evidence: details plus up to 5 private files (PDF or image). */
  async submitVerification(userId: string, kind: VerificationKind, details: Record<string, string>, files: { buffer: Buffer; originalname: string; size: number }[] = []) {
    const p = await this.requireSeller(userId);
    if (!SELLER_KINDS.includes(kind)) throw new BadRequestException({ code: 'KIND_INVALID', message: 'Unknown verification type.' });
    const current = kind === 'IDENTITY' ? p.identityStatus : p.businessStatus;
    if (current === 'PENDING') throw new BadRequestException({ code: 'ALREADY_PENDING', message: 'This check is already being reviewed.' });
    if (current === 'APPROVED') throw new BadRequestException({ code: 'ALREADY_APPROVED', message: 'This check is already approved.' });
    if (files.length > 5) throw new BadRequestException({ code: 'TOO_MANY_FILES', message: 'Attach up to 5 files.' });
    if (kind === 'IDENTITY' && !files.length) throw new BadRequestException({ code: 'EVIDENCE_REQUIRED', message: 'Attach a photo or scan of a government-issued ID.' });
    const evidence: { key: string; filename: string; contentType: string }[] = [];
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Each file can be up to 15 MB.' });
      const type = detectFileType(f.buffer, [...IMAGE_TYPES, 'application/pdf']);
      if (!type) throw new BadRequestException({ code: 'FILE_TYPE', message: 'Use PDF, PNG, JPEG or WebP files.' });
      const key = `marketplace/verification/${p.id}/${randomBytes(12).toString('hex')}.${type.ext}`;
      await this.storage.writeBuffer(key, f.buffer, type.mime);
      evidence.push({ key, filename: f.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 120), contentType: type.mime });
    }
    const clean = Object.fromEntries(Object.entries(details).map(([k, v]) => [k.slice(0, 40), String(v ?? '').trim().slice(0, 300)]).filter(([, v]) => v));
    await this.prisma.$transaction([
      this.prisma.sellerVerificationCase.create({ data: { sellerProfileId: p.id, kind, status: 'PENDING', details: clean, evidence } }),
      this.prisma.sellerProfile.update({ where: { id: p.id }, data: kind === 'IDENTITY' ? { identityStatus: 'PENDING' } : { businessStatus: 'PENDING' } }),
    ]);
    await this.audit.record({ actorUserId: userId, action: `marketplace.verification.submit`, targetType: 'seller_profile', targetId: p.id, afterState: { kind, files: evidence.length } });
    return this.sellerProfile(userId);
  }

  // ── Payout account (Stripe Connect Express) ─────────────────────────────

  /**
   * Bank-account countries sellers may connect. US only until Stripe approves recipient accounts
   * (cross-border payouts) for this platform; then list them in STRIPE_PAYOUT_COUNTRIES, e.g. "US,GB,DE".
   */
  payoutCountries(): string[] {
    const list = (this.config.get<string>('STRIPE_PAYOUT_COUNTRIES') ?? 'US').split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
    return list.length ? list : ['US'];
  }

  async payoutOnboarding(userId: string, country = 'US') {
    const p = await this.requireSeller(userId);
    if (!this.stripe.configured) throw new BadRequestException({ code: 'PAYMENTS_NOT_CONFIGURED', message: 'Payouts are not available yet.' });
    if (p.identityStatus !== 'APPROVED') throw new ForbiddenException({ code: 'IDENTITY_VERIFICATION_REQUIRED', message: 'Your identity must be verified before you connect a payout account.' });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    let accountId = p.stripeAccountId;
    if (!accountId) {
      const cc = country.toUpperCase();
      if (!this.payoutCountries().includes(cc)) throw new BadRequestException({ code: 'COUNTRY_UNSUPPORTED', message: 'Payouts to bank accounts in this country are not available yet.' });
      // Sellers outside the US use cross-border payouts: transfers only, under the recipient service agreement.
      const account = await this.stripe.request<StripeObject>(
        'POST',
        '/accounts',
        { type: 'express', country: cc, email: user.email, metadata: { sellerProfileId: p.id }, capabilities: { transfers: { requested: true } }, ...(cc === 'US' ? {} : { tos_acceptance: { service_agreement: 'recipient' } }) },
        `connect-account:${p.id}:${cc}`,
      );
      accountId = account.id;
      await this.prisma.sellerProfile.update({ where: { id: p.id }, data: { stripeAccountId: accountId, payoutStatus: 'PENDING' } });
    }
    const link = await this.stripe.request<{ url: string }>('POST', '/account_links', { account: accountId, type: 'account_onboarding', refresh_url: `${this.webUrl}/seller/verification?payout=refresh`, return_url: `${this.webUrl}/seller/verification?payout=returned` });
    return { url: link.url };
  }

  async refreshPayoutAccount(userId: string) {
    const p = await this.requireSeller(userId);
    if (!p.stripeAccountId) return this.sellerProfile(userId);
    const a = await this.stripe.request<StripeObject>('GET', `/accounts/${p.stripeAccountId}`);
    await this.applyAccount(a);
    return this.sellerProfile(userId);
  }

  private async applyAccount(a: StripeObject) {
    const enabled = a.payouts_enabled === true && a.details_submitted === true;
    await this.prisma.sellerProfile.updateMany({ where: { stripeAccountId: a.id }, data: { payoutsEnabled: enabled, payoutStatus: enabled ? 'APPROVED' : 'PENDING' } });
  }

  // ── Checkout (digital products) ─────────────────────────────────────────

  async checkout(userId: string, listingId: string, consents: { license: boolean; refundPolicy: boolean; withdrawalWaiver: boolean }) {
    const terms = await this.terms();
    if (!terms.checkoutEnabled || !this.stripe.configured) throw new BadRequestException({ code: 'CHECKOUT_UNAVAILABLE', message: 'Checkout is not open yet.' });
    const l = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!l || l.status !== 'PUBLISHED') throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    if (l.kind !== 'DIGITAL_PRODUCT') throw new BadRequestException({ code: 'NOT_DIGITAL', message: 'Business acquisitions go through an introduction and offer.' });
    if (l.sellerId === userId) throw new BadRequestException({ code: 'OWN_LISTING', message: 'You cannot buy your own listing.' });
    if (!consents.license || !consents.refundPolicy) throw new BadRequestException({ code: 'CONSENT_REQUIRED', message: 'Accept the licence and the refund policy to continue.' });
    const owned = await this.prisma.marketplaceOrder.findFirst({ where: { listingId, buyerId: userId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } });
    if (owned) throw new ConflictException({ code: 'ALREADY_PURCHASED', message: 'You already own this item. Find it in My Downloads.' });
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId: l.sellerId } });
    if (!seller || seller.status === 'SUSPENDED') throw new BadRequestException({ code: 'SELLER_UNAVAILABLE', message: 'This seller cannot accept orders right now.' });
    const fee = (l.askingPriceMinor * BigInt(terms.commissionBps)) / 10_000n;
    const now = new Date();
    const order = await this.prisma.marketplaceOrder.create({
      data: { buyerId: userId, sellerId: l.sellerId, listingId, amountMinor: l.askingPriceMinor, platformFeeMinor: fee, currency: l.currency, licenseAcceptedAt: now, withdrawalConsentAt: consents.withdrawalWaiver ? now : null },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const session = await this.stripe.request<{ id: string; url: string }>(
      'POST',
      '/checkout/sessions',
      {
        mode: 'payment',
        customer_email: user.email,
        // Stripe Tax is off until STRIPE_AUTOMATIC_TAX=true (prices exclude tax; the buyer's address decides the tax).
        ...(this.config.get<string>('STRIPE_AUTOMATIC_TAX') === 'true' ? { automatic_tax: { enabled: true }, billing_address_collection: 'required' } : {}),
        ...(this.config.get<string>('STRIPE_CHECKOUT_TERMS_CONSENT') === 'true' ? { consent_collection: { terms_of_service: 'required' } } : {}),
        custom_text: {
          submit: {
            message: consents.withdrawalWaiver
              ? 'You asked for immediate access to this digital content and acknowledged that you lose your right to withdraw once the download is available.'
              : 'Digital content is delivered to My Downloads as soon as payment is confirmed. Refunds follow the AmpliVerify Digital Product Refund Policy.',
          },
        },
        line_items: [{ quantity: 1, price_data: { currency: l.currency.toLowerCase(), unit_amount: Number(l.askingPriceMinor), product_data: { name: l.title.slice(0, 120) } } }],
        success_url: `${this.webUrl}/buyer/purchases/${order.id}?checkout=returned`,
        cancel_url: `${this.webUrl}/marketplace/listings/${l.slug ?? l.id}?checkout=canceled`,
        client_reference_id: order.id,
        metadata: { kind: 'marketplace_order', orderId: order.id },
        payment_intent_data: { metadata: { kind: 'marketplace_order', orderId: order.id } },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      `marketplace-checkout:${order.id}`,
    );
    await this.prisma.marketplaceOrder.update({ where: { id: order.id }, data: { checkoutSessionId: session.id } });
    await this.audit.record({ actorUserId: userId, action: 'marketplace.checkout.start', targetType: 'marketplace_order', targetId: order.id, afterState: { listingId, amountMinor: l.askingPriceMinor.toString(), currency: l.currency } });
    return { url: session.url, orderId: order.id };
  }

  /**
   * Called by the billing webhook processor for verified, de-duplicated Stripe
   * events. Returns true when the event concerned the Marketplace.
   */
  async handleStripeEvent(event: StripeEvent): Promise<boolean> {
    const obj = event.data.object;
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    switch (event.type) {
      case 'account.updated':
        await this.applyAccount(obj);
        return true;
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (metadata.kind !== 'marketplace_order') return false;
        if (obj.payment_status === 'paid') await this.markPaid(metadata.orderId, obj);
        return true;
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        if (metadata.kind !== 'marketplace_order') return false;
        await this.prisma.marketplaceOrder.updateMany({ where: { id: metadata.orderId, status: 'PENDING_PAYMENT' }, data: { status: event.type === 'checkout.session.expired' ? 'CANCELED' : 'FAILED' } });
        return true;
      case 'charge.refunded': {
        const order = await this.orderForPayment(obj.payment_intent as string | undefined);
        if (!order) return false;
        const refunds = ((obj.refunds as { data?: StripeObject[] } | undefined)?.data ?? []).filter((r) => r.status === 'succeeded');
        // Keyed by refund ID, shared with refund.* events, so each refund applies once.
        for (const r of refunds) await this.applyRefund(order.id, r.id, Number(r.amount ?? 0), null);
        return true;
      }
      case 'refund.created':
      case 'refund.updated': {
        if (obj.status !== 'succeeded') return false;
        const order = await this.orderForPayment(obj.payment_intent as string | undefined);
        if (!order) return false;
        await this.applyRefund(order.id, obj.id, Number(obj.amount ?? 0), null);
        return true;
      }
      case 'charge.dispute.created': {
        const order = await this.orderForPayment(obj.payment_intent as string | undefined);
        if (!order) return false;
        const exists = await this.prisma.marketplaceCase.findFirst({ where: { orderId: order.id, kind: 'DISPUTE', details: { contains: obj.id } } });
        if (!exists) await this.prisma.marketplaceCase.create({ data: { kind: 'DISPUTE', orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId, reason: String(obj.reason ?? 'Card dispute'), details: `Stripe dispute ${obj.id}`, status: 'UNDER_REVIEW', requestedAmountMinor: BigInt(Number(obj.amount ?? 0)) } });
        return true;
      }
      default:
        return false;
    }
  }

  private orderForPayment(paymentIntent: string | undefined) {
    return paymentIntent ? this.prisma.marketplaceOrder.findUnique({ where: { paymentIntentId: paymentIntent } }) : Promise.resolve(null);
  }

  /** Payment confirmed by the provider: validate, then fulfil exactly once. */
  async markPaid(orderId: string | undefined, session: StripeObject) {
    if (!orderId) return;
    const order = await this.prisma.marketplaceOrder.findUnique({ where: { id: orderId }, include: { listing: { include: { files: { where: { role: 'DELIVERABLE' } } } } } });
    if (!order) return;
    if (order.status !== 'PENDING_PAYMENT' && order.status !== 'FAILED' && order.status !== 'CANCELED') return; // already fulfilled
    // With Stripe Tax the total includes tax; the item price is the subtotal.
    const amount = Number(session.amount_subtotal ?? session.amount_total ?? -1);
    const total = Number(session.amount_total ?? -1);
    const tax = Math.max(0, total - amount);
    const currency = String(session.currency ?? '').toUpperCase();
    if (amount !== Number(order.amountMinor) || total < amount || currency !== order.currency) {
      this.logger.error(`Marketplace order ${order.id}: paid ${amount} ${currency}, expected ${order.amountMinor} ${order.currency}. Not fulfilled.`);
      await this.audit.record({ action: 'marketplace.order.amount_mismatch', targetType: 'marketplace_order', targetId: order.id, afterState: { amount, currency } });
      return;
    }
    const terms = await this.terms();
    const paidAt = new Date();
    const availableAt = new Date(paidAt.getTime() + terms.holdDays * 86_400_000);
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.marketplaceOrder.updateMany({ where: { id: order.id, status: { in: ['PENDING_PAYMENT', 'FAILED', 'CANCELED'] } }, data: { status: 'PAID', paidAt, taxMinor: BigInt(tax), paymentIntentId: (session.payment_intent as string | undefined) ?? null, checkoutSessionId: session.id } });
      if (res.count !== 1) return;
      for (const f of order.listing.files) {
        await tx.marketplaceDownloadEntitlement.upsert({ where: { orderId_fileId: { orderId: order.id, fileId: f.id } }, create: { orderId: order.id, fileId: f.id, buyerId: order.buyerId }, update: {} });
      }
      await tx.sellerLedgerEntry.createMany({
        data: [
          { sellerId: order.sellerId, type: 'SALE', amountMinor: order.amountMinor, currency: order.currency, orderId: order.id, idempotencyKey: `sale:${order.id}`, availableAt, memo: order.listing.title.slice(0, 120) },
          ...(order.platformFeeMinor > 0n ? [{ sellerId: order.sellerId, type: 'PLATFORM_FEE' as SellerLedgerType, amountMinor: -order.platformFeeMinor, currency: order.currency, orderId: order.id, idempotencyKey: `fee:${order.id}`, availableAt, memo: 'Marketplace commission' }] : []),
        ],
        skipDuplicates: true,
      });
    });
    await this.audit.record({ action: 'marketplace.order.paid', targetType: 'marketplace_order', targetId: order.id, afterState: { amountMinor: order.amountMinor.toString(), currency: order.currency } });
    const buyerWs = await this.market.defaultWorkspace(order.buyerId).catch(() => null);
    if (buyerWs) this.market.notify(buyerWs, order.buyerId, 'marketplace.order_paid', 'Purchase confirmed', `Payment received for “${order.listing.title}”. Your files are in My Downloads.`);
    this.market.notify(order.listing.workspaceId, order.sellerId, 'marketplace.sale', 'You made a sale', `“${order.listing.title}” was purchased.`);
  }

  /**
   * Idempotent by provider refund ID: updates the order, ledger and (on full refund) download access.
   * `grossMinor` is the amount Stripe returned to the buyer, tax included; only the item-price part
   * (the same share of the refund as the price is of the total) reverses seller earnings.
   */
  private async applyRefund(orderId: string, refundId: string, grossMinor: number, caseId: string | null) {
    if (grossMinor <= 0) return;
    await this.prisma.$transaction(async (tx) => {
      const key = `refund:${refundId}`;
      const done = await tx.sellerLedgerEntry.findUnique({ where: { idempotencyKey: key } });
      if (done) return;
      const order = await tx.marketplaceOrder.findUniqueOrThrow({ where: { id: orderId } });
      const remaining = order.amountMinor - order.refundedMinor;
      const gross = order.amountMinor + order.taxMinor;
      let net = gross > 0n ? (BigInt(grossMinor) * order.amountMinor) / gross : 0n;
      // Rounding across several partial refunds can leave at most one minor unit.
      if (net >= remaining - 1n) net = remaining;
      if (net <= 0n) return;
      const amountMinor = Number(net);
      const refunded = order.refundedMinor + net;
      const full = refunded >= order.amountMinor;
      await tx.marketplaceOrder.update({ where: { id: orderId }, data: { refundedMinor: refunded, status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      // Proportional reversal of the seller's net; a refund after payout leaves a negative balance (recorded, never silent).
      const sellerNet = order.amountMinor - order.platformFeeMinor;
      const sellerShare = order.amountMinor > 0n ? (sellerNet * BigInt(amountMinor)) / order.amountMinor : 0n;
      await tx.sellerLedgerEntry.create({ data: { sellerId: order.sellerId, type: 'REFUND', amountMinor: -sellerShare, currency: order.currency, orderId, caseId, idempotencyKey: key, memo: full ? 'Full refund' : 'Partial refund' } });
      if (full) await tx.marketplaceDownloadEntitlement.updateMany({ where: { orderId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      if (caseId) await tx.marketplaceCase.update({ where: { id: caseId }, data: { status: 'REFUNDED', providerRefundId: refundId } });
      else await tx.marketplaceCase.updateMany({ where: { orderId, status: 'APPROVED', providerRefundId: refundId }, data: { status: 'REFUNDED' } });
    });
  }

  // ── Orders and downloads (buyer) ────────────────────────────────────────

  async orders(userId: string) {
    const rows = await this.prisma.marketplaceOrder.findMany({ where: { buyerId: userId, status: { not: 'PENDING_PAYMENT' } }, orderBy: { createdAt: 'desc' }, take: 200, include: { listing: { select: { id: true, title: true, slug: true } } } });
    return rows.map((o) => this.orderView(o));
  }

  private orderView(o: Prisma.MarketplaceOrderGetPayload<{ include: { listing: { select: { id: true; title: true; slug: true } } } }>) {
    return { id: o.id, kind: 'DIGITAL_PRODUCT' as const, listing: o.listing, amountMinor: Number(o.amountMinor), refundedMinor: Number(o.refundedMinor), currency: o.currency, status: o.status, paidAt: o.paidAt, createdAt: o.createdAt };
  }

  async order(userId: string, id: string) {
    const o = await this.prisma.marketplaceOrder.findUnique({ where: { id }, include: { listing: { select: { id: true, title: true, slug: true, licenseTerms: true } }, entitlements: { include: { file: { select: { filename: true, sizeBytes: true } } } }, cases: { orderBy: { createdAt: 'desc' } } } });
    if (!o || o.buyerId !== userId) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    const terms = await this.terms();
    const reportBy = o.paidAt ? new Date(o.paidAt.getTime() + terms.reportingWindowDays * 86_400_000) : null;
    return {
      ...this.orderView(o),
      licenseTerms: o.listing.licenseTerms,
      licenseAcceptedAt: o.licenseAcceptedAt,
      withdrawalConsentAt: o.withdrawalConsentAt,
      downloads: o.entitlements.map((e) => ({ id: e.id, filename: e.file.filename, sizeBytes: e.file.sizeBytes, status: e.status })),
      cases: o.cases.map((c) => ({ id: c.id, kind: c.kind, status: c.status, reason: c.reason, createdAt: c.createdAt, decisionNote: c.decisionNote })),
      // Guideline for reporting issues; statutory consumer rights are not limited by it.
      reportingGuidelineUntil: reportBy,
    };
  }

  async downloads(userId: string) {
    const rows = await this.prisma.marketplaceDownloadEntitlement.findMany({ where: { buyerId: userId }, orderBy: { createdAt: 'desc' }, take: 500, include: { file: { select: { filename: true, sizeBytes: true, contentType: true } }, order: { select: { id: true, status: true, listing: { select: { id: true, title: true } } } }, _count: { select: { events: true } } } });
    return rows.map((e) => ({
      id: e.id,
      filename: e.file.filename,
      sizeBytes: e.file.sizeBytes,
      contentType: e.file.contentType,
      listing: e.order.listing,
      orderId: e.order.id,
      // Available only while the order is paid and access has not been revoked.
      state: e.status === 'REVOKED' ? 'REVOKED' : e.order.status === 'PAID' || e.order.status === 'PARTIALLY_REFUNDED' ? 'AVAILABLE' : 'UNAVAILABLE',
      downloads: e._count.events,
      createdAt: e.createdAt,
    }));
  }

  /** Entitlement check on every request, logged; S3 gets a 5-minute signed URL. */
  async downloadFile(userId: string, entitlementId: string, ip?: string) {
    const e = await this.prisma.marketplaceDownloadEntitlement.findUnique({ where: { id: entitlementId }, include: { file: true, order: { select: { status: true, buyerId: true } } } });
    if (!e || e.buyerId !== userId || e.order.buyerId !== userId) throw new NotFoundException({ code: 'DOWNLOAD_NOT_FOUND', message: 'Download not found.' });
    if (e.status !== 'ACTIVE') throw new ForbiddenException({ code: 'ACCESS_REVOKED', message: 'Access to this file was revoked.' });
    if (e.order.status !== 'PAID' && e.order.status !== 'PARTIALLY_REFUNDED') throw new ForbiddenException({ code: 'NOT_PAID', message: 'This order is not paid.' });
    const recent = await this.prisma.marketplaceDownloadEvent.count({ where: { entitlementId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent >= 30) throw new ForbiddenException({ code: 'DOWNLOAD_LIMIT', message: 'Too many downloads in the last hour. Try again later.' });
    await this.prisma.marketplaceDownloadEvent.create({ data: { entitlementId, userId, ip: ip?.slice(0, 64) ?? null } });
    const signed = await this.storage.signedUrl(e.file.storageKey, { filename: e.file.filename, contentType: e.file.contentType, expiresInSeconds: 300 });
    if (signed) return { signedUrl: signed.url, filename: e.file.filename, contentType: e.file.contentType };
    const body = await this.storage.readBuffer(e.file.storageKey);
    if (!body) throw new NotFoundException({ code: 'FILE_MISSING', message: 'The file is not available. Contact support.' });
    return { body, filename: e.file.filename, contentType: e.file.contentType };
  }

  // ── Cases: refunds, issues, disputes ────────────────────────────────────

  async openCase(userId: string, input: { orderId?: string; transactionId?: string; kind: MarketplaceCaseKind; reason: string; details: string; amountMinor?: number }) {
    if (input.kind === 'DISPUTE') throw new BadRequestException({ code: 'KIND_INVALID', message: 'Choose refund request or issue report.' });
    let sellerId: string;
    let max: bigint | null = null;
    if (input.orderId) {
      const o = await this.prisma.marketplaceOrder.findUnique({ where: { id: input.orderId } });
      if (!o || o.buyerId !== userId) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
      if (o.status !== 'PAID' && o.status !== 'PARTIALLY_REFUNDED') throw new BadRequestException({ code: 'NOT_REFUNDABLE', message: 'Only paid orders can be reported.' });
      sellerId = o.sellerId;
      max = o.amountMinor - o.refundedMinor;
    } else if (input.transactionId) {
      const t = await this.prisma.marketplaceTransaction.findUnique({ where: { id: input.transactionId } });
      if (!t || (t.buyerId !== userId && t.sellerId !== userId)) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' });
      if (input.kind === 'REFUND') throw new BadRequestException({ code: 'NOT_REFUNDABLE', message: 'Acquisition funds are not held by AmpliVerify. Report an issue instead.' });
      sellerId = t.sellerId;
    } else {
      throw new BadRequestException({ code: 'TARGET_REQUIRED', message: 'Choose the purchase this is about.' });
    }
    const open = await this.prisma.marketplaceCase.findFirst({ where: { buyerId: userId, orderId: input.orderId ?? undefined, transactionId: input.transactionId ?? undefined, status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
    if (open) throw new ConflictException({ code: 'CASE_OPEN', message: 'You already have an open case for this purchase.' });
    const amount = input.amountMinor !== undefined ? BigInt(input.amountMinor) : max;
    if (input.kind === 'REFUND' && max !== null && amount !== null && (amount <= 0n || amount > max)) throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'The amount cannot exceed what you paid.' });
    const c = await this.prisma.marketplaceCase.create({ data: { kind: input.kind, orderId: input.orderId ?? null, transactionId: input.transactionId ?? null, buyerId: userId, sellerId, reason: input.reason.trim().slice(0, 200), details: input.details.trim().slice(0, 5000), requestedAmountMinor: input.kind === 'REFUND' ? amount : null } });
    await this.audit.record({ actorUserId: userId, action: 'marketplace.case.open', targetType: 'marketplace_case', targetId: c.id, afterState: { kind: c.kind } });
    return this.caseView(c);
  }

  private caseView(c: Prisma.MarketplaceCaseGetPayload<object>) {
    return { id: c.id, kind: c.kind, orderId: c.orderId, transactionId: c.transactionId, reason: c.reason, details: c.details, status: c.status, requestedAmountMinor: num(c.requestedAmountMinor), approvedAmountMinor: num(c.approvedAmountMinor), decisionNote: c.decisionNote, decidedAt: c.decidedAt, createdAt: c.createdAt };
  }

  async cases(userId: string, role: 'buyer' | 'seller') {
    const rows = await this.prisma.marketplaceCase.findMany({ where: role === 'buyer' ? { buyerId: userId } : { sellerId: userId }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((c) => this.caseView(c));
  }

  // ── Seller finances ─────────────────────────────────────────────────────

  async balance(userId: string) {
    const now = new Date();
    const [byType, pending, profile, openPayout] = await Promise.all([
      this.prisma.sellerLedgerEntry.groupBy({ by: ['type', 'currency'], where: { sellerId: userId }, _sum: { amountMinor: true } }),
      this.prisma.sellerLedgerEntry.groupBy({ by: ['currency'], where: { sellerId: userId, availableAt: { gt: now }, type: { in: ['SALE', 'PLATFORM_FEE'] } }, _sum: { amountMinor: true } }),
      this.prisma.sellerProfile.findUnique({ where: { userId } }),
      this.prisma.sellerPayout.findFirst({ where: { sellerId: userId, status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] } } }),
    ]);
    const currencies = [...new Set(byType.map((b) => b.currency))];
    const balances = currencies.map((currency) => {
      const sum = (t: SellerLedgerType[]) => byType.filter((b) => b.currency === currency && t.includes(b.type)).reduce((s, b) => s + (b._sum.amountMinor ?? 0n), 0n);
      const total = sum(['SALE', 'PLATFORM_FEE', 'REFUND', 'PAYOUT', 'PAYOUT_REVERSAL', 'ADJUSTMENT']);
      const held = pending.find((p) => p.currency === currency)?._sum.amountMinor ?? 0n;
      const available = total - held;
      return {
        currency,
        grossSalesMinor: Number(sum(['SALE'])),
        feesMinor: Number(-sum(['PLATFORM_FEE'])),
        refundsMinor: Number(-sum(['REFUND'])),
        paidOutMinor: Number(-sum(['PAYOUT', 'PAYOUT_REVERSAL'])),
        adjustmentsMinor: Number(sum(['ADJUSTMENT'])),
        pendingMinor: Number(held),
        availableMinor: Number(available),
        balanceMinor: Number(total),
      };
    });
    const usd = balances.find((b) => b.currency === 'USD');
    return {
      balances,
      payoutThresholdMinor: PAYOUT_THRESHOLD_MINOR,
      payoutsEnabled: !!profile?.payoutsEnabled,
      openPayout: openPayout ? { id: openPayout.id, status: openPayout.status, amountMinor: Number(openPayout.amountMinor), currency: openPayout.currency } : null,
      canRequestPayout: !!profile?.payoutsEnabled && !openPayout && (usd?.availableMinor ?? 0) >= PAYOUT_THRESHOLD_MINOR,
    };
  }

  async ledger(userId: string, filters: { month?: string; type?: SellerLedgerType } = {}) {
    let createdAt: Prisma.DateTimeFilter | undefined;
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      const [y, m] = filters.month.split('-').map(Number);
      createdAt = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
    }
    const rows = await this.prisma.sellerLedgerEntry.findMany({ where: { sellerId: userId, ...(createdAt ? { createdAt } : {}), ...(filters.type ? { type: filters.type } : {}) }, orderBy: { createdAt: 'desc' }, take: 1000, include: { order: { select: { id: true, listing: { select: { title: true } } } } } });
    return rows.map((r) => ({ id: r.id, type: r.type, amountMinor: Number(r.amountMinor), currency: r.currency, memo: r.memo, orderId: r.orderId, payoutId: r.payoutId, listing: r.order?.listing.title ?? null, availableAt: r.availableAt, createdAt: r.createdAt }));
  }

  async statements(userId: string) {
    const rows = await this.prisma.$queryRaw<{ month: Date; currency: string; type: SellerLedgerType; total: bigint }[]>`
      SELECT date_trunc('month', created_at) AS month, currency, type, SUM(amount_minor)::bigint AS total
      FROM seller_ledger_entries WHERE seller_id = ${userId}::uuid GROUP BY 1, 2, 3 ORDER BY 1 DESC`;
    const map = new Map<string, { month: string; currency: string; salesMinor: number; feesMinor: number; refundsMinor: number; payoutsMinor: number; adjustmentsMinor: number }>();
    for (const r of rows) {
      const month = r.month.toISOString().slice(0, 7);
      const k = `${month}:${r.currency}`;
      const s = map.get(k) ?? { month, currency: r.currency, salesMinor: 0, feesMinor: 0, refundsMinor: 0, payoutsMinor: 0, adjustmentsMinor: 0 };
      const v = Number(r.total);
      if (r.type === 'SALE') s.salesMinor += v;
      else if (r.type === 'PLATFORM_FEE') s.feesMinor -= v;
      else if (r.type === 'REFUND') s.refundsMinor -= v;
      else if (r.type === 'PAYOUT' || r.type === 'PAYOUT_REVERSAL') s.payoutsMinor -= v;
      else s.adjustmentsMinor += v;
      map.set(k, s);
    }
    return [...map.values()];
  }

  async sales(userId: string) {
    const rows = await this.prisma.marketplaceOrder.findMany({ where: { sellerId: userId, status: { not: 'PENDING_PAYMENT' } }, orderBy: { createdAt: 'desc' }, take: 200, include: { listing: { select: { id: true, title: true, slug: true } } } });
    return rows.map((o) => ({ ...this.orderView(o), platformFeeMinor: Number(o.platformFeeMinor) }));
  }

  async payouts(userId: string) {
    const rows = await this.prisma.sellerPayout.findMany({ where: { sellerId: userId }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((p) => this.payoutView(p));
  }

  private payoutView(p: Prisma.SellerPayoutGetPayload<object>) {
    return { id: p.id, amountMinor: Number(p.amountMinor), currency: p.currency, status: p.status, failureReason: p.failureReason, providerTransferId: p.providerTransferId, approvedAt: p.approvedAt, paidAt: p.paidAt, createdAt: p.createdAt };
  }

  async payout(userId: string, id: string) {
    const p = await this.prisma.sellerPayout.findUnique({ where: { id }, include: { ledger: { where: { type: { in: ['PAYOUT', 'PAYOUT_REVERSAL'] } } } } });
    if (!p || p.sellerId !== userId) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND', message: 'Payout not found.' });
    return { ...this.payoutView(p), entries: p.ledger.map((l) => ({ type: l.type, amountMinor: Number(l.amountMinor), createdAt: l.createdAt })) };
  }

  /** Reserve the available USD balance (≥ $50) for a payout; staff approve and process it. */
  async requestPayout(userId: string) {
    const b = await this.balance(userId);
    if (!b.payoutsEnabled) throw new ForbiddenException({ code: 'PAYOUT_ACCOUNT_REQUIRED', message: 'Connect and verify your payout account first.' });
    if (b.openPayout) throw new ConflictException({ code: 'PAYOUT_OPEN', message: 'You already have a payout in progress.' });
    const usd = b.balances.find((x) => x.currency === 'USD');
    if (!usd || usd.availableMinor < PAYOUT_THRESHOLD_MINOR) throw new BadRequestException({ code: 'BELOW_THRESHOLD', message: 'Payouts start once your available balance reaches $50.' });
    const p = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.create({ data: { sellerId: userId, amountMinor: BigInt(usd.availableMinor), currency: 'USD', idempotencyKey: `payout-${randomBytes(12).toString('hex')}` } });
      await tx.sellerLedgerEntry.create({ data: { sellerId: userId, type: 'PAYOUT', amountMinor: -BigInt(usd.availableMinor), currency: 'USD', payoutId: payout.id, idempotencyKey: `payout:${payout.id}`, memo: 'Payout requested' } });
      return payout;
    });
    await this.audit.record({ actorUserId: userId, action: 'marketplace.payout.request', targetType: 'seller_payout', targetId: p.id, afterState: { amountMinor: p.amountMinor.toString() } });
    return this.payoutView(p);
  }

  // ── Admin: verification, payouts, cases ─────────────────────────────────

  async adminSellers(userId: string, q?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const rows = await this.prisma.sellerProfile.findMany({
      where: q?.trim() ? { OR: [{ displayName: { contains: q.trim(), mode: 'insensitive' } }, { user: { email: { contains: q.trim(), mode: 'insensitive' } } }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true } } },
    });
    const counts = await this.prisma.marketplaceListing.groupBy({ by: ['sellerId'], where: { sellerId: { in: rows.map((r) => r.userId) }, status: 'PUBLISHED' }, _count: true });
    const live = new Map(counts.map((c) => [c.sellerId, c._count]));
    return rows.map((p) => ({ id: p.id, userId: p.userId, displayName: p.displayName, email: p.user.email, status: p.status, identity: p.identityStatus, business: p.businessStatus, payout: p.payoutStatus, payoutsEnabled: p.payoutsEnabled, liveListings: live.get(p.userId) ?? 0, createdAt: p.createdAt }));
  }

  async adminSetSellerStatus(userId: string, profileId: string, status: 'ACTIVE' | 'SUSPENDED', note: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    if (!note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give a reason.' });
    const p = await this.prisma.sellerProfile.findUnique({ where: { id: profileId } });
    if (!p) throw new NotFoundException({ code: 'SELLER_NOT_FOUND', message: 'Seller not found.' });
    await this.prisma.sellerProfile.update({ where: { id: profileId }, data: { status } });
    if (status === 'SUSPENDED') await this.prisma.marketplaceListing.updateMany({ where: { sellerId: p.userId, status: 'PUBLISHED' }, data: { status: 'WITHDRAWN', reviewNote: 'Seller suspended' } });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: `marketplace.seller.${status.toLowerCase()}`, targetType: 'seller_profile', targetId: profileId, afterState: { note } });
    return { status };
  }

  async adminVerifications(userId: string, status?: SellerCheckStatus) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const rows = await this.prisma.sellerVerificationCase.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { seller: { include: { user: { select: { email: true } } } }, listing: { select: { id: true, title: true, url: true } } } });
    return rows.map((v) => ({
      id: v.id,
      kind: v.kind,
      status: v.status,
      seller: { id: v.seller.id, displayName: v.seller.displayName, email: v.seller.user.email },
      listing: v.listing,
      details: v.details,
      files: Array.isArray(v.evidence) ? (v.evidence as { filename: string; contentType: string }[]).map((e, i) => ({ index: i, filename: e.filename, contentType: e.contentType })) : [],
      decisionNote: v.decisionNote,
      createdAt: v.createdAt,
      reviewedAt: v.reviewedAt,
    }));
  }

  async adminEvidenceFile(userId: string, caseId: string, index: number) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const v = await this.prisma.sellerVerificationCase.findUnique({ where: { id: caseId } });
    const e = Array.isArray(v?.evidence) ? (v!.evidence as { key: string; filename: string; contentType: string }[])[index] : undefined;
    if (!e) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'marketplace.verification.evidence_view', targetType: 'seller_verification_case', targetId: caseId });
    const signed = await this.storage.signedUrl(e.key, { filename: e.filename, contentType: e.contentType, inline: true, expiresInSeconds: 120 });
    if (signed) return { signedUrl: signed.url };
    const body = await this.storage.readBuffer(e.key);
    if (!body) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    return { body, filename: e.filename, contentType: e.contentType };
  }

  /** Each check is decided on its own; a rejection keeps its reason and blocks the verified label. */
  async adminDecideVerification(userId: string, caseId: string, approve: boolean, note?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const v = await this.prisma.sellerVerificationCase.findUnique({ where: { id: caseId }, include: { seller: true } });
    if (!v) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'Verification not found.' });
    if (v.status !== 'PENDING') throw new BadRequestException({ code: 'ALREADY_DECIDED', message: 'This check was already decided.' });
    if (!approve && !note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give the seller a reason.' });
    const status: SellerCheckStatus = approve ? 'APPROVED' : 'REJECTED';
    await this.prisma.$transaction(async (tx) => {
      await tx.sellerVerificationCase.update({ where: { id: caseId }, data: { status, decisionNote: note?.trim() || null, reviewedBy: userId, reviewedAt: new Date() } });
      if (v.kind === 'IDENTITY') await tx.sellerProfile.update({ where: { id: v.sellerProfileId }, data: { identityStatus: status, ...(approve && v.seller.status === 'ONBOARDING' ? { status: 'ACTIVE' } : {}) } });
      if (v.kind === 'BUSINESS') await tx.sellerProfile.update({ where: { id: v.sellerProfileId }, data: { businessStatus: status } });
    });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: `marketplace.verification.${approve ? 'approve' : 'reject'}`, targetType: 'seller_verification_case', targetId: caseId, afterState: { kind: v.kind, note: note ?? null } });
    const ws = await this.market.defaultWorkspace(v.seller.userId).catch(() => null);
    if (ws) this.market.notify(ws, v.seller.userId, 'marketplace.verification', approve ? 'Verification approved' : 'Verification needs attention', approve ? `Your ${v.kind.toLowerCase()} check was approved.` : `Your ${v.kind.toLowerCase()} check was not approved: ${note}`);
    return { status };
  }

  async adminPayouts(userId: string, status?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.payouts');
    const rows = await this.prisma.sellerPayout.findMany({ where: status ? { status: status as never } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { seller: { select: { email: true, displayName: true, sellerProfile: { select: { displayName: true, payoutsEnabled: true } } } } } });
    return rows.map((p) => ({ ...this.payoutView(p), approvedBy: p.approvedBy, seller: { email: p.seller.email, name: p.seller.sellerProfile?.displayName ?? p.seller.displayName, payoutsEnabled: !!p.seller.sellerProfile?.payoutsEnabled } }));
  }

  /**
   * Dual control: one admin approves, a different admin processes. The
   * transfer uses the payout's idempotency key, so retries never pay twice.
   */
  async adminPayoutAction(userId: string, id: string, action: 'APPROVE' | 'PROCESS' | 'CANCEL', note?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.payouts');
    const p = await this.prisma.sellerPayout.findUnique({ where: { id } });
    if (!p) throw new NotFoundException({ code: 'PAYOUT_NOT_FOUND', message: 'Payout not found.' });
    if (action === 'APPROVE') {
      if (p.status !== 'REQUESTED') throw new BadRequestException({ code: 'WRONG_STATE', message: 'Only requested payouts can be approved.' });
      await this.prisma.sellerPayout.update({ where: { id }, data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() } });
    } else if (action === 'CANCEL') {
      if (!['REQUESTED', 'APPROVED', 'FAILED'].includes(p.status)) throw new BadRequestException({ code: 'WRONG_STATE', message: 'This payout cannot be canceled.' });
      if (!note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give a reason.' });
      await this.prisma.$transaction([
        this.prisma.sellerPayout.update({ where: { id }, data: { status: 'CANCELED', failureReason: note.trim() } }),
        this.prisma.sellerLedgerEntry.upsert({ where: { idempotencyKey: `payout-reversal:${id}` }, create: { sellerId: p.sellerId, type: 'PAYOUT_REVERSAL', amountMinor: p.amountMinor, currency: p.currency, payoutId: id, idempotencyKey: `payout-reversal:${id}`, memo: 'Payout canceled', createdBy: userId }, update: {} }),
      ]);
    } else {
      if (p.status !== 'APPROVED' && p.status !== 'FAILED') throw new BadRequestException({ code: 'WRONG_STATE', message: 'Approve the payout first.' });
      if (p.approvedBy === userId) throw new ForbiddenException({ code: 'DUAL_CONTROL', message: 'A different administrator must process a payout you approved.' });
      const seller = await this.prisma.sellerProfile.findUnique({ where: { userId: p.sellerId } });
      if (!seller?.stripeAccountId || !seller.payoutsEnabled) throw new BadRequestException({ code: 'PAYOUT_ACCOUNT_REQUIRED', message: "The seller's payout account is not ready." });
      const claimed = await this.prisma.sellerPayout.updateMany({ where: { id, status: { in: ['APPROVED', 'FAILED'] } }, data: { status: 'PROCESSING', processedBy: userId, failureReason: null } });
      if (claimed.count !== 1) throw new ConflictException({ code: 'PAYOUT_BUSY', message: 'This payout is already being processed.' });
      try {
        const transfer = await this.stripe.request<StripeObject>('POST', '/transfers', { amount: Number(p.amountMinor), currency: p.currency.toLowerCase(), destination: seller.stripeAccountId, metadata: { payoutId: p.id } }, p.idempotencyKey);
        await this.prisma.sellerPayout.update({ where: { id }, data: { status: 'PAID', providerTransferId: transfer.id, paidAt: new Date() } });
      } catch (err) {
        const reason = ((err as { response?: { message?: string } }).response?.message ?? String(err)).slice(0, 500);
        // Balance stays reserved while FAILED so a retry (same idempotency key) or cancel resolves it.
        await this.prisma.sellerPayout.update({ where: { id }, data: { status: 'FAILED', failureReason: reason } });
        await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'marketplace.payout.failed', targetType: 'seller_payout', targetId: id, afterState: { reason } });
        throw new BadRequestException({ code: 'PAYOUT_FAILED', message: `The transfer failed: ${reason}` });
      }
    }
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: `marketplace.payout.${action.toLowerCase()}`, targetType: 'seller_payout', targetId: id, afterState: { note: note ?? null } });
    return this.payoutView(await this.prisma.sellerPayout.findUniqueOrThrow({ where: { id } }));
  }

  async adminCases(userId: string, status?: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const rows = await this.prisma.marketplaceCase.findMany({ where: status ? { status: status as never } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { buyer: { select: { email: true, displayName: true } }, order: { select: { id: true, amountMinor: true, refundedMinor: true, currency: true, status: true, paidAt: true, listing: { select: { title: true } } } } } });
    return rows.map((c) => ({ ...this.caseView(c), buyer: c.buyer, order: c.order ? { id: c.order.id, title: c.order.listing.title, amountMinor: Number(c.order.amountMinor), refundedMinor: Number(c.order.refundedMinor), currency: c.order.currency, status: c.order.status, paidAt: c.order.paidAt } : null }));
  }

  /** Approve (with a provider refund for orders), deny or close. Idempotent per case. */
  async adminResolveCase(userId: string, id: string, decision: 'REVIEW' | 'APPROVE_REFUND' | 'DENY' | 'CLOSE', input: { note?: string; amountMinor?: number }) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const c = await this.prisma.marketplaceCase.findUnique({ where: { id }, include: { order: true } });
    if (!c) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'Case not found.' });
    if (['REFUNDED', 'DENIED', 'CLOSED'].includes(c.status)) throw new BadRequestException({ code: 'CASE_CLOSED', message: 'This case is closed.' });
    if (decision !== 'REVIEW' && !input.note?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Record the reason for this decision.' });
    if (decision === 'APPROVE_REFUND') {
      const o = c.order;
      if (!o?.paymentIntentId) throw new BadRequestException({ code: 'NOT_REFUNDABLE', message: 'Only paid digital-product orders can be refunded here.' });
      const max = o.amountMinor - o.refundedMinor;
      const amount = BigInt(input.amountMinor ?? Number(c.requestedAmountMinor ?? max));
      if (amount <= 0n || amount > max) throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'The refund cannot exceed the unrefunded amount.' });
      // The tax on the refunded part goes back too. A full refund returns everything left on the charge.
      const grossRefund = amount === max ? null : o.amountMinor > 0n ? (amount * (o.amountMinor + o.taxMinor)) / o.amountMinor : amount;
      await this.prisma.marketplaceCase.update({ where: { id }, data: { status: 'APPROVED', approvedAmountMinor: amount, decisionNote: input.note!.trim(), decidedBy: userId, decidedAt: new Date() } });
      const refund = await this.stripe.request<StripeObject>('POST', '/refunds', { payment_intent: o.paymentIntentId, ...(grossRefund === null ? {} : { amount: Number(grossRefund) }), metadata: { caseId: id, orderId: o.id } }, `marketplace-refund:${id}`);
      await this.prisma.marketplaceCase.update({ where: { id }, data: { providerRefundId: refund.id } });
      if (refund.status === 'succeeded') await this.applyRefund(o.id, refund.id, Number(refund.amount ?? grossRefund ?? amount + o.taxMinor), id);
    } else {
      await this.prisma.marketplaceCase.update({ where: { id }, data: { status: decision === 'REVIEW' ? 'UNDER_REVIEW' : decision === 'DENY' ? 'DENIED' : 'CLOSED', decisionNote: input.note?.trim() || c.decisionNote, ...(decision === 'REVIEW' ? {} : { decidedBy: userId, decidedAt: new Date() }) } });
    }
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: `marketplace.case.${decision.toLowerCase()}`, targetType: 'marketplace_case', targetId: id, afterState: { note: input.note ?? null, amountMinor: input.amountMinor ?? null } });
    const ws = await this.market.defaultWorkspace(c.buyerId).catch(() => null);
    if (ws && decision !== 'REVIEW') this.market.notify(ws, c.buyerId, 'marketplace.case', 'Update on your request', decision === 'APPROVE_REFUND' ? 'Your refund was approved.' : `Your request was ${decision === 'DENY' ? 'declined' : 'closed'}: ${input.note}`);
    return this.caseView(await this.prisma.marketplaceCase.findUniqueOrThrow({ where: { id } }));
  }

  async adminTransactions(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.manage');
    const [orders, deals] = await Promise.all([
      this.prisma.marketplaceOrder.findMany({ where: { status: { not: 'PENDING_PAYMENT' } }, orderBy: { createdAt: 'desc' }, take: 200, include: { listing: { select: { title: true } }, buyer: { select: { email: true } }, seller: { select: { email: true } } } }),
      this.prisma.marketplaceTransaction.findMany({ orderBy: { updatedAt: 'desc' }, take: 200, include: { listing: { select: { title: true } }, buyer: { select: { email: true } }, seller: { select: { email: true } } } }),
    ]);
    return [
      ...orders.map((o) => ({ id: o.id, kind: 'DIGITAL_PRODUCT', listing: o.listing.title, buyer: o.buyer.email, seller: o.seller.email, amountMinor: Number(o.amountMinor), feeMinor: Number(o.platformFeeMinor), refundedMinor: Number(o.refundedMinor), currency: o.currency, status: o.status, createdAt: o.createdAt })),
      ...deals.map((t) => ({ id: t.id, kind: 'ACQUISITION', listing: t.listing.title, buyer: t.buyer.email, seller: t.seller.email, amountMinor: Number(t.amountMinor), feeMinor: 0, refundedMinor: 0, currency: t.currency, status: t.status, createdAt: t.createdAt })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Manual balance correction: always with a reason, recorded in the ledger and audit log. */
  async adminAdjust(userId: string, sellerUserId: string, amountMinor: number, currency: string, reason: string) {
    await this.rbac.assertGlobalPermission(userId, 'marketplace.payouts');
    if (!reason?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Give a reason.' });
    if (!Number.isInteger(amountMinor) || amountMinor === 0) throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'Enter a non-zero amount.' });
    const e = await this.prisma.sellerLedgerEntry.create({ data: { sellerId: sellerUserId, type: 'ADJUSTMENT', amountMinor: BigInt(amountMinor), currency: currency.toUpperCase(), idempotencyKey: `adjust:${randomBytes(12).toString('hex')}`, memo: reason.trim().slice(0, 200), createdBy: userId } });
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'marketplace.ledger.adjust', targetType: 'seller_ledger_entry', targetId: e.id, afterState: { sellerUserId, amountMinor, currency, reason } });
    return { id: e.id };
  }
}
