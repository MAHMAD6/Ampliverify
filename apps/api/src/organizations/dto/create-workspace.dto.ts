import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;
}
