import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProjectStatus } from '../../db/entities';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
