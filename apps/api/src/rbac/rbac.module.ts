import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RbacService } from './rbac.service';

@Module({
  imports: [AuditModule],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
