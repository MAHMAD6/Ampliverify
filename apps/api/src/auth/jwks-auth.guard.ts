import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { RequestWithActor } from '../common/types/request-with-actor.type';
import { UsersService } from '../users/users.service';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

/**
 * Global guard: every route requires a Better Auth bearer JWT unless marked
 * @Public(). Authentication only identifies the user; RBAC is separate.
 */
@Injectable()
export class JwksAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly reflector: Reflector,
  ) {
    this.jwks = createRemoteJWKSet(
      new URL(this.config.getOrThrow<string>('BETTER_AUTH_JWKS_URL')),
    );
    this.issuer = this.config.getOrThrow<string>('BETTER_AUTH_ISSUER');
    this.audience = this.config.getOrThrow<string>('BETTER_AUTH_AUDIENCE');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const authHeader = request.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'MISSING_BEARER_TOKEN', message: 'Authentication required.' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      payload = verified.payload;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_BEARER_TOKEN', message: 'Authentication failed.' });
    }

    if (!payload.sub) {
      throw new UnauthorizedException({ code: 'TOKEN_SUBJECT_MISSING', message: 'Authentication failed.' });
    }

    const user = await this.users.findByAuthSubject(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_PROVISIONED',
        message: 'Authenticated user is not provisioned in the API database.',
      });
    }
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException({ code: 'USER_NOT_ACTIVE', message: 'This account is not active.' });
    }

    request.actor = {
      userId: user.id,
      authSubject: user.authSubject,
      email: user.email,
      mfa: payload.twoFactorEnabled === true,
    };
    return true;
  }
}
