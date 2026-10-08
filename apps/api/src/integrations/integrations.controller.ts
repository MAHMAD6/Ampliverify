import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { IntegrationsService } from './integrations.service';

class WordPressDto {
  @IsString() @MaxLength(2048) siteUrl: string;
  @IsString() @MinLength(1) @MaxLength(200) username: string;
  @IsString() @MinLength(8) @MaxLength(200) applicationPassword: string;
}
class GoogleStartDto {
  @IsIn(['google_search_console', 'google_analytics']) provider: 'google_search_console' | 'google_analytics';
}
class GoogleCallbackDto {
  @IsString() @MaxLength(2048) code: string;
  @IsString() @MaxLength(4096) state: string;
}
class PublishDto {
  @IsUUID() integrationId: string;
  @IsIn(['draft', 'publish']) status: 'draft' | 'publish';
  @IsOptional() @IsIn(['posts', 'pages']) type?: 'posts' | 'pages';
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
  @Post('workspaces/:id/integrations/google/start')
  googleStart(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GoogleStartDto) {
    return this.integrations.googleStart(a.userId, id, dto.provider);
  }
  @Post('integrations/google/callback')
  googleCallback(@CurrentActor() a: AuthenticatedActor, @Body() dto: GoogleCallbackDto, @Req() req: Request) {
    return this.integrations.googleCallback(a.userId, dto.code, dto.state, requestMeta(req));
  }
  @Post('integrations/:id/test')
  test(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.testConnection(a.userId, id);
  }
  @Get('integrations/:id/properties')
  properties(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.googleProperties(a.userId, id);
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
    return this.integrations.publishToWordPress(a.userId, id, { integrationId: dto.integrationId, status: dto.status, type: dto.type ?? 'posts' }, requestMeta(req));
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
