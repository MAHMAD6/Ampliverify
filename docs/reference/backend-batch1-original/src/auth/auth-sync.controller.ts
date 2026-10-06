import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthSyncGuard } from './auth-sync.guard';
import { SyncUserDto } from './dto/sync-user.dto';
import { UsersService } from '../users/users.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('internal/auth/users')
@Public()
@UseGuards(AuthSyncGuard)
export class AuthSyncController {
  constructor(private readonly users: UsersService) {}

  @Post('sync')
  sync(@Body() dto: SyncUserDto) {
    return this.users.syncAuthUser(dto);
  }
}
