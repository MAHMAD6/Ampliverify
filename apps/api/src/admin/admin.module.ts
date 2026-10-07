import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { AdminController } from './admin.controller';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { CommerceAdminController } from './commerce-admin.controller';
import { CommerceAdminService } from './commerce-admin.service';

@Module({
  imports: [UsersModule, BillingModule],
  controllers: [AdminController, OperationsController, CommerceAdminController],
  providers: [OperationsService, CommerceAdminService],
})
export class AdminModule {}
