import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthSyncGuard } from './auth-sync.guard';
import { AuthSyncController } from './auth-sync.controller';

@Module({
  imports: [UsersModule],
  controllers: [AuthSyncController],
  providers: [AuthSyncGuard],
})
export class AuthModule {}
