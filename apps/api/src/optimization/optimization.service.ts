import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { AuditsService } from '../audits/audits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestMeta } from '../common/types/request-meta.type';

export type RecommendationFilters = { category?: string; priority?: string; status?: string; q?: string; page?: string };

export type CreateTaskInput = { findingId?: string; title?: string; priority?: number; assignedTo?: string | null; dueAt?: string | null };
export type UpdateTaskInput = { title?: string; status?: TaskStatus; priority?: number; assignedTo?: string | null; dueAt?: string | null };

/**
 * Optimization Center: the current recommendations of a project (findings on
 * the most recent successful audit of each page), tasks created from them,
 * and verification re-audits that confirm a fix (Audit → Optimize → Verify).
 */
@Injectable()
export class OptimizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly audits: AuditsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Latest successful audit_page per page of the project. */
  private async currentAuditPages(projectId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON (ap."page_id") ap."id"
        FROM "audit_pages" ap
        JOIN "audit_runs" ar ON ar."id" = ap."audit_run_id"
       WHERE ar."project_id" = ${projectId}::uuid AND ar."status" = 'SUCCEEDED'
       ORDER BY ap."page_id", ar."started_at" DESC`;
    return rows.map((r) => r.id);
  }

  async recommendations(actorId: string, projectId: string, filters: RecommendationFilters = {}) {
    await this.projects.requireProject(actorId, projectId, 'seo.audit.read');
    const auditPageIds = await this.currentAuditPages(projectId);
    const lastRun = await this.prisma.auditRun.findFirst({
      where: { projectId, status: 'SUCCEEDED' },
      orderBy: { completedAt: 'desc' },
      select: { id: true, completedAt: true },
    });

    const findings = auditPageIds.length
      ? await this.prisma.auditFinding.findMany({
          where: { auditPageId: { in: auditPageIds }, severity: { not: 'INFO' } },
          include: {
            recommendations: true,
            optimizationTasks: { select: { id: true, status: true, assignedTo: true, dueAt: true } },
            auditPage: { select: { page: { select: { url: true } } } },
          },
        })
      : [];

    const all = findings.map((f) => this.audits.findingView(f, f.auditPage.page.url));
    const verified = await this.prisma.verificationRun.count({ where: { task: { projectId }, result: 'PASSED' } });
    const open = all.filter((f) => f.status !== 'RESOLVED' && f.status !== 'IGNORED');
    const summary = {
      high: open.filter((f) => f.priority === 1).length,
      medium: open.filter((f) => f.priority === 2).length,
      low: open.filter((f) => f.priority === 3).length,
      verified,
      resolved: all.filter((f) => f.status === 'RESOLVED').length,
      lastAnalyzedAt: lastRun?.completedAt ?? null,
      lastRunId: lastRun?.id ?? null,
      pages: [...new Set(all.map((f) => f.pageUrl))],
    };

    const categoryMap: Record<string, string> = { SEO: 'SEO', Content: 'CONTENT', 'AI Search (GEO)': 'GEO', Technical: 'TECHNICAL' };
    const category = filters.category ? categoryMap[filters.category] ?? filters.category.toUpperCase() : undefined;
    const term = filters.q?.trim().toLowerCase();
    const items = all
      .filter((f) => !category || category === 'ALL' || f.category === category)
      .filter((f) => !filters.priority || String(f.priority) === filters.priority || f.severity === filters.priority)
      .filter((f) => (filters.status ? f.status === filters.status : f.status !== 'RESOLVED'))
      .filter((f) => !filters.page || f.pageUrl === filters.page)
      .filter((f) => !term || f.title.toLowerCase().includes(term) || f.pageUrl.toLowerCase().includes(term))
      .sort((a, b) => a.priority - b.priority || severityRank(a.severity) - severityRank(b.severity));
    return { summary, items };
  }

  async listTasks(actorId: string, projectId: string, status?: TaskStatus) {
    await this.projects.requireProject(actorId, projectId, 'seo.audit.read');
    const tasks = await this.prisma.optimizationTask.findMany({
      where: { projectId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      include: this.taskInclude,
    });
    return tasks.map((t) => this.taskView(t));
  }

  async getTask(actorId: string, taskId: string) {
    const task = await this.findTask(taskId);
    await this.projects.requireProject(actorId, task.projectId, 'seo.audit.read');
    return this.taskView(task);
  }

  async createTask(actorId: string, projectId: string, input: CreateTaskInput, meta?: RequestMeta) {
    const project = await this.projects.requireProject(actorId, projectId, 'optimization.manage');
    let title = input.title?.trim();
    let priority = input.priority;
    if (input.findingId) {
      const finding = await this.prisma.auditFinding.findUnique({
        where: { id: input.findingId },
        include: { auditPage: { include: { auditRun: true, page: true } }, optimizationTasks: true, recommendations: true },
      });
      if (!finding || finding.auditPage.auditRun.projectId !== projectId) {
        throw new NotFoundException({ code: 'FINDING_NOT_FOUND', message: 'Finding not found in this project.' });
      }
      const openTask = finding.optimizationTasks.find((t) => t.status !== 'DONE' && t.status !== 'DISMISSED');
      if (openTask) throw new ConflictException({ code: 'TASK_EXISTS', message: 'A task already exists for this recommendation.' });
      const view = this.audits.findingView(finding, finding.auditPage.page.url);
      title ??= `${view.title} — ${finding.auditPage.page.url}`;
      priority ??= view.priority;
    }
    if (!title) throw new BadRequestException({ code: 'TITLE_REQUIRED', message: 'Enter a task title.' });
    if (input.assignedTo) await this.assertAssignable(input.assignedTo, project.workspaceId);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.optimizationTask.create({
        data: {
          projectId,
          findingId: input.findingId ?? null,
          title: title!.slice(0, 300),
          priority: priority ?? 2,
          assignedTo: input.assignedTo ?? null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        },
        include: this.taskInclude,
      });
      if (input.findingId) {
        await tx.auditFinding.update({ where: { id: input.findingId }, data: { status: 'IN_PROGRESS' } });
        await tx.findingEvent.create({ data: { findingId: input.findingId, actorUserId: actorId, eventType: 'task_created', payload: { taskId: created.id } } });
      }
      await this.auditLog.record(
        { actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.task.create', targetType: 'optimization_task', targetId: created.id, afterState: { title: created.title, findingId: created.findingId }, requestMeta: meta },
        tx,
      );
      return created;
    });
    if (task.assignedTo && task.assignedTo !== actorId) {
      await this.notifications.notify({ workspaceId: project.workspaceId, userId: task.assignedTo, eventKey: 'task.assigned', title: 'New optimization task', body: task.title });
    }
    return this.taskView(await this.findTask(task.id));
  }

  async updateTask(actorId: string, taskId: string, input: UpdateTaskInput, meta?: RequestMeta) {
    const task = await this.findTask(taskId);
    const project = await this.projects.requireProject(actorId, task.projectId, 'optimization.manage');
    if (input.assignedTo) await this.assertAssignable(input.assignedTo, project.workspaceId);
    const data: Prisma.OptimizationTaskUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assignedTo !== undefined) data.assignedTo = input.assignedTo;
    if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;

    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.optimizationTask.update({ where: { id: taskId }, data, include: this.taskInclude });
      if (task.findingId && input.status === 'DISMISSED') {
        await tx.auditFinding.update({ where: { id: task.findingId }, data: { status: 'IGNORED' } });
      }
      await this.auditLog.record(
        { actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.task.update', targetType: 'optimization_task', targetId: taskId, beforeState: { status: task.status, assignedTo: task.assignedTo }, afterState: { status: updated.status, assignedTo: updated.assignedTo }, requestMeta: meta },
        tx,
      );
      return updated;
    });
    if (input.assignedTo && input.assignedTo !== task.assignedTo && input.assignedTo !== actorId) {
      await this.notifications.notify({ workspaceId: project.workspaceId, userId: input.assignedTo, eventKey: 'task.assigned', title: 'Optimization task assigned to you', body: saved.title });
    }
    return this.taskView(saved);
  }

  /** Re-audits the affected page; the verification result lands when the audit completes. */
  async verifyTask(actorId: string, taskId: string, meta?: RequestMeta) {
    const task = await this.findTask(taskId);
    await this.projects.requireProject(actorId, task.projectId, 'optimization.manage');
    if (!task.finding) {
      throw new BadRequestException({ code: 'NOTHING_TO_VERIFY', message: 'Only tasks created from an audit finding can be verified automatically.' });
    }
    const pending = task.verificationRuns.find((v) => v.status === 'QUEUED' || v.status === 'RUNNING');
    if (pending) throw new ConflictException({ code: 'VERIFICATION_IN_PROGRESS', message: 'A verification is already running for this task.' });
    const run = await this.audits.requestVerification(actorId, task.projectId, task.finding.auditPage.page.url, [taskId], meta);
    return { taskId, auditRunId: run.id, status: 'QUEUED' };
  }

  /** Re-audits every page that has open tasks or recommendations ("Re-analyze Site"). */
  async reanalyze(actorId: string, projectId: string, meta?: RequestMeta) {
    await this.projects.requireProject(actorId, projectId, 'seo.audit.run');
    const auditPageIds = await this.currentAuditPages(projectId);
    if (!auditPageIds.length) {
      return [await this.audits.request(actorId, projectId, { scope: 'SITE', mode: 'BOTH' }, meta).catch(() => this.audits.request(actorId, projectId, { scope: 'SITE', mode: 'SEO' }, meta))];
    }
    const pages = await this.prisma.auditPage.findMany({ where: { id: { in: auditPageIds } }, include: { page: true } });
    const runs = [];
    for (const p of pages.slice(0, 3)) {
      const tasks = await this.prisma.optimizationTask.findMany({
        where: { projectId, status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] }, finding: { auditPage: { pageId: p.pageId } } },
        select: { id: true },
      });
      runs.push(await this.audits.requestVerification(actorId, projectId, p.page.url, tasks.map((t) => t.id), meta));
    }
    return runs;
  }

  private readonly taskInclude = {
    finding: { include: { auditPage: { include: { page: true } }, recommendations: true } },
    assignee: { select: { id: true, email: true, displayName: true } },
    verificationRuns: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  };

  private async findTask(taskId: string) {
    const task = await this.prisma.optimizationTask.findUnique({ where: { id: taskId }, include: this.taskInclude });
    if (!task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    return task;
  }

  private async assertAssignable(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMembership.findFirst({ where: { userId, workspaceId, status: 'ACTIVE' } });
    if (!member) throw new BadRequestException({ code: 'ASSIGNEE_NOT_MEMBER', message: 'Tasks can only be assigned to workspace members.' });
  }

  private taskView(t: Awaited<ReturnType<OptimizationService['findTask']>>) {
    return {
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      assignee: t.assignee,
      finding: t.finding ? this.audits.findingView(t.finding, t.finding.auditPage.page.url) : null,
      verifications: t.verificationRuns.map((v) => ({ id: v.id, status: v.status, result: v.result, createdAt: v.createdAt, auditRunId: v.auditRunId })),
    };
  }
}

function severityRank(s: string) {
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].indexOf(s);
}
