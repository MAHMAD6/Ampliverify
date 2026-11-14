import { startApp } from './app-harness';
import { grantGlobal } from './helpers';

describe('Webhook diagnostics', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let admin: { authorization: string };
  let user: { authorization: string };

  beforeAll(async () => {
    h = await startApp();
    const a = await h.provision('wh-admin');
    await grantGlobal(h.prisma, a.id, 'SUPER_ADMIN');
    admin = { authorization: a.bearer };
    user = { authorization: (await h.provision('wh-user')).bearer };
  });
  afterAll(async () => {
    await h?.close();
  });

  it('lists deliveries for staff only and retries failed ones once', async () => {
    const event = { id: `evt_diag_${Date.now()}`, type: 'diagnostics.test', data: { object: { id: 'obj_1' } } };
    const failed = await h.prisma.webhookEvent.create({ data: { provider: 'stripe', providerEventId: event.id, eventType: event.type, payloadRef: JSON.stringify(event), status: 'FAILED', attemptCount: 1, lastError: 'Error: boom' } });
    const noPayload = await h.prisma.webhookEvent.create({ data: { provider: 'stripe', providerEventId: `${event.id}_ref`, eventType: 'checkout.session.completed', payloadRef: 'cs_123', status: 'FAILED', attemptCount: 1 } });

    await h.api().get('/api/v1/admin/webhooks').expect(401);
    await h.api().get('/api/v1/admin/webhooks').set(user).expect(403);
    const d = (await h.api().get('/api/v1/admin/webhooks?status=FAILED').set(admin).expect(200)).body.data;
    expect(d.events.map((e: { id: string }) => e.id)).toEqual(expect.arrayContaining([failed.id, noPayload.id]));
    expect(d.last7Days.FAILED).toBeGreaterThanOrEqual(2);
    // Payloads never leave the server.
    expect(JSON.stringify(d)).not.toContain('payloadRef');

    await h.api().post(`/api/v1/admin/webhooks/${failed.id}/retry`).set(user).expect(403);
    await h.api().post(`/api/v1/admin/webhooks/${noPayload.id}/retry`).set(admin).expect(400);
    await h.api().post(`/api/v1/admin/webhooks/${failed.id}/retry`).set(admin).expect(201);
    await h.api().post(`/api/v1/admin/webhooks/${failed.id}/retry`).set(admin).expect(400); // already queued
    await h.jobs.drain(['billing.webhook']);

    const row = await h.prisma.webhookEvent.findUniqueOrThrow({ where: { id: failed.id } });
    expect(row).toMatchObject({ status: 'IGNORED', attemptCount: 2, lastError: null });
    expect(await h.prisma.auditLog.count({ where: { eventType: 'webhook.retry', targetId: failed.id } })).toBe(1);
  });
});
