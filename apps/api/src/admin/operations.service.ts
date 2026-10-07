import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncidentStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { SETTING, SettingsService } from '../commerce/settings.service';
import { RequestMeta } from '../common/types/request-meta.type';

/** Settings an administrator may edit, with light shape validation. */
const EDITABLE_SETTINGS: Record<string, (v: unknown) => boolean> = {
  [SETTING.creditCosts]: (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every((n) => typeof n === 'number' && n >= 0),
  [SETTING.creditPacks]: (v) =>
    Array.isArray(v) &&
    v.every((p) => p && typeof p.code === 'string' && Number.isFinite(p.credits) && p.credits > 0 && Number.isInteger(p.amountMinor) && p.amountMinor > 0 && typeof p.currency === 'string'),
  [SETTING.defaultPlanCode]: (v) => v === null || typeof v === 'string',
  [SETTING.signupCredits]: (v) => typeof v === 'number' && v >= 0,
  [SETTING.general]: (v) => !!v && typeof v === 'object' && !Array.isArray(v),
  [SETTING.notifications]: (v) => !!v && typeof v === 'object' && !Array.isArray(v),
  [SETTING.security]: (v) => !!v && typeof v === 'object' && !Array.isArray(v),
  [SETTING.appearance]: (v) => !!v && typeof v === 'object' && !Array.isArray(v),
};

export const MODULE_KEYS = ['seo_audit', 'optimization', 'seo_editor', 'content', 'keywords', 'geo', 'reports', 'ai', 'integrations', 'careers', 'blog'];

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  // ── Module controls & feature flags ────────────────────────────────────

  async setModule(userId: string, moduleKey: string, enabled: boolean, reason: string | undefined, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    if (!MODULE_KEYS.includes(moduleKey)) throw new BadRequestException({ code: 'UNKNOWN_MODULE', message: 'Unknown module.' });
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.moduleControl.findUnique({ where: { moduleKey } });
      const saved = await tx.moduleControl.upsert({ where: { moduleKey }, create: { moduleKey, enabled, updatedBy: userId }, update: { enabled, updatedBy: userId } });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'module.update', targetType: 'module_control', targetId: null, beforeState: { moduleKey, enabled: before?.enabled ?? true }, afterState: { moduleKey, enabled }, reason: reason ?? null, requestMeta: meta }, tx);
      return saved;
    });
  }

  async moduleList(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const rows = await this.prisma.moduleControl.findMany({ select: { moduleKey: true, enabled: true, updatedAt: true, updater: { select: { id: true, email: true, displayName: true } } } });
    return MODULE_KEYS.map((k) => rows.find((r) => r.moduleKey === k) ?? { moduleKey: k, enabled: true, updatedAt: null, updater: null });
  }

  async listFlags(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    return this.prisma.featureFlag.findMany({ orderBy: [{ key: 'asc' }, { environment: 'asc' }], include: { rules: { orderBy: { priority: 'asc' } } } });
  }

  async createFlag(userId: string, input: { key: string; description: string; environment: string; enabled?: boolean }, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z0-9_.-]+$/.test(key)) throw new BadRequestException({ code: 'FLAG_KEY_INVALID', message: 'Use lower-case letters, digits, dots, dashes and underscores.' });
    if (await this.prisma.featureFlag.findUnique({ where: { key_environment: { key, environment: input.environment } } })) {
      throw new ConflictException({ code: 'FLAG_EXISTS', message: 'This flag already exists in that environment.' });
    }
    const flag = await this.prisma.featureFlag.create({ data: { key, description: input.description, environment: input.environment, enabled: input.enabled ?? false } });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'flag.create', targetType: 'feature_flag', targetId: flag.id, afterState: { key, environment: flag.environment, enabled: flag.enabled }, requestMeta: meta });
    return flag;
  }

  async getFlag(userId: string, id: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const flag = await this.prisma.featureFlag.findUnique({ where: { id }, include: { rules: { orderBy: { priority: 'asc' } } } });
    if (!flag) throw new NotFoundException({ code: 'FLAG_NOT_FOUND', message: 'Feature flag not found.' });
    const history = await this.prisma.auditLog.findMany({ where: { targetType: 'feature_flag', targetId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { ...flag, history };
  }

  async updateFlag(
    userId: string,
    id: string,
    input: { enabled?: boolean; description?: string; rules?: { scopeType: string; scopeValue: string; percentage?: number | null; priority: number }[] },
    meta?: RequestMeta,
  ) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const flag = await this.prisma.featureFlag.findUnique({ where: { id }, include: { rules: true } });
    if (!flag) throw new NotFoundException({ code: 'FLAG_NOT_FOUND', message: 'Feature flag not found.' });
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.featureFlag.update({
        where: { id },
        data: { ...(input.enabled !== undefined && { enabled: input.enabled }), ...(input.description !== undefined && { description: input.description }) },
      });
      if (input.rules) {
        for (const r of input.rules) {
          if (!['WORKSPACE', 'ORGANIZATION', 'USER', 'PLAN', 'PERCENTAGE'].includes(r.scopeType)) {
            throw new BadRequestException({ code: 'FLAG_RULE_INVALID', message: `Unknown rule scope ${r.scopeType}.` });
          }
        }
        await tx.featureFlagRule.deleteMany({ where: { flagId: id } });
        if (input.rules.length) {
          await tx.featureFlagRule.createMany({ data: input.rules.map((r) => ({ flagId: id, scopeType: r.scopeType, scopeValue: r.scopeValue, percentage: r.percentage ?? null, priority: r.priority })) });
        }
      }
      await this.auditLog.record(
        { actorUserId: userId, actorRole: 'admin', action: 'flag.update', targetType: 'feature_flag', targetId: id, beforeState: { enabled: flag.enabled, rules: flag.rules.length }, afterState: { enabled: saved.enabled, rules: input.rules?.length ?? flag.rules.length }, requestMeta: meta },
        tx,
      );
      return tx.featureFlag.findUnique({ where: { id }, include: { rules: { orderBy: { priority: 'asc' } } } });
    });
  }

  // ── Platform settings ──────────────────────────────────────────────────

  async listSettings(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const rows = await this.settings.list();
    return Object.keys(EDITABLE_SETTINGS).map((key) => {
      const row = rows.find((r) => r.key === key);
      return { key, value: row?.valueJson ?? null, updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
    });
  }

  async setSetting(userId: string, key: string, value: unknown, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const validate = EDITABLE_SETTINGS[key];
    if (!validate) throw new BadRequestException({ code: 'UNKNOWN_SETTING', message: 'This setting cannot be edited.' });
    if (!validate(value)) throw new BadRequestException({ code: 'SETTING_INVALID', message: 'The value is not valid for this setting.' });
    if (key === SETTING.defaultPlanCode && value) {
      const plan = await this.prisma.plan.findUnique({ where: { code: String(value) } });
      if (!plan) throw new BadRequestException({ code: 'PLAN_NOT_FOUND', message: 'Unknown plan code.' });
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.systemSetting.findUnique({ where: { key } });
      const saved = await this.settings.set(key, (value ?? Prisma.JsonNull) as Prisma.InputJsonValue, userId, tx);
      await this.auditLog.record(
        { actorUserId: userId, actorRole: 'admin', action: 'settings.update', targetType: 'system_setting', targetId: null, beforeState: { key, value: (before?.valueJson ?? null) as Prisma.InputJsonValue }, afterState: { key, value: value as Prisma.InputJsonValue }, requestMeta: meta },
        tx,
      );
      return saved;
    });
  }

  // ── Users & workspaces ─────────────────────────────────────────────────

  async setUserStatus(userId: string, targetId: string, status: UserStatus, reason: string, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'user.manage');
    if (userId === targetId) throw new ForbiddenException({ code: 'SELF_SUSPEND_NOT_ALLOWED', message: 'You cannot change your own status.' });
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({ where: { id: targetId }, data: { status }, select: { id: true, email: true, displayName: true, status: true } });
      await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: status === 'ACTIVE' ? 'user.reactivate' : 'user.suspend', targetType: 'user', targetId, beforeState: { status: target.status }, afterState: { status }, reason, requestMeta: meta }, tx);
      return saved;
    });
  }

  async userDetail(userId: string, targetId: string) {
    await this.rbac.assertGlobalPermission(userId, 'user.read');
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        memberships: { select: { status: true, workspace: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } } } },
        roleAssignments: { where: { revokedAt: null }, select: { id: true, scopeType: true, role: { select: { key: true, name: true } }, organizationId: true, workspaceId: true, projectId: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    const activity = await this.prisma.auditLog.findMany({ where: { OR: [{ actorUserId: targetId }, { targetId }] }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { ...user, activity };
  }

  async listWorkspaces(userId: string, q?: string) {
    await this.rbac.assertGlobalPermission(userId, 'user.read');
    return this.prisma.workspace.findMany({
      where: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { organization: { name: { contains: q, mode: 'insensitive' } } }] } : {}) },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        creditWallet: { select: { balanceCache: true } },
        subscriptions: { where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } }, select: { status: true, plan: { select: { code: true, name: true } } } },
        _count: { select: { projects: true, memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ── Usage & costs, health, search ──────────────────────────────────────

  async usageAndCosts(userId: string, days = 30) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000);
    const [byFeature, byProvider, daily, topWorkspaces, credits] = await Promise.all([
      this.prisma.usageEvent.groupBy({ by: ['featureKey'], where: { occurredAt: { gte: since } }, _sum: { units: true }, _count: true }),
      this.prisma.providerUsage.groupBy({ by: ['provider', 'operation', 'currency'], where: { createdAt: { gte: since } }, _sum: { costMinor: true, inputUnits: true, outputUnits: true }, _count: true }),
      this.prisma.$queryRaw<{ day: Date; units: Prisma.Decimal }[]>`
        SELECT date_trunc('day', "occurred_at") AS day, SUM("units") AS units FROM "usage_events" WHERE "occurred_at" >= ${since} GROUP BY 1 ORDER BY 1`,
      this.prisma.usageEvent.groupBy({ by: ['workspaceId'], where: { occurredAt: { gte: since } }, _sum: { units: true }, orderBy: { _sum: { units: 'desc' } }, take: 10 }),
      this.prisma.creditLedger.groupBy({ by: ['reason'], where: { createdAt: { gte: since } }, _sum: { delta: true } }),
    ]);
    const names = await this.prisma.workspace.findMany({ where: { id: { in: topWorkspaces.map((w) => w.workspaceId) } }, select: { id: true, name: true } });
    return {
      since,
      byFeature: byFeature.map((r) => ({ featureKey: r.featureKey, units: Number(r._sum.units ?? 0), events: r._count })),
      byProvider: byProvider.map((r) => ({ provider: r.provider, operation: r.operation, currency: r.currency, costMinor: r._sum.costMinor?.toString() ?? '0', inputUnits: Number(r._sum.inputUnits ?? 0), outputUnits: Number(r._sum.outputUnits ?? 0), calls: r._count })),
      daily: daily.map((d) => ({ day: d.day, units: Number(d.units) })),
      topWorkspaces: topWorkspaces.map((w) => ({ workspaceId: w.workspaceId, name: names.find((n) => n.id === w.workspaceId)?.name ?? null, units: Number(w._sum.units ?? 0) })),
      credits: credits.map((c) => ({ reason: c.reason, delta: Number(c._sum.delta ?? 0) })),
    };
  }

  async health(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const started = Date.now();
    let database: 'UP' | 'DOWN' = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'DOWN';
    }
    const dbLatencyMs = Date.now() - started;
    const [queues, dead, webhooksFailed, incidents, checks, providerErrors] = await Promise.all([
      this.prisma.backgroundJob.groupBy({ by: ['queue', 'status'], _count: true }),
      this.prisma.backgroundJob.findMany({ where: { status: 'DEAD' }, orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, queue: true, lastError: true, updatedAt: true, attempts: true } }),
      this.prisma.webhookEvent.count({ where: { status: 'FAILED' } }),
      this.prisma.systemIncident.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
      this.prisma.healthCheckResult.findMany({ orderBy: { checkedAt: 'desc' }, take: 50 }),
      this.prisma.providerEvent.groupBy({ by: ['provider', 'status'], where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } }, _count: true, _avg: { latencyMs: true } }),
    ]);
    const has = (k: string) => !!this.config.get<string>(k);
    return {
      checkedAt: new Date(),
      database: { status: database, latencyMs: dbLatencyMs },
      queues: queues.map((q) => ({ queue: q.queue, status: q.status, count: q._count })),
      deadJobs: dead,
      webhooksFailed,
      incidents,
      checks,
      providers: [
        { key: 'stripe', label: 'Payments (Stripe)', configured: has('STRIPE_SECRET_KEY') && has('STRIPE_WEBHOOK_SECRET') },
        { key: 'email', label: 'Email (Resend)', configured: has('RESEND_API_KEY') },
        { key: 'anthropic', label: 'Claude (Anthropic)', configured: has('ANTHROPIC_API_KEY') },
        { key: 'openai', label: 'ChatGPT (OpenAI)', configured: has('OPENAI_API_KEY') },
        { key: 'gemini', label: 'Gemini (Google)', configured: has('GEMINI_API_KEY') },
        { key: 'perplexity', label: 'Perplexity', configured: has('PERPLEXITY_API_KEY') },
        { key: 'dataforseo', label: 'Keyword data (DataForSEO)', configured: has('DATAFORSEO_LOGIN') && has('DATAFORSEO_PASSWORD') },
        { key: 'storage', label: 'File storage', configured: true },
      ],
      providerActivity: providerErrors.map((p) => ({ provider: p.provider, status: p.status, count: p._count, avgLatencyMs: p._avg.latencyMs })),
    };
  }

  async createIncident(userId: string, input: { title: string; publicSummary?: string }, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const incident = await this.prisma.systemIncident.create({ data: { title: input.title, publicSummary: input.publicSummary ?? null } });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'system.incident.create', targetType: 'system_incident', targetId: incident.id, afterState: { title: input.title }, requestMeta: meta });
    return incident;
  }

  async updateIncident(userId: string, id: string, input: { status: IncidentStatus; publicSummary?: string }, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const incident = await this.prisma.systemIncident.update({
      where: { id },
      data: { status: input.status, ...(input.publicSummary !== undefined && { publicSummary: input.publicSummary }), ...(input.status === 'RESOLVED' && { resolvedAt: new Date() }) },
    });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'system.incident.update', targetType: 'system_incident', targetId: id, requestMeta: meta });
    return incident;
  }

  async retryJob(userId: string, id: string, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const job = await this.prisma.backgroundJob.update({ where: { id }, data: { status: 'QUEUED', runAt: new Date(), attempts: 0 } });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'system.job.retry', targetType: 'background_job', targetId: id, requestMeta: meta });
    return job;
  }

  async search(userId: string, q: string) {
    await this.rbac.assertGlobalPermission(userId, 'user.read');
    const term = q.trim();
    if (term.length < 2) return { users: [], workspaces: [], projects: [], content: [], jobs: [] };
    const contains = { contains: term, mode: 'insensitive' as const };
    const [users, workspaces, projects, posts, guides, help, jobs] = await Promise.all([
      this.prisma.user.findMany({ where: { OR: [{ email: contains }, { displayName: contains }] }, select: { id: true, email: true, displayName: true, status: true }, take: 10 }),
      this.prisma.workspace.findMany({ where: { name: contains, deletedAt: null }, select: { id: true, name: true, organization: { select: { name: true } } }, take: 10 }),
      this.prisma.project.findMany({ where: { name: contains, deletedAt: null }, select: { id: true, name: true, workspace: { select: { name: true } } }, take: 10 }),
      this.prisma.blogPost.findMany({ where: { title: contains }, select: { id: true, title: true, slug: true, status: true }, take: 5 }),
      this.prisma.guide.findMany({ where: { title: contains }, select: { id: true, title: true, slug: true, status: true }, take: 5 }),
      this.prisma.helpArticle.findMany({ where: { title: contains }, select: { id: true, title: true, slug: true, status: true }, take: 5 }),
      this.prisma.jobOpening.findMany({ where: { title: contains }, select: { id: true, title: true, slug: true, status: true }, take: 5 }),
    ]);
    return {
      users,
      workspaces,
      projects,
      content: [...posts.map((p) => ({ ...p, type: 'BLOG' })), ...guides.map((p) => ({ ...p, type: 'GUIDE' })), ...help.map((p) => ({ ...p, type: 'HELP' }))],
      jobs,
    };
  }
}
