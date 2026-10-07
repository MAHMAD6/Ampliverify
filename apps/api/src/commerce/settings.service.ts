import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';

/** Typed access to `system_settings` (platform configuration edited in Super Admin). */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T, db: Db = this.prisma): Promise<T> {
    const row = await db.systemSetting.findUnique({ where: { key } });
    return row ? (row.valueJson as T) : fallback;
  }

  set(key: string, value: Prisma.InputJsonValue, updatedBy: string | null, db: Db = this.prisma) {
    return db.systemSetting.upsert({
      where: { key },
      create: { key, valueJson: value, updatedBy },
      update: { valueJson: value, updatedBy },
    });
  }

  list() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }
}

/** Setting keys used across modules. */
export const SETTING = {
  /** `{ [featureKey]: credits }` charged per unit of usage. Missing or 0 = free. */
  creditCosts: 'credits.costs',
  /** Plan code applied to workspaces without an active subscription. Unset = no plan limits. */
  defaultPlanCode: 'billing.default_plan_code',
  /** Credits granted to a new workspace on creation. */
  signupCredits: 'credits.signup_grant',
  /** Purchasable credit packs: `[{ code, credits, amountMinor, currency }]`. */
  creditPacks: 'credits.packs',
  general: 'platform.general',
  notifications: 'platform.notifications',
  security: 'platform.security',
  appearance: 'platform.appearance',
} as const;
