import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { IntegrationsService } from './integrations.service';

class WordPressDto {
  @IsString() @MaxLength(2048) siteUrl: string;
  @IsString() @MinLength(1) @MaxLength(200) username: string;
  @IsString() @MinLength(8) @MaxLength(200) applicationPassword: string;
}
class WebflowDto {
  @IsString() @MinLength(10) @MaxLength(500) apiToken: string;
  @IsString() @MinLength(10) @MaxLength(64) collectionId: string;
}
class ShopifyDto {
  @IsString() @MinLength(3) @MaxLength(255) shopDomain: string;
  @IsString() @MinLength(10) @MaxLength(500) accessToken: string;
}
class WebhookDto {
  @IsString() @MaxLength(2048) url: string;
}
class GoogleStartDto {
  @IsIn(['google_search_console', 'google_analytics']) provider: 'google_search_console' | 'google_analytics';
  @IsOptional() @IsString() @MaxLength(300) returnTo?: string;
}
class GoogleCallbackDto {
  @IsOptional() @IsString() @MaxLength(2048) code?: string;
  @IsString() @MaxLength(200) state: string;
  @IsOptional() @IsString() @MaxLength(100) error?: string;
}
class LinkPropertyDto {
  @IsUUID() projectId: string;
  @IsUUID() integrationId: string;
  @IsString() @MaxLength(500) propertyId: string;
}
class PublishDto {
  @IsUUID() integrationId: string;
  @IsIn(['draft', 'publish']) status: 'draft' | 'publish';
  @IsOptional() @IsIn(['posts', 'pages']) type?: 'posts' | 'pages';
}
class ImportSitesDto {
  @IsUUID() integrationId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(25) @IsString({ each: true }) @MaxLength(2048, { each: true }) siteUrls: string[];
}
class LinkDto {
  @IsUUID() integrationId: string;
  @IsOptional() @IsString() @MaxLength(500) propertyId?: string;
}

@Controller('user')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('workspaces/:id/integrations')
  list(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.list(a.userId, id);
  }
  @Post('workspaces/:id/integrations/wordpress')
  wordpress(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WordPressDto, @Req() req: Request) {
    return this.integrations.connectWordPress(a.userId, id, dto, requestMeta(req));
  }
  @Post('workspaces/:id/integrations/webflow')
  webflow(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WebflowDto, @Req() req: Request) {
    return this.integrations.connectWebflow(a.userId, id, dto, requestMeta(req));
  }

  @Post('workspaces/:id/integrations/shopify')
  shopify(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShopifyDto, @Req() req: Request) {
    return this.integrations.connectShopify(a.userId, id, dto, requestMeta(req));
  }

  @Post('workspaces/:id/integrations/webhook')
  webhook(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WebhookDto, @Req() req: Request) {
    return this.integrations.connectWebhook(a.userId, id, dto, requestMeta(req));
  }

  @Post('workspaces/:id/integrations/google/start')
  googleStart(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GoogleStartDto) {
    return this.integrations.googleStart(a.userId, id, dto.provider, dto.returnTo);
  }
  @Post('workspaces/:id/integrations/google/import-projects')
  importProjects(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ImportSitesDto, @Req() req: Request) {
    return this.integrations.importSearchConsoleSites(a.userId, id, dto, requestMeta(req));
  }
  @Post('integrations/google/callback')
  googleCallback(@CurrentActor() a: AuthenticatedActor, @Body() dto: GoogleCallbackDto, @Req() req: Request) {
    return this.integrations.googleCallback(a.userId, dto, requestMeta(req));
  }
  @Get('integrations/:id/status')
  googleStatus(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.googleStatus(a.userId, id);
  }
  @Post('integrations/google/link-property')
  linkProperty(@CurrentActor() a: AuthenticatedActor, @Body() dto: LinkPropertyDto, @Req() req: Request) {
    return this.integrations.linkProject(a.userId, dto.projectId, { integrationId: dto.integrationId, propertyId: dto.propertyId }, requestMeta(req));
  }
  @Get('projects/:projectId/google/overview')
  googleOverview(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('days') days?: string) {
    return this.integrations.googleOverview(a.userId, id, days ? Number(days) : 28);
  }
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('projects/:projectId/google/sync')
  googleSync(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.integrations.googleSyncNow(a.userId, id);
  }
  @Post('integrations/:id/test')
  test(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.testConnection(a.userId, id);
  }
  @Get('integrations/:id/properties')
  properties(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('refresh') refresh?: string) {
    return this.integrations.googleProperties(a.userId, id, refresh === '1' || refresh === 'true');
  }
  @Get('integrations/:id/wordpress/content')
  wpContent(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('type') type?: string, @Query('q') q?: string) {
    return this.integrations.wordpressContent(a.userId, id, { type: type === 'posts' ? 'posts' : 'pages', q });
  }

  @Delete('integrations/:id')
  disconnect(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.integrations.disconnect(a.userId, id, requestMeta(req));
  }
  @Post('editor/documents/:id/publish')
  publish(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishDto, @Req() req: Request) {
    return this.integrations.publish(a.userId, id, { integrationId: dto.integrationId, status: dto.status, type: dto.type ?? 'posts' }, requestMeta(req));
  }
  @Get('projects/:projectId/data-sources')
  sources(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.integrations.projectSources(a.userId, id);
  }
  @Post('projects/:projectId/data-sources')
  link(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: LinkDto, @Req() req: Request) {
    return this.integrations.linkProject(a.userId, id, dto, requestMeta(req));
  }
  @Delete('data-sources/:id')
  unlink(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.unlinkProject(a.userId, id);
  }
  @Get('projects/:projectId/search-performance')
  performance(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('dimension') dimension?: string, @Query('days') days?: string) {
    return this.integrations.searchPerformance(a.userId, id, { dimension: dimension === 'page' ? 'page' : 'query', days: days ? Number(days) : 28 });
  }
  @Get('projects/:projectId/analytics')
  analytics(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('days') days?: string) {
    return this.integrations.analytics(a.userId, id, days ? Number(days) : 28);
  }
}
