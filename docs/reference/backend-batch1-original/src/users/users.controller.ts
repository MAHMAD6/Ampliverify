import { Controller, Get } from '@nestjs/common';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { UsersService } from './users.service';

@Controller('user')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentActor() actor: AuthenticatedActor) {
    const user = await this.users.findByIdOrThrow(actor.userId);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
