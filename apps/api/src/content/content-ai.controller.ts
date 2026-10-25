import { Controller, Get, Param, ParseBoolPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { AiAssistService } from './ai-assist.service';
import { ContentAuditService } from './content-audit.service';

/** Content Audit and OpenAI-assisted actions; AI routes are rate limited per caller. */
@Controller('user')
export class ContentAiController {
  constructor(
    private readonly audits: ContentAuditService,
    private readonly assist: AiAssistService,
  ) {}

  @Post('projects/:projectId/content/audits')
  runAudit(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.audits.run(a.userId, id);
  }

  @Get('projects/:projectId/content/audits')
  listAudits(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.audits.list(a.userId, id);
  }

  @Get('content/audits/:id')
  getAudit(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.audits.get(a.userId, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('content/audits/:id/assess')
  assessAudit(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.audits.assess(a.userId, id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('audit-findings/:id/explain')
  explain(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('refresh', new ParseBoolPipe({ optional: true })) refresh?: boolean) {
    return this.assist.explainFinding(a.userId, id, refresh ?? false);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('content/briefs/:id/draft')
  draft(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assist.draftArticle(a.userId, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('geo/prompts/:id/recommendations')
  geoRecommendations(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assist.geoRecommendations(a.userId, id);
  }

  @Get('geo/prompts/:id/recommendations')
  latestGeoRecommendations(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assist.latestGeoRecommendations(a.userId, id);
  }
}
