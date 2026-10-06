import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithActor } from '../types/request-with-actor.type';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    return request.actor;
  },
);
