import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Organization,
  OrganizationMembership,
  Role,
  RoleAssignment,
  Workspace,
  WorkspaceMembership,
} from '../db/entities';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Workspace,
      OrganizationMembership,
      WorkspaceMembership,
      Role,
      RoleAssignment,
    ]),
    AuditModule,
    RbacModule,
  ],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
