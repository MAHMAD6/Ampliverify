import { RetentionService } from '../../src/retention/retention.service';
import { startApp } from './app-harness';

const DAY = 86_400_000;

describe('Data retention', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let retention: RetentionService;

  beforeAll(async () => {
    h = await startApp({ PROJECT_PURGE_GRACE_DAYS: '30' });
    retention = h.app.get(RetentionService);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('purges projects deleted past the grace period, keeping recently deleted ones', async () => {
    const owner = await h.onboard('ret-owner', { domain: 'example.test' });
    const recent = await h.api().post('/api/v1/user/projects').set('authorization', owner.user.bearer).send({ workspaceId: owner.workspaceId, name: 'recent' }).expect(201);
    await h.api().delete(`/api/v1/user/projects/${owner.projectId}`).set('authorization', owner.user.bearer).expect(200);
    await h.api().delete(`/api/v1/user/projects/${recent.body.data.id}`).set('authorization', owner.user.bearer).expect(200);
    // Age the first deletion beyond the grace period.
    await h.prisma.project.update({ where: { id: owner.projectId }, data: { deletedAt: new Date(Date.now() - 31 * DAY) } });

    await retention.purgeDeletedProjects();
    expect(await h.prisma.project.findUnique({ where: { id: owner.projectId } })).toBeNull();
    expect(await h.prisma.project.findUnique({ where: { id: recent.body.data.id } })).not.toBeNull();
    const log = await h.prisma.auditLog.findFirstOrThrow({ where: { eventType: 'project.purge', targetId: owner.projectId } });
    expect(log.actorRole).toBe('system');
  });

  it('removes data older than the workspace retention period but keeps the latest audit', async () => {
    const owner = await h.onboard('ret-ws', { domain: 'example.test' });
    await h.api().patch(`/api/v1/user/workspaces/${owner.workspaceId}`).set('authorization', owner.user.bearer).send({ settings: { privacy: { retentionDays: 30 } } }).expect(200);
    const old = new Date(Date.now() - 60 * DAY);
    const mk = (startedAt: Date, completedAt: Date) => h.prisma.auditRun.create({ data: { projectId: owner.projectId, status: 'SUCCEEDED', trigger: 'MANUAL', startedAt, completedAt } });
    const older = await mk(new Date(old.getTime() - DAY), new Date(old.getTime() - DAY));
    const latestOld = await mk(old, old);
    const fresh = await mk(new Date(), new Date());

    await retention.applyWorkspaceRetention();
    const left = (await h.prisma.auditRun.findMany({ where: { projectId: owner.projectId } })).map((a) => a.id);
    expect(left).toContain(fresh.id);
    expect(left).not.toContain(older.id);
    // latestOld is older than the cutoff but is not the latest completed run, so it goes too.
    expect(left).not.toContain(latestOld.id);

    // With only old runs, the most recent completed one is kept.
    await h.prisma.auditRun.delete({ where: { id: fresh.id } });
    const a = await mk(new Date(old.getTime() - 2 * DAY), new Date(old.getTime() - 2 * DAY));
    const b = await mk(old, old);
    await retention.applyWorkspaceRetention();
    const remaining = (await h.prisma.auditRun.findMany({ where: { projectId: owner.projectId } })).map((x) => x.id);
    expect(remaining).toEqual([b.id]);
    expect(remaining).not.toContain(a.id);
  });
});
