import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { PlatformService } from '../platform/platform.service';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from '../commerce/credits.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { SETTING, SettingsService } from '../commerce/settings.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { StripeClient } from './stripe.client';

export type CreditPack = { code: string; name?: string; credits: number; amountMinor: number; currency: string };

type StripeObject = Record<string, unknown> & { id: string };
type StripeEvent = { id: string; type: string; data: { object: StripeObject } };

const STRIPE = 'stripe';

function toDate(unix: unknown) {
  return typeof unix === 'number' ? new Date(unix * 1000) : null;
}

function mapStatus(status: unknown): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      return 'INCOMPLETE';
  }
}

/**
 * Subscriptions, invoices and credit purchases through Stripe Checkout and
 * the Customer Portal. Stripe is the source of truth: local rows are written
 * only from verified webhooks, processed idempotently from `webhook_events`.
 */
@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly stripe: StripeClient,
    private readonly config: ConfigService,
    private readonly platform: PlatformService,
  ) {}

  onModuleInit() {
    this.jobs.register('billing.webhook', async (payload) => this.processWebhook(String(payload.webhookEventId)));
  }

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  // ── Read models ────────────────────────────────────────────────────────

  async overview(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'usage.read');
    const plan = await this.entitlements.resolve(workspaceId);
    const [balance, usage, subscription, packs, costs] = await Promise.all([
      this.credits.balance(workspaceId),
      this.credits.usageSince(workspaceId, plan.periodStart),
      plan.subscriptionId
        ? this.prisma.subscription.findUnique({ where: { id: plan.subscriptionId }, include: { plan: true, items: { include: { planPrice: true } } } })
        : null,
      this.settings.get<CreditPack[]>(SETTING.creditPacks, []),
      this.settings.get<Record<string, number>>(SETTING.creditCosts, {}),
    ]);
    const lowThreshold = Number((await this.settings.get<{ lowCreditThreshold?: number }>(SETTING.general, {})).lowCreditThreshold ?? 0);
    return {
      plan: { code: plan.planCode, name: plan.planName },
      subscription: subscription && {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        interval: subscription.items[0]?.planPrice.billingInterval ?? null,
        amountMinor: subscription.items[0]?.planPrice.amountMinor ?? null,
        currency: subscription.items[0]?.planPrice.currency ?? null,
      },
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      credits: { balance, lowThreshold, low: lowThreshold > 0 && Number(balance) <= lowThreshold },
      usage: usage.map((u) => ({ featureKey: u.featureKey, units: Number(u._sum.units ?? 0) })),
      limits: plan.features
        ? [...plan.features.entries()].filter(([, f]) => f.limit !== null).map(([key, f]) => ({ featureKey: key, limit: f.limit }))
        : [],
      features: plan.features ? [...plan.features.entries()].map(([key, f]) => ({ featureKey: key, enabled: f.enabled, limit: f.limit })) : null,
      creditPacks: packs,
      creditCosts: costs,
      paymentsEnabled: this.stripe.configured,
    };
  }

  async invoices(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'billing.read');
    return this.prisma.invoice.findMany({
      where: { workspaceId },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: { lines: true },
      take: 200,
    });
  }

  async ledger(userId: string, workspaceId: string, limit?: number) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'usage.read');
    return this.credits.ledger(workspaceId, limit);
  }

  async usageHistory(userId: string, workspaceId: string, days = 30) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'usage.read');
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000);
    const rows = await this.prisma.$queryRaw<{ day: Date; feature_key: string; units: Prisma.Decimal }[]>`
      SELECT date_trunc('day', "occurred_at") AS day, "feature_key", SUM("units") AS units
        FROM "usage_events"
       WHERE "workspace_id" = ${workspaceId}::uuid AND "occurred_at" >= ${since}
       GROUP BY 1, 2 ORDER BY 1`;
    const events = await this.prisma.usageEvent.findMany({
      where: { workspaceId, occurredAt: { gte: since } },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      include: { project: { select: { id: true, name: true } } },
    });
    return {
      daily: rows.map((r) => ({ day: r.day, featureKey: r.feature_key, units: Number(r.units) })),
      events: events.map((e) => ({ id: e.id, featureKey: e.featureKey, units: Number(e.units), occurredAt: e.occurredAt, project: e.project })),
    };
  }

  // ── Checkout / portal ──────────────────────────────────────────────────

  private async customerFor(workspaceId: string, email: string) {
    const existing = await this.prisma.billingCustomer.findUnique({ where: { workspaceId_provider: { workspaceId, provider: STRIPE } } });
    if (existing) return existing.providerCustomerId;
    const customer = await this.stripe.request<StripeObject>('POST', '/customers', { email, metadata: { workspaceId } }, `customer:${workspaceId}`);
    await this.prisma.billingCustomer.create({ data: { workspaceId, provider: STRIPE, providerCustomerId: customer.id } });
    return customer.id;
  }

  async checkoutSubscription(userId: string, workspaceId: string, planCode: string, interval: 'MONTHLY' | 'ANNUAL', meta?: RequestMeta) {
    const workspace = await this.rbac.requireWorkspace(userId, workspaceId, 'billing.manage');
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode }, include: { prices: { where: { active: true, billingInterval: interval } } } });
    if (!plan || plan.status !== 'ACTIVE' || !plan.isPublic) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'This plan is not available.' });
    const price = plan.prices[0];
    if (!price?.providerPriceId) throw new BadRequestException({ code: 'PRICE_NOT_AVAILABLE', message: 'This plan cannot be purchased online yet.' });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const live = await this.prisma.subscription.findFirst({ where: { workspaceId, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] }, providerSubscriptionId: { not: null } } });
    if (live) return this.portal(userId, workspaceId);

    const customer = await this.customerFor(workspaceId, user.email);
    const session = await this.stripe.request<{ id: string; url: string }>('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer,
      line_items: [{ price: price.providerPriceId, quantity: 1 }],
      success_url: `${this.webUrl}/app/settings/billing?checkout=success`,
      cancel_url: `${this.webUrl}/app/billing?checkout=canceled`,
      client_reference_id: workspaceId,
      metadata: { workspaceId, planId: plan.id, kind: 'subscription' },
      subscription_data: { metadata: { workspaceId, planId: plan.id } },
      allow_promotion_codes: true,
    });
    await this.auditLog.record({ actorUserId: userId, organizationId: workspace.organizationId, workspaceId, action: 'billing.checkout.start', targetType: 'plan', targetId: plan.id, afterState: { planCode, interval }, requestMeta: meta });
    return { url: session.url };
  }

  async checkoutCredits(userId: string, workspaceId: string, packCode: string, meta?: RequestMeta) {
    const workspace = await this.rbac.requireWorkspace(userId, workspaceId, 'billing.manage');
    const packs = await this.settings.get<CreditPack[]>(SETTING.creditPacks, []);
    const pack = packs.find((p) => p.code === packCode);
    if (!pack) throw new NotFoundException({ code: 'PACK_NOT_FOUND', message: 'This credit pack is not available.' });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const customer = await this.customerFor(workspaceId, user.email);
    const session = await this.stripe.request<{ id: string; url: string }>('POST', '/checkout/sessions', {
      mode: 'payment',
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: { currency: pack.currency.toLowerCase(), unit_amount: pack.amountMinor, product_data: { name: pack.name ?? `${pack.credits} AmpliVerify credits` } },
        },
      ],
      success_url: `${this.webUrl}/app/usage?purchase=success`,
      cancel_url: `${this.webUrl}/app/usage?purchase=canceled`,
      client_reference_id: workspaceId,
      metadata: { workspaceId, kind: 'credits', packCode, credits: String(pack.credits) },
      payment_intent_data: { metadata: { workspaceId, kind: 'credits', packCode, credits: String(pack.credits) } },
    });
    await this.auditLog.record({ actorUserId: userId, organizationId: workspace.organizationId, workspaceId, action: 'credit.purchase.start', targetType: 'credit_pack', targetId: null, afterState: { packCode, credits: pack.credits }, requestMeta: meta });
    return { url: session.url };
  }

  async portal(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'billing.manage');
    const customer = await this.prisma.billingCustomer.findUnique({ where: { workspaceId_provider: { workspaceId, provider: STRIPE } } });
    if (!customer) throw new BadRequestException({ code: 'NO_BILLING_ACCOUNT', message: 'There is no billing account for this workspace yet.' });
    const session = await this.stripe.request<{ url: string }>('POST', '/billing_portal/sessions', {
      customer: customer.providerCustomerId,
      return_url: `${this.webUrl}/app/settings/billing`,
    });
    return { url: session.url };
  }

  async setCancelAtPeriodEnd(userId: string, workspaceId: string, cancel: boolean, meta?: RequestMeta) {
    const workspace = await this.rbac.requireWorkspace(userId, workspaceId, 'billing.manage');
    const sub = await this.prisma.subscription.findFirst({ where: { workspaceId, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] }, providerSubscriptionId: { not: null } } });
    if (!sub) throw new BadRequestException({ code: 'NO_SUBSCRIPTION', message: 'There is no active subscription.' });
    await this.stripe.request('POST', `/subscriptions/${sub.providerSubscriptionId}`, { cancel_at_period_end: cancel });
    const saved = await this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel } });
    await this.auditLog.record({ actorUserId: userId, organizationId: workspace.organizationId, workspaceId, action: cancel ? 'subscription.cancel' : 'subscription.resume', targetType: 'subscription', targetId: sub.id, requestMeta: meta });
    return saved;
  }

  // ── Webhooks ───────────────────────────────────────────────────────────

  async receiveWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !this.stripe.verifyWebhook(rawBody, signature)) {
      throw new UnauthorizedException({ code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature.' });
    }
    const event = JSON.parse(rawBody.toString('utf8')) as StripeEvent;
    const existing = await this.prisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: STRIPE, providerEventId: event.id } } });
    if (existing) return { received: true, duplicate: true };
    const row = await this.prisma.webhookEvent.create({
      data: { provider: STRIPE, providerEventId: event.id, eventType: event.type, payloadRef: rawBody.toString('utf8') },
    });
    await this.jobs.enqueue('billing.webhook', { webhookEventId: row.id }, { jobKey: `webhook:${row.id}` });
    return { received: true };
  }

  async processWebhook(webhookEventId: string) {
    const row = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!row || row.status === 'PROCESSED' || row.status === 'IGNORED') return;
    await this.prisma.webhookEvent.update({ where: { id: row.id }, data: { status: 'PROCESSING', attemptCount: { increment: 1 } } });
    const event = JSON.parse(row.payloadRef) as StripeEvent;
    try {
      const handled = await this.handleEvent(event);
      await this.prisma.webhookEvent.update({ where: { id: row.id }, data: { status: handled ? 'PROCESSED' : 'IGNORED', processedAt: new Date(), lastError: null } });
    } catch (err) {
      await this.prisma.webhookEvent.update({ where: { id: row.id }, data: { status: 'FAILED', lastError: String(err).slice(0, 2000) } });
      throw err;
    }
  }

  /** Exposed for tests: applies one verified event. Returns false for ignored types. */
  async handleEvent(event: StripeEvent): Promise<boolean> {
    const obj = event.data.object;
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const workspaceId = metadata.workspaceId ?? (await this.workspaceForCustomer(obj.customer as string | undefined));
    await this.prisma.paymentEvent.upsert({
      where: { provider_providerEventId: { provider: STRIPE, providerEventId: event.id } },
      create: { provider: STRIPE, providerEventId: event.id, eventType: event.type, workspaceId: workspaceId ?? null, payloadRef: obj.id },
      update: {},
    });

    switch (event.type) {
      case 'checkout.session.completed':
        if (metadata.kind === 'credits' && obj.payment_status === 'paid' && workspaceId) {
          await this.grantPurchase(workspaceId, String(obj.payment_intent ?? obj.id), Number(metadata.credits), Number(obj.amount_total ?? 0), String(obj.currency ?? 'usd'));
        }
        if (metadata.kind === 'subscription' && obj.subscription) {
          const sub = await this.stripe.request<StripeObject>('GET', `/subscriptions/${obj.subscription}`);
          await this.upsertSubscription(sub);
        }
        return true;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.upsertSubscription(obj);
        return true;
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
        await this.upsertInvoice(obj, event.type);
        return true;
      default:
        return false;
    }
  }

  private async workspaceForCustomer(customerId: string | undefined) {
    if (!customerId) return null;
    const c = await this.prisma.billingCustomer.findUnique({ where: { provider_providerCustomerId: { provider: STRIPE, providerCustomerId: customerId } } });
    return c?.workspaceId ?? null;
  }

  private async grantPurchase(workspaceId: string, paymentId: string, credits: number, amountMinor: number, currency: string) {
    if (!credits || credits <= 0) return;
    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.creditPurchase.upsert({
        where: { providerPaymentId: paymentId },
        create: { workspaceId, providerPaymentId: paymentId, credits, amountMinor: BigInt(amountMinor), currency: currency.toUpperCase().slice(0, 3), status: 'SUCCEEDED' },
        update: { status: 'SUCCEEDED' },
      });
      await this.credits.applyEntry(tx, {
        workspaceId,
        delta: credits,
        reason: 'PURCHASE',
        referenceType: 'credit_purchase',
        referenceId: purchase.id,
        idempotencyKey: `purchase:${paymentId}`,
      });
      await this.auditLog.record({ workspaceId, action: 'credit.purchase.complete', targetType: 'credit_purchase', targetId: purchase.id, afterState: { credits, amountMinor } }, tx);
    });
  }

  private async upsertSubscription(obj: StripeObject) {
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const workspaceId = metadata.workspaceId ?? (await this.workspaceForCustomer(obj.customer as string));
    if (!workspaceId) {
      this.logger.warn(`Subscription ${obj.id} has no workspace; ignored.`);
      return;
    }
    const items = ((obj.items as { data?: { price: { id: string }; quantity?: number }[] })?.data ?? []);
    const prices = await this.prisma.planPrice.findMany({ where: { providerPriceId: { in: items.map((i) => i.price.id) } } });
    const planId = prices[0]?.planId ?? metadata.planId;
    if (!planId) {
      this.logger.warn(`Subscription ${obj.id} uses an unknown price; ignored.`);
      return;
    }
    const firstItem = items[0] as unknown as Record<string, unknown> | undefined;
    const periodStart = toDate(obj.current_period_start) ?? toDate(firstItem?.current_period_start) ?? new Date();
    const periodEnd = toDate(obj.current_period_end) ?? toDate(firstItem?.current_period_end) ?? new Date();
    const data = {
      workspaceId,
      planId,
      status: mapStatus(obj.status),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: !!obj.cancel_at_period_end,
      canceledAt: toDate(obj.canceled_at),
    };
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { providerSubscriptionId: obj.id } });
      const sub = await tx.subscription.upsert({ where: { providerSubscriptionId: obj.id }, create: { ...data, providerSubscriptionId: obj.id }, update: data });
      for (const item of items) {
        const price = prices.find((p) => p.providerPriceId === item.price.id);
        if (!price) continue;
        await tx.subscriptionItem.upsert({
          where: { subscriptionId_planPriceId: { subscriptionId: sub.id, planPriceId: price.id } },
          create: { subscriptionId: sub.id, planPriceId: price.id, quantity: item.quantity ?? 1 },
          update: { quantity: item.quantity ?? 1 },
        });
      }
      await this.auditLog.record(
        { workspaceId, action: before ? 'subscription.update' : 'subscription.create', targetType: 'subscription', targetId: sub.id, beforeState: before ? { status: before.status, planId: before.planId } : null, afterState: { status: sub.status, planId: sub.planId } },
        tx,
      );
    });
  }

  private async upsertInvoice(obj: StripeObject, type: string) {
    const workspaceId = await this.workspaceForCustomer(obj.customer as string);
    if (!workspaceId) return;
    const statusMap: Record<string, 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE'> = {
      draft: 'DRAFT',
      open: 'OPEN',
      paid: 'PAID',
      void: 'VOID',
      uncollectible: 'UNCOLLECTIBLE',
    };
    const sub = obj.subscription ? await this.prisma.subscription.findUnique({ where: { providerSubscriptionId: String(obj.subscription) } }) : null;
    const lines = ((obj.lines as { data?: { description?: string; amount?: number; quantity?: number }[] })?.data ?? []);
    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.upsert({
        where: { providerInvoiceId: obj.id },
        create: {
          providerInvoiceId: obj.id,
          workspaceId,
          subscriptionId: sub?.id ?? null,
          status: statusMap[String(obj.status)] ?? 'OPEN',
          currency: String(obj.currency ?? 'usd').toUpperCase().slice(0, 3),
          totalMinor: BigInt(Number(obj.total ?? 0)),
          issuedAt: toDate(obj.created),
        },
        update: { status: statusMap[String(obj.status)] ?? 'OPEN', totalMinor: BigInt(Number(obj.total ?? 0)) },
      });
      const count = await tx.invoiceLine.count({ where: { invoiceId: inv.id } });
      if (count === 0 && lines.length) {
        await tx.invoiceLine.createMany({
          data: lines.map((l) => ({ invoiceId: inv.id, description: l.description ?? 'Subscription', amountMinor: BigInt(l.amount ?? 0), quantity: l.quantity ?? null })),
        });
      }
      return inv;
    });

    if (type === 'invoice.paid' && sub) {
      // Monthly credit allowance included in the plan (feature `credits.monthly_grant`).
      const plan = await this.entitlements.resolve(workspaceId);
      const grant = plan.features?.get('credits.monthly_grant')?.limit ?? 0;
      if (grant > 0) {
        await this.prisma.$transaction((tx) =>
          this.credits.applyEntry(tx, { workspaceId, delta: grant, reason: 'PLAN_GRANT', referenceType: 'invoice', referenceId: invoice.id, idempotencyKey: `plan-grant:${obj.id}` }),
        );
      }
    }
    if (type === 'invoice.payment_failed' || type === 'invoice.paid') {
      const owners = await this.workspaceOwners(workspaceId);
      for (const userId of owners) {
        await this.notifications.notify({
          workspaceId,
          userId,
          eventKey: type === 'invoice.paid' ? 'billing.invoice_paid' : 'billing.payment_failed',
          title: type === 'invoice.paid' ? 'Payment received' : 'Payment failed',
          body: type === 'invoice.paid' ? 'Thank you — your invoice has been paid.' : 'We could not collect your subscription payment. Update your payment method to avoid interruption.',
        });
      }
      if (type === 'invoice.payment_failed') {
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
        void this.platform.alertStaff('payment_failed', `Payment failed: ${ws?.name ?? workspaceId}`, `Stripe invoice ${obj.id} for workspace ${ws?.name ?? workspaceId} failed to collect.

See Super Admin → Billing & Invoices.`);
      }
    }
  }

  private async workspaceOwners(workspaceId: string) {
    const rows = await this.prisma.roleAssignment.findMany({
      where: { workspaceId, revokedAt: null, role: { key: 'OWNER' } },
      select: { userId: true },
    });
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    const orgRows = ws
      ? await this.prisma.roleAssignment.findMany({ where: { organizationId: ws.organizationId, scopeType: 'ORGANIZATION', revokedAt: null, role: { key: 'OWNER' } }, select: { userId: true } })
      : [];
    return [...new Set([...rows, ...orgRows].map((r) => r.userId))];
  }

  // ── Admin: plans & prices sync to Stripe ───────────────────────────────

  /** Creates the Stripe product/price for a plan price that has none (admin action). */
  async syncPriceToStripe(priceId: string) {
    const price = await this.prisma.planPrice.findUniqueOrThrow({ where: { id: priceId }, include: { plan: true } });
    if (price.providerPriceId || !this.stripe.configured) return price;
    const product = await this.stripe.request<StripeObject>('POST', '/products', { name: `AmpliVerify ${price.plan.name}`, metadata: { planId: price.planId, planCode: price.plan.code } }, `product:${price.planId}`);
    const stripePrice = await this.stripe.request<StripeObject>(
      'POST',
      '/prices',
      {
        product: product.id,
        currency: price.currency.toLowerCase(),
        unit_amount: Number(price.amountMinor),
        recurring: { interval: price.billingInterval === 'ANNUAL' ? 'year' : 'month' },
        metadata: { planPriceId: price.id },
      },
      `price:${price.id}`,
    );
    return this.prisma.planPrice.update({ where: { id: price.id }, data: { providerPriceId: stripePrice.id } });
  }
}
