import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RbacService } from '../rbac/rbac.service';
import { RequestWithActor } from '../common/types/request-with-actor.type';
import { PlatformService } from './platform.service';

/**
 * Runs after authentication. Maintenance mode refuses product (`/user`)
 * requests from everyone except platform operators; "Require MFA for admins"
 * refuses `/admin` requests from sessions without two-factor enabled.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly platform: PlatformService,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = req.actor;
    if (!actor) return true;
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];

    if (path.includes('/api/v1/user/')) {
      const g = await this.platform.general();
      if (g.maintenanceMode === true && !(await this.rbac.hasPermission(actor.userId, 'system.read'))) {
        throw new ServiceUnavailableException({ code: 'MAINTENANCE', message: g.maintenanceMessage?.trim() || 'AmpliVerify is undergoing scheduled maintenance. Please try again shortly.' });
      }
    }

    if (path.includes('/api/v1/admin/')) {
      const s = await this.platform.security();
      if (s.requireAdminMfa === true && !actor.mfa) {
        throw new ForbiddenException({ code: 'MFA_REQUIRED', message: 'Turn on two-factor authentication in Account Security to use the admin console.' });
      }
    }
    return true;
  }
}
