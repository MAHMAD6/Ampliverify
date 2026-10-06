import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ScopeType } from '../../db/entities';

export class CreateRoleAssignmentDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  roleId: string;

  @IsEnum(ScopeType)
  scopeType: ScopeType;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
