import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { KeywordsService, KeywordTool } from './keywords.service';

class ResearchDto {
  @IsIn(['EXPLORER', 'RELATED', 'QUESTIONS', 'COMPETITOR', 'SERP']) tool: KeywordTool;
  @IsString() @MinLength(2) @MaxLength(200) query: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @Length(2, 2) language?: string;
}

class NameDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
}

class KeywordsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) @MaxLength(300, { each: true }) keywords: string[];
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @Length(2, 2) language?: string;
}

class RemoveDto {
  @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) keywordIds: string[];
}

class ClusterDto {
  @IsOptional() @IsUUID() listId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @Length(2, 2) language?: string;
}

@Controller('user')
export class KeywordsController {
  constructor(private readonly keywords: KeywordsService) {}

  @Get('keywords/status')
  status() {
    return { configured: this.keywords.configured };
  }

  @Post('projects/:projectId/keywords/research')
  research(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: ResearchDto) {
    return this.keywords.research(a.userId, id, dto);
  }

  @Get('projects/:projectId/keywords/research')
  recent(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('tool') tool?: string) {
    return this.keywords.recent(a.userId, id, tool);
  }

  @Get('keywords/research/:id')
  query(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.keywords.getQuery(a.userId, id);
  }

  @Get('projects/:projectId/keyword-lists')
  lists(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.keywords.lists(a.userId, id);
  }

  @Post('projects/:projectId/keyword-lists')
  createList(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: NameDto) {
    return this.keywords.createList(a.userId, id, dto.name);
  }

  @Post('projects/:projectId/saved-keywords')
  save(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: KeywordsDto) {
    return this.keywords.save(a.userId, id, dto.keywords, dto.country, dto.language);
  }

  @Get('keyword-lists/:id')
  list(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.keywords.getList(a.userId, id);
  }

  @Patch('keyword-lists/:id')
  rename(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NameDto) {
    return this.keywords.renameList(a.userId, id, dto.name);
  }

  @Delete('keyword-lists/:id')
  deleteList(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.keywords.deleteList(a.userId, id);
  }

  @Post('keyword-lists/:id/keywords')
  add(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: KeywordsDto) {
    return this.keywords.addToList(a.userId, id, dto.keywords, dto.country, dto.language);
  }

  @Post('keyword-lists/:id/keywords/remove')
  remove(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemoveDto) {
    return this.keywords.removeFromList(a.userId, id, dto.keywordIds);
  }

  @Get('projects/:projectId/keyword-clusters')
  clusters(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.keywords.clusters(a.userId, id);
  }

  @Post('projects/:projectId/keyword-clusters')
  cluster(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: ClusterDto) {
    return this.keywords.autoCluster(a.userId, id, dto);
  }

  @Delete('keyword-clusters/:id')
  deleteCluster(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.keywords.deleteCluster(a.userId, id);
  }
}
