import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RbacService } from './rbac.service';

@Global()
@Module({
  imports: [AuditModule],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
