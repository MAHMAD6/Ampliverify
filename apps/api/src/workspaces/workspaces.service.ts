import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobsService } from '../jobs/jobs.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { RequestMeta } from '../common/types/request-meta.type';

export const TENANT_ROLES = ['OWNER', 'MEMBER'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export type WorkspaceSettings = {
  aiGeo?: {
    defaultPlatforms?: string[];
    defaultCountry?: string;
    defaultLanguage?: string;
    brandName?: string;
    brandAliases?: string[];
    competitors?: string[];
    checkFrequency?: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    aiTone?: string;
    aiCreativity?: 'LOW' | 'BALANCED' | 'HIGH';
    autoApplySuggestions?: boolean;
    monthlyCreditCap?: number | null;
    preferences?: Record<string, unknown>;
  };
  privacy?: { retentionDays?: number | null; allowPublicReportShares?: boolean; shareLinkExpiryDays?: number };
  projectDefaults?: { crawlScope?: 'PAGE' | 'SITE'; maxPages?: number; auditMode?: 'SEO' | 'GEO' | 'BOTH'; auditFrequency?: 'MANUAL' | 'WEEKLY' | 'MONTHLY'; reportFrequency?: 'NONE' | 'WEEKLY' | 'MONTHLY' };
};

const INVITE_TTL_DAYS = 7;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Workspace administration for tenants: profile & preferences, members and
 * roles, invitations, data exports, support tickets and personal privacy.
 */
@Injectable()
export class WorkspacesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
    private readonly storage: ContentStorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.register('workspace.export', async (p) => this.buildExport(String(p.exportId)));
  }

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  // ── Workspace profile ──────────────────────────────────────────────────

  async get(userId: string, workspaceId: string) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read');
    const [org, counts, canUpdate, canManageMembers] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: ws.organizationId }, select: { id: true, name: true, slug: true } }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { _count: { select: { projects: { where: { deletedAt: null } }, memberships: { where: { status: 'ACTIVE' } } } } } }),
      this.rbac.hasPermission(userId, 'workspace.update', { organizationId: ws.organizationId, workspaceId }),
      this.rbac.hasPermission(userId, 'workspace.member.manage', { organizationId: ws.organizationId, workspaceId }),
    ]);
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      status: ws.status,
      timezone: ws.timezone,
      language: ws.language,
      settings: (ws.settingsJson ?? {}) as WorkspaceSettings,
      createdAt: ws.createdAt,
      organization: org,
      projectCount: counts?._count.projects ?? 0,
      memberCount: counts?._count.memberships ?? 0,
      permissions: { update: canUpdate, manageMembers: canManageMembers },
    };
  }

  async update(userId: string, workspaceId: string, input: { name?: string; timezone?: string; language?: string; settings?: WorkspaceSettings }, meta?: RequestMeta) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.update');
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: input.timezone });
      } catch {
        throw new BadRequestException({ code: 'INVALID_TIMEZONE', message: 'Unknown timezone.' });
      }
    }
    if (input.language && !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(input.language)) {
      throw new BadRequestException({ code: 'INVALID_LANGUAGE', message: 'Use a language code such as en or en-US.' });
    }
    const current = (ws.settingsJson ?? {}) as WorkspaceSettings;
    const merged: WorkspaceSettings = input.settings
      ? {
          aiGeo: { ...current.aiGeo, ...input.settings.aiGeo },
          privacy: { ...current.privacy, ...input.settings.privacy },
          projectDefaults: { ...current.projectDefaults, ...input.settings.projectDefaults },
        }
      : current;
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.language !== undefined && { language: input.language }),
          ...(input.settings !== undefined && { settingsJson: merged as Prisma.InputJsonObject }),
        },
      });
      await this.auditLog.record(
        {
          actorUserId: userId,
          organizationId: ws.organizationId,
          workspaceId,
          action: 'workspace.update',
          targetType: 'workspace',
          targetId: workspaceId,
          beforeState: { name: ws.name, timezone: ws.timezone, language: ws.language },
          afterState: { name: updated.name, timezone: updated.timezone, language: updated.language, settingsChanged: input.settings !== undefined },
          requestMeta: meta,
        },
        tx,
      );
      return updated;
    });
    return this.get(userId, saved.id);
  }

  // ── Members ────────────────────────────────────────────────────────────

  async members(userId: string, workspaceId: string) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read');
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      include: { user: { select: { id: true, email: true, displayName: true, status: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId: { in: memberships.map((m) => m.userId) },
        revokedAt: null,
        OR: [{ workspaceId, scopeType: 'WORKSPACE' }, { organizationId: ws.organizationId, scopeType: 'ORGANIZATION' }],
      },
      include: { role: { select: { key: true, name: true } } },
    });
    return memberships.map((m) => {
      const roles = assignments.filter((a) => a.userId === m.userId);
      return {
        userId: m.userId,
        email: m.user.email,
        displayName: m.user.displayName,
        status: m.status,
        joinedAt: m.joinedAt,
        roles: roles.map((r) => ({ key: r.role.key, name: r.role.name, scope: r.scopeType })),
        role: roles.some((r) => r.role.key === 'OWNER') ? 'OWNER' : roles[0]?.role.key ?? 'MEMBER',
      };
    });
  }

  private async ownerCount(workspaceId: string, organizationId: string) {
    const rows = await this.prisma.roleAssignment.findMany({
      where: {
        revokedAt: null,
        role: { key: 'OWNER' },
        OR: [{ workspaceId, scopeType: 'WORKSPACE' }, { organizationId, scopeType: 'ORGANIZATION' }],
        user: { memberships: { some: { workspaceId, status: 'ACTIVE' } } },
      },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId)).size;
  }

  async setMemberRole(userId: string, workspaceId: string, memberId: string, roleKey: TenantRole, meta?: RequestMeta) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.member.manage');
    if (!TENANT_ROLES.includes(roleKey)) throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Role must be OWNER or MEMBER.' });
    const membership = await this.prisma.workspaceMembership.findFirst({ where: { workspaceId, userId: memberId, status: 'ACTIVE' } });
    if (!membership) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    const current = await this.prisma.roleAssignment.findMany({ where: { userId: memberId, workspaceId, scopeType: 'WORKSPACE', revokedAt: null }, include: { role: true } });
    const orgOwner = await this.prisma.roleAssignment.findFirst({ where: { userId: memberId, organizationId: ws.organizationId, scopeType: 'ORGANIZATION', revokedAt: null, role: { key: 'OWNER' } } });
    const isOwner = !!orgOwner || current.some((a) => a.role.key === 'OWNER');
    if ((roleKey === 'OWNER') === isOwner && (roleKey === 'OWNER' || current.some((a) => a.role.key === 'MEMBER'))) return { userId: memberId, role: roleKey };
    if (roleKey === 'MEMBER' && isOwner && (await this.ownerCount(workspaceId, ws.organizationId)) <= 1) {
      throw new ConflictException({ code: 'LAST_OWNER', message: 'A workspace needs at least one owner.' });
    }
    if (roleKey === 'MEMBER' && orgOwner) {
      // Organization-wide ownership can only be narrowed here when the organization has a single workspace.
      const workspaces = await this.prisma.workspace.count({ where: { organizationId: ws.organizationId, deletedAt: null } });
      if (workspaces > 1) throw new ConflictException({ code: 'ORGANIZATION_OWNER', message: 'This person owns the whole organization. Remove organization ownership first.' });
    }
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    await this.prisma.$transaction(async (tx) => {
      const revoke = [...current.map((c) => c.id), ...(roleKey === 'MEMBER' && orgOwner ? [orgOwner.id] : [])];
      await tx.roleAssignment.updateMany({ where: { id: { in: revoke } }, data: { revokedAt: new Date(), revokedBy: userId } });
      await tx.roleAssignment.create({ data: { userId: memberId, roleId: role.id, scopeType: 'WORKSPACE', workspaceId, createdBy: userId } });
      await this.auditLog.record(
        { actorUserId: userId, organizationId: ws.organizationId, workspaceId, action: 'workspace.member.role', targetType: 'user', targetId: memberId, beforeState: { roles: [...current.map((c) => c.role.key), ...(orgOwner ? ['OWNER (organization)'] : [])] }, afterState: { role: roleKey }, requestMeta: meta },
        tx,
      );
    });
    return { userId: memberId, role: roleKey };
  }

  async removeMember(userId: string, workspaceId: string, memberId: string, meta?: RequestMeta) {
    const self = userId === memberId;
    const ws = self ? await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read') : await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.member.manage');
    const membership = await this.prisma.workspaceMembership.findFirst({ where: { workspaceId, userId: memberId, status: 'ACTIVE' } });
    if (!membership) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    const isOwner = await this.prisma.roleAssignment.count({
      where: { userId: memberId, revokedAt: null, role: { key: 'OWNER' }, OR: [{ workspaceId }, { organizationId: ws.organizationId, scopeType: 'ORGANIZATION' }] },
    });
    if (isOwner && (await this.ownerCount(workspaceId, ws.organizationId)) <= 1) {
      throw new ConflictException({ code: 'LAST_OWNER', message: 'Transfer ownership before the last owner leaves.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMembership.update({ where: { id: membership.id }, data: { status: 'REMOVED' } });
      await tx.roleAssignment.updateMany({ where: { userId: memberId, workspaceId, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: userId } });
      await tx.optimizationTask.updateMany({ where: { assignedTo: memberId, project: { workspaceId } }, data: { assignedTo: null } });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId, action: self ? 'workspace.member.leave' : 'workspace.member.remove', targetType: 'user', targetId: memberId, requestMeta: meta }, tx);
    });
    return { userId: memberId, removed: true };
  }

  // ── Invitations ────────────────────────────────────────────────────────

  async invitations(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.member.manage');
    await this.prisma.workspaceInvitation.updateMany({ where: { workspaceId, status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      select: { id: true, email: true, roleKey: true, status: true, expiresAt: true, createdAt: true, acceptedAt: true, inviter: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async invite(userId: string, workspaceId: string, email: string, roleKey: TenantRole, meta?: RequestMeta) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.member.manage');
    if (!TENANT_ROLES.includes(roleKey)) throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Role must be OWNER or MEMBER.' });
    const normalized = email.trim().toLowerCase();
    const existingMember = await this.prisma.workspaceMembership.findFirst({ where: { workspaceId, status: 'ACTIVE', user: { email: normalized } } });
    if (existingMember) throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'This person is already a member.' });

    const plan = await this.entitlements.resolve(workspaceId);
    const seatLimit = plan.features?.get('limit.team_members')?.limit;
    if (seatLimit !== undefined && seatLimit !== null) {
      const [members, pending] = await Promise.all([
        this.prisma.workspaceMembership.count({ where: { workspaceId, status: 'ACTIVE' } }),
        this.prisma.workspaceInvitation.count({ where: { workspaceId, status: 'PENDING', expiresAt: { gt: new Date() } } }),
      ]);
      if (members + pending >= seatLimit) {
        throw new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', message: `Your plan includes ${seatLimit} team member${seatLimit === 1 ? '' : 's'}.` });
      }
    }

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.updateMany({ where: { workspaceId, email: normalized, status: 'PENDING' }, data: { status: 'REVOKED' } });
      const inv = await tx.workspaceInvitation.create({
        data: { workspaceId, email: normalized, roleKey, tokenHash: hash(token), invitedBy: userId, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) },
      });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId, action: 'workspace.invitation.create', targetType: 'workspace_invitation', targetId: inv.id, afterState: { email: normalized, roleKey }, requestMeta: meta }, tx);
      return inv;
    });

    const acceptUrl = `${this.webUrl}/invite?token=${token}`;
    const inviter = await this.prisma.user.findUnique({ where: { id: userId } });
    let emailed = false;
    if (this.email.configured) {
      try {
        await this.email.send({
          to: normalized,
          subject: `${inviter?.displayName ?? inviter?.email ?? 'A teammate'} invited you to ${ws.name} on AmpliVerify`,
          text: `You have been invited to join the "${ws.name}" workspace on AmpliVerify as ${roleKey === 'OWNER' ? 'an owner' : 'a member'}.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires in ${INVITE_TTL_DAYS} days.`,
        });
        emailed = true;
      } catch {
        emailed = false;
      }
    }
    return { id: invitation.id, email: normalized, roleKey, status: invitation.status, expiresAt: invitation.expiresAt, emailed, acceptUrl };
  }

  async revokeInvitation(userId: string, invitationId: string, meta?: RequestMeta) {
    const inv = await this.prisma.workspaceInvitation.findUnique({ where: { id: invitationId } });
    if (!inv) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found.' });
    const ws = await this.rbac.requireWorkspace(userId, inv.workspaceId, 'workspace.member.manage');
    if (inv.status !== 'PENDING') throw new ConflictException({ code: 'INVITATION_NOT_PENDING', message: 'This invitation is no longer pending.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.update({ where: { id: inv.id }, data: { status: 'REVOKED' } });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId: ws.id, action: 'workspace.invitation.revoke', targetType: 'workspace_invitation', targetId: inv.id, requestMeta: meta }, tx);
    });
    return { id: inv.id, status: 'REVOKED' };
  }

  /** Public preview of an invitation (workspace name, role, email mask) for the accept page. */
  async previewInvitation(token: string) {
    const inv = await this.prisma.workspaceInvitation.findUnique({ where: { tokenHash: hash(token) }, include: { workspace: { select: { name: true } }, inviter: { select: { displayName: true, email: true } } } });
    if (!inv || inv.status !== 'PENDING' || inv.expiresAt < new Date()) {
      throw new NotFoundException({ code: 'INVITATION_INVALID', message: 'This invitation is invalid or has expired.' });
    }
    const [name, domain] = inv.email.split('@');
    return {
      workspaceName: inv.workspace.name,
      roleKey: inv.roleKey,
      invitedBy: inv.inviter.displayName ?? inv.inviter.email,
      emailHint: `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`,
      expiresAt: inv.expiresAt,
    };
  }

  async acceptInvitation(userId: string, token: string, meta?: RequestMeta) {
    const inv = await this.prisma.workspaceInvitation.findUnique({ where: { tokenHash: hash(token) }, include: { workspace: true } });
    if (!inv || inv.status !== 'PENDING' || inv.expiresAt < new Date()) {
      throw new NotFoundException({ code: 'INVITATION_INVALID', message: 'This invitation is invalid or has expired.' });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new ForbiddenException({ code: 'INVITATION_EMAIL_MISMATCH', message: `This invitation was sent to a different email address. Sign in as ${inv.email}.` });
    }
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: inv.roleKey } });
    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: inv.workspace.organizationId, userId } },
        create: { organizationId: inv.workspace.organizationId, userId, status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
        create: { workspaceId: inv.workspaceId, userId, status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      const existing = await tx.roleAssignment.findFirst({ where: { userId, roleId: role.id, workspaceId: inv.workspaceId, scopeType: 'WORKSPACE', revokedAt: null } });
      if (!existing) {
        await tx.roleAssignment.create({ data: { userId, roleId: role.id, scopeType: 'WORKSPACE', workspaceId: inv.workspaceId, createdBy: inv.invitedBy } });
      }
      await tx.workspaceInvitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedBy: userId } });
      await this.auditLog.record({ actorUserId: userId, organizationId: inv.workspace.organizationId, workspaceId: inv.workspaceId, action: 'workspace.invitation.accept', targetType: 'workspace_invitation', targetId: inv.id, afterState: { roleKey: inv.roleKey }, requestMeta: meta }, tx);
    });
    await this.notifications.notify({
      workspaceId: inv.workspaceId,
      userId: inv.invitedBy,
      eventKey: 'workspace.member_joined',
      title: 'New member joined',
      body: `${user.displayName ?? user.email} joined ${inv.workspace.name}.`,
    });
    return { workspaceId: inv.workspaceId, organizationId: inv.workspace.organizationId, role: inv.roleKey };
  }

  // ── Data export ────────────────────────────────────────────────────────

  async exports(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.update');
    return this.prisma.dataExportRequest.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, sizeBytes: true, createdAt: true, completedAt: true, expiresAt: true, error: true } });
  }

  async requestExport(userId: string, workspaceId: string, meta?: RequestMeta) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.update');
    const running = await this.prisma.dataExportRequest.count({ where: { workspaceId, status: { in: ['QUEUED', 'RUNNING'] } } });
    if (running) throw new ConflictException({ code: 'EXPORT_IN_PROGRESS', message: 'An export is already being prepared.' });
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.dataExportRequest.create({ data: { workspaceId, requestedBy: userId } });
      await this.jobs.enqueue('workspace.export', { exportId: req.id }, { jobKey: `export:${req.id}` }, tx);
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId, action: 'workspace.export.request', targetType: 'data_export_request', targetId: req.id, requestMeta: meta }, tx);
      return req;
    });
  }

  async buildExport(exportId: string) {
    const req = await this.prisma.dataExportRequest.findUnique({ where: { id: exportId } });
    if (!req || req.status === 'SUCCEEDED') return;
    await this.prisma.dataExportRequest.update({ where: { id: exportId }, data: { status: 'RUNNING' } });
    try {
      const workspaceId = req.workspaceId;
      const [workspace, projects, members, auditRuns, tasks, keywordLists, geoPrompts, reports, ledger, usage, contentIdeas, editorDocs] = await Promise.all([
        this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, timezone: true, language: true, settingsJson: true, createdAt: true } }),
        this.prisma.project.findMany({ where: { workspaceId, deletedAt: null }, include: { domains: true, settings: true } }),
        this.prisma.workspaceMembership.findMany({ where: { workspaceId }, select: { status: true, joinedAt: true, user: { select: { email: true, displayName: true } } } }),
        this.prisma.auditRun.findMany({ where: { project: { workspaceId } }, include: { pages: { include: { page: { select: { url: true } }, findings: { select: { ruleKey: true, severity: true, status: true, detailsJson: true } } } } } }),
        this.prisma.optimizationTask.findMany({ where: { project: { workspaceId } } }),
        this.prisma.keywordList.findMany({ where: { project: { workspaceId } }, include: { items: { include: { keyword: true } } } }),
        this.prisma.geoPrompt.findMany({ where: { project: { workspaceId } }, include: { runs: { include: { platformResults: true } } } }),
        this.prisma.report.findMany({ where: { project: { workspaceId } } }),
        this.prisma.creditLedger.findMany({ where: { wallet: { workspaceId } } }),
        this.prisma.usageEvent.findMany({ where: { workspaceId } }),
        this.prisma.contentIdea.findMany({ where: { project: { workspaceId } } }),
        this.prisma.editorDocument.findMany({ where: { project: { workspaceId } }, include: { versions: { select: { id: true, createdAt: true, versionNo: true } } } }),
      ]);
      const body = JSON.stringify(
        { exportedAt: new Date(), workspace, members, projects, auditRuns, optimizationTasks: tasks, keywordLists, geoPrompts, reports, editorDocuments: editorDocs, contentIdeas, credits: { ledger, usage } },
        (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
        2,
      );
      const key = `exports/${workspaceId}/${exportId}.json`;
      await this.storage.writeBuffer(key, Buffer.from(body, 'utf8'), 'application/json');
      await this.prisma.dataExportRequest.update({
        where: { id: exportId },
        data: { status: 'SUCCEEDED', fileRef: key, sizeBytes: BigInt(Buffer.byteLength(body)), completedAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
      });
    } catch (err) {
      await this.prisma.dataExportRequest.update({ where: { id: exportId }, data: { status: 'FAILED', error: String(err).slice(0, 1000) } });
      throw err;
    }
  }

  async downloadExport(userId: string, exportId: string) {
    const req = await this.prisma.dataExportRequest.findUnique({ where: { id: exportId } });
    if (!req) throw new NotFoundException({ code: 'EXPORT_NOT_FOUND', message: 'Export not found.' });
    await this.rbac.requireWorkspace(userId, req.workspaceId, 'workspace.update');
    if (req.status !== 'SUCCEEDED' || !req.fileRef || (req.expiresAt && req.expiresAt < new Date())) {
      throw new NotFoundException({ code: 'EXPORT_NOT_READY', message: 'This export is not available.' });
    }
    const body = await this.storage.readBuffer(req.fileRef);
    if (!body) throw new NotFoundException({ code: 'EXPORT_NOT_READY', message: 'This export is not available.' });
    return { filename: `ampliverify-export-${req.createdAt.toISOString().slice(0, 10)}.json`, body };
  }

  // ── Personal privacy ───────────────────────────────────────────────────

  async privacy(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { privacyJson: true } });
    return { productAnalytics: true, productEmails: true, ...((user.privacyJson ?? {}) as object) };
  }

  async setPrivacy(userId: string, input: { productAnalytics?: boolean; productEmails?: boolean }) {
    const current = await this.privacy(userId);
    const next = { ...current, ...input };
    await this.prisma.user.update({ where: { id: userId }, data: { privacyJson: next } });
    await this.auditLog.record({ actorUserId: userId, action: 'user.privacy.update', targetType: 'user', targetId: userId, afterState: next });
    return next;
  }

  async updateProfile(userId: string, input: { displayName?: string }) {
    const saved = await this.prisma.user.update({ where: { id: userId }, data: { displayName: input.displayName?.trim() || null }, select: { id: true, email: true, displayName: true, status: true } });
    await this.auditLog.record({ actorUserId: userId, action: 'user.profile.update', targetType: 'user', targetId: userId, afterState: { displayName: saved.displayName } });
    return saved;
  }

  // ── Support tickets ────────────────────────────────────────────────────

  async tickets(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read');
    return this.prisma.supportTicket.findMany({ where: { workspaceId, userId }, orderBy: { updatedAt: 'desc' }, take: 100, include: { _count: { select: { messages: true } } } });
  }

  async ticket(userId: string, ticketId: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { displayName: true, email: true } } } } } });
    if (!t || t.userId !== userId) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Request not found.' });
    return t;
  }

  async createTicket(userId: string, input: { workspaceId: string; subject: string; category: string; priority?: string; message: string }, meta?: RequestMeta) {
    const ws = await this.rbac.requireWorkspace(userId, input.workspaceId, 'workspace.read');
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: { workspaceId: input.workspaceId, userId, subject: input.subject.trim(), category: input.category, priority: input.priority ?? 'NORMAL', messages: { create: { authorUserId: userId, body: input.message.trim() } } },
      });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId: ws.id, action: 'support.ticket.create', targetType: 'support_ticket', targetId: t.id, requestMeta: meta }, tx);
      return t;
    });
  }

  async replyTicket(userId: string, ticketId: string, body: string) {
    const t = await this.ticket(userId, ticketId);
    if (t.status === 'CLOSED') throw new ConflictException({ code: 'TICKET_CLOSED', message: 'This request is closed.' });
    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({ data: { ticketId, authorUserId: userId, body: body.trim() } }),
      this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: t.status === 'WAITING_ON_CUSTOMER' || t.status === 'RESOLVED' ? 'OPEN' : t.status } }),
    ]);
    return this.ticket(userId, ticketId);
  }
}
