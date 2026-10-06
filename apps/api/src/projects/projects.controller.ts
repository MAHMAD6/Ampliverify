import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('user/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.projects.listAccessible(actor.userId);
  }

  @Get(':id')
  get(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.getAccessible(actor.userId, id);
  }

  @Post()
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateProjectDto,
    @Req() request: Request,
  ) {
    return this.projects.create(actor.userId, dto, requestMeta(request));
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() request: Request,
  ) {
    return this.projects.update(actor.userId, id, dto, requestMeta(request));
  }
}
