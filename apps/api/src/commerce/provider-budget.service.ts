import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING, SettingsService } from './settings.service';

/**
 * `providers.budgets` setting: monthly USD ceilings per provider plus an alert
 * threshold. OpenAI spend is estimated from recorded tokens using the
 * configured per-million-token prices.
 */
export type ProviderBudgets = {
  dataforseo?: number;
  openai?: number;
  /** Warn staff when spend passes this share of a ceiling (default 80). */
  alertPct?: number;
  openaiUsdPer1MInput?: number;
  openaiUsdPer1MOutput?: number;
};

const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/**
 * Provider budget ceilings (Hybrid guide §7): a provider call is refused once
 * the month's recorded spend reaches its ceiling, and staff are alerted once
 * per month when spend passes the alert threshold.
 */
@Injectable()
export class ProviderBudgetService {
  private readonly logger = new Logger(ProviderBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Month-to-date spend in USD per provider (DataForSEO from reported cost, OpenAI estimated from tokens). */
  async spend(from = monthStart()) {
    const b = await this.settings.get<ProviderBudgets>(SETTING.providerBudgets, {});
    const rows = await this.prisma.providerUsage.groupBy({ by: ['provider'], where: { createdAt: { gte: from } }, _sum: { costMinor: true, inputUnits: true, outputUnits: true } });
    const out: Record<string, number> = {};
    for (const r of rows) {
      let usd = Number(r._sum.costMinor ?? 0) / 100;
      if (r.provider === 'openai' && (b.openaiUsdPer1MInput || b.openaiUsdPer1MOutput)) {
        usd += (Number(r._sum.inputUnits ?? 0) / 1e6) * (b.openaiUsdPer1MInput ?? 0) + (Number(r._sum.outputUnits ?? 0) / 1e6) * (b.openaiUsdPer1MOutput ?? 0);
      }
      out[r.provider] = Math.round(usd * 100) / 100;
    }
    return out;
  }

  async status() {
    const b = await this.settings.get<ProviderBudgets>(SETTING.providerBudgets, {});
    const spend = await this.spend();
    return (['dataforseo', 'openai'] as const).map((p) => ({ provider: p, spendUsd: spend[p] ?? 0, ceilingUsd: b[p] ?? null, pct: b[p] ? Math.round(((spend[p] ?? 0) / b[p]!) * 100) : null }));
  }

  async assertWithinBudget(provider: 'dataforseo' | 'openai') {
    const b = await this.settings.get<ProviderBudgets>(SETTING.providerBudgets, {});
    const ceiling = b[provider];
    if (!ceiling || ceiling <= 0) return;
    const spent = (await this.spend())[provider] ?? 0;
    if (spent >= ceiling) {
      await this.alertOnce(provider, 'reached', `Provider budget reached: ${provider}`, `Month-to-date ${provider} spend is $${spent.toFixed(2)} of the $${ceiling} ceiling. New ${provider} requests are paused until next month or until the ceiling is raised in Super Admin → Settings.`);
      throw new ServiceUnavailableException({ code: 'PROVIDER_BUDGET_REACHED', message: 'This feature is temporarily unavailable. Please try again later.' });
    }
    if (spent >= (ceiling * (b.alertPct ?? 80)) / 100) {
      await this.alertOnce(provider, 'warning', `Provider budget at ${Math.round((spent / ceiling) * 100)}%: ${provider}`, `Month-to-date ${provider} spend is $${spent.toFixed(2)} of the $${ceiling} ceiling.`);
    }
  }

  private async alertOnce(provider: string, level: string, subject: string, text: string) {
    const key = `budget-alert:${provider}:${level}:${monthStart().toISOString().slice(0, 7)}`;
    const created = await this.prisma.providerCache
      .create({ data: { key, provider: 'budget', valueJson: { at: new Date().toISOString() }, expiresAt: new Date(Date.now() + 40 * 86_400_000) } })
      .then(() => true)
      .catch(() => false);
    if (!created) return;
    try {
      const { PlatformService } = await import('../platform/platform.service');
      const platform = this.moduleRef.get(PlatformService, { strict: false });
      void platform.alertStaff('incident', subject, text);
    } catch (err) {
      this.logger.warn(`Budget alert could not be sent: ${err}`);
    }
  }
}
