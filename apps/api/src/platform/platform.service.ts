import { Injectable, Logger } from '@nestjs/common';
import { SettingsService, SETTING } from '../commerce/settings.service';
import { EmailService } from '../notifications/email.service';
import { PrismaService } from '../prisma/prisma.service';

/** Shapes of the platform.* settings edited in Super Admin → Settings. Every field is optional; unset = default. */
export type GeneralSettings = {
  platformName?: string;
  platformUrl?: string;
  supportEmail?: string;
  defaultTimezone?: string;
  defaultLanguage?: string;
  allowSignup?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  lowCreditThreshold?: number;
};
export type SecuritySettings = { requireAdminMfa?: boolean; allowPasskeys?: boolean; invitationExpiryDays?: number };
export type StaffAlertKind = 'contact' | 'support' | 'application' | 'payment_failed' | 'incident';
export type NotificationSettings = { staffEmails?: string[]; alerts?: Partial<Record<StaffAlertKind, boolean>> };

const TTL_MS = 10_000;

/**
 * Reads the platform settings that change runtime behavior (maintenance
 * mode, sign-up, admin MFA, defaults) with a short cache, and sends staff
 * alerts to the configured recipients.
 */
@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  private cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  private async read<T>(key: string): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
    const value = ((await this.settings.get<T | null>(key, null)) ?? {}) as T;
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Drops cached values (after an admin saves a setting). */
  invalidate(key?: string) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  general() {
    return this.read<GeneralSettings>(SETTING.general);
  }
  security() {
    return this.read<SecuritySettings>(SETTING.security);
  }
  notifications() {
    return this.read<NotificationSettings>(SETTING.notifications);
  }

  /** Safe, public subset for the website and sign-in pages. */
  async publicInfo() {
    const [g, s] = await Promise.all([this.general(), this.security()]);
    return {
      platformName: g.platformName?.trim() || 'AmpliVerify',
      platformUrl: g.platformUrl?.trim() || null,
      supportEmail: g.supportEmail?.trim() || null,
      allowSignup: g.allowSignup !== false,
      allowPasskeys: s.allowPasskeys !== false,
      maintenance: { enabled: g.maintenanceMode === true, message: g.maintenanceMessage?.trim() || null },
    };
  }

  /** Whether a new account may be created for this email (sign-up closed still admits invited people). */
  async canRegister(email: string) {
    const g = await this.general();
    if (g.allowSignup !== false) return true;
    const normalized = email.trim().toLowerCase();
    const [existing, invited] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: normalized }, select: { id: true } }),
      this.prisma.workspaceInvitation.findFirst({ where: { email: normalized, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } }),
    ]);
    return !!existing || !!invited;
  }

  async invitationTtlDays() {
    const days = Number((await this.security()).invitationExpiryDays);
    return Number.isFinite(days) && days >= 1 && days <= 90 ? Math.round(days) : 7;
  }

  /** Emails staff about an operational event when alerts for it are on (default on) and recipients exist. */
  async alertStaff(kind: StaffAlertKind, subject: string, text: string) {
    try {
      const [n, g] = await Promise.all([this.notifications(), this.general()]);
      if (n.alerts?.[kind] === false || !this.email.configured) return;
      const to = [...new Set([...(n.staffEmails ?? []), ...(g.supportEmail ? [g.supportEmail] : [])].map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e)))];
      for (const address of to) await this.email.send({ to: address, subject: `[AmpliVerify] ${subject}`, text });
    } catch (err) {
      this.logger.warn(`Staff alert (${kind}) failed: ${err}`);
    }
  }
}
