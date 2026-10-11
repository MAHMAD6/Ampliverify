import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ValuationKind } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { SettingsService } from '../commerce/settings.service';
import { DataForSeoClient } from '../keywords/dataforseo.client';
import { IntegrationsService } from '../integrations/integrations.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { normalizeHost } from '../common/utils/domain';
import { renderPdf, SectionPayload } from '../reports/report-render';
import {
  BusinessInputs,
  DEFAULT_SETTINGS,
  FACTOR_LABELS,
  insights,
  PlanAccessLevel,
  SOURCE_LABELS,
  SOURCES,
  SourceKey,
  valuate,
  ValuationSettings,
  validateSettings,
  withDefaults,
} from './valuation-engine';
import { collectDataForSeo, collectPageSpeed, collectRdap, collectSite, Collected, initialCollected } from './valuation-sources';

export const VALUATION_SETTING = 'valuation.engine';

export type VerifyInputs = BusinessInputs & {
  ga4?: { integrationId: string; propertyId: string } | null;
  gsc?: { integrationId: string; siteUrl: string } | null;
  businessModel?: string | null;
  industry?: string | null;
  audience?: string | null;
  trafficSource?: string | null;
  notes?: string | null;
};

type Viewer = { userId: string } | null;

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/**
 * Website Value Calculator: public estimates, verified valuations (GA4 / Search
 * Console / business inputs), admin engine settings and test runs.
 * Calculations run on the job queue; the report page polls until complete.
 */
@Injectable()
export class ValuationService implements OnModuleInit {
  private readonly logger = new Logger(ValuationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly settingsStore: SettingsService,
    private readonly dataforseo: DataForSeoClient,
    private readonly integrations: IntegrationsService,
  ) {}

  onModuleInit() {
    this.jobs.register('valuation.run', async (p) => this.run(String(p.valuationId)));
  }

  async settings() {
    return withDefaults(await this.settingsStore.get<unknown>(VALUATION_SETTING, null));
  }

  private get allowPrivate() {
    return this.config.get<string>('AUDIT_ALLOW_PRIVATE_HOSTS') === 'true';
  }

  private requesterHash(ip: string | undefined) {
    return ip ? createHash('sha256').update(`${this.config.get<string>('AUTH_SYNC_SECRET') ?? ''}:valuation:${ip}`).digest('hex').slice(0, 32) : null;
  }

  /** What the public calculator page needs to render (no secrets). */
  async publicConfig() {
    const s = await this.settings();
    return {
      enabled: s.calculator.enabled,
      available: s.calculator.enabled && s.sources.dataforseo && this.dataforseo.configured,
      verifiedValuation: s.features.verifiedValuation,
      showRange: s.showRange,
      currency: s.currency.code,
      freePerMonth: s.limits.freePerMonth,
      disclaimer: s.report.disclaimer,
    };
  }

  // ── Plans, access and limits ───────────────────────────────────────────────

  private async defaultWorkspace(userId: string) {
    const m = await this.prisma.workspaceMembership.findFirst({ where: { userId, status: 'ACTIVE', workspace: { deletedAt: null } }, orderBy: { joinedAt: 'asc' } });
    return m?.workspaceId ?? null;
  }

  private async planOf(workspaceId: string | null) {
    if (!workspaceId) return { code: 'free', paid: false };
    const plan = await this.entitlements.resolve(workspaceId);
    return { code: plan.planCode ?? 'free', paid: !!plan.subscriptionId };
  }

  private accessFor(s: ValuationSettings, planCode: string): PlanAccessLevel {
    return s.access[planCode] ?? s.access.free ?? 'limited';
  }

  private async assertWithinLimit(s: ValuationSettings, by: { userId?: string | null; requesterHash?: string | null }, paid: boolean) {
    const limit = paid ? s.limits.paidPerMonth : s.limits.freePerMonth;
    const where: Prisma.WebsiteValuationWhereInput = { createdAt: { gte: monthStart() }, kind: { in: ['ESTIMATE', 'VERIFIED'] } };
    if (by.userId) where.userId = by.userId;
    else if (by.requesterHash) where.requesterHash = by.requesterHash;
    else return;
    const used = await this.prisma.websiteValuation.count({ where });
    if (used >= limit) {
      throw new HttpException(
        { code: 'VALUATION_LIMIT_REACHED', message: paid ? `You have used all ${limit} valuations included this month.` : `Free valuations are limited to ${limit} per month. Create an account or upgrade for more.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ── Creating valuations ────────────────────────────────────────────────────

  private async assertAvailable(s: ValuationSettings) {
    if (!s.calculator.enabled) throw new ServiceUnavailableException({ code: 'VALUATION_DISABLED', message: 'The Website Value Calculator is turned off.' });
    if (!s.sources.dataforseo || !this.dataforseo.configured) {
      throw new ServiceUnavailableException({ code: 'VALUATION_UNAVAILABLE', message: 'Website valuation is not available yet: the SEO data provider is not configured.' });
    }
  }

  private domainOf(input: string) {
    const host = normalizeHost(input ?? '');
    if (!host) throw new BadRequestException({ code: 'INVALID_DOMAIN', message: 'Enter a valid website domain, for example example.com.' });
    return host;
  }

  /** Anonymous or signed-in estimate. Reuses a recent completed estimate of the same domain. */
  async createEstimate(input: { domain: string; userId?: string | null; workspaceId?: string | null }, meta?: RequestMeta) {
    const s = await this.settings();
    await this.assertAvailable(s);
    const domain = this.domainOf(input.domain);
    let workspaceId: string | null = null;
    if (input.userId) {
      workspaceId = input.workspaceId ?? (await this.defaultWorkspace(input.userId));
      if (workspaceId) await this.rbac.requireWorkspace(input.userId, workspaceId, 'workspace.read');
    }
    const plan = await this.planOf(workspaceId);
    if (this.accessFor(s, plan.code) === 'off') throw new ForbiddenException({ code: 'VALUATION_NOT_IN_PLAN', message: 'Website valuation is not included in your plan.' });
    const requesterHash = input.userId ? null : this.requesterHash(meta?.ipAddress);

    if (s.calculator.cacheHours > 0) {
      const cached = await this.prisma.websiteValuation.findFirst({
        where: { domain, kind: 'ESTIMATE', status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - s.calculator.cacheHours * 3600_000) }, userId: input.userId ?? null, workspaceId },
        orderBy: { completedAt: 'desc' },
      });
      if (cached) return { id: cached.id, cached: true };
    }
    await this.assertWithinLimit(s, { userId: input.userId, requesterHash }, plan.paid);
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.websiteValuation.create({ data: { domain, kind: 'ESTIMATE', userId: input.userId ?? null, workspaceId, requesterHash, currency: s.currency.code } });
      await this.jobs.enqueue('valuation.run', { valuationId: v.id }, { jobKey: `valuation:${v.id}` }, tx);
      return v;
    });
    return { id: row.id, cached: false };
  }

  /** Verified valuation from connected GA4 / Search Console and business inputs (signed-in users). */
  async createVerified(userId: string, parentId: string, inputs: VerifyInputs, meta?: RequestMeta) {
    const s = await this.settings();
    await this.assertAvailable(s);
    if (!s.features.verifiedValuation) throw new ServiceUnavailableException({ code: 'VERIFIED_VALUATION_DISABLED', message: 'Verified valuations are turned off.' });
    const parent = await this.prisma.websiteValuation.findUnique({ where: { id: parentId } });
    if (!parent || parent.kind === 'TEST') throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    // Each connection is authorized (workspace read + property ownership) before use.
    if (inputs.ga4) await this.integrations.ga4ValuationSummary(userId, inputs.ga4.integrationId, inputs.ga4.propertyId).catch((e) => this.rethrowSource(e, 'Google Analytics'));
    if (inputs.gsc) await this.integrations.gscValuationSummary(userId, inputs.gsc.integrationId, inputs.gsc.siteUrl).catch((e) => this.rethrowSource(e, 'Search Console'));
    const connectionWs = inputs.ga4 || inputs.gsc ? await this.prisma.workspaceIntegration.findUnique({ where: { id: (inputs.ga4 ?? inputs.gsc)!.integrationId } }) : null;
    const workspaceId = connectionWs?.workspaceId ?? (await this.defaultWorkspace(userId));
    if (workspaceId) await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read');
    const plan = await this.planOf(workspaceId);
    if (this.accessFor(s, plan.code) === 'off') throw new ForbiddenException({ code: 'VALUATION_NOT_IN_PLAN', message: 'Website valuation is not included in your plan.' });
    await this.assertWithinLimit(s, { userId }, plan.paid);
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.websiteValuation.create({
        data: { domain: parent.domain, kind: 'VERIFIED', parentId: parent.id, userId, workspaceId, inputsJson: inputs as unknown as Prisma.InputJsonValue, currency: s.currency.code },
      });
      await this.jobs.enqueue('valuation.run', { valuationId: v.id }, { jobKey: `valuation:${v.id}` }, tx);
      return v;
    });
    await this.audit.record({ actorUserId: userId, workspaceId, action: 'valuation.verify', targetType: 'website_valuation', targetId: row.id, afterState: { domain: parent.domain, ga4: !!inputs.ga4, gsc: !!inputs.gsc, revenue: !!(inputs.monthlyRevenue || inputs.annualRevenue) }, requestMeta: meta });
    return { id: row.id };
  }

  private rethrowSource(e: unknown, label: string): never {
    if (e instanceof HttpException) throw e;
    throw new BadRequestException({ code: 'SOURCE_ERROR', message: `${label}: ${(e as Error).message}` });
  }

  /** Admin test calculation: bypasses limits and caching. */
  async createTest(userId: string, domainInput: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const s = await this.settings();
    if (!s.sources.dataforseo || !this.dataforseo.configured) throw new ServiceUnavailableException({ code: 'VALUATION_UNAVAILABLE', message: 'The SEO data provider (DataForSEO) is not configured.' });
    const domain = this.domainOf(domainInput);
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.websiteValuation.create({ data: { domain, kind: 'TEST', userId, currency: s.currency.code } });
      await this.jobs.enqueue('valuation.run', { valuationId: v.id }, { jobKey: `valuation:${v.id}` }, tx);
      return v;
    });
    return { id: row.id };
  }

  // ── Calculation ────────────────────────────────────────────────────────────

  private async timed<T>(provider: string, operation: string, fn: () => Promise<T>) {
    const started = Date.now();
    try {
      const r = await fn();
      await this.prisma.providerEvent.create({ data: { provider, operation, status: 'ok', latencyMs: Date.now() - started } }).catch(() => undefined);
      return r;
    } catch (e) {
      await this.prisma.providerEvent.create({ data: { provider, operation, status: 'error', latencyMs: Date.now() - started } }).catch(() => undefined);
      throw e;
    }
  }

  async run(id: string) {
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v || v.status === 'COMPLETED') return;
    await this.prisma.websiteValuation.update({ where: { id }, data: { status: 'RUNNING' } });
    try {
      const s = await this.settings();
      const inputs = (v.inputsJson ?? {}) as VerifyInputs;
      const c = await this.collect(v.domain, s, v.kind === 'VERIFIED' ? { userId: v.userId!, inputs } : null);
      const business: BusinessInputs = { monthlyRevenue: inputs.monthlyRevenue ?? null, annualRevenue: inputs.annualRevenue ?? null, profitMargin: inputs.profitMargin ?? null, monthlyVisits: inputs.monthlyVisits ?? null };
      if (c.signals.organicVisits === null && c.signals.verifiedOrganicVisits === null && !business.monthlyVisits) {
        throw new Error('No traffic data could be collected for this domain.');
      }
      const result = valuate(c.signals, c.sources, s, business);
      const notes = insights(c.signals, result);
      await this.prisma.websiteValuation.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          valueLow: result.valueLow,
          valueHigh: result.valueHigh,
          valueMid: result.valueMid,
          currency: result.currency,
          confidence: result.confidence,
          error: null,
          resultJson: { valuation: result, insights: notes, collected: c, settingsSnapshot: { weights: s.weights, multipliers: s.multipliers, industryAdjustmentPct: s.industryAdjustmentPct, valuePerVisitUsd: s.valuePerVisitUsd } } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(`Valuation ${id} failed: ${(e as Error).message}`);
      await this.prisma.websiteValuation.update({ where: { id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 500), completedAt: new Date() } });
    }
  }

  private async collect(domain: string, s: ValuationSettings, verified: { userId: string; inputs: VerifyInputs } | null): Promise<Collected> {
    const c = initialCollected(domain, s.sources);
    const notes: string[] = [];
    const tasks: Promise<unknown>[] = [];
    if (s.sources.dataforseo && this.dataforseo.configured) {
      tasks.push(
        collectDataForSeo(this.dataforseo, domain, s.calculator.country, s.calculator.language, c, notes).then((ok) => {
          c.sources.dataforseo = ok ? 'estimated' : 'unavailable';
          if (notes.length) c.sourceNotes.dataforseo = notes.join(' ');
        }),
      );
    } else if (s.sources.dataforseo) c.sourceNotes.dataforseo = 'Not configured.';
    if (s.sources.pagespeed) {
      tasks.push(
        this.timed('pagespeed', 'valuation.pagespeed', () => collectPageSpeed(domain, this.config.get<string>('PAGESPEED_API_KEY') || undefined, c)).then(
          () => (c.sources.pagespeed = 'estimated'),
          (e: Error) => (c.sourceNotes.pagespeed = e.message),
        ),
      );
    }
    if (s.sources.rdap) {
      tasks.push(
        this.timed('rdap', 'valuation.rdap', () => collectRdap(domain, c)).then(
          () => (c.sources.rdap = 'estimated'),
          (e: Error) => (c.sourceNotes.rdap = e.message),
        ),
      );
    }
    tasks.push(collectSite(domain, this.allowPrivate, c).catch((e: Error) => (notes.push(`Site checks: ${e.message}`), undefined)));
    if (verified?.inputs.ga4 && s.sources.ga4) {
      const { integrationId, propertyId } = verified.inputs.ga4;
      tasks.push(
        this.timed('google', 'valuation.ga4', () => this.integrations.ga4ValuationSummary(verified.userId, integrationId, propertyId)).then(
          (g) => {
            c.sources.ga4 = 'verified';
            c.signals.verifiedOrganicVisits = g.organicSessions;
            c.signals.totalVisits = g.totalSessions;
            if (s.sources.social) {
              c.signals.socialVisits = g.socialSessions;
              c.sources.social = 'verified';
              c.socialSources = g.socialSources.map((x) => ({ source: x.source, visits: x.sessions, share: g.socialSessions ? Math.round((x.sessions / g.socialSessions) * 100) : 0 }));
              c.trends.socialTraffic = g.socialTrend;
            }
            if (g.organicTrend.length >= 2) c.trends.organicTraffic = g.organicTrend;
          },
          (e: Error) => (c.sourceNotes.ga4 = e.message),
        ),
      );
    }
    if (verified?.inputs.gsc && s.sources.gsc) {
      const { integrationId, siteUrl } = verified.inputs.gsc;
      tasks.push(
        this.timed('google', 'valuation.gsc', () => this.integrations.gscValuationSummary(verified.userId, integrationId, siteUrl)).then(
          (g) => {
            c.sources.gsc = 'verified';
            if (c.signals.verifiedOrganicVisits === null) c.signals.verifiedOrganicVisits = Math.round(g.clicks);
            if (g.pagesWithImpressions) c.signals.contentPages = Math.max(c.signals.contentPages ?? 0, g.pagesWithImpressions);
            if (g.position) c.signals.avgPosition = Math.round(g.position * 10) / 10;
          },
          (e: Error) => (c.sourceNotes.gsc = e.message),
        ),
      );
    }
    await Promise.all(tasks);
    if (c.trends.organicTraffic.length >= 12) {
      const vals = c.trends.organicTraffic.map((p) => p.value);
      const cur = vals.slice(-6).reduce((a, b) => a + b, 0);
      const prev = vals.slice(-12, -6).reduce((a, b) => a + b, 0);
      c.signals.trafficGrowthPct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : c.signals.trafficGrowthPct;
    }
    return c;
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  /** Report payload shaped by the owner's plan access level and the report section settings. */
  async report(id: string) {
    const v = await this.prisma.websiteValuation.findUnique({ where: { id }, include: { children: { where: { kind: 'VERIFIED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } } } });
    if (!v || v.kind === 'TEST') throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    const s = await this.settings();
    const plan = await this.planOf(v.workspaceId);
    const level = this.accessFor(s, plan.code);
    return this.shape(v, s, level);
  }

  private shape(v: Prisma.WebsiteValuationGetPayload<object> & { children?: { id: string; status: string }[] }, s: ValuationSettings, level: PlanAccessLevel) {
    const base = {
      id: v.id,
      domain: v.domain,
      kind: v.kind,
      status: v.status,
      error: v.status === 'FAILED' ? v.error : null,
      createdAt: v.createdAt,
      completedAt: v.completedAt,
      parentId: v.parentId,
      verifiedChild: v.children?.[0] ?? null,
      access: level,
      showRange: s.showRange,
      exports: { pdf: s.exports.pdf && (level === 'full' || level === 'full_api'), json: s.exports.json && level === 'full_api' },
      disclaimer: s.report.disclaimer,
      verifiedValuation: s.features.verifiedValuation,
    };
    if (v.status !== 'COMPLETED' || !v.resultJson) return { ...base, result: null };
    const r = v.resultJson as unknown as { valuation: ReturnType<typeof valuate>; insights: ReturnType<typeof insights>; collected: Collected };
    const sec = s.report.sections;
    const full = level === 'full' || level === 'full_api';
    const c = r.collected;
    const result = {
      valueLow: v.valueLow,
      valueHigh: v.valueHigh,
      valueMid: v.valueMid,
      currency: v.currency,
      confidence: v.confidence,
      confidenceLabel: r.valuation.confidenceLabel,
      confidenceParts: r.valuation.confidenceParts,
      method: r.valuation.method,
      screenshot: c.screenshot,
      metrics: {
        organicTraffic: c.signals.verifiedOrganicVisits ?? c.signals.organicVisits,
        organicTrafficVerified: c.signals.verifiedOrganicVisits !== null,
        trafficGrowthPct: c.signals.trafficGrowthPct,
        referringDomains: c.signals.referringDomains,
        backlinkGrowthPct: c.signals.backlinkGrowthPct,
        domainAuthority: c.signals.domainAuthority,
        contentPages: c.signals.contentPages,
        socialTraffic: c.signals.socialVisits,
      },
      breakdown: sec.breakdown ? r.valuation.breakdown.map((b) => ({ label: b.label, factor: b.factor, contributionPct: b.contributionPct, score: b.score })) : null,
      drivers: r.insights.drivers,
      risks: r.insights.risks,
      sources: SOURCES.map((k) => ({ key: k, label: SOURCE_LABELS[k], state: c.sources[k] })),
      // Detail tabs: full access only.
      detail: full
        ? {
            traffic: sec.traffic ? { organicVisits: c.signals.verifiedOrganicVisits ?? c.signals.organicVisits, rankingKeywords: c.signals.rankingKeywords, avgPosition: c.signals.avgPosition, trend: c.trends.organicTraffic, keywordTrend: c.trends.rankingKeywords } : null,
            backlinks: sec.backlinks ? { referringDomains: c.signals.referringDomains, totalBacklinks: c.totalBacklinks, domainAuthority: c.signals.domainAuthority, trend: c.trends.referringDomains } : null,
            content: sec.content ? { pages: c.signals.contentPages, rankingKeywords: c.signals.rankingKeywords, relevance: r.valuation.scores.content === null ? null : Math.round(r.valuation.scores.content * 100) / 10 } : null,
            social:
              sec.social && s.features.socialSection
                ? { visits: c.signals.socialVisits, share: c.signals.socialVisits !== null && c.signals.totalVisits ? Math.round((c.signals.socialVisits / c.signals.totalVisits) * 100) : null, sources: c.socialSources, trend: c.trends.socialTraffic, verified: c.sources.social === 'verified' }
                : null,
            technical: sec.technical ? { pagespeedMobile: c.signals.pagespeedMobile, pagespeedDesktop: c.signals.pagespeedDesktop, coreWebVitals: c.signals.coreWebVitals, ...c.technical } : null,
            domain: sec.domain ? { ageYears: c.signals.domainAgeYears, registeredAt: c.domain.registeredAt, status: c.domain.status, authority: c.signals.domainAuthority, tld: c.domain.tld } : null,
            opportunities: sec.opportunities && s.features.opportunities ? r.insights.opportunities : null,
          }
        : null,
    };
    return { ...base, result };
  }

  /** Projected range/confidence for the enhance page, without saving anything. */
  async preview(id: string, business: BusinessInputs, planned: SourceKey[]) {
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v || v.kind === 'TEST' || v.status !== 'COMPLETED' || !v.resultJson) throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    const s = await this.settings();
    const c = (v.resultJson as unknown as { collected: Collected }).collected;
    const sources = { ...c.sources };
    for (const k of planned) if (k === 'ga4' || k === 'gsc') sources[k] = 'verified';
    if (planned.includes('ga4') && s.sources.social) sources.social = 'verified';
    const signals = { ...c.signals };
    // A planned GA4 connection supplies verified traffic; assume the estimate until it is read.
    if (planned.includes('ga4') || planned.includes('gsc')) signals.verifiedOrganicVisits = signals.verifiedOrganicVisits ?? signals.organicVisits;
    if (planned.includes('ga4') && signals.socialVisits === null) signals.socialVisits = 0;
    const r = valuate(signals, sources, s, business);
    return { valueLow: r.valueLow, valueHigh: r.valueHigh, valueMid: r.valueMid, currency: r.currency, confidence: r.confidence, confidenceLabel: r.confidenceLabel };
  }

  async myValuations(userId: string) {
    return this.prisma.websiteValuation.findMany({
      where: { userId, kind: { in: ['ESTIMATE', 'VERIFIED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, domain: true, kind: true, status: true, valueLow: true, valueHigh: true, valueMid: true, currency: true, confidence: true, createdAt: true },
    });
  }

  // ── Exports ────────────────────────────────────────────────────────────────

  private async exportAllowed(id: string, kind: 'pdf' | 'json') {
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v || v.kind === 'TEST') throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    if (v.status !== 'COMPLETED') throw new BadRequestException({ code: 'VALUATION_NOT_READY', message: 'The valuation is still being calculated.' });
    const s = await this.settings();
    const report = this.shape(v, s, this.accessFor(s, (await this.planOf(v.workspaceId)).code));
    if (!report.exports[kind] || !v.workspaceId) {
      throw new ForbiddenException({ code: 'EXPORT_NOT_IN_PLAN', message: kind === 'pdf' ? 'PDF downloads are available on plans with full valuation reports.' : 'JSON export is available on plans with API access.' });
    }
    return { v, s, report };
  }

  async pdf(id: string) {
    const { v, s, report } = await this.exportAllowed(id, 'pdf');
    const used = await this.prisma.usageEvent.count({ where: { workspaceId: v.workspaceId!, featureKey: 'valuation.pdf', occurredAt: { gte: monthStart() } } });
    if (used >= s.limits.pdfPerMonth) throw new HttpException({ code: 'EXPORT_LIMIT_REACHED', message: `PDF downloads are limited to ${s.limits.pdfPerMonth} per month.` }, HttpStatus.TOO_MANY_REQUESTS);
    await this.prisma.usageEvent.create({ data: { workspaceId: v.workspaceId!, featureKey: 'valuation.pdf', units: 1, idempotencyKey: `valuation.pdf:${randomUUID()}` } });
    const r = report.result!;
    const money = (n: number | null) => (n === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: r.currency, maximumFractionDigits: 0 }).format(n));
    const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));
    const d = r.detail;
    const sections: SectionPayload[] = [
      { title: 'Estimated Website Value', summary: `${money(r.valueLow)} – ${money(r.valueHigh)} (midpoint ${money(r.valueMid)}). Confidence ${r.confidence}% (${r.confidenceLabel}).`, metrics: [
        { label: 'Organic traffic / month', value: fmt(r.metrics.organicTraffic) },
        { label: 'Referring domains', value: fmt(r.metrics.referringDomains) },
        { label: 'Domain authority', value: r.metrics.domainAuthority === null ? '—' : `${r.metrics.domainAuthority}/100` },
        { label: 'Content pages', value: fmt(r.metrics.contentPages) },
      ] },
      ...(r.breakdown ? [{ title: 'Value Breakdown', table: { columns: ['Factor', 'Contribution'], rows: r.breakdown.map((b) => [b.label, `${b.contributionPct}%`]) } }] : []),
      { title: 'Key Value Drivers', bullets: r.drivers, empty: 'None identified.' },
      { title: 'Potential Risks', bullets: r.risks, empty: 'None identified.' },
      ...(d?.technical ? [{ title: 'Technical Health', metrics: [{ label: 'PageSpeed (mobile)', value: fmt(d.technical.pagespeedMobile) }, { label: 'PageSpeed (desktop)', value: fmt(d.technical.pagespeedDesktop) }, { label: 'Core Web Vitals', value: d.technical.coreWebVitals ?? '—' }] }] : []),
      ...(d?.domain ? [{ title: 'Domain Signals', metrics: [{ label: 'Domain age', value: d.domain.ageYears === null ? '—' : `${d.domain.ageYears} years` }, { label: 'Registration', value: d.domain.status ?? '—' }, { label: 'TLD', value: `.${d.domain.tld}` }] }] : []),
      ...(d?.opportunities ? [{ title: 'Ways to Increase Website Value', bullets: d.opportunities }] : []),
      { title: 'Data Sources & Confidence', table: { columns: ['Source', 'Status'], rows: r.sources.filter((x) => x.state !== 'disabled').map((x) => [x.label, x.state]) } },
      { title: 'Disclaimer', summary: s.report.disclaimer },
    ];
    return { filename: `website-value-${v.domain}.pdf`, body: await renderPdf({ title: 'Website Value Report', projectName: v.domain, domain: v.domain, period: v.kind === 'VERIFIED' ? 'Verified valuation' : 'Estimate from public data', generatedAt: new Date(), sections }) };
  }

  async json(id: string) {
    const { report } = await this.exportAllowed(id, 'json');
    return report;
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async adminSettings(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const s = await this.settings();
    const plans = await this.prisma.plan.findMany({ where: { status: { not: 'ARCHIVED' } }, orderBy: { displayOrder: 'asc' }, select: { code: true, name: true } });
    return { settings: s, defaults: DEFAULT_SETTINGS, plans, factorLabels: FACTOR_LABELS, sourceLabels: SOURCE_LABELS };
  }

  async updateSettings(userId: string, next: ValuationSettings, meta?: RequestMeta, reset = false) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const merged = withDefaults(next);
    const errors = validateSettings(merged);
    if (errors.length) throw new BadRequestException({ code: 'INVALID_VALUATION_SETTINGS', message: errors.join(' ') });
    const before = await this.settings();
    const summary = reset ? 'Reset all settings to defaults' : describeChanges(before, merged);
    await this.prisma.$transaction(async (tx) => {
      await this.settingsStore.set(VALUATION_SETTING, merged as unknown as Prisma.InputJsonValue, userId, tx);
      await this.audit.record(
        { actorUserId: userId, actorRole: 'admin', action: reset ? 'valuation.settings.reset' : 'valuation.settings.update', targetType: 'system_setting', targetId: null, reason: summary.slice(0, 500), beforeState: before as unknown as Prisma.InputJsonObject, afterState: merged as unknown as Prisma.InputJsonObject, requestMeta: meta },
        tx,
      );
    });
    return merged;
  }

  async changes(userId: string, take = 25) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const where = { eventType: { in: ['valuation.settings.update', 'valuation.settings.reset'] } };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(take, 100), select: { id: true, createdAt: true, reason: true, actorUserId: true, eventType: true } }),
      this.prisma.auditLog.count({ where }),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.actorUserId).filter((x): x is string => !!x) } }, select: { id: true, displayName: true, email: true } });
    const name = new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
    return { total, rows: rows.map((r, i) => ({ id: r.id, at: r.createdAt, by: r.actorUserId ? (name.get(r.actorUserId) ?? 'Admin') : 'System', change: r.reason ?? r.eventType, current: i === 0 })) };
  }

  async history(userId: string, q: { kind?: string; status?: string; domain?: string; take?: number }) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const where: Prisma.WebsiteValuationWhereInput = {};
    if (q.kind && ['ESTIMATE', 'VERIFIED', 'TEST'].includes(q.kind)) where.kind = q.kind as ValuationKind;
    if (q.status && ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'].includes(q.status)) where.status = q.status as never;
    if (q.domain) where.domain = { contains: q.domain.trim().toLowerCase() };
    const rows = await this.prisma.websiteValuation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(q.take ?? 50, 200),
      select: { id: true, domain: true, kind: true, status: true, valueLow: true, valueHigh: true, valueMid: true, currency: true, confidence: true, error: true, createdAt: true, completedAt: true, user: { select: { email: true } } },
    });
    return rows.map((r) => ({ ...r, user: r.user?.email ?? null }));
  }

  /** Admin view of one valuation, including test runs (always full detail). */
  async adminReport(userId: string, id: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v) throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    const s = await this.settings();
    return this.shape(v, s, 'full_api');
  }

  async sources(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const s = await this.settings();
    const since = new Date(Date.now() - 30 * 86400000);
    const google = !!this.config.get('GOOGLE_OAUTH_CLIENT_ID') && !!this.config.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const configured: Record<SourceKey, { ok: boolean; note: string }> = {
      ga4: { ok: google, note: google ? 'Read with each user’s own Google connection (verified valuations).' : 'Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.' },
      gsc: { ok: google, note: google ? 'Read with each user’s own Google connection (verified valuations).' : 'Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.' },
      dataforseo: { ok: this.dataforseo.configured, note: this.dataforseo.configured ? 'Traffic, keywords, backlinks and history.' : 'Set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.' },
      pagespeed: { ok: true, note: this.config.get('PAGESPEED_API_KEY') ? 'Using PAGESPEED_API_KEY.' : 'Keyless (rate-limited); set PAGESPEED_API_KEY for production volume.' },
      rdap: { ok: true, note: 'Public RDAP registry lookups (rdap.org).' },
      social: { ok: google, note: 'Social and referral traffic from GA4 (verified valuations only).' },
    };
    const usage = async (provider: string, opPrefix: string) => {
      const where = { provider, operation: { startsWith: opPrefix }, createdAt: { gte: since } };
      const [count, last] = await Promise.all([this.prisma.providerEvent.count({ where }), this.prisma.providerEvent.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true, status: true } })]);
      return { requests30d: count, lastSync: last?.createdAt ?? null, lastStatus: last?.status ?? null };
    };
    const u = {
      ga4: await usage('google', 'valuation.ga4'),
      gsc: await usage('google', 'valuation.gsc'),
      dataforseo: await usage('dataforseo', 'valuation.'),
      pagespeed: await usage('pagespeed', 'valuation.'),
      rdap: await usage('rdap', 'valuation.'),
      social: await usage('google', 'valuation.ga4'),
    };
    return SOURCES.map((k) => ({ key: k, label: SOURCE_LABELS[k], enabled: s.sources[k], configured: configured[k].ok, note: configured[k].note, ...u[k] }));
  }

  async usage(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const since = new Date(Date.now() - 30 * 86400000);
    const [byKind, failed, domains, pdfs] = await Promise.all([
      this.prisma.websiteValuation.groupBy({ by: ['kind'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.websiteValuation.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
      this.prisma.websiteValuation.findMany({ where: { createdAt: { gte: since } }, distinct: ['domain'], select: { domain: true } }),
      this.prisma.usageEvent.count({ where: { featureKey: 'valuation.pdf', occurredAt: { gte: since } } }),
    ]);
    return { since, byKind: Object.fromEntries(byKind.map((r) => [r.kind, r._count._all])), failed, uniqueDomains: domains.length, pdfExports: pdfs };
  }
}

/** Human-readable summary of what changed, for the change history. */
export function describeChanges(a: ValuationSettings, b: ValuationSettings) {
  const out: string[] = [];
  for (const f of Object.keys(b.weights) as (keyof ValuationSettings['weights'])[]) {
    if (a.weights[f] !== b.weights[f]) out.push(`Updated ${FACTOR_LABELS[f]} weight (${a.weights[f]}% → ${b.weights[f]}%)`);
  }
  for (const k of Object.keys(b.sources) as SourceKey[]) if (a.sources[k] !== b.sources[k]) out.push(`${b.sources[k] ? 'Enabled' : 'Disabled'} ${SOURCE_LABELS[k]}`);
  if (a.multipliers.min !== b.multipliers.min || a.multipliers.max !== b.multipliers.max) out.push(`Updated value multipliers (${a.multipliers.min}–${a.multipliers.max} → ${b.multipliers.min}–${b.multipliers.max})`);
  if (a.industryAdjustmentPct !== b.industryAdjustmentPct) out.push(`Updated industry adjustment (±${a.industryAdjustmentPct}% → ±${b.industryAdjustmentPct}%)`);
  if (JSON.stringify(a.confidence) !== JSON.stringify(b.confidence) || JSON.stringify(a.thresholds) !== JSON.stringify(b.thresholds)) out.push('Updated confidence rules');
  if (JSON.stringify(a.access) !== JSON.stringify(b.access)) out.push('Updated plan access');
  if (JSON.stringify(a.limits) !== JSON.stringify(b.limits)) out.push('Updated usage limits');
  if (JSON.stringify(a.exports) !== JSON.stringify(b.exports)) out.push('Updated export options');
  if (JSON.stringify(a.features) !== JSON.stringify(b.features)) out.push('Updated feature controls');
  if (JSON.stringify(a.currency) !== JSON.stringify(b.currency) || a.showRange !== b.showRange) out.push('Updated currency and range display');
  if (JSON.stringify(a.calculator) !== JSON.stringify(b.calculator)) out.push('Updated calculator settings');
  if (JSON.stringify(a.report) !== JSON.stringify(b.report)) out.push('Updated report template');
  if (a.valuePerVisitUsd !== b.valuePerVisitUsd) out.push(`Updated value per visit ($${a.valuePerVisitUsd} → $${b.valuePerVisitUsd})`);
  return out.length ? out.join('; ') : 'Saved without changes';
}
