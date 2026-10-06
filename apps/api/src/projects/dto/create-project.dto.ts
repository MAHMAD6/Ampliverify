import { ProjectGoal } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  workspaceId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  /** Website domain; normalized to a bare host and stored as the project's first domain. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  domain?: string;

  @IsOptional()
  @IsEnum(ProjectGoal)
  primaryGoal?: ProjectGoal;
}
