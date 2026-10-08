import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsEmail, MaxLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { AuthSyncGuard } from '../auth/auth-sync.guard';
import { PlatformService } from './platform.service';

class CanRegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  /** Platform name, support contact, sign-up and maintenance state for the website. */
  @Public()
  @Get('public/platform')
  info() {
    return this.platform.publicInfo();
  }

  /** Called by the auth server before creating an account (shared-secret guarded, so invitations are not enumerable). */
  @Public()
  @UseGuards(AuthSyncGuard)
  @Post('internal/auth/users/can-register')
  @HttpCode(200)
  async canRegister(@Body() dto: CanRegisterDto) {
    return { allowed: await this.platform.canRegister(dto.email) };
  }
}
