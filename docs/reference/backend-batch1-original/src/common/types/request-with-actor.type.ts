import { Request } from 'express';
import { AuthenticatedActor } from './actor.type';

export type RequestWithActor = Request & {
  actor: AuthenticatedActor;
};
