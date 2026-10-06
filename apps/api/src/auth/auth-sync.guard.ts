import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/** Server-to-server guard for the auth provisioning endpoint. */
@Injectable()
export class AuthSyncGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const received = request.header('x-auth-sync-secret') ?? '';
    const expected = this.config.getOrThrow<string>('AUTH_SYNC_SECRET');
    // Compare fixed-length digests so the secret length is not leaked by timing.
    const digest = (value: string) => createHash('sha256').update(value).digest();

    if (!received || !timingSafeEqual(digest(received), digest(expected))) {
      throw new UnauthorizedException({ code: 'INVALID_AUTH_SYNC_SECRET', message: 'Unauthorized.' });
    }

    return true;
  }
}
