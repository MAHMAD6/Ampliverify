import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingInterval, EntitlementValueType, PlanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from '../commerce/credits.service';
import { BillingService } from '../billing/billing.service';
import { RequestMeta } from '../common/types/request-meta.type';

export type PlanInput = { code?: string; name?: string; description?: string | null; status?: PlanStatus; isPublic?: boolean; displayOrder?: number };
export type PriceInput = { billingInterval: BillingInterval; currency: string; amountMinor: number };
export type EntitlementInput = { featureKey: string; enabled: boolean; limit?: number | null; config?: unknown };
export type FeatureInput = { key: string; name: string; moduleKey?: string | null; description?: string | null; valueType: EntitlementValueType };
export type OverrideInput = { featureKey: string; enabled: boolean; limit?: number | null; reason: string; endsAt?: string | null };
export type AdjustmentInput = { workspaceId: string; type: 'CREDIT' | 'DEBIT' | 'PROMOTIONAL_CREDIT' | 'CORRECTION'; amount: number; reasonCode: string; internalNote: string };

/**
 * Super Admin commerce: plans, prices, features, entitlements, workspace
 * overrides, subscriptions/invoices (read) and credit adjustments with
 * two-person approval (requester ≠ approver).
 */
@Injectable()
export class CommerceAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly credits: CreditsService,
    private readonly billing: BillingService,
  ) {}

  private guard(userId: string, permission = 'commerce.manage') {
    return this.rbac.assertGlobalPermission(userId, permission);
  }

  // ── Plans ──────────────────────────────────────────────────────────────

  async listPlans(userId: string) {
    await this.guard(userId);
    return this.prisma.plan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        prices: { orderBy: [{ billingInterval: 'asc' }, { createdAt: 'desc' }] },
        entitlements: { include: { feature: true } },
        _count: { select: { subscriptions: { where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } } } } },
      },
    });
  }

  async getPlan(userId: string, code: string) {
    await this.guard(userId);
    const plan = await this.prisma.plan.findUnique({
      where: { code },
      include: { prices: { orderBy: { createdAt: 'desc' } }, entitlements: { include: { feature: true } }, _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    return plan;
  }

  async createPlan(userId: string, input: PlanInput, meta?: RequestMeta) {
    await this.guard(userId);
    const code = (input.code ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!code || !input.name?.trim()) throw new BadRequestException({ code: 'PLAN_INVALID', message: 'Plan code and name are required.' });
    if (await this.prisma.plan.findUnique({ where: { code } })) throw new ConflictException({ code: 'PLAN_CODE_EXISTS', message: 'A plan with this code already exists.' });
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: { code, name: input.name!.trim(), description: input.description ?? null, status: input.status ?? 'DRAFT', isPublic: input.isPublic ?? false, displayOrder: input.displayOrder ?? 0 },
      });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'plan.create', targetType: 'plan', targetId: plan.id, afterState: { code, name: plan.name, status: plan.status }, requestMeta: meta }, tx);
      return plan;
    });
  }

  async updatePlan(userId: string, code: string, input: PlanInput, meta?: RequestMeta) {
    await this.guard(userId);
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.plan.update({
        where: { id: plan.id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
          ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
        },
      });
      await this.auditLog.record(
        { actorUserId: userId, actorRole: 'admin', action: 'plan.update', targetType: 'plan', targetId: plan.id, beforeState: { name: plan.name, status: plan.status, isPublic: plan.isPublic }, afterState: { name: saved.name, status: saved.status, isPublic: saved.isPublic }, requestMeta: meta },
        tx,
      );
      return saved;
    });
  }

  /** Adds a price. Existing prices are never edited (subscriptions reference them); the old one is deactivated. */
  async addPrice(userId: string, code: string, input: PriceInput, meta?: RequestMeta) {
    await this.guard(userId);
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) throw new BadRequestException({ code: 'PRICE_INVALID', message: 'Amount must be a whole number of minor units (e.g. cents).' });
    const price = await this.prisma.$transaction(async (tx) => {
      await tx.planPrice.updateMany({ where: { planId: plan.id, billingInterval: input.billingInterval, active: true }, data: { active: false } });
      const created = await tx.planPrice.create({
        data: { planId: plan.id, billingInterval: input.billingInterval, currency: input.currency.toUpperCase().slice(0, 3), amountMinor: BigInt(input.amountMinor) },
      });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'plan.price.create', targetType: 'plan_price', targetId: created.id, afterState: { planCode: code, ...input }, requestMeta: meta }, tx);
      return created;
    });
    return this.billing.syncPriceToStripe(price.id);
  }

  async setEntitlements(userId: string, code: string, entitlements: EntitlementInput[], meta?: RequestMeta) {
    await this.guard(userId);
    const plan = await this.prisma.plan.findUnique({ where: { code }, include: { entitlements: { include: { feature: true } } } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    const features = await this.prisma.feature.findMany({ where: { key: { in: entitlements.map((e) => e.featureKey) } } });
    const byKey = new Map(features.map((f) => [f.key, f]));
    const unknown = entitlements.filter((e) => !byKey.has(e.featureKey)).map((e) => e.featureKey);
    if (unknown.length) throw new BadRequestException({ code: 'UNKNOWN_FEATURES', message: `Unknown features: ${unknown.join(', ')}` });
    await this.prisma.$transaction(async (tx) => {
      for (const e of entitlements) {
        const feature = byKey.get(e.featureKey)!;
        const data = {
          enabled: e.enabled,
          limitNumeric: feature.valueType === 'LIMIT' && e.limit !== undefined && e.limit !== null ? new Prisma.Decimal(e.limit) : null,
          configJson: feature.valueType === 'CONFIG' && e.config !== undefined ? (e.config as Prisma.InputJsonValue) : Prisma.DbNull,
        };
        await tx.planEntitlement.upsert({ where: { planId_featureId: { planId: plan.id, featureId: feature.id } }, create: { planId: plan.id, featureId: feature.id, ...data }, update: data });
      }
      await this.auditLog.record(
        {
          actorUserId: userId,
          actorRole: 'admin',
          action: 'plan.entitlements.update',
          targetType: 'plan',
          targetId: plan.id,
          beforeState: { entitlements: plan.entitlements.map((e) => ({ key: e.feature.key, enabled: e.enabled, limit: e.limitNumeric?.toString() ?? null })) },
          afterState: { entitlements: entitlements.map((e) => ({ key: e.featureKey, enabled: e.enabled, limit: e.limit ?? null })) },
          requestMeta: meta,
        },
        tx,
      );
    });
    return this.getPlan(userId, code);
  }

  async listFeatures(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    return this.prisma.feature.findMany({ orderBy: [{ moduleKey: 'asc' }, { key: 'asc' }] });
  }

  async createFeature(userId: string, input: FeatureInput, meta?: RequestMeta) {
    await this.guard(userId);
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z0-9_.]+$/.test(key)) throw new BadRequestException({ code: 'FEATURE_KEY_INVALID', message: 'Use lower-case letters, digits, dots and underscores.' });
    if (await this.prisma.feature.findUnique({ where: { key } })) throw new ConflictException({ code: 'FEATURE_EXISTS', message: 'This feature key already exists.' });
    const feature = await this.prisma.feature.create({ data: { key, name: input.name.trim(), moduleKey: input.moduleKey ?? null, description: input.description ?? null, valueType: input.valueType } });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'plan.feature.create', targetType: 'feature', targetId: feature.id, afterState: { key, valueType: input.valueType }, requestMeta: meta });
    return feature;
  }

  async addOverride(userId: string, workspaceId: string, input: OverrideInput, meta?: RequestMeta) {
    await this.guard(userId);
    const feature = await this.prisma.feature.findUnique({ where: { key: input.featureKey } });
    if (!feature) throw new BadRequestException({ code: 'UNKNOWN_FEATURES', message: 'Unknown feature.' });
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.workspaceEntitlementOverride.create({
        data: {
          workspaceId,
          featureId: feature.id,
          enabled: input.enabled,
          limitNumeric: input.limit ?? null,
          reason: input.reason,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          createdBy: userId,
        },
      });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', organizationId: ws.organizationId, workspaceId, action: 'plan.override.create', targetType: 'workspace_entitlement_override', targetId: o.id, afterState: { ...input }, reason: input.reason, requestMeta: meta }, tx);
      return o;
    });
  }

  async listOverrides(userId: string, workspaceId?: string) {
    await this.guard(userId);
    return this.prisma.workspaceEntitlementOverride.findMany({
      where: workspaceId ? { workspaceId } : {},
      include: { feature: true, workspace: { select: { id: true, name: true } }, creator: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // ── Subscriptions / invoices (read) ────────────────────────────────────

  async listSubscriptions(userId: string, status?: string) {
    await this.rbac.assertGlobalPermission(userId, 'billing.read');
    return this.prisma.subscription.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { updatedAt: 'desc' },
      include: { plan: { select: { code: true, name: true } }, workspace: { select: { id: true, name: true, organization: { select: { name: true } } } }, items: { include: { planPrice: true } } },
      take: 500,
    });
  }

  async getSubscription(userId: string, id: string) {
    await this.rbac.assertGlobalPermission(userId, 'billing.read');
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, workspace: { include: { organization: true } }, items: { include: { planPrice: true } }, invoices: { orderBy: { issuedAt: 'desc' }, take: 50 } },
    });
    if (!sub) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found.' });
    return sub;
  }

  async listInvoices(userId: string, status?: string) {
    await this.rbac.assertGlobalPermission(userId, 'billing.read');
    return this.prisma.invoice.findMany({
      where: status ? { status: status as never } : {},
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: { workspace: { select: { id: true, name: true } } },
      take: 500,
    });
  }

  async getInvoice(userId: string, id: string) {
    await this.rbac.assertGlobalPermission(userId, 'billing.read');
    const inv = await this.prisma.invoice.findUnique({ where: { id }, include: { lines: true, workspace: { include: { organization: true } }, subscription: { include: { plan: true } } } });
    if (!inv) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' });
    const events = await this.prisma.paymentEvent.findMany({ where: { payloadRef: inv.providerInvoiceId }, orderBy: { receivedAt: 'desc' } });
    return { ...inv, events };
  }

  // ── Credit adjustments ─────────────────────────────────────────────────

  async listAdjustments(userId: string, status?: string) {
    await this.rbac.assertGlobalPermission(userId, 'billing.read');
    return this.prisma.creditAdjustment.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        workspace: { select: { id: true, name: true } },
        requester: { select: { id: true, email: true, displayName: true } },
        approver: { select: { id: true, email: true, displayName: true } },
      },
      take: 500,
    });
  }

  async requestAdjustment(userId: string, input: AdjustmentInput, meta?: RequestMeta) {
    await this.guard(userId, 'credit.adjust');
    if (!input.amount || !Number.isFinite(input.amount)) throw new BadRequestException({ code: 'AMOUNT_INVALID', message: 'Enter a non-zero amount.' });
    if (!input.internalNote?.trim() || !input.reasonCode?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'A reason code and internal note are required.' });
    const ws = await this.prisma.workspace.findUnique({ where: { id: input.workspaceId } });
    if (!ws) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
    const signed = input.type === 'DEBIT' ? -Math.abs(input.amount) : input.type === 'CORRECTION' ? input.amount : Math.abs(input.amount);
    return this.prisma.$transaction(async (tx) => {
      const adj = await tx.creditAdjustment.create({
        data: { workspaceId: input.workspaceId, type: input.type, amount: signed, reasonCode: input.reasonCode.trim(), internalNote: input.internalNote.trim(), requestedBy: userId },
      });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', organizationId: ws.organizationId, workspaceId: ws.id, action: 'credit.adjustment.request', targetType: 'credit_adjustment', targetId: adj.id, afterState: { type: input.type, amount: signed, reasonCode: input.reasonCode }, reason: input.internalNote, requestMeta: meta }, tx);
      return adj;
    });
  }

  async reviewAdjustment(userId: string, id: string, approve: boolean, meta?: RequestMeta) {
    await this.guard(userId, 'credit.adjust');
    const adj = await this.prisma.creditAdjustment.findUnique({ where: { id }, include: { workspace: true } });
    if (!adj) throw new NotFoundException({ code: 'ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found.' });
    if (adj.status !== 'PENDING_REVIEW') throw new ConflictException({ code: 'ADJUSTMENT_NOT_PENDING', message: 'This adjustment has already been reviewed.' });
    if (adj.requestedBy === userId) throw new ForbiddenException({ code: 'SELF_APPROVAL_NOT_ALLOWED', message: 'A different administrator must review this adjustment.' });

    return this.prisma.$transaction(async (tx) => {
      if (!approve) {
        const rejected = await tx.creditAdjustment.update({ where: { id }, data: { status: 'REJECTED', approvedBy: userId, approvedAt: new Date() } });
        await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', organizationId: adj.workspace.organizationId, workspaceId: adj.workspaceId, action: 'credit.adjustment.reject', targetType: 'credit_adjustment', targetId: id, requestMeta: meta }, tx);
        return rejected;
      }
      const before = (await tx.creditWallet.findUnique({ where: { workspaceId: adj.workspaceId } }))?.balanceCache ?? new Prisma.Decimal(0);
      const entry = await this.credits.applyEntry(tx, {
        workspaceId: adj.workspaceId,
        delta: adj.amount,
        reason: new Prisma.Decimal(adj.amount).isNegative() ? 'ADJUSTMENT_DEBIT' : 'ADJUSTMENT_CREDIT',
        referenceType: 'credit_adjustment',
        referenceId: adj.id,
        idempotencyKey: `adjustment:${adj.id}`,
        createdBy: userId,
        allowNegative: adj.type === 'CORRECTION',
      });
      const after = new Prisma.Decimal(before).add(adj.amount);
      const applied = await tx.creditAdjustment.update({
        where: { id },
        data: { status: 'APPLIED', approvedBy: userId, approvedAt: new Date(), ledgerEntryId: entry.id, balanceBefore: before, balanceAfter: after },
      });
      await this.auditLog.record(
        { actorUserId: userId, actorRole: 'admin', organizationId: adj.workspace.organizationId, workspaceId: adj.workspaceId, action: 'credit.adjustment.apply', targetType: 'credit_adjustment', targetId: id, beforeState: { balance: before.toString() }, afterState: { balance: after.toString() }, requestMeta: meta },
        tx,
      );
      return applied;
    });
  }

  /** Reverses an applied adjustment with an opposite, linked adjustment. */
  async reverseAdjustment(userId: string, id: string, note: string, meta?: RequestMeta) {
    await this.guard(userId, 'credit.adjust');
    const adj = await this.prisma.creditAdjustment.findUnique({ where: { id }, include: { workspace: true, reversedBy: true } });
    if (!adj) throw new NotFoundException({ code: 'ADJUSTMENT_NOT_FOUND', message: 'Adjustment not found.' });
    if (adj.status !== 'APPLIED' || adj.reversedBy) throw new ConflictException({ code: 'ADJUSTMENT_NOT_REVERSIBLE', message: 'Only applied adjustments can be reversed, once.' });
    return this.prisma.$transaction(async (tx) => {
      const amount = new Prisma.Decimal(adj.amount).negated();
      const reversal = await tx.creditAdjustment.create({
        data: { workspaceId: adj.workspaceId, type: 'CORRECTION', amount, reasonCode: 'REVERSAL', internalNote: note || `Reversal of ${adj.id}`, requestedBy: userId, approvedBy: userId, approvedAt: new Date(), status: 'APPLIED', reversesAdjustmentId: adj.id },
      });
      const entry = await this.credits.applyEntry(tx, {
        workspaceId: adj.workspaceId,
        delta: amount,
        reason: 'REVERSAL',
        referenceType: 'credit_adjustment',
        referenceId: reversal.id,
        idempotencyKey: `adjustment-reversal:${adj.id}`,
        createdBy: userId,
        allowNegative: true,
      });
      await tx.creditAdjustment.update({ where: { id: reversal.id }, data: { ledgerEntryId: entry.id } });
      await tx.creditAdjustment.update({ where: { id: adj.id }, data: { status: 'REVERSED' } });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', organizationId: adj.workspace.organizationId, workspaceId: adj.workspaceId, action: 'credit.adjustment.reverse', targetType: 'credit_adjustment', targetId: adj.id, reason: note, requestMeta: meta }, tx);
      return reversal;
    });
  }
}
