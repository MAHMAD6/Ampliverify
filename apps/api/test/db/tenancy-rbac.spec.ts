import { MembershipStatus, PrismaClient, ScopeType } from '@prisma/client';
import {
  addWorkspaceMember,
  createPrisma,
  createServices,
  createUser,
  expectCode,
  grantGlobal,
  uniq,
} from './helpers';

describe('tenancy and RBAC', () => {
  let prisma: PrismaClient;
  let svc: ReturnType<typeof createServices>;

  beforeAll(() => {
    prisma = createPrisma();
    svc = createServices(prisma);
  });
  afterAll(() => prisma.$disconnect());

  async function onboard(label: string) {
    const owner = await createUser(prisma, label);
    const { organization, workspace } = await svc.organizations.createOrganization(owner.id, { name: uniq(label) });
    return { owner, organization, workspace };
  }

  describe('onboarding', () => {
    it('creates org, workspace, memberships, wallet, OWNER assignment and audit atomically', async () => {
      const { owner, organization, workspace } = await onboard('onboard');

      expect(workspace.organizationId).toBe(organization.id);
      await expect(
        prisma.organizationMembership.findUniqueOrThrow({
          where: { organizationId_userId: { organizationId: organization.id, userId: owner.id } },
        }),
      ).resolves.toMatchObject({ status: MembershipStatus.ACTIVE });
      await expect(prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: workspace.id } })).resolves.toBeTruthy();

      const assignment = await prisma.roleAssignment.findFirstOrThrow({
        where: { userId: owner.id, organizationId: organization.id },
        include: { role: true },
      });
      expect(assignment).toMatchObject({ scopeType: ScopeType.ORGANIZATION, role: { key: 'OWNER' } });

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { eventType: 'organization.create', targetId: organization.id },
      });
      expect(audit.actorUserId).toBe(owner.id);
    });

    it('generates a distinct slug when the organization name repeats', async () => {
      const name = uniq('dup');
      const a = await createUser(prisma);
      const b = await createUser(prisma);
      const first = await svc.organizations.createOrganization(a.id, { name });
      const second = await svc.organizations.createOrganization(b.id, { name });
      expect(second.organization.slug).toBe(`${first.organization.slug}-2`);
    });
  });

  describe('cross-tenant isolation', () => {
    it('denies reading, updating and creating projects in another tenant', async () => {
      const alice = await onboard('alice');
      const bob = await onboard('bob');
      const project = await svc.projects.create(alice.owner.id, { workspaceId: alice.workspace.id, name: 'Site' });

      await expectCode(svc.projects.getAccessible(bob.owner.id, project.id), 'PERMISSION_DENIED');
      await expectCode(svc.projects.update(bob.owner.id, project.id, { name: 'pwned' }), 'PERMISSION_DENIED');
      await expectCode(
        svc.projects.create(bob.owner.id, { workspaceId: alice.workspace.id, name: 'x' }),
        'PERMISSION_DENIED',
      );
      await expectCode(
        svc.organizations.createWorkspace(bob.owner.id, { organizationId: alice.organization.id, name: 'x' }),
        'PERMISSION_DENIED',
      );

      const bobsList = await svc.projects.listAccessible(bob.owner.id);
      expect(bobsList.map((p) => p.id)).not.toContain(project.id);
      await prisma.domain.create({ data: { projectId: project.id, host: 'alice.example', canonicalUrl: 'https://alice.example/' } });
      const alicesList = await svc.projects.listAccessible(alice.owner.id);
      expect(alicesList.find((p) => p.id === project.id)).toMatchObject({ primaryDomain: 'alice.example' });
      await expect(svc.projects.getAccessible(alice.owner.id, project.id)).resolves.toMatchObject({ primaryDomain: 'alice.example' });
    });

    it('a user with no assignments sees nothing', async () => {
      const nobody = await createUser(prisma, 'nobody');
      await expect(svc.projects.listAccessible(nobody.id)).resolves.toEqual([]);
    });

    it('stops honouring a tenant assignment once the membership is no longer ACTIVE', async () => {
      const { owner, organization, workspace } = await onboard('suspend');
      const project = await svc.projects.create(owner.id, { workspaceId: workspace.id, name: 'Site' });

      await prisma.organizationMembership.update({
        where: { organizationId_userId: { organizationId: organization.id, userId: owner.id } },
        data: { status: MembershipStatus.SUSPENDED },
      });

      await expectCode(svc.projects.getAccessible(owner.id, project.id), 'PERMISSION_DENIED');
      await expect(svc.projects.listAccessible(owner.id)).resolves.toEqual([]);
    });

    it('a soft-deleted project is not found', async () => {
      const { owner, workspace } = await onboard('softdel');
      const project = await svc.projects.create(owner.id, { workspaceId: workspace.id, name: 'Gone' });
      await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
      await expectCode(svc.projects.getAccessible(owner.id, project.id), 'PROJECT_NOT_FOUND');
    });
  });

  describe('projects', () => {
    it('rejects duplicate names in a workspace and audits updates with before/after', async () => {
      const { owner, workspace } = await onboard('proj');
      const project = await svc.projects.create(owner.id, { workspaceId: workspace.id, name: 'Main Site' });
      await expectCode(
        svc.projects.create(owner.id, { workspaceId: workspace.id, name: 'main site' }),
        'PROJECT_SLUG_EXISTS',
      );

      await svc.projects.update(owner.id, project.id, { name: 'Renamed', status: 'ARCHIVED' });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { eventType: 'project.update', targetId: project.id },
      });
      expect(audit.beforeJson).toMatchObject({ name: 'Main Site', status: 'ACTIVE' });
      expect(audit.afterJson).toMatchObject({ name: 'Renamed', slug: 'renamed', status: 'ARCHIVED' });
    });
  });

  describe('access assignments (anti-escalation)', () => {
    it('blocks self-assignment', async () => {
      const { owner } = await onboard('self');
      const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });
      await expectCode(
        svc.rbac.createAssignment(owner.id, { userId: owner.id, roleId: member.id, scopeType: ScopeType.GLOBAL }),
        'SELF_ASSIGNMENT_NOT_ALLOWED',
      );
    });

    it('an OWNER (no admin.access.manage) cannot grant anything', async () => {
      const { owner, organization, workspace } = await onboard('owner-grant');
      const colleague = await createUser(prisma);
      await addWorkspaceMember(prisma, colleague.id, workspace.id, organization.id);
      const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });

      await expectCode(
        svc.rbac.createAssignment(owner.id, {
          userId: colleague.id,
          roleId: member.id,
          scopeType: ScopeType.WORKSPACE,
          workspaceId: workspace.id,
        }),
        'PERMISSION_DENIED',
      );
    });

    it('cannot grant a role containing permissions the grantor lacks', async () => {
      const grantor = await createUser(prisma, 'grantor');
      const target = await createUser(prisma, 'target');
      const accessOnly = await svc.rbac.createRole(
        (await superAdmin()).id,
        { key: uniq('ACCESS_ONLY'), name: 'Access only', permissionKeys: ['admin.access.manage'] },
      );
      await prisma.roleAssignment.create({
        data: { userId: grantor.id, roleId: accessOnly.id, scopeType: ScopeType.GLOBAL, createdBy: grantor.id },
      });
      const superRole = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });

      await expectCode(
        svc.rbac.createAssignment(grantor.id, { userId: target.id, roleId: superRole.id, scopeType: ScopeType.GLOBAL }),
        'PERMISSION_DENIED',
      );
    });

    it('requires the target to be an active member of the scoped workspace', async () => {
      const admin = await superAdmin();
      const { workspace } = await onboard('target-ws');
      const outsider = await createUser(prisma, 'outsider');
      const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });

      await expectCode(
        svc.rbac.createAssignment(admin.id, {
          userId: outsider.id,
          roleId: member.id,
          scopeType: ScopeType.WORKSPACE,
          workspaceId: workspace.id,
        }),
        'TARGET_USER_NOT_IN_WORKSPACE',
      );
    });

    it('rejects mismatched scope fields', async () => {
      const admin = await superAdmin();
      const { workspace } = await onboard('scope');
      const target = await createUser(prisma);
      const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });
      await expectCode(
        svc.rbac.createAssignment(admin.id, {
          userId: target.id,
          roleId: member.id,
          scopeType: ScopeType.GLOBAL,
          workspaceId: workspace.id,
        }),
        'INVALID_SCOPE',
      );
    });

    it('grants, rejects duplicates, revokes (audited) and blocks self-revocation', async () => {
      const admin = await superAdmin();
      const { organization, workspace } = await onboard('grant');
      const target = await createUser(prisma, 'grantee');
      await addWorkspaceMember(prisma, target.id, workspace.id, organization.id);
      const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });
      const dto = { userId: target.id, roleId: member.id, scopeType: ScopeType.WORKSPACE, workspaceId: workspace.id };

      const assignment = await svc.rbac.createAssignment(admin.id, dto);
      expect(assignment).toMatchObject({ workspaceId: workspace.id, organizationId: null, projectId: null });
      await expect(svc.rbac.hasPermission(target.id, 'project.read', { organizationId: organization.id, workspaceId: workspace.id })).resolves.toBe(true);
      await expect(svc.rbac.hasPermission(target.id, 'project.update', { organizationId: organization.id, workspaceId: workspace.id })).resolves.toBe(false);

      await expectCode(svc.rbac.createAssignment(admin.id, dto), 'ROLE_ASSIGNMENT_EXISTS');

      const adminOwnGrant = await prisma.roleAssignment.findFirstOrThrow({ where: { userId: admin.id, revokedAt: null } });
      await expectCode(svc.rbac.revokeAssignment(admin.id, adminOwnGrant.id), 'SELF_REVOCATION_NOT_ALLOWED');

      const revoked = await svc.rbac.revokeAssignment(admin.id, assignment.id);
      expect(revoked.revokedAt).toBeInstanceOf(Date);
      expect(revoked.revokedBy).toBe(admin.id);
      await expect(svc.rbac.hasPermission(target.id, 'project.read', { workspaceId: workspace.id })).resolves.toBe(false);
      await expectCode(svc.rbac.revokeAssignment(admin.id, assignment.id), 'ROLE_ASSIGNMENT_NOT_FOUND');

      const events = await prisma.auditLog.findMany({ where: { targetId: assignment.id }, orderBy: { createdAt: 'asc' } });
      expect(events.map((e) => e.eventType)).toEqual(['access.assignment.create', 'access.assignment.revoke']);

      // Re-granting after revocation is allowed (partial unique index only covers active rows).
      await expect(svc.rbac.createAssignment(admin.id, dto)).resolves.toBeTruthy();
    });

    it('a project-scoped assignment covers only that project', async () => {
      const admin = await superAdmin();
      const { owner, organization, workspace } = await onboard('pscope');
      const a = await svc.projects.create(owner.id, { workspaceId: workspace.id, name: 'A' });
      const b = await svc.projects.create(owner.id, { workspaceId: workspace.id, name: 'B' });
      const target = await createUser(prisma);
      await addWorkspaceMember(prisma, target.id, workspace.id, organization.id);
      const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });
      await svc.rbac.createAssignment(admin.id, { userId: target.id, roleId: member.id, scopeType: ScopeType.PROJECT, projectId: a.id });

      await expect(svc.projects.getAccessible(target.id, a.id)).resolves.toMatchObject({ id: a.id });
      await expectCode(svc.projects.getAccessible(target.id, b.id), 'PERMISSION_DENIED');
      const listed = await svc.projects.listAccessible(target.id);
      expect(listed.map((p) => p.id)).toEqual([a.id]);
    });

    it('custom roles: only permissions the creator holds; unknown keys rejected', async () => {
      const admin = await superAdmin();
      await expectCode(
        svc.rbac.createRole(admin.id, { key: uniq('BAD'), name: 'Bad', permissionKeys: ['does.not.exist'] }),
        'UNKNOWN_PERMISSIONS',
      );
      const { owner } = await onboard('role-maker');
      await expectCode(
        svc.rbac.createRole(owner.id, { key: uniq('X'), name: 'X', permissionKeys: ['project.read'] }),
        'PERMISSION_DENIED',
      );
      const key = uniq('qa reviewer');
      const role = await svc.rbac.createRole(admin.id, { key, name: 'QA', permissionKeys: ['project.read'] });
      expect(role.key).toBe(key.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
      expect(role.isSystem).toBe(false);
    });
  });

  async function superAdmin() {
    const admin = await createUser(prisma, 'super');
    await grantGlobal(prisma, admin.id, 'SUPER_ADMIN');
    return admin;
  }
});
