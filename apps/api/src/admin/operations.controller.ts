import { Controller, Get } from '@nestjs/common';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

/** Read-only platform operations data for the Super Admin console (global `system.read`). */
@Controller('admin')
export class OperationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  @Get('module-controls')
  async moduleControls(@CurrentActor() actor: AuthenticatedActor) {
    await this.rbac.assertGlobalPermission(actor.userId, 'system.read');
    return this.prisma.moduleControl.findMany({
      orderBy: { moduleKey: 'asc' },
      select: { moduleKey: true, enabled: true, updatedAt: true, updater: { select: { id: true, email: true, displayName: true } } },
    });
  }

  @Get('feature-flags')
  async featureFlags(@CurrentActor() actor: AuthenticatedActor) {
    await this.rbac.assertGlobalPermission(actor.userId, 'system.read');
    return this.prisma.featureFlag.findMany({
      orderBy: [{ key: 'asc' }, { environment: 'asc' }],
      include: { rules: { orderBy: { priority: 'asc' } } },
    });
  }
}
