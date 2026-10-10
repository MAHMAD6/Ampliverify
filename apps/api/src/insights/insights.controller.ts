import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { InsightsService } from './insights.service';

class SettingsDto {
  @IsOptional() @IsString() @MaxLength(10) locale?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsIn(['PAGE', 'SITE']) crawlScope?: 'PAGE' | 'SITE';
  @IsOptional() @IsInt() @Min(1) @Max(200) maxPages?: number;
  @IsOptional() @IsIn(['SEO', 'GEO', 'BOTH']) auditMode?: 'SEO' | 'GEO' | 'BOTH';
  @IsOptional() @IsIn(['MANUAL', 'WEEKLY', 'MONTHLY']) auditFrequency?: 'MANUAL' | 'WEEKLY' | 'MONTHLY';
  @IsOptional() @IsString() @Length(2, 2) targetCountry?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) excludePaths?: string[];
}

@Controller('user')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('onboarding')
  onboarding(@CurrentActor() a: AuthenticatedActor) {
    return this.insights.onboarding(a.userId);
  }

  @Get('dashboard')
  dashboard(@CurrentActor() a: AuthenticatedActor) {
    return this.insights.dashboard(a.userId);
  }

  @Get('projects/:projectId/summary')
  summary(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.insights.summary(a.userId, id);
  }

  @Get('projects/:projectId/settings')
  settings(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.insights.getSettings(a.userId, id);
  }

  @Put('projects/:projectId/settings')
  update(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: SettingsDto) {
    return this.insights.updateSettings(a.userId, id, dto);
  }
}
