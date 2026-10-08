import { grantGlobal } from './helpers';
import { startApp, SYNC_SECRET } from './app-harness';

describe('Platform settings enforcement', () => {
  let h: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    h = await startApp();
  });

  afterAll(async () => {
    await h.prisma.systemSetting.deleteMany({ where: { key: { in: ['platform.general', 'platform.security'] } } });
    await h?.close();
  });

  const as = (bearer: string) => ({ authorization: bearer });

  async function admin(label: string) {
    const u = await h.provision(label);
    await grantGlobal(h.prisma, u.id, 'SUPER_ADMIN');
    return u;
  }

  it('maintenance mode refuses product requests except from platform operators', async () => {
    const operator = await admin('maint-admin');
    const customer = await h.onboard('maint-customer');
    await h.api().put('/api/v1/admin/settings/platform.general').set(as(operator.bearer)).send({ value: { maintenanceMode: true, maintenanceMessage: 'Back at noon.' } }).expect(200);

    const refused = await h.api().get('/api/v1/user/projects').set(as(customer.user.bearer)).expect(503);
    expect(refused.body.error).toMatchObject({ code: 'MAINTENANCE', message: 'Back at noon.' });
    await h.api().get('/api/v1/user/projects').set(as(operator.bearer)).expect(200);
    const info = await h.api().get('/api/v1/public/platform').expect(200);
    expect(info.body.data.maintenance).toEqual({ enabled: true, message: 'Back at noon.' });

    await h.api().put('/api/v1/admin/settings/platform.general').set(as(operator.bearer)).send({ value: { maintenanceMode: false } }).expect(200);
    await h.api().get('/api/v1/user/projects').set(as(customer.user.bearer)).expect(200);
  });

  it('requires two-factor authentication for the admin console when configured', async () => {
    const operator = await admin('mfa-admin');
    await h.api().put('/api/v1/admin/settings/platform.security').set(as(operator.bearer)).send({ value: { requireAdminMfa: true } }).expect(200);

    const refused = await h.api().get('/api/v1/admin/users').set(as(operator.bearer)).expect(403);
    expect(refused.body.error.code).toBe('MFA_REQUIRED');
    const withMfa = `Bearer ${await h.token(operator.authSubject, { twoFactorEnabled: true })}`;
    await h.api().get('/api/v1/admin/users').set(as(withMfa)).expect(200);
    // Product routes are unaffected.
    await h.api().get('/api/v1/user/me').set(as(operator.bearer)).expect(200);

    await h.api().put('/api/v1/admin/settings/platform.security').set(as(withMfa)).send({ value: { requireAdminMfa: false } }).expect(200);
    await h.api().get('/api/v1/admin/users').set(as(operator.bearer)).expect(200);
  });

  it('closes sign-up to everyone except invited people', async () => {
    const operator = await admin('signup-admin');
    const owner = await h.onboard('signup-owner');
    const check = (email: string) => h.api().post('/api/v1/internal/auth/users/can-register').set('x-auth-sync-secret', SYNC_SECRET).send({ email }).expect(200);
    await h.api().post('/api/v1/internal/auth/users/can-register').send({ email: 'x@example.test' }).expect(401);

    expect((await check('new-person@example.test')).body.data.allowed).toBe(true);
    await h.api().put('/api/v1/admin/settings/platform.general').set(as(operator.bearer)).send({ value: { allowSignup: false } }).expect(200);
    expect((await check('new-person@example.test')).body.data.allowed).toBe(false);
    await h.api().post(`/api/v1/user/workspaces/${owner.workspaceId}/invitations`).set(as(owner.user.bearer)).send({ email: 'invited-person@example.test', roleKey: 'MEMBER' }).expect(201);
    expect((await check('Invited-Person@example.test')).body.data.allowed).toBe(true);
    expect((await h.api().get('/api/v1/public/platform').expect(200)).body.data.allowSignup).toBe(false);

    await h.api().put('/api/v1/admin/settings/platform.general').set(as(operator.bearer)).send({ value: { allowSignup: true } }).expect(200);
  });

  it('authorizes and audits session revocation, and reports permissions', async () => {
    const operator = await admin('sess-admin');
    const target = await h.provision('sess-target');
    const me = await h.api().get('/api/v1/admin/me').set(as(operator.bearer)).expect(200);
    expect(me.body.data.roles).toContain('SUPER_ADMIN');
    expect(me.body.data.permissions).toContain('user.manage');

    await h.api().post(`/api/v1/admin/users/${target.id}/sessions/revoke`).set(as(target.bearer)).send({ reason: 'not allowed' }).expect(403);
    const res = await h.api().post(`/api/v1/admin/users/${target.id}/sessions/revoke`).set(as(operator.bearer)).send({ reason: 'Lost laptop' }).expect(201);
    expect(res.body.data.authSubject).toBe(target.authSubject);
    const log = await h.prisma.auditLog.findFirstOrThrow({ where: { eventType: 'user.sessions.revoke_all', targetId: target.id } });
    expect(log.reason).toBe('Lost laptop');
  });
});
