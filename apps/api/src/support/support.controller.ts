import { Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { PlatformService } from '../platform/platform.service';
import { TicketStatus } from '@prisma/client';
import { Request } from 'express';
import { createHash } from 'crypto';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';

class ContactDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsIn(['SALES', 'SUPPORT', 'PARTNERSHIP', 'PRESS', 'BILLING', 'OTHER']) topic: string;
  @IsString() @MinLength(10) @MaxLength(5000) message: string;
  /** Honeypot: real visitors leave it empty. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

class StatusDto {
  @IsEnum(TicketStatus) status: TicketStatus;
}

class StaffReplyDto {
  @IsString() @MinLength(1) @MaxLength(5000) body: string;
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
}

const hashIp = (ip: string | undefined) => (ip ? createHash('sha256').update(`contact:${ip}`).digest('hex') : null);

/** Public Contact form and the Super Admin inbox for contact submissions and support tickets. */
@Controller()
export class SupportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly platform: PlatformService,
  ) {}

  @Public()
  @Post('public/contact')
  async contact(@Body() dto: ContactDto, @Req() req: Request) {
    // Bots fill the hidden field; accept silently without storing.
    if (dto.website) return { received: true };
    const ipHash = hashIp(req.ip);
    if (ipHash) {
      const recent = await this.prisma.contactSubmission.count({ where: { ipHash, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
      if (recent >= 5) throw new HttpException({ code: 'RATE_LIMITED', message: 'Too many messages. Please try again later.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const row = await this.prisma.contactSubmission.create({
      data: { name: dto.name.trim(), email: dto.email.trim(), company: dto.company?.trim() || null, topic: dto.topic, message: dto.message.trim(), ipHash },
    });
    void this.platform.alertStaff('contact', `Contact form: ${dto.topic.toLowerCase()} from ${row.name}`, `From: ${row.name} <${row.email}>${row.company ? `\nCompany: ${row.company}` : ''}\nTopic: ${dto.topic}\n\n${row.message}\n\nReference ${row.id.slice(0, 8).toUpperCase()} · Super Admin → Support → Contact.`);
    return { received: true, reference: row.id.slice(0, 8).toUpperCase() };
  }

  @Get('admin/contact-submissions')
  async contactList(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: TicketStatus) {
    await this.rbac.assertGlobalPermission(a.userId, 'user.read');
    return this.prisma.contactSubmission.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 500, omit: { ipHash: true } });
  }

  @Patch('admin/contact-submissions/:id')
  async contactStatus(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @Req() req: Request) {
    await this.rbac.assertGlobalPermission(a.userId, 'user.manage');
    const saved = await this.prisma.contactSubmission.update({ where: { id }, data: { status: dto.status, handledBy: a.userId, handledAt: new Date() }, omit: { ipHash: true } });
    await this.auditLog.record({ actorUserId: a.userId, actorRole: 'admin', action: 'admin.contact.update', targetType: 'contact_submission', targetId: id, afterState: { status: dto.status }, requestMeta: requestMeta(req) });
    return saved;
  }

  @Get('admin/support-tickets')
  async tickets(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: TicketStatus) {
    await this.rbac.assertGlobalPermission(a.userId, 'user.read');
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : {},
      orderBy: { updatedAt: 'desc' },
      take: 500,
      include: { user: { select: { id: true, email: true, displayName: true } }, workspace: { select: { id: true, name: true } }, _count: { select: { messages: true } } },
    });
  }

  @Get('admin/support-tickets/:id')
  async ticket(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    await this.rbac.assertGlobalPermission(a.userId, 'user.read');
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        workspace: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { displayName: true, email: true } } } },
      },
    });
    if (!t) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' });
    return t;
  }

  @Post('admin/support-tickets/:id/messages')
  async staffReply(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffReplyDto, @Req() req: Request) {
    await this.rbac.assertGlobalPermission(a.userId, 'user.manage');
    const t = await this.prisma.supportTicket.findUnique({ where: { id }, include: { user: true } });
    if (!t) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' });
    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({ data: { ticketId: id, authorUserId: a.userId, isStaff: true, body: dto.body.trim() } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: dto.status ?? 'WAITING_ON_CUSTOMER' } }),
    ]);
    await this.auditLog.record({ actorUserId: a.userId, actorRole: 'admin', action: 'admin.support.reply', targetType: 'support_ticket', targetId: id, requestMeta: requestMeta(req) });
    await this.notifications.notify({ workspaceId: t.workspaceId, userId: t.userId, eventKey: 'support.reply', title: `Reply to your request: ${t.subject}`, body: dto.body.slice(0, 500) });
    return this.ticket(a, id);
  }

  @Patch('admin/support-tickets/:id')
  async ticketStatus(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @Req() req: Request) {
    await this.rbac.assertGlobalPermission(a.userId, 'user.manage');
    const saved = await this.prisma.supportTicket.update({ where: { id }, data: { status: dto.status } });
    await this.auditLog.record({ actorUserId: a.userId, actorRole: 'admin', action: 'admin.support.status', targetType: 'support_ticket', targetId: id, afterState: { status: dto.status }, requestMeta: requestMeta(req) });
    return saved;
  }
}
