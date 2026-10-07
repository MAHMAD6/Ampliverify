import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { ContentService } from './content.service';

class IdeaDto {
  @IsString() @MinLength(3) @MaxLength(300) title: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
class UpdateIdeaDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(300) title?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
class GenerateIdeasDto {
  @IsOptional() @IsString() @MaxLength(200) topic?: string;
  @IsOptional() @IsInt() @Min(3) @Max(20) count?: number;
}
class BriefDto {
  @IsString() @MinLength(3) @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(200) keyword?: string;
  @IsOptional() @IsUUID() ideaId?: string;
  @IsOptional() @IsBoolean() generate?: boolean;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @Length(2, 2) language?: string;
}
class UpdateBriefDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(300) title?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsObject() brief?: Record<string, unknown>;
}
class PlanDto {
  @IsString() @MinLength(1) @MaxLength(160) name: string;
}
class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}
class PlanItemDto {
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() targetDate?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() briefId?: string | null;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}
class UpdatePlanItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() targetDate?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() briefId?: string | null;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}

@Controller('user')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('projects/:projectId/content/summary')
  summary(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.content.summary(a.userId, id);
  }

  @Get('projects/:projectId/content/ideas')
  ideas(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('status') status?: ContentStatus) {
    return this.content.ideas(a.userId, id, status && status in ContentStatus ? status : undefined);
  }
  @Post('projects/:projectId/content/ideas')
  createIdea(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: IdeaDto) {
    return this.content.createIdea(a.userId, id, dto);
  }
  @Post('projects/:projectId/content/ideas/generate')
  generateIdeas(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: GenerateIdeasDto) {
    return this.content.generateIdeas(a.userId, id, dto);
  }
  @Patch('content/ideas/:id')
  updateIdea(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIdeaDto) {
    return this.content.updateIdea(a.userId, id, dto);
  }

  @Get('projects/:projectId/content/briefs')
  briefs(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.content.briefs(a.userId, id);
  }
  @Post('projects/:projectId/content/briefs')
  createBrief(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: BriefDto) {
    return this.content.createBrief(a.userId, id, dto);
  }
  @Get('content/briefs/:id')
  brief(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.getBrief(a.userId, id);
  }
  @Patch('content/briefs/:id')
  updateBrief(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBriefDto) {
    return this.content.updateBrief(a.userId, id, dto);
  }
  @Post('content/briefs/:id/generate')
  generateBrief(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.generateBrief(a.userId, id);
  }

  @Get('projects/:projectId/content/plans')
  plans(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.content.plans(a.userId, id);
  }
  @Post('projects/:projectId/content/plans')
  createPlan(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: PlanDto) {
    return this.content.createPlan(a.userId, id, dto.name);
  }
  @Patch('content/plans/:id')
  updatePlan(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.content.updatePlan(a.userId, id, dto);
  }
  @Post('content/plans/:id/items')
  addItem(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlanItemDto) {
    return this.content.addPlanItem(a.userId, id, dto);
  }
  @Patch('content/plan-items/:id')
  updateItem(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanItemDto) {
    return this.content.updatePlanItem(a.userId, id, dto);
  }
  @Delete('content/plan-items/:id')
  deleteItem(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deletePlanItem(a.userId, id);
  }

  @Get('projects/:projectId/content/optimized')
  optimized(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.content.optimized(a.userId, id);
  }
}
