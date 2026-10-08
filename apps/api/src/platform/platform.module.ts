import { Global, Module } from '@nestjs/common';
import { AuthSyncGuard } from '../auth/auth-sync.guard';
import { PlatformController } from './platform.controller';
import { PlatformGuard } from './platform.guard';
import { PlatformService } from './platform.service';

@Global()
@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformGuard, AuthSyncGuard],
  exports: [PlatformService, PlatformGuard],
})
export class PlatformModule {}
