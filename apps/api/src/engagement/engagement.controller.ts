import { Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommentStatus } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { ARTICLE_TYPES, EngagementService } from './engagement.service';

class CommentDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(2) @MaxLength(3000) body: string;
  /** Honeypot (must stay empty). */
  @IsOptional() @IsString() @MaxLength(300) website?: string;
}
class VoteDto {
  @IsBoolean() helpful: boolean;
}
class SubscribeDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsString() @MaxLength(60) source?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
}
class TokenDto {
  @IsString() @MinLength(10) @MaxLength(100) token: string;
}
class ModerateDto {
  @IsEnum(CommentStatus) status: CommentStatus;
}

const typeOf = (kind: string) => {
  const t = ARTICLE_TYPES[kind];
  if (!t) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found.' });
  return t;
};

@Controller()
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Public()
  @Get('public/:kind/:slug/comments')
  comments(@Param('kind') kind: string, @Param('slug') slug: string) {
    return this.engagement.approvedComments(typeOf(kind), slug);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/:kind/:slug/comments')
  comment(@Param('kind') kind: string, @Param('slug') slug: string, @Body() dto: CommentDto, @Req() req: Request) {
    return this.engagement.submitComment(typeOf(kind), slug, dto, requestMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('public/:kind/:slug/feedback')
  vote(@Param('kind') kind: string, @Param('slug') slug: string, @Body() dto: VoteDto, @Req() req: Request) {
    return this.engagement.vote(typeOf(kind), slug, dto.helpful, requestMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/newsletter')
  subscribe(@Body() dto: SubscribeDto, @Req() req: Request) {
    return this.engagement.subscribe(dto, requestMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('public/newsletter/confirm')
  confirm(@Body() dto: TokenDto) {
    return this.engagement.confirm(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('public/newsletter/unsubscribe')
  unsubscribe(@Body() dto: TokenDto) {
    return this.engagement.unsubscribe(dto.token);
  }

  // ── Super Admin ───────────────────────────────────────────────────────
  @Get('admin/comments')
  adminComments(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.engagement.adminComments(a.userId, { status });
  }

  @Patch('admin/comments/:id')
  moderate(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateDto, @Req() req: Request) {
    return this.engagement.moderate(a.userId, id, dto.status, requestMeta(req));
  }

  @Delete('admin/comments/:id')
  deleteComment(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.engagement.deleteComment(a.userId, id, requestMeta(req));
  }

  @Get('admin/feedback/:kind')
  feedback(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string) {
    return this.engagement.feedbackTotals(a.userId, typeOf(kind));
  }

  @Get('admin/newsletter')
  subscribers(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: string) {
    return this.engagement.subscribers(a.userId, { status });
  }

  @Get('admin/newsletter/export')
  async export(@CurrentActor() a: AuthenticatedActor, @Req() req: Request, @Res() res: Response) {
    const csv = await this.engagement.exportSubscribers(a.userId, requestMeta(req));
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="newsletter-subscribers.csv"');
    res.send(csv);
  }

  @Delete('admin/newsletter/:id')
  deleteSubscriber(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.engagement.deleteSubscriber(a.userId, id, requestMeta(req));
  }
}
