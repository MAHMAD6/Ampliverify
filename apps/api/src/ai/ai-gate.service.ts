import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreditsService } from '../commerce/credits.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { ClaudeService } from './claude.service';

export const AI_USAGE_FEATURE = 'ai.action';

/**
 * Gate for AI-assisted actions: module switch, plan feature (`ai.suggest`),
 * monthly limit (`limit.ai_actions`) and credits. The charge is refunded if
 * the AI call fails.
 */
@Injectable()
export class AiGateService {
  constructor(
    private readonly claude: ClaudeService,
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  get configured() {
    return this.claude.configured;
  }

  async run<T>(
    ctx: { workspaceId: string; projectId: string; actorId: string; referenceType: string; referenceId?: string },
    fn: (usageEventId: string) => Promise<T>,
  ): Promise<T> {
    await this.entitlements.assertModuleEnabled('ai');
    await this.entitlements.assertFeature(ctx.workspaceId, 'ai.suggest');
    await this.entitlements.assertWithinLimit(ctx.workspaceId, 'limit.ai_actions', AI_USAGE_FEATURE);
    if (!this.claude.configured) {
      throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI features are not available yet.' });
    }
    const key = `ai:${randomUUID()}`;
    const { usageEventId } = await this.credits.charge({
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      featureKey: AI_USAGE_FEATURE,
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId ?? ctx.projectId,
      idempotencyKey: key,
      actorId: ctx.actorId,
    });
    try {
      return await fn(usageEventId);
    } catch (err) {
      await this.credits.refund(ctx.workspaceId, key);
      throw err;
    }
  }
}
