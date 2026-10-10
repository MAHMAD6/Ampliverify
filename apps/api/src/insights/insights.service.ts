import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditsService } from '../audits/audits.service';
import { GeoService } from '../geo/geo.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SETTING, SettingsService } from '../commerce/settings.service';
import { AuditService } from '../audit/audit.service';

export type ProjectSettingsInput = {
  locale?: string;
  timezone?: string;
  crawlScope?: 'PAGE' | 'SITE';
  maxPages?: number;
  auditMode?: 'SEO' | 'GEO' | 'BOTH';
  auditFrequency?: 'MANUAL' | 'WEEKLY' | 'MONTHLY';
  targetCountry?: string;
  excludePaths?: string[];
};

type CrawlConfig = Omit<ProjectSettingsInput, 'locale' | 'timezone'> & { nextAuditAt?: string | null };

const nextAudit = (freq: string | undefined, from = new Date()) => {
  if (freq === 'WEEKLY') return new Date(from.getTime() + 7 * 86_400_000).toISOString();
  if (freq === 'MONTHLY') {
    const d = new Date(from);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString();
  }
  return null;
};

/**
 * Cross-module project views: project settings (crawl defaults and the audit
 * schedule), the dashboard/project overview summary, scheduled audits, low
 * credit alerts and periodic health checks.
 */
@Injectable()
export class InsightsService implements OnModuleInit {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly audits: AuditsService,
    private readonly geo: GeoService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditService,
  ) {}

  onModuleInit() {
    this.jobs.registerPeriodic('audits.schedules', 5 * 60_000, () => this.runDueAudits());
    this.jobs.registerPeriodic('credits.low', 60 * 60_000, () => this.lowCreditAlerts());
    this.jobs.registerPeriodic('health.checks', 5 * 60_000, () => this.recordHealth());
  }

  async getSettings(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'project.read');
    const s = await this.prisma.projectSetting.findUnique({ where: { projectId } });
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { workspace: true } });
    const defaults = ((project.workspace.settingsJson ?? {}) as { projectDefaults?: CrawlConfig }).projectDefaults ?? {};
    return {
      locale: s?.locale ?? project.workspace.language,
      timezone: s?.timezone ?? project.workspace.timezone,
      crawl: { crawlScope: 'PAGE', maxPages: 25, auditMode: 'SEO', auditFrequency: 'MANUAL', ...defaults, ...((s?.crawlConfig ?? {}) as CrawlConfig) },
    };
  }

  async updateSettings(actorId: string, projectId: string, input: ProjectSettingsInput) {
    const project = await this.projects.requireProject(actorId, projectId, 'project.update');
    const current = await this.prisma.projectSetting.findUnique({ where: { projectId } });
    const { locale, timezone, ...crawl } = input;
    const merged: CrawlConfig = { ...((current?.crawlConfig ?? {}) as CrawlConfig), ...crawl };
    if (crawl.auditFrequency !== undefined) merged.nextAuditAt = nextAudit(crawl.auditFrequency);
    await this.prisma.projectSetting.upsert({
      where: { projectId },
      create: { projectId, locale: locale ?? 'en', timezone: timezone ?? 'UTC', crawlConfig: merged as Prisma.InputJsonObject },
      update: { ...(locale && { locale }), ...(timezone && { timezone }), crawlConfig: merged as Prisma.InputJsonObject },
    });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.settings.update', targetType: 'project', targetId: projectId, afterState: merged as Prisma.InputJsonObject });
    return this.getSettings(actorId, projectId);
  }

  private async runDueAudits() {
    const rows = await this.prisma.projectSetting.findMany({ where: { project: { status: 'ACTIVE', deletedAt: null } }, include: { project: true } });
    const now = Date.now();
    for (const row of rows) {
      const cfg = (row.crawlConfig ?? {}) as CrawlConfig;
      if (!cfg.auditFrequency || cfg.auditFrequency === 'MANUAL' || !cfg.nextAuditAt || new Date(cfg.nextAuditAt).getTime() > now) continue;
      await this.prisma.projectSetting.update({ where: { projectId: row.projectId }, data: { crawlConfig: { ...cfg, nextAuditAt: nextAudit(cfg.auditFrequency) } as Prisma.InputJsonObject } });
      await this.audits
        .request(row.project.createdBy, row.projectId, { scope: cfg.crawlScope ?? 'SITE', mode: cfg.auditMode ?? 'SEO', maxPages: cfg.maxPages }, undefined, 'SCHEDULED')
        .catch((err) => this.logger.warn(`Scheduled audit for ${row.projectId} skipped: ${(err as Error).message}`));
    }
  }

  private async lowCreditAlerts() {
    const general = await this.settings.get<{ lowCreditThreshold?: number }>(SETTING.general, {});
    const threshold = Number(general.lowCreditThreshold ?? 0);
    if (threshold <= 0) return;
    const low = await this.prisma.creditWallet.findMany({ where: { balanceCache: { lte: threshold } }, include: { workspace: true } });
    for (const w of low) {
      const recent = await this.prisma.notification.count({ where: { workspaceId: w.workspaceId, eventKey: 'credits.low', createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } } });
      if (recent) continue;
      const owners = await this.prisma.roleAssignment.findMany({
        where: { revokedAt: null, role: { key: 'OWNER' }, OR: [{ workspaceId: w.workspaceId }, { organizationId: w.workspace.organizationId, scopeType: 'ORGANIZATION' }] },
        select: { userId: true },
      });
      for (const o of new Set(owners.map((x) => x.userId))) {
        await this.notifications.notify({ workspaceId: w.workspaceId, userId: o, eventKey: 'credits.low', title: 'Credits are running low', body: `${w.workspace.name} has ${Number(w.balanceCache)} credits left. Buy more credits to keep audits and AI checks running.` });
      }
    }
  }

  private async recordHealth() {
    const started = Date.now();
    let db: 'HEALTHY' | 'DOWN' = 'HEALTHY';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'DOWN';
    }
    const latency = Date.now() - started;
    const [dead, stale] = await Promise.all([
      this.prisma.backgroundJob.count({ where: { status: 'DEAD', updatedAt: { gt: new Date(Date.now() - 86_400_000) } } }),
      this.prisma.backgroundJob.count({ where: { status: 'QUEUED', runAt: { lt: new Date(Date.now() - 15 * 60_000) } } }),
    ]);
    await this.prisma.healthCheckResult.createMany({
      data: [
        { componentKey: 'database', status: db, latencyMs: latency },
        { componentKey: 'job_queue', status: stale > 20 ? 'DEGRADED' : dead > 10 ? 'DEGRADED' : 'HEALTHY', latencyMs: null },
      ],
    });
    await this.prisma.healthCheckResult.deleteMany({ where: { checkedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  }

  /** Everything the Dashboard and Project Overview show for one project. */
  async summary(actorId: string, projectId: string) {
    const project = await this.projects.requireProject(actorId, projectId, 'project.read');
    const [lastAudit, auditCount, openFindings, tasks, verified, keywordLists, keywordsTracked, contentIdeas, briefs, editorDocs, reports, activity] = await Promise.all([
      this.prisma.auditRun.findFirst({ where: { projectId, status: 'SUCCEEDED' }, orderBy: { completedAt: 'desc' } }),
      this.prisma.auditRun.count({ where: { projectId } }),
      this.prisma.$queryRaw<{ severity: string; n: bigint }[]>`
        SELECT f."severity", COUNT(*) AS n FROM "audit_findings" f
          JOIN (SELECT DISTINCT ON (ap."page_id") ap."id" FROM "audit_pages" ap JOIN "audit_runs" ar ON ar."id" = ap."audit_run_id"
                 WHERE ar."project_id" = ${projectId}::uuid AND ar."status" = 'SUCCEEDED' ORDER BY ap."page_id", ar."started_at" DESC) cur ON cur."id" = f."audit_page_id"
         WHERE f."status" IN ('OPEN', 'IN_PROGRESS', 'REGRESSED') GROUP BY f."severity"`,
      this.prisma.optimizationTask.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.verificationRun.count({ where: { task: { projectId }, result: 'PASSED' } }),
      this.prisma.keywordList.count({ where: { projectId } }),
      this.prisma.keywordListItem.count({ where: { list: { projectId } } }),
      this.prisma.contentIdea.count({ where: { projectId, status: { not: 'ARCHIVED' } } }),
      this.prisma.contentBrief.count({ where: { projectId, status: { not: 'ARCHIVED' } } }),
      this.prisma.editorDocument.count({ where: { projectId, status: { not: 'ARCHIVED' } } }),
      this.prisma.report.count({ where: { projectId } }),
      this.prisma.auditLog.findMany({ where: { workspaceId: project.workspaceId, OR: [{ targetId: projectId }, { eventType: { startsWith: 'project.' } }] }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ]);
    const geo = await this.geo.overview(actorId, projectId, 30);
    const audit = lastAudit ? this.audits.runView(lastAudit) : null;
    const sev = Object.fromEntries(openFindings.map((r) => [r.severity, Number(r.n)]));
    return {
      project: { id: project.id, name: project.name, status: project.status },
      audit: audit && { id: audit.id, completedAt: audit.completedAt, scores: audit.scores, pagesCrawled: audit.pagesCrawled, url: (audit.request as { url?: string } | null)?.url ?? null },
      audits: auditCount,
      issues: { critical: sev.CRITICAL ?? 0, high: sev.HIGH ?? 0, medium: sev.MEDIUM ?? 0, low: sev.LOW ?? 0, total: Object.values(sev).reduce((a: number, b) => a + (b as number), 0) },
      tasks: { open: tasks.filter((t) => ['OPEN', 'IN_PROGRESS', 'BLOCKED'].includes(t.status)).reduce((n, t) => n + t._count, 0), done: tasks.find((t) => t.status === 'DONE')?._count ?? 0, verified },
      geo: { visibility: geo.visibility, citationRate: geo.citationRate, avgPosition: geo.avgPosition, prompts: geo.prompts, lastCheckedAt: geo.lastCheckedAt, trend: geo.trend },
      keywords: { lists: keywordLists, tracked: keywordsTracked },
      content: { ideas: contentIdeas, briefs, documents: editorDocs },
      reports,
      activity: activity.map((a) => ({ id: a.id, eventType: a.eventType, targetType: a.targetType, targetId: a.targetId, createdAt: a.createdAt, actorUserId: a.actorUserId })),
    };
  }

  /** Dashboard rows for all accessible projects. */
  /** Getting Started checklist: which core workflow steps the user's accessible projects have completed. */
  async onboarding(actorId: string) {
    const projects = await this.projects.listAccessible(actorId);
    const ids = projects.map((p) => p.id);
    if (!ids.length) return { projects: 0, pages: 0, audits: 0, tasksStarted: 0, editorDocuments: 0, reports: 0 };
    const where = { projectId: { in: ids } };
    const [pages, audits, tasksStarted, editorDocuments, reports] = await Promise.all([
      this.prisma.page.count({ where: { domain: { projectId: { in: ids } } } }),
      this.prisma.auditRun.count({ where: { ...where, status: 'SUCCEEDED' } }),
      this.prisma.optimizationTask.count({ where: { ...where, status: { in: ['IN_PROGRESS', 'DONE'] } } }),
      this.prisma.editorDocument.count({ where }),
      this.prisma.report.count({ where: { ...where, status: 'SUCCEEDED' } }),
    ]);
    return { projects: ids.length, pages, audits, tasksStarted, editorDocuments, reports };
  }

  async dashboard(actorId: string) {
    const projects = await this.projects.listAccessible(actorId);
    const ids = projects.map((p) => p.id);
    const latest = ids.length
      ? await this.prisma.$queryRaw<{ project_id: string; summary_json: Prisma.JsonValue; completed_at: Date }[]>`
          SELECT DISTINCT ON ("project_id") "project_id", "summary_json", "completed_at" FROM "audit_runs"
           WHERE "project_id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) AND "status" = 'SUCCEEDED'
           ORDER BY "project_id", "completed_at" DESC`
      : [];
    const openTasks = ids.length ? await this.prisma.optimizationTask.groupBy({ by: ['projectId'], where: { projectId: { in: ids }, status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] } }, _count: true }) : [];
    return projects.map((p) => {
      const a = latest.find((l) => l.project_id === p.id);
      const s = (a?.summary_json ?? {}) as { scores?: { overall?: number; geo?: number } ; counts?: Record<string, number> };
      return {
        ...p,
        lastAuditAt: a?.completed_at ?? null,
        seoScore: s.scores?.overall ?? null,
        geoScore: s.scores?.geo ?? null,
        highIssues: s.counts ? (s.counts.CRITICAL ?? 0) + (s.counts.HIGH ?? 0) : null,
        openTasks: openTasks.find((t) => t.projectId === p.id)?._count ?? 0,
      };
    });
  }
}
