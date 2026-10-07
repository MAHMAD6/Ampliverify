import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { OptimizationService } from '../optimization/optimization.service';
import { GeoService } from '../geo/geo.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { WorkspaceSettings } from '../workspaces/workspaces.service';
import { renderCsv, renderHtml, renderPdf, SectionPayload } from './report-render';

export const SECTION_KEYS = ['overview', 'audit', 'recommendations', 'tasks', 'geo', 'geo_citations', 'keywords', 'content'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const DEFAULT_SECTIONS: Record<ReportType, SectionKey[]> = {
  SEO_AUDIT: ['overview', 'audit', 'recommendations', 'tasks'],
  KEYWORD: ['overview', 'keywords'],
  GEO_VISIBILITY: ['overview', 'geo', 'geo_citations'],
  CONTENT: ['overview', 'content'],
  EXECUTIVE_SUMMARY: ['overview', 'audit', 'geo', 'tasks', 'content'],
  CUSTOM: ['overview'],
};

type Cadence = 'WEEKLY' | 'MONTHLY';
const nextRun = (cadence: Cadence, from = new Date()) => {
  const d = new Date(from);
  if (cadence === 'WEEKLY') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const fmt = (n: number | null | undefined, suffix = '') => (n === null || n === undefined ? '—' : `${n}${suffix}`);

/**
 * Reports: on-demand or scheduled snapshots of a project's real data
 * (audits, optimization, GEO, keywords, content), stored as sections and
 * rendered to HTML, PDF and CSV. Read-only share links are opt-in per workspace.
 */
@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly jobs: JobsService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly storage: ContentStorageService,
    private readonly optimization: OptimizationService,
    private readonly geo: GeoService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.register('report.generate', async (p) => this.build(String(p.reportId)));
    this.jobs.registerPeriodic('report.schedules', 60_000, () => this.runDueSchedules());
  }

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  async generate(actorId: string, projectId: string, input: { type: ReportType; title?: string; periodStart?: string; periodEnd?: string; sections?: SectionKey[] }, meta?: RequestMeta, scheduleId?: string) {
    const project = await this.projects.requireProject(actorId, projectId, 'report.write');
    await this.entitlements.assertModuleEnabled('reports');
    const periodEnd = input.periodEnd ? new Date(input.periodEnd) : new Date();
    const periodStart = input.periodStart ? new Date(input.periodStart) : new Date(periodEnd.getTime() - 30 * 86_400_000);
    if (periodStart > periodEnd) throw new BadRequestException({ code: 'INVALID_PERIOD', message: 'The start date must be before the end date.' });
    const sections = (input.sections?.length ? input.sections : DEFAULT_SECTIONS[input.type]).filter((s) => SECTION_KEYS.includes(s));
    const title = input.title?.trim() || `${labelOf(input.type)} — ${project.name}`;
    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.report.create({ data: { projectId, type: input.type, title, periodStart, periodEnd, createdBy: actorId, scheduleId: scheduleId ?? null } });
      await tx.reportSection.create({ data: { reportId: r.id, sectionKey: '_config', position: -1, payload: { sections } } });
      await this.jobs.enqueue('report.generate', { reportId: r.id }, { jobKey: `report:${r.id}` }, tx);
      await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.report.generate', targetType: 'report', targetId: r.id, afterState: { type: input.type, sections }, requestMeta: meta }, tx);
      return r;
    });
    return report;
  }

  async build(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId }, include: { project: { include: { domains: true } }, sections: true } });
    if (!report || report.status === 'SUCCEEDED') return;
    await this.prisma.report.update({ where: { id: reportId }, data: { status: 'RUNNING' } });
    try {
      const config = report.sections.find((s) => s.sectionKey === '_config')?.payload as { sections: SectionKey[] } | undefined;
      const keys = config?.sections ?? DEFAULT_SECTIONS[report.type];
      const actor = report.createdBy ?? report.project.createdBy;
      const payloads: [SectionKey, SectionPayload][] = [];
      for (const key of keys) payloads.push([key, await this.section(key, report.projectId, actor, report.periodStart ?? new Date(0), report.periodEnd ?? new Date())]);

      const period = `${(report.periodStart ?? report.createdAt).toISOString().slice(0, 10)} – ${(report.periodEnd ?? report.createdAt).toISOString().slice(0, 10)}`;
      const doc = { title: report.title, projectName: report.project.name, domain: report.project.domains[0]?.host ?? null, period, generatedAt: new Date(), sections: payloads.map(([, p]) => p) };
      const files: { format: string; body: Buffer; type: string }[] = [
        { format: 'html', body: Buffer.from(renderHtml(doc), 'utf8'), type: 'text/html; charset=utf-8' },
        { format: 'pdf', body: await renderPdf(doc), type: 'application/pdf' },
        { format: 'csv', body: Buffer.from(renderCsv(doc.sections), 'utf8'), type: 'text/csv; charset=utf-8' },
      ];
      for (const f of files) await this.storage.writeBuffer(`reports/${report.projectId}/${reportId}.${f.format}`, f.body, f.type);

      await this.prisma.$transaction(async (tx) => {
        await tx.reportSection.deleteMany({ where: { reportId, sectionKey: { not: '_config' } } });
        await tx.reportSection.createMany({ data: payloads.map(([key, p], i) => ({ reportId, sectionKey: key, position: i, payload: p as unknown as Prisma.InputJsonObject })) });
        await tx.reportFile.deleteMany({ where: { reportId } });
        await tx.reportFile.createMany({
          data: files.map((f) => ({ reportId, format: f.format, storageKey: `reports/${report.projectId}/${reportId}.${f.format}`, sizeBytes: BigInt(f.body.length), checksum: hash(f.body.toString('base64')) })),
        });
        await tx.report.update({ where: { id: reportId }, data: { status: 'SUCCEEDED' } });
      });
      if (report.createdBy) {
        const ws = await this.prisma.project.findUniqueOrThrow({ where: { id: report.projectId }, select: { workspaceId: true } });
        await this.notifications.notify({ workspaceId: ws.workspaceId, userId: report.createdBy, eventKey: 'report.ready', title: 'Report ready', body: `${report.title} is ready to view and download.` });
      }
    } catch (err) {
      await this.prisma.report.update({ where: { id: reportId }, data: { status: 'FAILED' } });
      throw err;
    }
  }

  /** Builds one section from live project data. Empty data yields an honest empty state. */
  private async section(key: SectionKey, projectId: string, actorId: string, from: Date, to: Date): Promise<SectionPayload> {
    const inPeriod = { gte: from, lte: new Date(to.getTime() + 86_400_000) };
    switch (key) {
      case 'overview': {
        const [audits, tasksDone, geoRuns, briefs] = await Promise.all([
          this.prisma.auditRun.count({ where: { projectId, status: 'SUCCEEDED', completedAt: inPeriod } }),
          this.prisma.optimizationTask.count({ where: { projectId, status: 'DONE', updatedAt: inPeriod } }),
          this.prisma.geoRun.count({ where: { prompt: { projectId }, status: 'SUCCEEDED', completedAt: inPeriod } }),
          this.prisma.contentBrief.count({ where: { projectId, createdAt: inPeriod } }),
        ]);
        return {
          title: 'Overview',
          summary: 'Activity in this project during the reporting period.',
          metrics: [
            { label: 'Audits completed', value: String(audits) },
            { label: 'Fixes completed', value: String(tasksDone) },
            { label: 'AI search checks', value: String(geoRuns) },
            { label: 'Content briefs', value: String(briefs) },
          ],
        };
      }
      case 'audit': {
        const run = await this.prisma.auditRun.findFirst({ where: { projectId, status: 'SUCCEEDED', completedAt: { lte: inPeriod.lte } }, orderBy: { completedAt: 'desc' } });
        if (!run) return { title: 'SEO audit', empty: 'No audit has been completed for this project yet.' };
        const s = run.summaryJson as { scores?: Record<string, number>; counts?: Record<string, number>; pagesCrawled?: number; request?: { url?: string } };
        return {
          title: 'SEO audit',
          summary: `Latest audit of ${s.request?.url ?? 'the website'} on ${run.completedAt?.toISOString().slice(0, 10)} (${s.pagesCrawled ?? 0} page(s)).`,
          metrics: [
            { label: 'Overall score', value: fmt(s.scores?.overall, '/100') },
            { label: 'Technical', value: fmt(s.scores?.technical, '/100') },
            { label: 'On-page SEO', value: fmt(s.scores?.seo, '/100') },
            { label: 'Content', value: fmt(s.scores?.content, '/100') },
            { label: 'AI search (GEO)', value: fmt(s.scores?.geo, '/100') },
            { label: 'Critical + high issues', value: String((s.counts?.CRITICAL ?? 0) + (s.counts?.HIGH ?? 0)) },
          ],
        };
      }
      case 'recommendations': {
        const { items, summary } = await this.optimization.recommendations(actorId, projectId, {});
        return {
          title: 'Top recommendations',
          summary: `${summary.high} high, ${summary.medium} medium and ${summary.low} low priority open recommendations; ${summary.verified} fixes verified.`,
          table: { columns: ['Priority', 'Recommendation', 'Category', 'Page', 'Status'], rows: items.slice(0, 40).map((i) => [['High', 'Medium', 'Low'][i.priority - 1], i.title, i.categoryLabel, i.pageUrl, i.status]) },
          empty: 'No open recommendations.',
        };
      }
      case 'tasks': {
        const tasks = await this.prisma.optimizationTask.findMany({ where: { projectId, updatedAt: inPeriod }, orderBy: { updatedAt: 'desc' }, take: 50, include: { assignee: { select: { displayName: true, email: true } }, verificationRuns: { orderBy: { createdAt: 'desc' }, take: 1 } } });
        return {
          title: 'Optimization tasks',
          table: { columns: ['Task', 'Status', 'Assignee', 'Verification'], rows: tasks.map((t) => [t.title, t.status, t.assignee?.displayName ?? t.assignee?.email ?? '—', t.verificationRuns[0]?.result ?? '—']) },
          empty: 'No task activity in this period.',
        };
      }
      case 'geo': {
        const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
        const o = await this.geo.overview(actorId, projectId, days);
        if (!o.answers) return { title: 'AI search visibility', empty: 'No AI search checks have been run in this period.' };
        return {
          title: 'AI search visibility',
          summary: `Based on ${o.answers} AI answer(s) across ${o.prompts} tracked prompt(s). Last checked ${o.lastCheckedAt ? new Date(o.lastCheckedAt).toISOString().slice(0, 10) : '—'}.`,
          metrics: [
            { label: 'Visibility', value: fmt(o.visibility, '%') },
            { label: 'Cited as a source', value: fmt(o.citationRate, '%') },
            { label: 'Average position', value: fmt(o.avgPosition) },
            { label: 'Share of voice', value: fmt(o.shareOfVoice, '%') },
          ],
          table: { columns: ['Platform', 'Answers', 'Visibility', 'Cited', 'Avg. position'], rows: o.platforms.filter((p) => p.answers).map((p) => [p.name, String(p.answers), fmt(p.visibility, '%'), fmt(p.citationRate, '%'), fmt(p.avgPosition)]) },
        };
      }
      case 'geo_citations': {
        const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
        const rows = await this.geo.citations(actorId, projectId, days);
        return { title: 'Sources cited by AI', table: { columns: ['Domain', 'Your site', 'Citations', 'Platforms'], rows: rows.slice(0, 30).map((r) => [r.domain, r.own ? 'Yes' : 'No', String(r.citations), r.platforms.join(', ')]) }, empty: 'No citations recorded yet.' };
      }
      case 'keywords': {
        const lists = await this.prisma.keywordList.findMany({ where: { projectId }, include: { items: { include: { keyword: { include: { metricSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } } } } } } });
        const rows = lists.flatMap((l) => l.items.map((i) => [l.name, i.keyword.normalizedTerm, fmt(i.keyword.metricSnapshots[0]?.searchVolume), fmt(i.keyword.metricSnapshots[0]?.difficulty ? Number(i.keyword.metricSnapshots[0].difficulty) : null)]));
        return { title: 'Tracked keywords', table: { columns: ['List', 'Keyword', 'Search volume', 'Difficulty'], rows: rows.slice(0, 100) }, empty: 'No keywords have been saved to lists yet.' };
      }
      case 'content': {
        const items = await this.prisma.contentPlanItem.findMany({ where: { plan: { projectId } }, orderBy: { targetDate: 'asc' }, take: 60, include: { plan: true } });
        return { title: 'Content plan', table: { columns: ['Plan', 'Item', 'Status', 'Target date'], rows: items.map((i) => [i.plan.name, i.title, i.status, i.targetDate?.toISOString().slice(0, 10) ?? '—']) }, empty: 'No content is planned yet.' };
      }
    }
  }

  async list(actorId: string, projectIds: string[], filters: { type?: string; status?: string; scheduled?: boolean; projectId?: string } = {}) {
    const ids: string[] = [];
    for (const id of filters.projectId ? [filters.projectId] : projectIds) {
      try {
        await this.projects.requireProject(actorId, id, 'report.read');
        ids.push(id);
      } catch {
        // skip projects without access
      }
    }
    return this.prisma.report.findMany({
      where: {
        projectId: { in: ids },
        ...(filters.type && filters.type in ReportType ? { type: filters.type as ReportType } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.scheduled ? { scheduleId: { not: null } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { project: { select: { id: true, name: true } }, creator: { select: { displayName: true, email: true } }, files: { select: { format: true, sizeBytes: true } }, shares: { where: { revokedAt: null }, select: { id: true, expiresAt: true } } },
    });
  }

  async get(actorId: string, id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } }, sections: { where: { sectionKey: { not: '_config' } }, orderBy: { position: 'asc' } }, files: true, shares: { orderBy: { createdAt: 'desc' } }, schedule: true },
    });
    if (!report) throw new NotFoundException({ code: 'REPORT_NOT_FOUND', message: 'Report not found.' });
    await this.projects.requireProject(actorId, report.projectId, 'report.read');
    return { ...report, shares: report.shares.map((s) => ({ id: s.id, expiresAt: s.expiresAt, revokedAt: s.revokedAt, createdAt: s.createdAt })) };
  }

  async file(actorId: string, id: string, format: string) {
    const report = await this.get(actorId, id);
    const f = report.files.find((x) => x.format === format);
    if (!f) throw new NotFoundException({ code: 'REPORT_FILE_NOT_FOUND', message: 'This report file is not available.' });
    const body = await this.storage.readBuffer(f.storageKey);
    if (!body) throw new NotFoundException({ code: 'REPORT_FILE_NOT_FOUND', message: 'This report file is not available.' });
    return { body, filename: `${report.title.replace(/[^\w\- ]+/g, '').slice(0, 80) || 'report'}.${format}`, contentType: ({ html: 'text/html; charset=utf-8', pdf: 'application/pdf', csv: 'text/csv; charset=utf-8' } as Record<string, string>)[format] ?? 'application/octet-stream' };
  }

  async remove(actorId: string, id: string, meta?: RequestMeta) {
    const report = await this.prisma.report.findUnique({ where: { id }, include: { files: true } });
    if (!report) throw new NotFoundException({ code: 'REPORT_NOT_FOUND', message: 'Report not found.' });
    const project = await this.projects.requireProject(actorId, report.projectId, 'report.write');
    await this.prisma.report.delete({ where: { id } });
    for (const f of report.files) await this.storage.delete(f.storageKey).catch(() => undefined);
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.report.delete', targetType: 'report', targetId: id, requestMeta: meta });
    return { id, deleted: true };
  }

  // ── Shares ─────────────────────────────────────────────────────────────

  async share(actorId: string, id: string, meta?: RequestMeta) {
    const report = await this.get(actorId, id);
    const project = await this.projects.requireProject(actorId, report.projectId, 'report.write');
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: project.workspaceId } });
    const privacy = ((ws.settingsJson ?? {}) as WorkspaceSettings).privacy ?? {};
    if (privacy.allowPublicReportShares === false) throw new ForbiddenException({ code: 'SHARING_DISABLED', message: 'Public report links are disabled for this workspace.' });
    if (report.status !== 'SUCCEEDED') throw new ConflictException({ code: 'REPORT_NOT_READY', message: 'The report is still being generated.' });
    const token = randomBytes(24).toString('base64url');
    const share = await this.prisma.reportShare.create({ data: { reportId: id, tokenHash: hash(token), expiresAt: new Date(Date.now() + (privacy.shareLinkExpiryDays ?? 30) * 86_400_000) } });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.report.share', targetType: 'report_share', targetId: share.id, requestMeta: meta });
    return { id: share.id, url: `${this.webUrl}/r/${token}`, expiresAt: share.expiresAt };
  }

  async revokeShare(actorId: string, shareId: string, meta?: RequestMeta) {
    const share = await this.prisma.reportShare.findUnique({ where: { id: shareId }, include: { report: true } });
    if (!share) throw new NotFoundException({ code: 'SHARE_NOT_FOUND', message: 'Share link not found.' });
    const project = await this.projects.requireProject(actorId, share.report.projectId, 'report.write');
    await this.prisma.reportShare.update({ where: { id: shareId }, data: { revokedAt: new Date() } });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.report.unshare', targetType: 'report_share', targetId: shareId, requestMeta: meta });
    return { id: shareId, revoked: true };
  }

  async shared(actorId: string, projectIds: string[]) {
    const reports = await this.list(actorId, projectIds);
    return reports.filter((r) => r.shares.length > 0);
  }

  /** Public, read-only view of a shared report. */
  async publicView(token: string) {
    const share = await this.prisma.reportShare.findUnique({
      where: { tokenHash: hash(token) },
      include: { report: { include: { project: { select: { name: true } }, sections: { where: { sectionKey: { not: '_config' } }, orderBy: { position: 'asc' } } } } },
    });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt < new Date()) || share.report.status !== 'SUCCEEDED') {
      throw new NotFoundException({ code: 'SHARE_INVALID', message: 'This report link is invalid or has expired.' });
    }
    const r = share.report;
    return { title: r.title, type: r.type, projectName: r.project.name, periodStart: r.periodStart, periodEnd: r.periodEnd, createdAt: r.createdAt, sections: r.sections.map((s) => s.payload) };
  }

  // ── Schedules ──────────────────────────────────────────────────────────

  async schedules(actorId: string, projectIds: string[]) {
    const ids: string[] = [];
    for (const id of projectIds) {
      try {
        await this.projects.requireProject(actorId, id, 'report.read');
        ids.push(id);
      } catch {
        // skip
      }
    }
    return this.prisma.reportSchedule.findMany({ where: { projectId: { in: ids } }, orderBy: { createdAt: 'desc' }, include: { project: { select: { id: true, name: true } }, reports: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } } } });
  }

  async createSchedule(actorId: string, projectId: string, input: { name: string; reportType: ReportType; cadence: Cadence; timezone?: string }) {
    const project = await this.projects.requireProject(actorId, projectId, 'report.write');
    await this.entitlements.assertFeature(project.workspaceId, 'reports.scheduled');
    return this.prisma.reportSchedule.create({ data: { projectId, name: input.name.trim(), reportType: input.reportType, cadence: input.cadence, timezone: input.timezone ?? 'UTC', nextRunAt: nextRun(input.cadence) } });
  }

  async updateSchedule(actorId: string, id: string, input: { name?: string; cadence?: Cadence; enabled?: boolean }) {
    const s = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Schedule not found.' });
    await this.projects.requireProject(actorId, s.projectId, 'report.write');
    return this.prisma.reportSchedule.update({
      where: { id },
      data: { ...(input.name !== undefined && { name: input.name }), ...(input.enabled !== undefined && { enabled: input.enabled }), ...(input.cadence !== undefined && { cadence: input.cadence, nextRunAt: nextRun(input.cadence) }) },
    });
  }

  async deleteSchedule(actorId: string, id: string) {
    const s = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Schedule not found.' });
    await this.projects.requireProject(actorId, s.projectId, 'report.write');
    await this.prisma.reportSchedule.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async runDueSchedules() {
    const due = await this.prisma.reportSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: new Date() }, project: { status: 'ACTIVE', deletedAt: null } }, include: { project: true }, take: 20 });
    for (const s of due) {
      await this.prisma.reportSchedule.update({ where: { id: s.id }, data: { nextRunAt: nextRun(s.cadence as Cadence) } });
      const end = new Date();
      const start = new Date(end.getTime() - (s.cadence === 'WEEKLY' ? 7 : 30) * 86_400_000);
      await this.generate(s.project.createdBy, s.projectId, { type: s.reportType, title: `${s.name} — ${end.toISOString().slice(0, 10)}`, periodStart: start.toISOString(), periodEnd: end.toISOString() }, undefined, s.id).catch((err) =>
        this.logger.warn(`Scheduled report ${s.id} skipped: ${(err as Error).message}`),
      );
    }
  }
}

function labelOf(t: ReportType) {
  return { SEO_AUDIT: 'SEO Audit Report', KEYWORD: 'Keyword Report', GEO_VISIBILITY: 'AI Search Visibility Report', CONTENT: 'Content Report', EXECUTIVE_SUMMARY: 'Executive Summary', CUSTOM: 'Custom Report' }[t];
}
