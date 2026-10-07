import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { EditorStatus, SuggestionStatus, SuggestionType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { EditorService } from './editor.service';

class ContentDto {
  @IsString() @MaxLength(2_000_000) html: string;
  @IsString() @MaxLength(300) title: string;
  @IsString() @MaxLength(500) metaDescription: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @IsOptional() @IsString() @MaxLength(200) focusKeyword?: string;
}
class CreateDto {
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ContentDto) content?: ContentDto;
  @IsOptional() @IsUrl({ require_protocol: true, require_tld: false }) pageUrl?: string;
}
class ImportDto {
  @IsUrl({ require_protocol: true, require_tld: false }) url: string;
}
class UpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @IsOptional() @IsEnum(EditorStatus) status?: EditorStatus;
}
class SuggestDto {
  @IsOptional() @IsEnum(SuggestionType) focus?: SuggestionType;
  @IsOptional() @IsString() @MaxLength(1000) instruction?: string;
}
class DecideDto {
  @IsEnum(SuggestionStatus) status: SuggestionStatus;
}

@Controller('user')
export class EditorController {
  constructor(private readonly editor: EditorService) {}

  @Get('projects/:projectId/editor/documents')
  list(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('status') status?: EditorStatus) {
    return this.editor.list(a.userId, id, status && status in EditorStatus ? status : undefined);
  }
  @Post('projects/:projectId/editor/documents')
  create(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: CreateDto) {
    return this.editor.create(a.userId, id, dto);
  }
  @Post('projects/:projectId/editor/import')
  import(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: ImportDto) {
    return this.editor.importPage(a.userId, id, dto.url);
  }
  @Get('editor/documents/:id')
  get(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('version') version?: string) {
    return this.editor.get(a.userId, id, version ? Number(version) : undefined);
  }
  @Put('editor/documents/:id/content')
  save(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContentDto) {
    return this.editor.saveVersion(a.userId, id, dto);
  }
  @Patch('editor/documents/:id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDto) {
    return this.editor.update(a.userId, id, dto);
  }
  @Post('editor/documents/:id/analyze')
  analyze(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContentDto) {
    return this.editor.analyzeDraft(a.userId, id, dto);
  }
  @Post('editor/documents/:id/suggestions')
  suggest(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SuggestDto) {
    return this.editor.suggest(a.userId, id, dto);
  }
  @Patch('editor/suggestions/:id')
  decide(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) {
    return this.editor.decideSuggestion(a.userId, id, dto.status);
  }
  @Get('editor/documents/:id/history')
  history(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.editor.history(a.userId, id);
  }
  @Get('editor/documents/:id/versions/:versionNo')
  version(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('versionNo', ParseIntPipe) v: number) {
    return this.editor.get(a.userId, id, v);
  }
}
