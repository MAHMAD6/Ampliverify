import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Project, Workspace } from '../db/entities';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    private readonly rbac: RbacService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async listAccessible(userId: string) {
    const scopes = await this.rbac.getProjectReadScopes(userId);
    if (scopes.length === 0) return [];
    if (scopes.some((scope) => scope.scopeType === 'GLOBAL')) {
      return this.projects.find({ order: { createdAt: 'DESC' } });
    }

    const orgIds = [...new Set(scopes.map((scope) => scope.organizationId).filter(Boolean))] as string[];
    const workspaceIds = [...new Set(scopes.map((scope) => scope.workspaceId).filter(Boolean))] as string[];
    const projectIds = [...new Set(scopes.map((scope) => scope.projectId).filter(Boolean))] as string[];

    const qb = this.projects.createQueryBuilder('project');
    qb.where(
      new Brackets((where) => {
        let hasClause = false;
        if (orgIds.length) {
          where.where('project.organization_id IN (:...orgIds)', { orgIds });
          hasClause = true;
        }
        if (workspaceIds.length) {
          if (hasClause) where.orWhere('project.workspace_id IN (:...workspaceIds)', { workspaceIds });
          else where.where('project.workspace_id IN (:...workspaceIds)', { workspaceIds });
          hasClause = true;
        }
        if (projectIds.length) {
          if (hasClause) where.orWhere('project.id IN (:...projectIds)', { projectIds });
          else where.where('project.id IN (:...projectIds)', { projectIds });
        }
      }),
    );
    return qb.orderBy('project.created_at', 'DESC').getMany();
  }

  async getAccessible(userId: string, projectId: string) {
    const project = await this.getOrThrow(projectId);
    await this.rbac.assertPermission(userId, 'project.read', {
      organizationId: project.organizationId,
      workspaceId: project.workspaceId,
      projectId: project.id,
    });
    return project;
  }

  async create(
    actorId: string,
    dto: CreateProjectDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const workspace = await this.workspaces.findOne({ where: { id: dto.workspaceId } });
    if (!workspace) {
      throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
    }

    await this.rbac.assertPermission(actorId, 'project.create', {
      organizationId: workspace.organizationId,
      workspaceId: workspace.id,
    });

    const name = dto.name.trim();
    const slug = this.slugify(name);
    const duplicate = await this.projects.findOne({ where: { workspaceId: workspace.id, slug } });
    if (duplicate) {
      throw new ConflictException({
        code: 'PROJECT_SLUG_EXISTS',
        message: 'A project with this name already exists in the workspace.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Project);
      const project = await repo.save(
        repo.create({
          organizationId: workspace.organizationId,
          workspaceId: workspace.id,
          name,
          slug,
          createdBy: actorId,
        }),
      );

      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        organizationId: project.organizationId,
        workspaceId: project.workspaceId,
        action: 'project.create',
        targetType: 'project',
        targetId: project.id,
        afterState: this.publicState(project),
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });
      return project;
    });
  }

  async update(
    actorId: string,
    projectId: string,
    dto: UpdateProjectDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const project = await this.getOrThrow(projectId);
    await this.rbac.assertPermission(actorId, 'project.update', {
      organizationId: project.organizationId,
      workspaceId: project.workspaceId,
      projectId: project.id,
    });

    const beforeState = this.publicState(project);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const slug = this.slugify(name);
      const duplicate = await this.projects
        .createQueryBuilder('project')
        .where('project.workspace_id = :workspaceId', { workspaceId: project.workspaceId })
        .andWhere('project.slug = :slug', { slug })
        .andWhere('project.id <> :projectId', { projectId: project.id })
        .getOne();
      if (duplicate) {
        throw new ConflictException({
          code: 'PROJECT_SLUG_EXISTS',
          message: 'A project with this name already exists in the workspace.',
        });
      }
      project.name = name;
      project.slug = slug;
    }
    if (dto.status !== undefined) project.status = dto.status;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Project);
      const saved = await repo.save(project);
      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        organizationId: saved.organizationId,
        workspaceId: saved.workspaceId,
        action: 'project.update',
        targetType: 'project',
        targetId: saved.id,
        beforeState,
        afterState: this.publicState(saved),
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });
      return saved;
    });
  }

  private async getOrThrow(projectId: string) {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    }
    return project;
  }

  private slugify(input: string) {
    const slug = input
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    return slug || `project-${Date.now()}`;
  }

  private publicState(project: Project): Record<string, unknown> {
    return {
      id: project.id,
      organizationId: project.organizationId,
      workspaceId: project.workspaceId,
      name: project.name,
      slug: project.slug,
      status: project.status,
    };
  }
}
