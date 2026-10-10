import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContentStorageService } from '../storage/content-storage.service';

const DAY = 86_400_000;

/**
 * Policy-aware retention (the workflow the integrity migration reserves
 * cascading deletes for). Runs daily:
 *  - projects deleted more than PROJECT_PURGE_GRACE_DAYS ago (default 30) are
 *    purged with all their data and stored files;
 *  - workspaces with a retention period (Settings → Data & Privacy) lose
 *    audit runs, AI search checks, keyword research and reports older than it,
 *    keeping each project's latest completed audit so current state survives;
 *  - expired data-export files are removed.
 * Audit logs, the credit ledger and payment records are never touched.
 */
@Injectable()
export class RetentionService implements OnModuleInit {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ContentStorageService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.registerPeriodic('retention.purge', DAY, async () => void (await this.run()));
  }

  async run(now = new Date()) {
    const projects = await this.purgeDeletedProjects(now);
    const aged = await this.applyWorkspaceRetention(now);
    const exports = await this.purgeExpiredExports(now);
    if (projects || aged || exports) this.logger.log(`Retention: ${projects} projects purged, ${aged} aged records removed, ${exports} exports expired.`);
    return { projects, aged, exports };
  }

  private graceDays() {
    const d = Number(this.config.get('PROJECT_PURGE_GRACE_DAYS') ?? 30);
    return Number.isFinite(d) && d >= 0 ? d : 30;
  }

  private async removeFiles(keys: (string | null | undefined)[]) {
    for (const key of keys) if (key) await this.storage.delete(key).catch((e) => this.logger.warn(`Could not delete ${key}: ${e}`));
  }

  /** Storage objects owned by a set of projects (or by records older than a cutoff within them). */
  private async filesFor(projectIds: string[], before?: Date) {
    const created = before ? { lt: before } : undefined;
    const [reportFiles, editorVersions, geoResults, keywordQueries] = await Promise.all([
      this.prisma.reportFile.findMany({ where: { report: { projectId: { in: projectIds }, ...(created && { createdAt: created }) } }, select: { storageKey: true } }),
      before ? Promise.resolve([]) : this.prisma.editorVersion.findMany({ where: { document: { projectId: { in: projectIds } } }, select: { contentRef: true } }),
      this.prisma.geoPlatformResult.findMany({ where: { run: { prompt: { projectId: { in: projectIds } }, ...(created && { startedAt: created }) } }, select: { responseRef: true } }),
      this.prisma.keywordQuery.findMany({ where: { projectId: { in: projectIds }, ...(created && { createdAt: created }) }, select: { resultRef: true } }),
    ]);
    return [...reportFiles.map((f) => f.storageKey), ...editorVersions.map((v) => v.contentRef), ...geoResults.map((r) => r.responseRef), ...keywordQueries.map((q) => q.resultRef)];
  }

  async purgeDeletedProjects(now = new Date()) {
    const cutoff = new Date(now.getTime() - this.graceDays() * DAY);
    const due = await this.prisma.project.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true, name: true, organizationId: true, workspaceId: true }, take: 50 });
    for (const p of due) {
      const files = await this.filesFor([p.id]);
      await this.prisma.project.delete({ where: { id: p.id } });
      await this.removeFiles(files);
      await this.audit.record({ actorUserId: null, actorRole: 'system', organizationId: p.organizationId, workspaceId: p.workspaceId, action: 'project.purge', targetType: 'project', targetId: p.id, beforeState: { name: p.name }, reason: `Deleted more than ${this.graceDays()} days ago` });
    }
    return due.length;
  }

  async applyWorkspaceRetention(now = new Date()) {
    const workspaces = await this.prisma.workspace.findMany({ where: { deletedAt: null }, select: { id: true, organizationId: true, settingsJson: true } });
    let removed = 0;
    for (const ws of workspaces) {
      const days = Number((ws.settingsJson as { privacy?: { retentionDays?: number | null } } | null)?.privacy?.retentionDays);
      if (!Number.isFinite(days) || days < 30) continue;
      const before = new Date(now.getTime() - days * DAY);
      const projects = await this.prisma.project.findMany({ where: { workspaceId: ws.id }, select: { id: true } });
      const ids = projects.map((p) => p.id);
      if (!ids.length) continue;
      const files = await this.filesFor(ids, before);
      // Keep each project's latest completed audit, whatever its age.
      const latest = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT ON ("project_id") "id" FROM "audit_runs"
         WHERE "project_id" = ANY(${ids}::uuid[]) AND "status" = 'SUCCEEDED'
         ORDER BY "project_id", "completed_at" DESC`;
      const [audits, geo, keywords, reports] = await this.prisma.$transaction([
        this.prisma.auditRun.deleteMany({ where: { projectId: { in: ids }, startedAt: { lt: before }, id: { notIn: latest.map((l) => l.id) } } }),
        this.prisma.geoRun.deleteMany({ where: { prompt: { projectId: { in: ids } }, startedAt: { lt: before } } }),
        this.prisma.keywordQuery.deleteMany({ where: { projectId: { in: ids }, createdAt: { lt: before } } }),
        this.prisma.report.deleteMany({ where: { projectId: { in: ids }, createdAt: { lt: before } } }),
      ]);
      const count = audits.count + geo.count + keywords.count + reports.count;
      if (!count) continue;
      await this.removeFiles(files);
      removed += count;
      await this.audit.record({ actorUserId: null, actorRole: 'system', organizationId: ws.organizationId, workspaceId: ws.id, action: 'workspace.retention.apply', targetType: 'workspace', targetId: ws.id, afterState: { audits: audits.count, geoChecks: geo.count, keywordResearch: keywords.count, reports: reports.count, before: before.toISOString() } });
    }
    return removed;
  }

  async purgeExpiredExports(now = new Date()) {
    const expired = await this.prisma.dataExportRequest.findMany({ where: { expiresAt: { lt: now }, fileRef: { not: null } }, select: { id: true, fileRef: true } });
    await this.removeFiles(expired.map((e) => e.fileRef));
    if (expired.length) await this.prisma.dataExportRequest.updateMany({ where: { id: { in: expired.map((e) => e.id) } }, data: { fileRef: null } });
    return expired.length;
  }
}
