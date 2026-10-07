import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { CreditsService } from '../commerce/credits.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { normalizeHost } from '../common/utils/domain';
import { parsePublicUrl, SafeFetchError } from '../common/utils/safe-fetch';
import { fingerprint, scoreFindings } from './analyzer';
import { crawl, CrawlResult } from './crawler';
import { CATEGORY_LABELS, RULES_BY_KEY } from './rules';

export type AuditMode = 'SEO' | 'GEO' | 'BOTH';
export type AuditScope = 'PAGE' | 'SITE';

export type AuditRequest = {
  url?: string;
  scope?: AuditScope;
  mode?: AuditMode;
  maxPages?: number;
};

type RunRequestJson = {
  url: string;
  scope: AuditScope;
  mode: AuditMode;
  maxPages: number;
  requestedBy: string | null;
  verificationTaskIds?: string[];
};

export const AUDIT_QUEUE = 'audit.run';
const USAGE_FEATURE = 'seo.audit_run';

/**
 * SEO / GEO audit runs: request → queued job → crawl + rule analysis →
 * pages, findings (fingerprinted across runs) and rule recommendations →
 * scores and summary. Findings that disappear on a later run of the same
 * page are marked RESOLVED; ones that come back after resolution REGRESSED.
 */
@Injectable()
export class AuditsService implements OnModuleInit {
  private readonly logger = new Logger(AuditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly jobs: JobsService,
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.register(AUDIT_QUEUE, async (payload) => this.process(String(payload.runId)));
  }

  private get allowPrivate() {
    return this.config.get<string>('AUDIT_ALLOW_PRIVATE_HOSTS') === 'true';
  }

  async request(actorId: string, projectId: string, req: AuditRequest, meta?: RequestMeta, trigger: 'MANUAL' | 'SCHEDULED' | 'SYSTEM' = 'MANUAL') {
    const project = await this.projects.requireProject(actorId, projectId, 'seo.audit.run');
    if (project.status !== 'ACTIVE') {
      throw new ConflictException({ code: 'PROJECT_NOT_ACTIVE', message: 'Resume the project before running an audit.' });
    }
    const mode: AuditMode = req.mode ?? 'SEO';
    const scope: AuditScope = req.scope ?? 'PAGE';
    await this.entitlements.assertModuleEnabled('seo_audit');
    await this.entitlements.assertFeature(project.workspaceId, 'seo.on_page_audit');
    if (mode !== 'SEO') await this.entitlements.assertFeature(project.workspaceId, 'geo.audit');
    await this.entitlements.assertWithinLimit(project.workspaceId, 'limit.audit_runs', USAGE_FEATURE);

    const domains = await this.prisma.domain.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    let url: URL;
    try {
      url = parsePublicUrl(req.url?.trim() || (domains[0] ? `https://${domains[0].host}/` : ''), this.allowPrivate);
    } catch (err) {
      throw new BadRequestException({
        code: 'INVALID_URL',
        message: req.url ? (err as SafeFetchError).message : 'Add a website domain to this project or enter a page URL.',
      });
    }
    // IP hosts are only reachable in local development (AUDIT_ALLOW_PRIVATE_HOSTS).
    const host = normalizeHost(url.hostname) ?? (this.allowPrivate ? url.hostname : null);
    if (!host) throw new BadRequestException({ code: 'INVALID_URL', message: 'Enter a valid public URL.' });

    // Audits are limited to the project's own domains (and their subdomains).
    let domain = domains.find((d) => host === d.host || host.endsWith(`.${d.host}`) || d.host === host.replace(/^www\./, ''));
    if (!domain) {
      if (domains.length > 0) {
        throw new BadRequestException({
          code: 'URL_OUTSIDE_PROJECT',
          message: `This URL is not on the project's website (${domains.map((d) => d.host).join(', ')}).`,
        });
      }
      domain = await this.prisma.domain.create({ data: { projectId, host, canonicalUrl: `${url.protocol}//${host}` } });
    }

    const active = await this.prisma.auditRun.count({ where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } } });
    if (active >= 3) {
      throw new ConflictException({ code: 'AUDIT_IN_PROGRESS', message: 'Several audits are already running for this project. Try again when they finish.' });
    }

    const maxPages = scope === 'SITE' ? Math.min(Math.max(req.maxPages ?? 25, 1), 200) : 1;
    const requestJson: RunRequestJson = { url: url.toString(), scope, mode, maxPages, requestedBy: actorId };

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.auditRun.create({
        data: { projectId, domainId: domain!.id, trigger, status: 'QUEUED', summaryJson: { request: requestJson } as Prisma.InputJsonObject },
      });
      await this.credits.charge(
        {
          workspaceId: project.workspaceId,
          projectId,
          featureKey: USAGE_FEATURE,
          units: scope === 'SITE' ? maxPages : 1,
          referenceType: 'audit_run',
          referenceId: created.id,
          idempotencyKey: `audit:${created.id}`,
          actorId,
        },
        tx,
      );
      await this.jobs.enqueue(AUDIT_QUEUE, { runId: created.id }, { jobKey: `audit:${created.id}` }, tx);
      await this.auditLog.record(
        {
          actorUserId: actorId,
          organizationId: project.organizationId,
          workspaceId: project.workspaceId,
          action: 'project.audit.request',
          targetType: 'audit_run',
          targetId: created.id,
          afterState: { url: requestJson.url, scope, mode },
          requestMeta: meta,
        },
        tx,
      );
      return created;
    });
    return this.runView(run);
  }

  /** Job handler. Safe to retry: a finished run is left untouched. */
  async process(runId: string) {
    const run = await this.prisma.auditRun.findUnique({ where: { id: runId }, include: { project: true } });
    if (!run || run.status === 'SUCCEEDED' || run.status === 'CANCELED' || run.status === 'FAILED') return;
    const request = (run.summaryJson as { request: RunRequestJson }).request;
    await this.prisma.auditRun.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } });

    let result: CrawlResult;
    try {
      result = await crawl({ startUrl: request.url, scope: request.scope, maxPages: request.maxPages, allowPrivate: this.allowPrivate });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.auditRun.update({
        where: { id: runId },
        data: { status: 'FAILED', completedAt: new Date(), summaryJson: { request, error: message } as Prisma.InputJsonObject },
      });
      await this.credits.refund(run.project.workspaceId, `audit:${runId}`);
      await this.failVerifications(runId, message);
      if (request.requestedBy) {
        await this.notifications.notify({
          workspaceId: run.project.workspaceId,
          userId: request.requestedBy,
          eventKey: 'audit.failed',
          title: 'Audit failed',
          body: `The audit of ${request.url} could not be completed: ${message}`,
        });
      }
      return;
    }

    const current = await this.prisma.auditRun.findUnique({ where: { id: runId } });
    if (current?.status === 'CANCELED') return;

    const pageScores: number[] = [];
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    const categoryTotals = { TECHNICAL: 0, SEO: 0, CONTENT: 0, GEO: 0 };

    for (const page of result.pages) {
      const scores = scoreFindings(page.findings);
      pageScores.push(scores.overall);
      for (const k of Object.keys(categoryTotals) as (keyof typeof categoryTotals)[]) categoryTotals[k] += scores[k];

      await this.prisma.$transaction(async (tx) => {
        const pageRow = await tx.page.upsert({
          where: { domainId_url: { domainId: run.domainId!, url: page.url } },
          create: {
            domainId: run.domainId!,
            url: page.url,
            canonicalUrl: page.metrics.canonical,
            httpStatus: page.metrics.status || null,
            lastSeenAt: new Date(),
            contentHash: page.metrics.contentHash,
          },
          update: {
            canonicalUrl: page.metrics.canonical,
            httpStatus: page.metrics.status || null,
            lastSeenAt: new Date(),
            contentHash: page.metrics.contentHash,
          },
        });

        const previous = await tx.auditPage.findFirst({
          where: { pageId: pageRow.id, auditRun: { status: 'SUCCEEDED' }, auditRunId: { not: runId } },
          orderBy: { auditRun: { startedAt: 'desc' } },
          include: { findings: true },
        });
        const previousByFp = new Map((previous?.findings ?? []).map((f) => [f.fingerprint, f]));

        const auditPage = await tx.auditPage.create({
          data: {
            auditRunId: runId,
            pageId: pageRow.id,
            score: scores.overall,
            metricsJson: { ...page.metrics, scores } as unknown as Prisma.InputJsonObject,
          },
        });

        const seen = new Set<string>();
        for (const f of page.findings) {
          const rule = RULES_BY_KEY.get(f.ruleKey)!;
          const fp = fingerprint(page.url, f.ruleKey, f.context);
          if (seen.has(fp)) continue;
          seen.add(fp);
          counts[rule.severity]++;
          const prior = previousByFp.get(fp);
          let status: FindingStatus = 'OPEN';
          if (prior?.status === 'IGNORED') status = 'IGNORED';
          else if (prior?.status === 'IN_PROGRESS') status = 'IN_PROGRESS';
          else if (prior?.status === 'RESOLVED') status = 'REGRESSED';
          const finding = await tx.auditFinding.create({
            data: {
              auditPageId: auditPage.id,
              ruleKey: f.ruleKey,
              severity: rule.severity,
              status,
              fingerprint: fp,
              detailsJson: { category: rule.category, ...(f.details ?? {}) } as Prisma.InputJsonObject,
              recommendations: {
                create: { priority: rule.priority, title: rule.title, guidance: rule.guidance, source: 'RULE' },
              },
            },
          });
          // Carry open tasks forward so the Optimization Center keeps one task per issue.
          if (prior) {
            await tx.optimizationTask.updateMany({
              where: { findingId: prior.id, status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] } },
              data: { findingId: finding.id },
            });
            if (status === 'REGRESSED') {
              await tx.findingEvent.create({ data: { findingId: finding.id, eventType: 'regressed', payload: { previousFindingId: prior.id } } });
            }
          }
        }

        // Issues that no longer occur on this page are resolved.
        for (const prior of previous?.findings ?? []) {
          if (seen.has(prior.fingerprint) || prior.status === 'RESOLVED' || prior.status === 'IGNORED') continue;
          await tx.auditFinding.update({ where: { id: prior.id }, data: { status: 'RESOLVED' } });
          await tx.findingEvent.create({ data: { findingId: prior.id, eventType: 'resolved', payload: { auditRunId: runId } } });
        }
      });
    }

    const n = result.pages.length;
    const first = result.pages[0];
    const summary = {
      request,
      pagesCrawled: n,
      scores: {
        overall: Math.round(pageScores.reduce((a, b) => a + b, 0) / n),
        technical: Math.round(categoryTotals.TECHNICAL / n),
        seo: Math.round(categoryTotals.SEO / n),
        content: Math.round(categoryTotals.CONTENT / n),
        geo: Math.round(categoryTotals.GEO / n),
      },
      counts,
      site: result.site,
      errors: result.errors.slice(0, 50),
      page: {
        url: first.metrics.finalUrl,
        status: first.metrics.status,
        title: first.metrics.title,
        metaDescription: first.metrics.metaDescription,
        h1: first.metrics.h1[0] ?? null,
        wordCount: first.metrics.wordCount,
        responseTimeMs: first.metrics.responseTimeMs,
      },
    };
    await this.prisma.auditRun.update({
      where: { id: runId },
      data: { status: 'SUCCEEDED', completedAt: new Date(), summaryJson: summary as unknown as Prisma.InputJsonObject },
    });
    await this.completeVerifications(runId);

    if (request.requestedBy) {
      await this.notifications.notify({
        workspaceId: run.project.workspaceId,
        userId: request.requestedBy,
        eventKey: 'audit.completed',
        title: `Audit completed: score ${summary.scores.overall}/100`,
        body: `${request.url} — ${n} page${n === 1 ? '' : 's'} analyzed, ${counts.CRITICAL + counts.HIGH} high-priority issue${counts.CRITICAL + counts.HIGH === 1 ? '' : 's'} found.`,
      });
    }
  }

  async cancel(actorId: string, runId: string, meta?: RequestMeta) {
    const run = await this.getRun(runId);
    const project = await this.projects.requireProject(actorId, run.projectId, 'seo.audit.run');
    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
      throw new ConflictException({ code: 'AUDIT_NOT_ACTIVE', message: 'Only queued or running audits can be canceled.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.auditRun.update({ where: { id: runId }, data: { status: 'CANCELED', completedAt: new Date() } });
      await tx.backgroundJob.updateMany({ where: { jobKey: `audit:${runId}`, status: 'QUEUED' }, data: { status: 'CANCELED' } });
      await this.auditLog.record(
        { actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.audit.cancel', targetType: 'audit_run', targetId: runId, requestMeta: meta },
        tx,
      );
    });
    await this.credits.refund(project.workspaceId, `audit:${runId}`);
    await this.failVerifications(runId, 'Audit canceled');
    return { id: runId, status: 'CANCELED' };
  }

  async list(actorId: string, projectId: string, limit = 50) {
    await this.projects.requireProject(actorId, projectId, 'seo.audit.read');
    const runs = await this.prisma.auditRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return runs.map((r) => this.runView(r));
  }

  async get(actorId: string, runId: string) {
    const run = await this.getRun(runId);
    await this.projects.requireProject(actorId, run.projectId, 'seo.audit.read');
    const pages = await this.prisma.auditPage.findMany({
      where: { auditRunId: runId },
      include: {
        page: { select: { url: true } },
        findings: { include: { recommendations: true, optimizationTasks: { select: { id: true, status: true } } }, orderBy: { severity: 'asc' } },
      },
    });
    return {
      ...this.runView(run),
      pages: pages.map((p) => ({
        id: p.id,
        url: p.page.url,
        score: p.score ? Number(p.score) : null,
        metrics: p.metricsJson,
        findings: p.findings.map((f) => this.findingView(f, p.page.url)),
      })),
    };
  }

  /** Latest run for the project (optionally for one URL), used by the audit page. */
  async latest(actorId: string, projectId: string, url?: string) {
    await this.projects.requireProject(actorId, projectId, 'seo.audit.read');
    const runs = await this.prisma.auditRun.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' }, take: 50 });
    const target = url ? parsePublicUrlSafe(url) : null;
    const run = target
      ? runs.find((r) => sameUrl((r.summaryJson as { request?: RunRequestJson })?.request?.url, target))
      : runs[0];
    return run ? this.get(actorId, run.id) : null;
  }

  async setFindingStatus(actorId: string, findingId: string, status: FindingStatus, meta?: RequestMeta) {
    if (!['OPEN', 'IN_PROGRESS', 'IGNORED', 'RESOLVED'].includes(status)) {
      throw new BadRequestException({ code: 'INVALID_STATUS', message: 'Status must be OPEN, IN_PROGRESS, IGNORED or RESOLVED.' });
    }
    const finding = await this.prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: { auditPage: { include: { auditRun: true } } },
    });
    if (!finding) throw new NotFoundException({ code: 'FINDING_NOT_FOUND', message: 'Finding not found.' });
    const project = await this.projects.requireProject(actorId, finding.auditPage.auditRun.projectId, 'optimization.manage');
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.auditFinding.update({ where: { id: findingId }, data: { status } });
      await tx.findingEvent.create({ data: { findingId, actorUserId: actorId, eventType: 'status_changed', payload: { from: finding.status, to: status } } });
      await this.auditLog.record(
        {
          actorUserId: actorId,
          organizationId: project.organizationId,
          workspaceId: project.workspaceId,
          action: 'project.finding.update',
          targetType: 'audit_finding',
          targetId: findingId,
          beforeState: { status: finding.status },
          afterState: { status },
          requestMeta: meta,
        },
        tx,
      );
      return saved;
    });
  }

  /** Queues a verification re-audit of the finding's page for each task. Used by the optimization module. */
  async requestVerification(actorId: string, projectId: string, url: string, taskIds: string[], meta?: RequestMeta) {
    const run = await this.request(actorId, projectId, { url, scope: 'PAGE', mode: 'BOTH' }, meta, 'SYSTEM').catch(async (err) => {
      // GEO may be restricted by plan; verification only needs the rule checks.
      if (err?.response?.code === 'PLAN_RESTRICTED') return this.request(actorId, projectId, { url, scope: 'PAGE', mode: 'SEO' }, meta, 'SYSTEM');
      throw err;
    });
    await this.prisma.verificationRun.createMany({ data: taskIds.map((taskId) => ({ taskId, auditRunId: run.id, status: 'QUEUED' as const })) });
    return run;
  }

  private async completeVerifications(runId: string) {
    const verifications = await this.prisma.verificationRun.findMany({
      where: { auditRunId: runId, status: { in: ['QUEUED', 'RUNNING'] } },
      include: { task: { include: { finding: true, project: true } } },
    });
    if (!verifications.length) return;
    const fingerprints = new Set(
      (await this.prisma.auditFinding.findMany({ where: { auditPage: { auditRunId: runId } }, select: { fingerprint: true } })).map((f) => f.fingerprint),
    );
    for (const v of verifications) {
      const fp = v.task.finding?.fingerprint;
      const passed = fp ? !fingerprints.has(fp) : false;
      await this.prisma.$transaction(async (tx) => {
        await tx.verificationRun.update({
          where: { id: v.id },
          data: {
            status: 'SUCCEEDED',
            result: fp ? (passed ? 'PASSED' : 'FAILED') : 'INCONCLUSIVE',
            evidenceJson: { auditRunId: runId, ruleKey: v.task.finding?.ruleKey ?? null, stillPresent: fp ? !passed : null },
          },
        });
        if (passed) await tx.optimizationTask.update({ where: { id: v.taskId }, data: { status: 'DONE' } });
      });
      const assignee = v.task.assignedTo;
      if (assignee) {
        await this.notifications.notify({
          workspaceId: v.task.project.workspaceId,
          userId: assignee,
          eventKey: 'verification.completed',
          title: passed ? 'Fix verified' : 'Fix not verified yet',
          body: `${v.task.title}: ${passed ? 'the issue no longer appears.' : 'the issue is still present on the page.'}`,
        });
      }
    }
  }

  private async failVerifications(runId: string, message: string) {
    await this.prisma.verificationRun.updateMany({
      where: { auditRunId: runId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'FAILED', result: 'INCONCLUSIVE', evidenceJson: { error: message } },
    });
  }

  private async getRun(runId: string) {
    const run = await this.prisma.auditRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException({ code: 'AUDIT_NOT_FOUND', message: 'Audit not found.' });
    return run;
  }

  runView(run: { id: string; projectId: string; status: string; trigger: string; startedAt: Date; completedAt: Date | null; summaryJson: Prisma.JsonValue }) {
    const summary = (run.summaryJson ?? {}) as Record<string, unknown>;
    return {
      id: run.id,
      projectId: run.projectId,
      status: run.status,
      trigger: run.trigger,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      request: summary.request ?? null,
      scores: summary.scores ?? null,
      counts: summary.counts ?? null,
      pagesCrawled: summary.pagesCrawled ?? null,
      page: summary.page ?? null,
      site: summary.site ?? null,
      error: summary.error ?? null,
    };
  }

  findingView(
    f: {
      id: string;
      ruleKey: string;
      severity: string;
      status: string;
      detailsJson: Prisma.JsonValue;
      createdAt: Date;
      recommendations: { title: string; guidance: string; priority: number; source: string }[];
      optimizationTasks?: { id: string; status: string }[];
    },
    pageUrl: string,
  ) {
    const rule = RULES_BY_KEY.get(f.ruleKey);
    const details = (f.detailsJson ?? {}) as Record<string, unknown>;
    return {
      id: f.id,
      ruleKey: f.ruleKey,
      severity: f.severity,
      status: f.status,
      category: rule?.category ?? (details.category as string) ?? 'SEO',
      categoryLabel: CATEGORY_LABELS[rule?.category ?? 'SEO'],
      priority: rule?.priority ?? 3,
      title: rule?.title ?? f.ruleKey,
      why: rule?.why ?? null,
      guidance: f.recommendations[0]?.guidance ?? rule?.guidance ?? null,
      details,
      pageUrl,
      createdAt: f.createdAt,
      task: f.optimizationTasks?.[0] ?? null,
    };
  }
}

function parsePublicUrlSafe(url: string) {
  try {
    return parsePublicUrl(url).toString();
  } catch {
    return null;
  }
}

function sameUrl(a: string | undefined, b: string | null) {
  if (!a || !b) return false;
  const strip = (u: string) => u.replace(/\/+$/, '').toLowerCase();
  return strip(a) === strip(b);
}
