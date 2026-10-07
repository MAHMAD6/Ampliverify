import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';
import { SETTING, SettingsService } from './settings.service';

export type ResolvedFeature = { enabled: boolean; limit: number | null; config: unknown };

export type WorkspacePlan = {
  planCode: string | null;
  planName: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  periodStart: Date;
  periodEnd: Date | null;
  /** null = no plan applies, so nothing is restricted. */
  features: Map<string, ResolvedFeature> | null;
};

const LIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Plan entitlements per workspace: the live subscription's plan, else the
 * platform default plan (system setting), then per-workspace overrides.
 * Module kill-switches (module_controls) apply to everyone.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async resolve(workspaceId: string, db: Db = this.prisma): Promise<WorkspacePlan> {
    const subscription = await db.subscription.findFirst({
      where: { workspaceId, status: { in: [...LIVE_STATUSES] } },
      orderBy: { currentPeriodEnd: 'desc' },
      include: { plan: { include: { entitlements: { include: { feature: true } } } } },
    });

    let plan = subscription?.plan ?? null;
    if (!plan) {
      const code = await this.settings.get<string | null>(SETTING.defaultPlanCode, null, db);
      if (code) {
        plan = await db.plan.findUnique({ where: { code }, include: { entitlements: { include: { feature: true } } } });
      }
    }

    const overrides = await db.workspaceEntitlementOverride.findMany({
      where: { workspaceId, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      include: { feature: true },
      orderBy: { startsAt: 'asc' },
    });

    let features: Map<string, ResolvedFeature> | null = null;
    if (plan || overrides.length) {
      features = new Map();
      for (const e of plan?.entitlements ?? []) {
        features.set(e.feature.key, { enabled: e.enabled, limit: e.limitNumeric ? Number(e.limitNumeric) : null, config: e.configJson });
      }
      for (const o of overrides) {
        features.set(o.feature.key, { enabled: o.enabled, limit: o.limitNumeric ? Number(o.limitNumeric) : null, config: o.configJson });
      }
    }

    return {
      planCode: plan?.code ?? null,
      planName: plan?.name ?? null,
      subscriptionId: subscription?.id ?? null,
      subscriptionStatus: subscription?.status ?? null,
      periodStart: subscription?.currentPeriodStart ?? monthStart(),
      periodEnd: subscription?.currentPeriodEnd ?? null,
      // Overrides alone (no plan) only restrict what they name.
      features: plan ? features : overrides.length ? features : null,
    };
  }

  async assertModuleEnabled(moduleKey: string, db: Db = this.prisma) {
    const control = await db.moduleControl.findUnique({ where: { moduleKey } });
    if (control && !control.enabled) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'This module is temporarily unavailable.' });
    }
  }

  /** Boolean capability check. Missing from a configured plan = not included. */
  async assertFeature(workspaceId: string, featureKey: string, db: Db = this.prisma) {
    const plan = await this.resolve(workspaceId, db);
    if (!plan.features) return plan;
    const feature = plan.features.get(featureKey);
    const restricted = plan.planCode ? !feature?.enabled : feature !== undefined && !feature.enabled;
    if (restricted) {
      throw new ForbiddenException({
        code: 'PLAN_RESTRICTED',
        message: 'Your current plan does not include this feature. Upgrade to use it.',
      });
    }
    return plan;
  }

  /**
   * Usage limit check for the current billing period: sum of `usage_events`
   * for `usageFeatureKey` plus `units` must not exceed the plan's limit.
   */
  async assertWithinLimit(workspaceId: string, limitKey: string, usageFeatureKey: string, units = 1, db: Db = this.prisma) {
    const plan = await this.resolve(workspaceId, db);
    const limit = plan.features?.get(limitKey);
    if (!limit || limit.limit === null) return { used: null, limit: null };
    const agg = await db.usageEvent.aggregate({
      where: { workspaceId, featureKey: usageFeatureKey, occurredAt: { gte: plan.periodStart } },
      _sum: { units: true },
    });
    const used = Number(agg._sum.units ?? new Prisma.Decimal(0));
    if (used + units > limit.limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        message: `You have reached your plan limit (${limit.limit}) for this billing period.`,
      });
    }
    return { used, limit: limit.limit };
  }

  /** Project-count limit (`limit.projects`), counted live rather than from usage. */
  async assertProjectLimit(workspaceId: string, db: Db = this.prisma) {
    const plan = await this.resolve(workspaceId, db);
    const limit = plan.features?.get('limit.projects')?.limit;
    if (limit === undefined || limit === null) return;
    const count = await db.project.count({ where: { workspaceId, deletedAt: null, status: { not: 'ARCHIVED' } } });
    if (count >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        message: `Your plan allows ${limit} active project${limit === 1 ? '' : 's'}. Archive a project or upgrade.`,
      });
    }
  }
}
