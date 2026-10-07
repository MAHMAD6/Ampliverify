import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { EmailService } from './email.service';

/** Notification events users can configure (Settings → Notifications). */
export const NOTIFICATION_EVENTS = [
  { key: 'audit.completed', label: 'Audit completed', description: 'An SEO / GEO audit you started has finished.', defaultEmail: true },
  { key: 'audit.failed', label: 'Audit failed', description: 'An audit could not be completed.', defaultEmail: true },
  { key: 'verification.completed', label: 'Fix verified', description: 'A verification re-check finished.', defaultEmail: false },
  { key: 'geo.check_completed', label: 'AI search check completed', description: 'A GEO prompt check finished.', defaultEmail: false },
  { key: 'report.ready', label: 'Report ready', description: 'A report finished generating.', defaultEmail: true },
  { key: 'credits.low', label: 'Low credits', description: 'Your workspace credit balance is running low.', defaultEmail: true },
  { key: 'billing.payment_failed', label: 'Payment failed', description: 'A subscription payment did not go through.', defaultEmail: true },
  { key: 'billing.invoice_paid', label: 'Invoice paid', description: 'A payment was received.', defaultEmail: false },
  { key: 'workspace.member_joined', label: 'Member joined', description: 'Someone joined your workspace.', defaultEmail: false },
  { key: 'task.assigned', label: 'Task assigned', description: 'An optimization task was assigned to you.', defaultEmail: true },
] as const;

export type NotifyInput = { workspaceId: string; userId: string; eventKey: string; title: string; body: string };

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    this.jobs.register('notification.email', async (payload) => this.deliverEmail(String(payload.deliveryId)));
  }

  private async channelEnabled(input: NotifyInput, channel: NotificationChannel) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { workspaceId_userId_eventKey_channel: { workspaceId: input.workspaceId, userId: input.userId, eventKey: input.eventKey, channel } },
    });
    if (pref) return pref.enabled;
    if (channel === 'IN_APP') return true;
    return NOTIFICATION_EVENTS.find((e) => e.key === input.eventKey)?.defaultEmail ?? false;
  }

  /** In-app notification (unless disabled) plus a queued email delivery when enabled. */
  async notify(input: NotifyInput) {
    const [inApp, email] = await Promise.all([this.channelEnabled(input, 'IN_APP'), this.channelEnabled(input, 'EMAIL')]);
    if (!inApp && !email) return null;
    const notification = await this.prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        eventKey: input.eventKey,
        title: input.title,
        body: input.body,
        // Email-only notifications are created already read so they stay out of the bell.
        readAt: inApp ? null : new Date(),
      },
    });
    if (email) {
      const delivery = await this.prisma.notificationDelivery.create({ data: { notificationId: notification.id, channel: 'EMAIL' } });
      await this.jobs.enqueue('notification.email', { deliveryId: delivery.id }, { jobKey: `email:${delivery.id}` });
    }
    return notification;
  }

  private async deliverEmail(deliveryId: string) {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: { notification: { include: { user: true } } },
    });
    if (!delivery || delivery.status !== 'QUEUED') return;
    if (!this.email.configured) {
      await this.prisma.notificationDelivery.update({ where: { id: deliveryId }, data: { status: 'FAILED' } });
      return;
    }
    const { notification } = delivery;
    const result = await this.email.send({
      to: notification.user.email,
      subject: notification.title,
      text: `${notification.body}\n\n— AmpliVerify`,
    });
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', providerMessageId: result.id, attemptedAt: new Date() },
    });
  }

  list(userId: string, opts: { unread?: boolean; limit?: number } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unread ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(opts.limit ?? 50, 1), 200),
      select: { id: true, workspaceId: true, eventKey: true, title: true, body: true, readAt: true, createdAt: true },
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
    return this.prisma.notification.update({ where: { id }, data: { readAt: n.readAt ?? new Date() } });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: count };
  }

  async preferences(userId: string, workspaceId: string) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId, workspaceId } });
    return NOTIFICATION_EVENTS.map((e) => ({
      eventKey: e.key,
      label: e.label,
      description: e.description,
      inApp: rows.find((r) => r.eventKey === e.key && r.channel === 'IN_APP')?.enabled ?? true,
      email: rows.find((r) => r.eventKey === e.key && r.channel === 'EMAIL')?.enabled ?? e.defaultEmail,
    }));
  }

  async setPreferences(userId: string, workspaceId: string, prefs: { eventKey: string; inApp?: boolean; email?: boolean }[]) {
    const known = new Set<string>(NOTIFICATION_EVENTS.map((e) => e.key));
    await this.prisma.$transaction(
      prefs
        .filter((p) => known.has(p.eventKey))
        .flatMap((p) =>
          (
            [
              ['IN_APP', p.inApp],
              ['EMAIL', p.email],
            ] as const
          )
            .filter(([, v]) => v !== undefined)
            .map(([channel, enabled]) =>
              this.prisma.notificationPreference.upsert({
                where: { workspaceId_userId_eventKey_channel: { workspaceId, userId, eventKey: p.eventKey, channel } },
                create: { workspaceId, userId, eventKey: p.eventKey, channel, enabled: !!enabled },
                update: { enabled: !!enabled },
              }),
            ),
        ),
    );
    return this.preferences(userId, workspaceId);
  }
}
