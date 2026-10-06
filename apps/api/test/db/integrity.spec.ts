import { randomUUID } from 'crypto';
import { Prisma, PrismaClient, ScopeType } from '@prisma/client';
import { createPrisma, createServices, createUser, uniq } from './helpers';

/** Rules enforced by PostgreSQL itself, independent of application code. */
describe('database-enforced integrity', () => {
  let prisma: PrismaClient;
  let svc: ReturnType<typeof createServices>;

  beforeAll(() => {
    prisma = createPrisma();
    svc = createServices(prisma);
  });
  afterAll(() => prisma.$disconnect());

  async function tenant() {
    const owner = await createUser(prisma);
    const { organization, workspace } = await svc.organizations.createOrganization(owner.id, { name: uniq('org') });
    return { owner, organization, workspace };
  }

  it('audit_logs reject UPDATE and DELETE', async () => {
    const row = await svc.audit.record({ action: 'test.event', targetType: 'test' });
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { eventType: 'tampered' } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });

  it('a project cannot point at a workspace from another organization (composite FK)', async () => {
    const a = await tenant();
    const b = await tenant();
    await expect(
      prisma.project.create({
        data: {
          organizationId: b.organization.id,
          workspaceId: a.workspace.id,
          name: 'x',
          slug: uniq('x'),
          createdBy: a.owner.id,
        },
      }),
    ).rejects.toThrow(/Foreign key constraint/);
  });

  it('role_assignments enforce scope shape, single active copy and revoke-only updates', async () => {
    const { owner, workspace } = await tenant();
    const member = await prisma.role.findUniqueOrThrow({ where: { key: 'MEMBER' } });
    const base = { userId: owner.id, roleId: member.id, createdBy: owner.id };

    await expect(
      prisma.roleAssignment.create({ data: { ...base, scopeType: ScopeType.GLOBAL, workspaceId: workspace.id } }),
    ).rejects.toThrow(/ck_role_assignments_scope/);

    const assignment = await prisma.roleAssignment.create({
      data: { ...base, scopeType: ScopeType.WORKSPACE, workspaceId: workspace.id },
    });
    await expect(
      prisma.roleAssignment.create({ data: { ...base, scopeType: ScopeType.WORKSPACE, workspaceId: workspace.id } }),
    ).rejects.toThrow(/Unique constraint/);

    await expect(
      prisma.roleAssignment.update({ where: { id: assignment.id }, data: { scopeType: ScopeType.GLOBAL, workspaceId: null } }),
    ).rejects.toThrow(/only be revoked once/);

    await prisma.roleAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date(), revokedBy: owner.id } });
    await expect(
      prisma.roleAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } }),
    ).rejects.toThrow(/only be revoked once/);
  });

  describe('credit ledger', () => {
    it('is append-only, idempotent and keeps the wallet cache reconciled', async () => {
      const { workspace } = await tenant();
      const wallet = await prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: workspace.id } });
      const key = uniq('grant');

      const entry = await prisma.creditLedger.create({
        data: { walletId: wallet.id, delta: new Prisma.Decimal('100.5'), reason: 'PLAN_GRANT', idempotencyKey: key },
      });
      await prisma.creditLedger.create({
        data: { walletId: wallet.id, delta: new Prisma.Decimal('-20.25'), reason: 'USAGE', idempotencyKey: uniq('use') },
      });

      // A retried request with the same idempotency key cannot double-credit.
      await expect(
        prisma.creditLedger.create({
          data: { walletId: wallet.id, delta: new Prisma.Decimal('100.5'), reason: 'PLAN_GRANT', idempotencyKey: key },
        }),
      ).rejects.toThrow(/Unique constraint/);

      await expect(prisma.creditLedger.update({ where: { id: entry.id }, data: { delta: 1 } })).rejects.toThrow(/append-only/);
      await expect(prisma.creditLedger.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
      await expect(
        prisma.creditLedger.create({ data: { walletId: wallet.id, delta: 0, reason: 'USAGE', idempotencyKey: uniq('z') } }),
      ).rejects.toThrow(/ck_credit_ledger_delta_nonzero/);

      const [{ sum }] = await prisma.$queryRaw<{ sum: Prisma.Decimal }[]>`
        SELECT COALESCE(SUM(delta), 0) AS sum FROM credit_ledger WHERE wallet_id = ${wallet.id}::uuid`;
      const refreshed = await prisma.creditWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(refreshed.balanceCache.toString()).toBe('80.25');
      expect(refreshed.balanceCache.equals(sum)).toBe(true);
    });

    it('credit adjustments cannot be self-approved', async () => {
      const { owner, workspace } = await tenant();
      await expect(
        prisma.creditAdjustment.create({
          data: {
            workspaceId: workspace.id,
            type: 'CREDIT',
            amount: 10,
            reasonCode: 'GOODWILL',
            internalNote: 'test',
            requestedBy: owner.id,
            approvedBy: owner.id,
          },
        }),
      ).rejects.toThrow(/ck_credit_adjustments_no_self_approval/);
    });
  });

  it('plan_prices allow only one active price per plan/interval/currency', async () => {
    const plan = await prisma.plan.create({ data: { code: uniq('plan'), name: 'Test plan' } });
    const price = { planId: plan.id, billingInterval: 'MONTHLY' as const, currency: 'USD', amountMinor: 1000n };
    await prisma.planPrice.create({ data: price });
    await expect(prisma.planPrice.create({ data: price })).rejects.toThrow(/Unique constraint/);
    await expect(prisma.planPrice.create({ data: { ...price, active: false } })).resolves.toBeTruthy();
    await expect(prisma.planPrice.create({ data: { ...price, currency: 'usd' } })).rejects.toThrow(/ck_plan_prices_currency/);
  });

  describe('job applications', () => {
    const applicant = () => ({ firstName: 'A', lastName: 'B', email: `${uniq('a')}@example.test` });

    async function job(data: Partial<Prisma.JobOpeningCreateInput>) {
      return prisma.jobOpening.create({
        data: { title: 'Role', slug: uniq('role'), employmentType: 'FULL_TIME', descriptionRef: 'ref', ...data },
      });
    }

    it('are rejected unless the job is published, live and before its deadline', async () => {
      const draft = await job({});
      await expect(prisma.jobApplication.create({ data: { jobId: draft.id, ...applicant() } })).rejects.toThrow(/not accepting applications/);

      const future = await job({ status: 'PUBLISHED', publishedAt: new Date(Date.now() + 86_400_000) });
      await expect(prisma.jobApplication.create({ data: { jobId: future.id, ...applicant() } })).rejects.toThrow(/not accepting applications/);

      const expired = await job({ status: 'PUBLISHED', publishedAt: new Date(), applicationDeadline: new Date(Date.now() - 1000) });
      await expect(prisma.jobApplication.create({ data: { jobId: expired.id, ...applicant() } })).rejects.toThrow(/not accepting applications/);

      const open = await job({ status: 'PUBLISHED', publishedAt: new Date(Date.now() - 1000) });
      await expect(prisma.jobApplication.create({ data: { jobId: open.id, ...applicant() } })).resolves.toBeTruthy();
    });

    it('published content must carry published_at', async () => {
      await expect(job({ status: 'PUBLISHED' })).rejects.toThrow(/ck_job_openings_published_at/);
    });
  });

  it('webhook events are unique per provider event id', async () => {
    const data = { provider: 'stripe', providerEventId: randomUUID(), eventType: 'invoice.paid', payloadRef: 'ref' };
    await prisma.webhookEvent.create({ data });
    await expect(prisma.webhookEvent.create({ data })).rejects.toThrow(/Unique constraint/);
  });
});
