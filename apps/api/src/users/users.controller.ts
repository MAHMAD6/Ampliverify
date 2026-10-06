import { Controller, Get } from '@nestjs/common';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { UsersService } from './users.service';

@Controller('user')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentActor() actor: AuthenticatedActor) {
    return this.users.findByIdOrThrow(actor.userId);
  }
}
