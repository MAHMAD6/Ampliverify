import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreditsService } from '../commerce/credits.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService, type UsageContext } from './openai.service';
import { ProviderBudgetService } from '../commerce/provider-budget.service';

export const AI_USAGE_FEATURE = 'ai.action';
/** Published credit price keys per AI operation (`credits.costs`; Hybrid guide §3). */
export type AiOperation = 'ai.suggestion' | 'ai.content_ideas' | 'ai.content_brief';

/**
 * Gate for AI-assisted actions: module switch, plan feature (`ai.suggest`),
 * monthly limit (`limit.ai_actions`) and credits. Credits are reserved before
 * the call, settled when it succeeds and released when it fails (V1 manual §6).
 */
@Injectable()
export class AiGateService {
  constructor(
    private readonly openai: OpenAiService,
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
    private readonly prisma: PrismaService,
    private readonly budgets: ProviderBudgetService,
  ) {}

  get configured() {
    return this.openai.configured;
  }

  async run<T>(
    ctx: { workspaceId: string; projectId: string; actorId: string; referenceType: string; referenceId?: string; operation: AiOperation },
    fn: (usage: Pick<UsageContext, 'providerUsageIds'>) => Promise<T>,
  ): Promise<T> {
    await this.entitlements.assertModuleEnabled('ai');
    await this.entitlements.assertFeature(ctx.workspaceId, 'ai.suggest');
    await this.entitlements.assertWithinLimit(ctx.workspaceId, 'limit.ai_actions', AI_USAGE_FEATURE);
    if (!this.openai.configured) {
      throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI features are not available yet.' });
    }
    await this.budgets.assertWithinBudget('openai');
    const reservation = await this.credits.reserve({
      workspaceId: ctx.workspaceId,
      featureKey: AI_USAGE_FEATURE,
      amount: Number(await this.credits.costOf(ctx.operation)),
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId ?? ctx.projectId,
      idempotencyKey: `ai:${randomUUID()}`,
      actorId: ctx.actorId,
      ttlMinutes: 15,
    });
    const usage = { providerUsageIds: [] as string[] };
    let out: T;
    try {
      out = await fn(usage);
    } catch (err) {
      await this.credits.release(reservation.id, 'ai call failed');
      throw err;
    }
    const settled = await this.credits.settle(reservation.id, { projectId: ctx.projectId });
    const usageEventId = settled && 'usageEventId' in settled ? settled.usageEventId : null;
    if (usageEventId && usage.providerUsageIds.length) {
      await this.prisma.providerUsage.updateMany({ where: { id: { in: usage.providerUsageIds } }, data: { usageEventId } });
    }
    return out;
  }
}
