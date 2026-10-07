import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { Request } from 'express';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { OptimizationService } from './optimization.service';

class CreateTaskDto {
  @IsOptional()
  @IsUUID()
  findingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  priority?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assignedTo?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  dueAt?: string | null;
}

class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  priority?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assignedTo?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  dueAt?: string | null;
}

@Controller('user')
export class OptimizationController {
  constructor(private readonly optimization: OptimizationService) {}

  @Get('projects/:projectId/recommendations')
  recommendations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() filters: Record<string, string>,
  ) {
    return this.optimization.recommendations(actor.userId, projectId, filters);
  }

  @Post('projects/:projectId/reanalyze')
  reanalyze(@CurrentActor() actor: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) projectId: string, @Req() req: Request) {
    return this.optimization.reanalyze(actor.userId, projectId, requestMeta(req));
  }

  @Get('projects/:projectId/tasks')
  tasks(@CurrentActor() actor: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) projectId: string, @Query('status') status?: TaskStatus) {
    return this.optimization.listTasks(actor.userId, projectId, status && status in TaskStatus ? status : undefined);
  }

  @Post('projects/:projectId/tasks')
  createTask(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.optimization.createTask(actor.userId, projectId, dto, requestMeta(req));
  }

  @Get('tasks/:id')
  task(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.optimization.getTask(actor.userId, id);
  }

  @Patch('tasks/:id')
  updateTask(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @Req() req: Request) {
    return this.optimization.updateTask(actor.userId, id, dto, requestMeta(req));
  }

  @Post('tasks/:id/verify')
  verify(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.optimization.verifyTask(actor.userId, id, requestMeta(req));
  }
}
