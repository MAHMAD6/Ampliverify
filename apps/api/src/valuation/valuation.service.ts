import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ValuationKind, ValuationStatus, WebsiteValuation } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { CreditsService } from '../commerce/credits.service';
import { DataForSeoClient } from '../keywords/dataforseo.client';
import { IntegrationsService } from '../integrations/integrations.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { normalizeHost } from '../common/utils/domain';
import { renderPdf, SectionPayload } from '../reports/report-render';
import {
  calculate,
  CATEGORY_LABELS,
  checksum,
  DEFAULT_CONFIG,
  Evidence,
  FinancialInputs,
  insights,
  PlanAccessLevel,
  Result,
  SOURCE_LABELS,
  SOURCES,
  SourceKey,
  validateConfig,
  ValuationConfig,
  withDefaults,
} from './valuation-engine';
import { collectCrawler, collectDataForSeo, collectPageSpeed, collectRdap, CRAWLER_METRICS, DATAFORSEO_METRICS, ev, missing, PAGESPEED_METRICS, RDAP_METRICS, TrendPoint } from './valuation-sources';

export type VerifyInputs = {
  ga4?: { integrationId: string; propertyId: string } | null;
  gsc?: { integrationId: string; siteUrl: string } | null;
  financial?: FinancialInputs | null;
  consentVersion: string;
  /** Required when financial inputs are given: the user accepts the scenario assumptions. */
  acceptAssumptions?: boolean;
  idempotencyKey?: string;
};

type Stored = { result: Result; insights: ReturnType<typeof insights>; trend: TrendPoint[]; screenshot: string | null; methodology: { version: string; weights: ValuationConfig['weights']; minEvidencePct: number } };

const DAY = 86_400_000;
const ACTIVE: ValuationStatus[] = ['QUEUED', 'COLLECTING', 'NORMALIZING', 'CALCULATING'];
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};
const hash = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Website Value Calculator (V1 manual). Public indicative estimates and
 * authenticated enhanced/verified valuations share one versioned calculation;
 * evidence tiers stay separate and every signal keeps its provenance.
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
    private readonly credits: CreditsService,
    private readonly dataforseo: DataForSeoClient,
    private readonly integrations: IntegrationsService,
  ) {}

  onModuleInit() {
    this.jobs.register('valuation.run', async (p) => this.run(String(p.valuationId)));
  }

  // ── Methodology (versioned, append-only) ──────────────────────────────────

  async methodology(): Promise<{ version: string; config: ValuationConfig; effectiveAt: Date | null }> {
    const row = await this.prisma.valuationMethodology.findFirst({ orderBy: { effectiveAt: 'desc' } });
    if (row) return { version: row.version, config: withDefaults(row.configJson), effectiveAt: row.effectiveAt };
    return { version: 'v1.0.0', config: DEFAULT_CONFIG, effectiveAt: null };
  }

  /** Validated config change → new immutable methodology version (manual §06 PATCH /admin/valuation/config). */
  async updateConfig(userId: string, next: unknown, note: string | undefined, meta?: RequestMeta) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const config = withDefaults(next);
    const errors = validateConfig(config);
    if (errors.length) throw new BadRequestException({ code: 'INVALID_VALUATION_CONFIG', message: errors.join(' ') });
    const current = await this.methodology();
    if (current.effectiveAt && checksum(current.config) === checksum(config)) throw new BadRequestException({ code: 'NO_CHANGES', message: 'Nothing changed.' });
    const count = await this.prisma.valuationMethodology.count();
    const version = `v1.0.${count + 1}`;
    const row = await this.prisma.$transaction(async (tx) => {
      if (count === 0) {
        // Record the defaults the first results were calculated with.
        await tx.valuationMethodology.create({ data: { version: 'v1.0.0', configJson: DEFAULT_CONFIG as unknown as Prisma.InputJsonObject, checksum: checksum(DEFAULT_CONFIG), note: 'Initial defaults', effectiveAt: new Date(Date.now() - 1000) } });
      }
      const created = await tx.valuationMethodology.create({ data: { version, configJson: config as unknown as Prisma.InputJsonObject, checksum: checksum(config), approverId: userId, note: note?.slice(0, 500) ?? null } });
      await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'valuation.methodology.publish', targetType: 'valuation_methodology', targetId: created.id, reason: note?.slice(0, 500) ?? null, afterState: { version, checksum: created.checksum }, requestMeta: meta }, tx);
      return created;
    });
    return { version: row.version, config, effectiveAt: row.effectiveAt };
  }

  // ── Access helpers ────────────────────────────────────────────────────────

  private get allowPrivate() {
    return this.config.get<string>('AUDIT_ALLOW_PRIVATE_HOSTS') === 'true';
  }

  private secret() {
    return this.config.get<string>('AUTH_SYNC_SECRET') ?? '';
  }

  private requesterHash(ip: string | undefined) {
    return ip ? hash(`${this.secret()}:valuation:${ip}`).slice(0, 32) : null;
  }

  /** Share token = HMAC of the job id; lets non-owners read a result (manual §06). */
  shareToken(id: string) {
    return createHmac('sha256', this.secret()).update(`valuation-share:${id}`).digest('base64url').slice(0, 32);
  }

  private tokenOk(id: string, token: string | undefined) {
    if (!token) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(this.shareToken(id));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Owner (signed-in creator) or share-token holder; everyone else gets 404. */
  private async readable(id: string, viewer: { userId?: string | null; token?: string }) {
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v || v.kind === 'TEST') throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    const owner = !!viewer.userId && v.userId === viewer.userId;
    if (!owner && !this.tokenOk(id, viewer.token)) throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    return { v, owner };
  }

  private async defaultWorkspace(userId: string) {
    const m = await this.prisma.workspaceMembership.findFirst({ where: { userId, status: 'ACTIVE', workspace: { deletedAt: null } }, orderBy: { joinedAt: 'asc' } });
    return m?.workspaceId ?? null;
  }

  private async accessFor(c: ValuationConfig, workspaceId: string | null): Promise<PlanAccessLevel> {
    const code = workspaceId ? ((await this.entitlements.resolve(workspaceId)).planCode ?? 'free') : 'free';
    return c.access[code] ?? c.access.free ?? 'public';
  }

  private domainOf(input: string) {
    const host = normalizeHost(input ?? '');
    if (!host) throw new HttpException({ code: 'UNSUPPORTED_DOMAIN', message: 'Enter a valid public website domain, for example example.com.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    return host;
  }

  private assertConsent(c: ValuationConfig, consentVersion: string | undefined) {
    if (consentVersion !== c.consentVersion) throw new BadRequestException({ code: 'CONSENT_REQUIRED', message: 'Please accept the current valuation terms to continue.', consentVersion: c.consentVersion });
  }

  async publicConfig() {
    const { config: c, version } = await this.methodology();
    return {
      enabled: c.calculator.enabled,
      available: c.calculator.enabled && c.sources.crawler,
      consentVersion: c.consentVersion,
      methodologyVersion: version,
      weights: c.weights,
      anonymousPerDay: c.limits.anonymousPerDay,
      enhancedCredits: c.enhancedCredits,
      currency: c.currency,
      disclaimer: c.disclaimer,
      sources: SOURCES.filter((k) => c.sources[k]).map((k) => ({ key: k, label: SOURCE_LABELS[k] })),
    };
  }

  // ── Creating jobs ─────────────────────────────────────────────────────────

  /** POST /valuations — public quick estimate (anonymous or signed in). */
  async createEstimate(input: { domain: string; consentVersion: string; idempotencyKey?: string; userId?: string | null }, meta?: RequestMeta) {
    const { config: c, version } = await this.methodology();
    if (!c.calculator.enabled) throw new HttpException({ code: 'VALUATION_DISABLED', message: 'The Website Value Calculator is turned off.' }, HttpStatus.SERVICE_UNAVAILABLE);
    this.assertConsent(c, input.consentVersion);
    const domain = this.domainOf(input.domain);
    const key = input.idempotencyKey ? `est:${input.userId ?? 'anon'}:${input.idempotencyKey}` : null;
    if (key) {
      const prior = await this.prisma.websiteValuation.findUnique({ where: { idempotencyKey: key } });
      if (prior) return this.created(prior);
    }
    let workspaceId: string | null = null;
    const requesterHash = this.requesterHash(meta?.ipAddress);
    if (input.userId) {
      workspaceId = await this.defaultWorkspace(input.userId);
      if ((await this.accessFor(c, workspaceId)) === 'off') throw new ForbiddenException({ code: 'VALUATION_NOT_IN_PLAN', message: 'Website valuation is not included in your plan.' });
      const used = await this.prisma.websiteValuation.count({ where: { userId: input.userId, createdAt: { gte: monthStart() }, kind: { not: 'TEST' } } });
      if (used >= c.limits.userPerMonth) throw new HttpException({ code: 'VALUATION_LIMIT_REACHED', message: `You have used all ${c.limits.userPerMonth} valuations included this month.` }, HttpStatus.TOO_MANY_REQUESTS);
    } else {
      const since = new Date(Date.now() - DAY);
      const [mine, domainCount] = await Promise.all([
        requesterHash ? this.prisma.websiteValuation.count({ where: { requesterHash, createdAt: { gte: since } } }) : 0,
        this.prisma.websiteValuation.count({ where: { domain, userId: null, createdAt: { gte: since } } }),
      ]);
      if (mine >= c.limits.anonymousPerDay) throw new HttpException({ code: 'VALUATION_LIMIT_REACHED', message: `Free estimates are limited to ${c.limits.anonymousPerDay} per day. Create an account for more.` }, HttpStatus.TOO_MANY_REQUESTS);
      if (domainCount >= c.limits.anonymousPerDomainPerDay) throw new HttpException({ code: 'VALUATION_LIMIT_REACHED', message: 'This domain was estimated recently. Please try again tomorrow or sign in.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.websiteValuation.create({ data: { domain, kind: 'ESTIMATE', userId: input.userId ?? null, workspaceId, requesterHash: input.userId ? null : requesterHash, idempotencyKey: key, consentVersion: input.consentVersion, methodologyVersion: version, currency: c.currency } });
      await this.jobs.enqueue('valuation.run', { valuationId: v.id }, { jobKey: `valuation:${v.id}` }, tx);
      return v;
    });
    return this.created(row);
  }

  private created(v: WebsiteValuation) {
    return { id: v.id, jobId: v.id, status: v.status.toLowerCase(), shareToken: this.shareToken(v.id) };
  }

  /** POST /valuations/:id/verify — enhanced valuation with GSC/GA4 and/or self-reported financials. */
  async createVerified(userId: string, parentId: string, token: string | undefined, inputs: VerifyInputs, meta?: RequestMeta) {
    const { config: c, version } = await this.methodology();
    this.assertConsent(c, inputs.consentVersion);
    const { v: parent } = await this.readable(parentId, { userId, token });
    if (!inputs.ga4 && !inputs.gsc && !inputs.financial) throw new BadRequestException({ code: 'NOTHING_TO_VERIFY', message: 'Connect Google Search Console or GA4, or add financial details.' });
    if (inputs.financial && !inputs.acceptAssumptions) throw new BadRequestException({ code: 'ASSUMPTIONS_NOT_ACCEPTED', message: 'Please accept the valuation assumptions before adding financial details.' });
    const key = inputs.idempotencyKey ? `ver:${userId}:${inputs.idempotencyKey}` : null;
    if (key) {
      const prior = await this.prisma.websiteValuation.findUnique({ where: { idempotencyKey: key } });
      if (prior) return this.created(prior);
    }
    // Property access is verified before anything is queued (manual §10).
    if (inputs.ga4) await this.integrations.ga4ValuationSummary(userId, inputs.ga4.integrationId, inputs.ga4.propertyId);
    if (inputs.gsc) await this.integrations.gscValuationSummary(userId, inputs.gsc.integrationId, inputs.gsc.siteUrl);
    const connection = inputs.ga4 || inputs.gsc ? await this.prisma.workspaceIntegration.findUnique({ where: { id: (inputs.ga4 ?? inputs.gsc)!.integrationId } }) : null;
    const workspaceId = connection?.workspaceId ?? (await this.defaultWorkspace(userId));
    if (!workspaceId) throw new ForbiddenException({ code: 'WORKSPACE_REQUIRED', message: 'Create a workspace before running an enhanced valuation.' });
    await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read');
    if ((await this.accessFor(c, workspaceId)) !== 'enhanced') throw new ForbiddenException({ code: 'VALUATION_NOT_IN_PLAN', message: 'Enhanced valuations are not included in your plan.' });
    const id = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      const reservation = c.enhancedCredits > 0 ? await this.credits.reserve({ workspaceId, featureKey: 'valuation.enhanced', amount: c.enhancedCredits, referenceType: 'website_valuation', referenceId: id, idempotencyKey: `valuation:${id}`, actorId: userId, ttlMinutes: 180 }, tx) : null;
      const v = await tx.websiteValuation.create({
        data: {
          id,
          domain: parent.domain,
          kind: 'VERIFIED',
          parentId: parent.id,
          userId,
          workspaceId,
          idempotencyKey: key,
          consentVersion: inputs.consentVersion,
          methodologyVersion: version,
          currency: c.currency,
          reservationId: reservation?.id ?? null,
          inputsJson: { ga4: inputs.ga4 ?? null, gsc: inputs.gsc ?? null, financial: inputs.financial ?? null, acceptAssumptions: !!inputs.acceptAssumptions } as unknown as Prisma.InputJsonObject,
        },
      });
      await this.jobs.enqueue('valuation.run', { valuationId: v.id }, { jobKey: `valuation:${v.id}` }, tx);
      return v;
    });
    await this.audit.record({ actorUserId: userId, workspaceId, action: 'valuation.verify', targetType: 'website_valuation', targetId: row.id, afterState: { domain: parent.domain, ga4: !!inputs.ga4, gsc: !!inputs.gsc, financial: !!inputs.financial, reservedCredits: c.enhancedCredits }, requestMeta: meta });
    return this.created(row);
  }

  /** Admin test run: no limits; same pipeline. */
  async createTest(userId: string, domainInput: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.manage');
    const { config: c, version } = await this.methodology();
    const domain = this.domainOf(domainInput);
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.websiteValuation.create({ data: { domain, kind: 'TEST', userId, methodologyVersion: version, currency: c.currency } });
      await this.jobs.enqueue('valuation.run', { valuationId: v.id }, { jobKey: `valuation:${v.id}` }, tx);
      return v;
    });
    return { id: row.id };
  }

  async cancel(id: string, viewer: { userId?: string | null; token?: string }) {
    const { v } = await this.readable(id, viewer);
    if (v.status !== 'QUEUED') throw new HttpException({ code: 'NOT_CANCELLABLE', message: 'Only queued valuations can be cancelled.' }, HttpStatus.CONFLICT);
    await this.prisma.websiteValuation.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date() } });
    if (v.reservationId) await this.credits.release(v.reservationId, 'cancelled');
    return { id, status: 'cancelled' };
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────

  /** Cached provider read (manual §08 TTLs); `key` already includes domain and locale. */
  private async cached<T>(key: string, provider: string, hours: number, fetcher: () => Promise<T>): Promise<T> {
    if (hours > 0) {
      const hit = await this.prisma.providerCache.findUnique({ where: { key } });
      if (hit && hit.expiresAt > new Date()) return hit.valueJson as T;
    }
    const value = await fetcher();
    if (hours > 0) {
      const data = { provider, valueJson: value as unknown as Prisma.InputJsonValue, fetchedAt: new Date(), expiresAt: new Date(Date.now() + hours * 3600_000) };
      await this.prisma.providerCache.upsert({ where: { key }, create: { key, ...data }, update: data }).catch(() => undefined);
    }
    return value;
  }

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

  private async setStatus(id: string, status: ValuationStatus) {
    await this.prisma.websiteValuation.update({ where: { id }, data: { status } });
  }

  async run(id: string) {
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v || !ACTIVE.includes(v.status)) return;
    const { config: c, version } = await this.methodology();
    try {
      await this.setStatus(id, 'COLLECTING');
      const inputs = (v.inputsJson ?? {}) as Partial<VerifyInputs>;
      const { evidence, trend, screenshot } = await this.collect(v, c, inputs);
      await this.setStatus(id, 'NORMALIZING');
      // Self-reported inputs alone are not a result: at least one provider must return evidence.
      if (!evidence.some((e) => e.status === 'available' && e.source !== 'user')) throw Object.assign(new Error('No source returned evidence for this domain; the result would be empty.'), { code: 'SOURCE_UNAVAILABLE' });
      await this.prisma.valuationEvidence.createMany({
        data: evidence.map((e) => ({
          valuationId: id,
          source: e.source,
          metric: e.metric,
          label: e.label,
          valueJson: e.value === null ? Prisma.DbNull : (e.value as Prisma.InputJsonValue),
          unit: e.unit ?? null,
          classification: e.classification,
          status: e.status,
          observedAt: new Date(e.observedAt),
          periodStart: e.periodStart ? new Date(e.periodStart) : null,
          periodEnd: e.periodEnd ? new Date(e.periodEnd) : null,
          missingReason: e.missingReason ?? null,
          rawHash: e.value === null ? null : hash(JSON.stringify(e.value)).slice(0, 16),
        })),
      });
      await this.setStatus(id, 'CALCULATING');
      const result = calculate(evidence, c, inputs.financial ?? {});
      const stored: Stored = { result, insights: insights(result), trend, screenshot, methodology: { version, weights: c.weights, minEvidencePct: c.minEvidencePct } };
      await this.prisma.websiteValuation.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + c.resultTtlDays * DAY),
          methodologyVersion: version,
          qualityScore: result.qualityScore,
          confidenceGrade: result.confidence,
          evidenceCoveragePct: result.evidenceCoveragePct,
          valueLow: result.monetary?.low ?? null,
          valueHigh: result.monetary?.high ?? null,
          currency: c.currency,
          limitationsJson: result.limitations,
          resultJson: stored as unknown as Prisma.InputJsonObject,
          error: null,
        },
      });
      if (v.reservationId) await this.credits.settle(v.reservationId);
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'VALUATION_FAILED';
      this.logger.warn(`Valuation ${id} failed (${code}): ${(e as Error).message}`);
      await this.prisma.websiteValuation.update({ where: { id }, data: { status: 'FAILED', error: `${code}: ${(e as Error).message}`.slice(0, 500), completedAt: new Date() } });
      // Unrecoverable failures are never charged (manual §08).
      if (v.reservationId) await this.credits.release(v.reservationId, 'failed');
    }
  }

  private async collect(v: WebsiteValuation, c: ValuationConfig, inputs: Partial<VerifyInputs>) {
    const d = v.domain;
    const loc = `${c.calculator.country}:${c.calculator.language}`;
    const off = (k: SourceKey, metrics: [string, string][]) => missing(k, metrics, 'Disabled by the administrator.');
    const tasks: Promise<Evidence[]>[] = [];
    let trend: TrendPoint[] = [];
    let screenshot: string | null = null;
    tasks.push(c.sources.crawler ? this.cached(`crawler:${d}`, 'crawler', c.cacheHours.crawler, () => collectCrawler(d, this.allowPrivate)) : Promise.resolve(off('crawler', CRAWLER_METRICS)));
    tasks.push(
      c.sources.pagespeed
        ? this.cached(`pagespeed:${d}`, 'pagespeed', c.cacheHours.pagespeed, () => this.timed('pagespeed', 'valuation.pagespeed', () => collectPageSpeed(d, this.config.get<string>('PAGESPEED_API_KEY') || undefined))).then(
            (r) => ((screenshot = r.screenshot), r.evidence),
            (e: Error) => missing('pagespeed', PAGESPEED_METRICS, e.message),
          )
        : Promise.resolve(off('pagespeed', PAGESPEED_METRICS)),
    );
    tasks.push(c.sources.rdap ? this.cached(`rdap:${d}`, 'rdap', c.cacheHours.rdap, () => this.timed('rdap', 'valuation.rdap', () => collectRdap(d))).catch((e: Error) => missing('rdap', RDAP_METRICS, e.message)) : Promise.resolve(off('rdap', RDAP_METRICS)));
    if (!c.sources.dataforseo) tasks.push(Promise.resolve(off('dataforseo', DATAFORSEO_METRICS)));
    else if (!this.dataforseo.configured) tasks.push(Promise.resolve(missing('dataforseo', DATAFORSEO_METRICS, 'The SEO data provider is not configured.')));
    else
      tasks.push(
        this.cached(`dataforseo:${d}:${loc}`, 'dataforseo', c.cacheHours.rankings, () => collectDataForSeo(this.dataforseo, d, c.calculator.country, c.calculator.language)).then(
          (r) => ((trend = r.trend), r.evidence),
          (e: Error) => missing('dataforseo', DATAFORSEO_METRICS, e.message),
        ),
      );
    if (v.kind === 'VERIFIED' && v.userId) {
      if (inputs.gsc && c.sources.gsc) {
        const { integrationId, siteUrl } = inputs.gsc;
        tasks.push(
          this.timed('google', 'valuation.gsc', () => this.integrations.gscValuationSummary(v.userId!, integrationId, siteUrl)).then(
            (g) => {
              const period = { periodStart: new Date(Date.now() - 30 * DAY).toISOString(), periodEnd: new Date(Date.now() - 2 * DAY).toISOString() };
              return [
                ev('gsc', 'clicks_28d', 'Search clicks (28 days)', Math.round(g.clicks), period),
                ev('gsc', 'impressions_28d', 'Search impressions (28 days)', Math.round(g.impressions), period),
                ev('gsc', 'pages_with_impressions', 'Pages with search impressions', g.pagesWithImpressions, period),
                g.position === null ? ev('gsc', 'avg_position', 'Average position', null, { missingReason: 'No search data in the period.' }) : ev('gsc', 'avg_position', 'Average position', Math.round(g.position * 10) / 10, period),
              ];
            },
            (e: Error) => missing('gsc', [['clicks_28d', 'Search clicks (28 days)']], e.message),
          ),
        );
      }
      if (inputs.ga4 && c.sources.ga4) {
        const { integrationId, propertyId } = inputs.ga4;
        tasks.push(
          this.timed('google', 'valuation.ga4', () => this.integrations.ga4ValuationSummary(v.userId!, integrationId, propertyId)).then(
            (g) => {
              const period = { periodStart: new Date(Date.now() - 30 * DAY).toISOString(), periodEnd: new Date(Date.now() - DAY).toISOString() };
              return [ev('ga4', 'sessions_30d', 'Sessions (30 days)', g.totalSessions, period), ev('ga4', 'organic_sessions_30d', 'Organic search sessions (30 days)', g.organicSessions, period)];
            },
            (e: Error) => missing('ga4', [['sessions_30d', 'Sessions (30 days)']], e.message),
          ),
        );
      }
    }
    const evidence = (await Promise.all(tasks)).flat();
    const f = inputs.financial;
    if (f) {
      const self = (metric: string, label: string, value: number | string | null | undefined) =>
        ({ source: 'user' as const, metric: `user.${metric}`, label, value: value ?? null, classification: 'self_reported' as const, status: value === null || value === undefined ? ('unavailable' as const) : ('available' as const), observedAt: new Date().toISOString(), missingReason: value === null || value === undefined ? 'Not provided.' : null, periodStart: null, periodEnd: null, unit: typeof value === 'number' ? c.currency : null });
      evidence.push(self('ttm_revenue', 'Revenue (trailing 12 months)', f.ttmRevenue), self('ttm_expenses', 'Expenses (trailing 12 months)', f.ttmExpenses), self('ttm_profit', 'Owner earnings (trailing 12 months)', f.ttmProfit), self('business_model', 'Business model', f.businessModel));
    }
    return { evidence, trend, screenshot };
  }

  // ── Reading ───────────────────────────────────────────────────────────────

  /** Marks a completed result past its lifetime as expired (the only allowed change). */
  private async freshen(v: WebsiteValuation) {
    if (v.status === 'COMPLETED' && v.expiresAt && v.expiresAt < new Date()) {
      await this.prisma.websiteValuation.update({ where: { id: v.id }, data: { status: 'EXPIRED' } });
      return { ...v, status: 'EXPIRED' as ValuationStatus };
    }
    return v;
  }

  async get(id: string, viewer: { userId?: string | null; token?: string }) {
    const { v: raw, owner } = await this.readable(id, viewer);
    const v = await this.freshen(raw);
    const { config: c } = await this.methodology();
    const children = await this.prisma.websiteValuation.findMany({ where: { parentId: v.id, kind: 'VERIFIED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } });
    return { ...this.shape(v), owner, shareToken: this.shareToken(v.id), verifiedChild: children[0] ? { id: children[0].id, status: children[0].status.toLowerCase(), shareToken: this.shareToken(children[0].id) } : null, enhancedCredits: c.enhancedCredits, consentVersion: c.consentVersion, disclaimer: c.disclaimer };
  }

  private shape(v: WebsiteValuation) {
    const stored = v.resultJson as unknown as Stored | null;
    const r = stored?.result ?? null;
    return {
      id: v.id,
      domain: v.domain,
      mode: v.kind === 'VERIFIED' ? 'enhanced' : v.kind === 'TEST' ? 'test' : 'public',
      status: v.status.toLowerCase(),
      error: v.status === 'FAILED' ? v.error : null,
      parentId: v.parentId,
      createdAt: v.createdAt,
      asOf: v.completedAt,
      expiresAt: v.expiresAt,
      methodologyVersion: v.methodologyVersion,
      currency: v.currency,
      qualityScore: v.qualityScore,
      confidence: v.confidenceGrade,
      evidenceCoveragePct: v.evidenceCoveragePct,
      monetaryRange: r?.monetary ? { low: r.monetary.low, high: r.monetary.high, currency: r.monetary.currency, earnings: r.monetary.earnings, multipleLow: r.monetary.multipleLow, multipleHigh: r.monetary.multipleHigh, riskAdjusted: r.monetary.riskAdjusted } : null,
      breakdown: r?.breakdown ?? null,
      limitations: (v.limitationsJson as string[] | null) ?? [],
      strengths: stored?.insights.strengths ?? [],
      improvements: stored?.insights.improvements ?? [],
      opportunities: stored?.insights.opportunities ?? [],
      trend: stored?.trend ?? [],
      screenshot: stored?.screenshot ?? null,
      methodology: stored?.methodology ?? null,
    };
  }

  /** GET /valuations/:id/evidence — per-signal provenance. */
  async evidence(id: string, viewer: { userId?: string | null; token?: string }) {
    await this.readable(id, viewer);
    return this.evidenceRows(id);
  }

  private async evidenceRows(id: string) {
    const rows = await this.prisma.valuationEvidence.findMany({ where: { valuationId: id }, orderBy: [{ source: 'asc' }, { metric: 'asc' }] });
    return rows.map((e) => ({ source: e.source, sourceLabel: e.source === 'user' ? 'You (self-reported)' : (SOURCE_LABELS[e.source as SourceKey] ?? e.source), metric: e.metric, label: e.label, value: e.valueJson, unit: e.unit, classification: e.classification, status: e.status, observedAt: e.observedAt, periodStart: e.periodStart, periodEnd: e.periodEnd, missingReason: e.missingReason }));
  }

  async preview(id: string, viewer: { userId?: string | null; token?: string }, financial: FinancialInputs, planned: ('gsc' | 'ga4')[]) {
    const { v } = await this.readable(id, viewer);
    if (v.status !== 'COMPLETED' && v.status !== 'EXPIRED') throw new HttpException({ code: 'VALUATION_NOT_READY', message: 'The valuation is still being calculated.' }, HttpStatus.CONFLICT);
    const { config: c } = await this.methodology();
    const rows = await this.evidenceRows(id);
    const evid: Evidence[] = rows.map((e) => ({ source: e.source as SourceKey, metric: e.metric, label: e.label, value: e.value as Evidence['value'], classification: e.classification as Evidence['classification'], status: e.status as Evidence['status'], observedAt: e.observedAt.toISOString() }));
    // Projection only: planned Google connections are assumed to succeed.
    for (const p of planned) evid.push({ source: p, metric: `${p}.planned`, label: 'Planned connection', value: 1, classification: 'verified', status: 'available', observedAt: new Date().toISOString() });
    const r = calculate(evid, c, financial);
    return { projected: true, qualityScore: r.qualityScore, confidence: r.confidence, monetaryRange: r.monetary ? { low: r.monetary.low, high: r.monetary.high, currency: r.monetary.currency } : null, limitations: r.limitations };
  }

  async mine(userId: string) {
    const rows = await this.prisma.websiteValuation.findMany({ where: { userId, kind: { not: 'TEST' } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((v) => ({ ...this.shape(v), shareToken: this.shareToken(v.id) }));
  }

  // ── Report (PDF) ──────────────────────────────────────────────────────────

  async pdf(id: string, viewer: { userId?: string | null; token?: string }) {
    const { v: raw } = await this.readable(id, viewer);
    const v = await this.freshen(raw);
    if (v.status !== 'COMPLETED' && v.status !== 'EXPIRED') throw new HttpException({ code: 'VALUATION_NOT_READY', message: 'The valuation is still being calculated.' }, HttpStatus.CONFLICT);
    const { config: c } = await this.methodology();
    if (v.workspaceId) {
      const used = await this.prisma.usageEvent.count({ where: { workspaceId: v.workspaceId, featureKey: 'valuation.pdf', occurredAt: { gte: monthStart() } } });
      if (used >= c.limits.pdfPerMonth) throw new HttpException({ code: 'EXPORT_LIMIT_REACHED', message: `PDF downloads are limited to ${c.limits.pdfPerMonth} per month.` }, HttpStatus.TOO_MANY_REQUESTS);
      await this.prisma.usageEvent.create({ data: { workspaceId: v.workspaceId, featureKey: 'valuation.pdf', units: 1, idempotencyKey: `valuation.pdf:${randomUUID()}` } });
    }
    const s = this.shape(v);
    const rows = await this.evidenceRows(id);
    const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: v.currency, maximumFractionDigits: 0 }).format(n);
    const fmt = (x: unknown) => (x === null || x === undefined ? '—' : typeof x === 'boolean' ? (x ? 'Yes' : 'No') : String(x));
    const sections: SectionPayload[] = [
      {
        title: 'Summary',
        summary: s.monetaryRange
          ? `Indicative range ${money(s.monetaryRange.low)} – ${money(s.monetaryRange.high)} (owner earnings ${money(s.monetaryRange.earnings)} × comparable multiples ${s.monetaryRange.multipleLow}–${s.monetaryRange.multipleHigh}${s.monetaryRange.riskAdjusted ? ', risk-adjusted' : ''}).`
          : 'Insufficient evidence for a monetary valuation.',
        metrics: [
          { label: 'Quality score', value: s.qualityScore === null ? 'Not enough evidence' : `${s.qualityScore}/100` },
          { label: 'Confidence', value: s.confidence ?? '—' },
          { label: 'Evidence coverage', value: `${s.evidenceCoveragePct ?? 0}%` },
          { label: 'Methodology', value: s.methodologyVersion ?? '—' },
        ],
      },
      ...(s.breakdown ? [{ title: 'Score composition', table: { columns: ['Category', 'Weight', 'Score'], rows: s.breakdown.map((b) => [CATEGORY_LABELS[b.category], `${b.weight}%`, b.score === null ? 'No evidence' : `${b.score}/100`]) } }] : []),
      { title: 'Limitations', bullets: s.limitations, empty: 'None.' },
      { title: 'Evidence', table: { columns: ['Source', 'Signal', 'Value', 'Class', 'Observed'], rows: rows.map((e) => [e.sourceLabel, e.label, e.status === 'available' ? `${fmt(e.value)}${e.unit ? ` ${e.unit}` : ''}` : `Unavailable: ${e.missingReason ?? ''}`, e.classification, e.observedAt.toISOString().slice(0, 10)]) } },
      { title: 'Ways to improve', bullets: s.opportunities, empty: '—' },
      { title: 'Disclosure', summary: `${c.disclaimer} Methodology ${s.methodologyVersion}; currency ${v.currency}; search market ${c.calculator.country.toUpperCase()} (${c.calculator.language}); calculated ${s.asOf ? new Date(s.asOf).toISOString().slice(0, 10) : '—'}.` },
    ];
    return { filename: `website-value-${v.domain}.pdf`, body: await renderPdf({ title: 'Website Value Report', projectName: v.domain, domain: v.domain, period: v.kind === 'VERIFIED' ? 'Enhanced valuation' : 'Public indicative estimate', generatedAt: new Date(), sections }) };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async adminConfig(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const current = await this.methodology();
    const [versions, plans] = await Promise.all([
      this.prisma.valuationMethodology.findMany({ orderBy: { effectiveAt: 'desc' }, take: 50, select: { id: true, version: true, checksum: true, approverId: true, note: true, effectiveAt: true } }),
      this.prisma.plan.findMany({ where: { status: { not: 'ARCHIVED' } }, orderBy: { displayOrder: 'asc' }, select: { code: true, name: true } }),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: versions.map((x) => x.approverId).filter((x): x is string => !!x) } }, select: { id: true, displayName: true, email: true } });
    const who = new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
    return {
      version: current.version,
      config: current.config,
      defaults: DEFAULT_CONFIG,
      categoryLabels: CATEGORY_LABELS,
      sourceLabels: SOURCE_LABELS,
      plans,
      versions: versions.map((x, i) => ({ ...x, approver: x.approverId ? (who.get(x.approverId) ?? 'Admin') : 'System', current: i === 0 })),
    };
  }

  async history(userId: string, q: { kind?: string; status?: string; domain?: string }) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const where: Prisma.WebsiteValuationWhereInput = {};
    if (q.kind && ['ESTIMATE', 'VERIFIED', 'TEST'].includes(q.kind)) where.kind = q.kind as ValuationKind;
    if (q.status && Object.values(ValuationStatus).includes(q.status as ValuationStatus)) where.status = q.status as ValuationStatus;
    if (q.domain) where.domain = { contains: q.domain.trim().toLowerCase() };
    const rows = await this.prisma.websiteValuation.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { email: true } } } });
    return rows.map((r) => ({ id: r.id, domain: r.domain, kind: r.kind, status: r.status, qualityScore: r.qualityScore, confidence: r.confidenceGrade, valueLow: r.valueLow, valueHigh: r.valueHigh, currency: r.currency, methodologyVersion: r.methodologyVersion, error: r.error, createdAt: r.createdAt, completedAt: r.completedAt, user: r.user?.email ?? null }));
  }

  async adminDetail(userId: string, id: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const v = await this.prisma.websiteValuation.findUnique({ where: { id } });
    if (!v) throw new NotFoundException({ code: 'VALUATION_NOT_FOUND', message: 'Valuation not found.' });
    return { ...this.shape(v), evidence: await this.evidenceRows(id) };
  }

  async sources(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const { config: c } = await this.methodology();
    const since = new Date(Date.now() - 30 * DAY);
    const google = !!this.config.get('GOOGLE_OAUTH_CLIENT_ID') && !!this.config.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const info: Record<SourceKey, { ok: boolean; note: string; provider: string; op: string; classification: string }> = {
      crawler: { ok: true, note: 'Built in: home page, robots.txt and sitemap through the SSRF-safe fetcher.', provider: 'crawler', op: '', classification: 'Observed' },
      pagespeed: { ok: true, note: this.config.get('PAGESPEED_API_KEY') ? 'Using PAGESPEED_API_KEY.' : 'Keyless (rate-limited); set PAGESPEED_API_KEY for production volume.', provider: 'pagespeed', op: 'valuation.', classification: 'Observed' },
      rdap: { ok: true, note: 'IANA bootstrap → authoritative RDAP service; no key required.', provider: 'rdap', op: 'valuation.', classification: 'Public record' },
      dataforseo: { ok: this.dataforseo.configured, note: this.dataforseo.configured ? 'Labs domain overview and history (modeled estimates).' : 'Set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.', provider: 'dataforseo', op: 'valuation.', classification: 'Modeled' },
      gsc: { ok: google, note: google ? 'Read with each user’s own Google connection.' : 'Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.', provider: 'google', op: 'valuation.gsc', classification: 'Verified' },
      ga4: { ok: google, note: google ? 'Read with each user’s own Google connection.' : 'Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.', provider: 'google', op: 'valuation.ga4', classification: 'Verified' },
    };
    return Promise.all(
      SOURCES.map(async (k) => {
        const where = { provider: info[k].provider, operation: { startsWith: info[k].op }, createdAt: { gte: since } };
        const [count, last] = k === 'crawler' ? [0, null] : await Promise.all([this.prisma.providerEvent.count({ where }), this.prisma.providerEvent.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })]);
        return { key: k, label: SOURCE_LABELS[k], enabled: c.sources[k], configured: info[k].ok, note: info[k].note, classification: info[k].classification, requests30d: count, lastSync: last?.createdAt ?? null };
      }),
    );
  }

  async usage(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'system.read');
    const since = new Date(Date.now() - 30 * DAY);
    const [byKind, failed, monetary, pdfs] = await Promise.all([
      this.prisma.websiteValuation.groupBy({ by: ['kind'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.websiteValuation.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
      this.prisma.websiteValuation.count({ where: { createdAt: { gte: since }, valueLow: { not: null } } }),
      this.prisma.usageEvent.count({ where: { featureKey: 'valuation.pdf', occurredAt: { gte: since } } }),
    ]);
    return { byKind: Object.fromEntries(byKind.map((r) => [r.kind, r._count._all])), failed, withMonetaryRange: monetary, pdfExports: pdfs };
  }
}
