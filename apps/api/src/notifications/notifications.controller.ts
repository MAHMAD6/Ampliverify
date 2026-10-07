import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { RbacService } from '../rbac/rbac.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

class PreferenceDto {
  @IsString()
  @MaxLength(80)
  eventKey: string;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

class SetPreferencesDto {
  @IsUUID()
  workspaceId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreferenceDto)
  preferences: PreferenceDto[];
}

@Controller('user')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly rbac: RbacService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('notifications')
  list(@CurrentActor() actor: AuthenticatedActor, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.notifications.list(actor.userId, { unread: unread === 'true', limit: limit ? Number(limit) : undefined });
  }

  @Get('notifications/unread-count')
  async unread(@CurrentActor() actor: AuthenticatedActor) {
    return { count: await this.notifications.unreadCount(actor.userId) };
  }

  @Post('notifications/read-all')
  readAll(@CurrentActor() actor: AuthenticatedActor) {
    return this.notifications.markAllRead(actor.userId);
  }

  @Post('notifications/:id/read')
  read(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(actor.userId, id);
  }

  @Get('notification-preferences')
  async preferences(@CurrentActor() actor: AuthenticatedActor, @Query('workspaceId', ParseUUIDPipe) workspaceId: string) {
    await this.assertWorkspace(actor.userId, workspaceId);
    return this.notifications.preferences(actor.userId, workspaceId);
  }

  @Put('notification-preferences')
  async setPreferences(@CurrentActor() actor: AuthenticatedActor, @Body() dto: SetPreferencesDto) {
    await this.assertWorkspace(actor.userId, dto.workspaceId);
    return this.notifications.setPreferences(actor.userId, dto.workspaceId, dto.preferences);
  }

  private async assertWorkspace(userId: string, workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null } });
    await this.rbac.assertPermission(userId, 'workspace.read', { organizationId: ws?.organizationId ?? '00000000-0000-0000-0000-000000000000', workspaceId });
  }
}
