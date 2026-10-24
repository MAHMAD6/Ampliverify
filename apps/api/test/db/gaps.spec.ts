import { EntitlementsService } from '../../src/commerce/entitlements.service';
import { RetentionService } from '../../src/retention/retention.service';
import { grantGlobal } from './helpers';
import { startApp } from './app-harness';

describe('Hybrid pricing and Google data rules', () => {
  let h: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40) });
  });
  afterAll(async () => {
    await h?.close();
  });

  it('keeps paid access during the payment grace period, then falls back', async () => {
    const { workspaceId } = await h.onboard('grace');
    const plan = await h.prisma.plan.create({ data: { code: `paid-${Date.now()}`, name: 'Paid', status: 'ACTIVE' } });
    const feature = await h.prisma.feature.findUniqueOrThrow({ where: { key: 'limit.audit_runs' } });
    await h.prisma.planEntitlement.create({ data: { planId: plan.id, featureId: feature.id, enabled: true, limitNumeric: 999 } });
    const sub = await h.prisma.subscription.create({ data: { workspaceId, planId: plan.id, status: 'PAST_DUE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000), pastDueSince: new Date(Date.now() - 2 * 86_400_000) } });
    const ent = h.app.get(EntitlementsService);
    const within = await ent.resolve(workspaceId);
    expect(within.planCode).toBe(plan.code);
    expect(within.graceEndsAt).toBeInstanceOf(Date);
    await h.prisma.subscription.update({ where: { id: sub.id }, data: { pastDueSince: new Date(Date.now() - 10 * 86_400_000) } });
    const after = await ent.resolve(workspaceId);
    expect(after.planCode).not.toBe(plan.code);
    expect(after.subscriptionStatus).toBe('PAST_DUE');
  });

  it('records an immutable entitlement version on every plan change', async () => {
    const admin = await h.provision('ent-admin');
    await grantGlobal(h.prisma, admin.id, 'SUPER_ADMIN');
    const code = `ver-${Date.now()}`;
    await h.api().post('/api/v1/admin/plans').set({ authorization: admin.bearer }).send({ code, name: 'Versioned', status: 'DRAFT' }).expect(201);
    for (const limit of [10, 20]) {
      await h.api().put(`/api/v1/admin/plans/${code}/entitlements`).set({ authorization: admin.bearer }).send({ entitlements: [{ featureKey: 'limit.audit_runs', enabled: true, limit }] }).expect(200);
    }
    const res = await h.api().get(`/api/v1/admin/plans/${code}/entitlement-versions`).set({ authorization: admin.bearer }).expect(200);
    const versions = res.body.data as { version: number; entitlements: { key: string; limit: string }[] }[];
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0].entitlements.find((e) => e.key === 'limit.audit_runs')!.limit).toBe('20');
    await expect(h.prisma.planEntitlementVersion.updateMany({ where: { planId: (await h.prisma.plan.findUniqueOrThrow({ where: { code } })).id }, data: { version: 99 } })).rejects.toThrow();
  });

  it('purges synced Google metrics after a connection has been disconnected for the retention period', async () => {
    const { user, workspaceId, projectId } = await h.onboard('google-retention', { domain: 'retain.test' });
    const me = await h.prisma.user.findFirstOrThrow({ where: { authSubject: user.authSubject } });
    const provider = await h.prisma.integrationProvider.findUniqueOrThrow({ where: { key: 'google_search_console' } });
    const integ = await h.prisma.workspaceIntegration.create({ data: { workspaceId, providerId: provider.id, status: 'DISCONNECTED', connectedBy: me.id } });
    const ds = await h.prisma.projectDataSource.create({ data: { projectId, workspaceIntegrationId: integ.id, sourceType: 'GOOGLE_SEARCH_CONSOLE', status: 'DISCONNECTED', configJson: { propertyId: 'sc-domain:retain.test' } } });
    await h.prisma.googleMetric.create({ data: { dataSourceId: ds.id, projectId, source: 'GSC', propertyId: 'sc-domain:retain.test', date: new Date('2026-10-01'), dimension: 'date', clicks: 1, impressions: 2 } });
    const retention = h.app.get(RetentionService);
    expect(await retention.purgeDisconnectedGoogleData(new Date())).toBe(0);
    expect(await retention.purgeDisconnectedGoogleData(new Date(Date.now() + 31 * 86_400_000))).toBeGreaterThanOrEqual(1);
    expect(await h.prisma.googleMetric.count({ where: { dataSourceId: ds.id } })).toBe(0);
  });

  it('includes attributed Search Console data in reports, with an honest empty state', async () => {
    const { user, projectId } = await h.onboard('google-report', { domain: 'report.test' });
    const auth = { authorization: user.bearer };
    const r = await h.api().post(`/api/v1/user/projects/${projectId}/reports`).set(auth).send({ type: 'KEYWORD', title: 'Keywords' }).expect(201);
    await h.jobs.drain(['report.generate']);
    const report = await h.api().get(`/api/v1/user/reports/${r.body.data.id}`).set(auth).expect(200);
    const gsc = (report.body.data.sections as { payload: { title: string; empty?: string } }[]).map((s) => s.payload).find((p) => p.title === 'Google Search Console');
    expect(gsc?.empty).toBe('Google Search Console is not connected to this project.');
  });
});
