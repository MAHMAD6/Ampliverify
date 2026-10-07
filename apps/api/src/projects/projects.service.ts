import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { normalizeHost } from '../common/utils/domain';
import { slugify } from '../common/utils/slug';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const PROJECT_FIELDS = {
  id: true,
  organizationId: true,
  workspaceId: true,
  name: true,
  slug: true,
  status: true,
  primaryGoal: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ProjectView = Pick<Project, keyof typeof PROJECT_FIELDS>;

/**
 * Projects are never trusted from client ids alone: every read/write resolves
 * project -> workspace -> organization server-side and checks RBAC on that scope.
 * Soft-deleted projects are invisible here.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async listAccessible(userId: string) {
    const access = await this.rbac.projectAccessFilter(userId, 'project.read');
    if (!access) return [];
    const projects = await this.prisma.project.findMany({
      where: { AND: [access, { deletedAt: null }] },
      select: {
        ...PROJECT_FIELDS,
        domains: { select: { host: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map(({ domains, ...project }) => ({ ...project, primaryDomain: domains[0]?.host ?? null }));
  }

  async getAccessible(userId: string, projectId: string) {
    const project = await this.getOrThrow(projectId);
    await this.rbac.assertPermission(userId, 'project.read', this.scopeOf(project));
    const domain = await this.prisma.domain.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      select: { host: true },
    });
    return { ...project, primaryDomain: domain?.host ?? null };
  }

  async create(actorId: string, dto: CreateProjectDto, requestMeta?: RequestMeta) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: dto.workspaceId, deletedAt: null },
    });
    if (!workspace) {
      throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
    }

    await this.rbac.assertPermission(actorId, 'project.create', {
      organizationId: workspace.organizationId,
      workspaceId: workspace.id,
    });

    await this.entitlements.assertProjectLimit(workspace.id);

    const name = dto.name.trim();
    const host = dto.domain === undefined || dto.domain.trim() === '' ? null : normalizeHost(dto.domain);
    if (dto.domain !== undefined && dto.domain.trim() !== '' && !host) {
      throw new BadRequestException({ code: 'INVALID_DOMAIN', message: 'Enter a valid domain, for example example.com.' });
    }
    const slug = slugify(name, `project-${Date.now()}`);
    await this.assertSlugAvailable(workspace.id, slug);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: workspace.organizationId,
          workspaceId: workspace.id,
          name,
          slug,
          primaryGoal: dto.primaryGoal ?? null,
          createdBy: actorId,
        },
        select: PROJECT_FIELDS,
      });
      if (host) {
        await tx.domain.create({ data: { projectId: project.id, host, canonicalUrl: `https://${host}` } });
      }

      await this.audit.record(
        {
          actorUserId: actorId,
          organizationId: project.organizationId,
          workspaceId: project.workspaceId,
          action: 'project.create',
          targetType: 'project',
          targetId: project.id,
          afterState: { ...this.auditState(project), primaryDomain: host },
          requestMeta,
        },
        tx,
      );
      return { ...project, primaryDomain: host };
    });
  }

  async update(actorId: string, projectId: string, dto: UpdateProjectDto, requestMeta?: RequestMeta) {
    const project = await this.getOrThrow(projectId);
    await this.rbac.assertPermission(actorId, 'project.update', this.scopeOf(project));

    const data: { name?: string; slug?: string; status?: Project['status'] } = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      data.slug = slugify(data.name, project.slug);
      if (data.slug !== project.slug) await this.assertSlugAvailable(project.workspaceId, data.slug);
    }
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.project.update({ where: { id: project.id }, data, select: PROJECT_FIELDS });
      await this.audit.record(
        {
          actorUserId: actorId,
          organizationId: saved.organizationId,
          workspaceId: saved.workspaceId,
          action: 'project.update',
          targetType: 'project',
          targetId: saved.id,
          beforeState: this.auditState(project),
          afterState: this.auditState(saved),
          requestMeta,
        },
        tx,
      );
      return saved;
    });
  }

  /**
   * Resolves a live project and asserts `permissionKey` on its scope. Used by
   * every project-scoped module (audits, keywords, GEO, reports…).
   */
  async requireProject(userId: string, projectId: string, permissionKey: string) {
    const project = await this.getOrThrow(projectId);
    await this.rbac.assertPermission(userId, permissionKey, this.scopeOf(project));
    return project;
  }

  /** Soft delete (`deleted_at`); data is retained for the grace period, then purged by operations. */
  async remove(actorId: string, projectId: string, requestMeta?: RequestMeta) {
    const project = await this.getOrThrow(projectId);
    await this.rbac.assertPermission(actorId, 'project.delete', this.scopeOf(project));
    return this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
      await this.audit.record(
        {
          actorUserId: actorId,
          organizationId: project.organizationId,
          workspaceId: project.workspaceId,
          action: 'project.delete',
          targetType: 'project',
          targetId: project.id,
          beforeState: this.auditState(project),
          requestMeta,
        },
        tx,
      );
      return { id: project.id, deleted: true };
    });
  }

  private async assertSlugAvailable(workspaceId: string, slug: string) {
    const duplicate = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'PROJECT_SLUG_EXISTS',
        message: 'A project with this name already exists in the workspace.',
      });
    }
  }

  private async getOrThrow(projectId: string): Promise<ProjectView> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: PROJECT_FIELDS,
    });
    if (!project) {
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    }
    return project;
  }

  private scopeOf(project: ProjectView) {
    return { organizationId: project.organizationId, workspaceId: project.workspaceId, projectId: project.id };
  }

  private auditState(project: ProjectView) {
    return {
      id: project.id,
      organizationId: project.organizationId,
      workspaceId: project.workspaceId,
      name: project.name,
      slug: project.slug,
      status: project.status,
      primaryGoal: project.primaryGoal,
    };
  }
}
