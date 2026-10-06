import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  workspaceId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;
}
