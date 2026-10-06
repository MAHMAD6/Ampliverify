import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OrganizationMembership,
  Permission,
  Project,
  Role,
  RoleAssignment,
  RolePermission,
  Workspace,
  WorkspaceMembership,
  User,
} from '../db/entities';
import { AuditModule } from '../audit/audit.module';
import { RbacService } from './rbac.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      Permission,
      RolePermission,
      RoleAssignment,
      Workspace,
      Project,
      OrganizationMembership,
      WorkspaceMembership,
      User,
    ]),
    AuditModule,
  ],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
