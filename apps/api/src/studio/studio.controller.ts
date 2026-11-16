import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { ContentStorageService } from '../storage/content-storage.service';
import { PROVIDER_FIELDS, PROVIDERS } from './studio.adapters';
import { MEDIA_LIMITS, StudioMediaService } from './studio-media.service';
import { StudioService } from './studio.service';

type Body_ = Record<string, unknown>;
type MulterFile = { buffer: Buffer; size: number; originalname: string };

/**
 * SEO Editor Studio routes (V13.2 guide §4 route map), under /api/v1. The web
 * app proxies the editor's /api/workspaces/... calls here with the signed-in
 * user's token; workspace access is checked on every request.
 */
@Controller('workspaces/:workspaceId')
export class StudioController {
  constructor(
    private readonly studio: StudioService,
    private readonly media: StudioMediaService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('ai/generate')
  @HttpCode(200)
  ai(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Body() body: Body_) {
    return this.studio.generate(a.userId, ws, body);
  }

  @Get('articles')
  drafts(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string) {
    return this.studio.listDrafts(a.userId, ws);
  }

  @Get('articles/:articleKey')
  getDraft(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('articleKey') key: string) {
    return this.studio.getDraft(a.userId, ws, key);
  }

  @Put('articles/:articleKey')
  saveDraft(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('articleKey') key: string, @Body() body: Body_) {
    return this.studio.saveDraft(a.userId, ws, key, body);
  }

  @Get('articles/:articleKey/revisions')
  revisions(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('articleKey') key: string) {
    return this.studio.revisions(a.userId, ws, key);
  }

  @Get('articles/:articleKey/revisions/:revision')
  revision(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('articleKey') key: string, @Param('revision', ParseIntPipe) revision: number) {
    return this.studio.revision(a.userId, ws, key, revision);
  }

  @Post('articles/:articleKey/revisions/:revision/restore')
  restore(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('articleKey') key: string, @Param('revision', ParseIntPipe) revision: number, @Body() body: Body_) {
    return this.studio.restore(a.userId, ws, key, revision, body);
  }

  @Get('connections')
  connections(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string) {
    return this.studio.connections(a.userId, ws);
  }

  @Post('connections')
  connect(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Body() body: Body_) {
    return this.studio.createConnection(a.userId, ws, body);
  }

  @Delete('connections/:connectionId')
  disconnect(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('connectionId') id: string) {
    return this.studio.removeConnection(a.userId, ws, id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('connections/:connectionId/publish')
  @HttpCode(200)
  publish(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('connectionId') id: string, @Body() body: Body_) {
    return this.studio.publish(a.userId, ws, id, body);
  }

  @Get('connections/:connectionId/publications')
  publications(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('connectionId') id: string) {
    return this.studio.publications(a.userId, ws, id);
  }

  @Post('connections/:connectionId/publications/:articleKey/reconcile')
  @HttpCode(200)
  reconcile(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('connectionId') id: string, @Param('articleKey') key: string, @Body() body: Body_) {
    return this.studio.reconcile(a.userId, ws, id, key, body);
  }

  @Get('forms')
  forms(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string) {
    return this.studio.forms(a.userId, ws);
  }

  @Post('forms')
  createForm(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Body() body: Body_) {
    return this.studio.createForm(a.userId, ws, body);
  }

  @Delete('forms/:id')
  removeForm(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('id') id: string) {
    return this.studio.removeForm(a.userId, ws, id);
  }

  @Get('forms/:id/submissions')
  submissions(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('id') id: string) {
    return this.studio.submissions(a.userId, ws, id);
  }

  @Post('media/init')
  mediaInit(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Body() body: Body_) {
    return this.media.init(a.userId, ws, body);
  }

  @Post('media/complete')
  @HttpCode(200)
  mediaComplete(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Body() body: Body_) {
    return this.media.complete(a.userId, ws, body);
  }

  @Get('media/:mediaId/status')
  mediaStatus(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('mediaId') id: string) {
    return this.media.status(a.userId, ws, id);
  }

  @Post('media/:mediaId/resolve')
  @HttpCode(200)
  mediaResolve(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Param('mediaId') id: string, @Body() body: Body_) {
    return this.media.resolve(a.userId, ws, id, body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('exports')
  async export(@CurrentActor() a: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) ws: string, @Body() body: Body_, @Res() res: Response) {
    const file = await this.studio.export(a.userId, ws, body);
    res.setHeader('Content-Type', file.ctype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(file.bytes);
  }
}

/** Public endpoints: hosted forms, signed media uploads and approved media delivery. */
@Public()
@Controller()
export class StudioPublicController {
  constructor(
    private readonly studio: StudioService,
    private readonly media: StudioMediaService,
    private readonly storage: ContentStorageService,
  ) {}

  @Get('studio/providers')
  providers() {
    return { providers: PROVIDERS, fields: PROVIDER_FIELDS };
  }

  @Get('forms/public/:id')
  async hostedForm(@Param('id') id: string, @Res() res: Response) {
    const page = await this.studio.publicFormPage(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', page.csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.removeHeader('X-Frame-Options');
    res.status(200).send(page.html);
  }

  @Get('forms/public/:id/schema')
  schema(@Param('id') id: string) {
    return this.studio.publicFormSchema(id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('forms/public/:id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @Body() body: Body_, @Req() req: Request) {
    return this.studio.submitForm(id, body, req.ip);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('studio/uploads/:id')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEDIA_LIMITS.video, files: 1, fields: 10 } }))
  upload(@Param('id') id: string, @Body() fields: Body_, @UploadedFile() file: MulterFile | undefined) {
    return this.media.receive(id, fields, file);
  }

  /** Approved editor media, served for published articles (supports Range for video seeking). */
  @Get('studio/media/:file')
  async deliver(@Param('file') file: string, @Headers('range') range: string | undefined, @Res() res: Response) {
    const m = await this.media.deliverable(file);
    const mime = m.detectedMime ?? m.declaredMime;
    const signed = await this.storage.signedUrl(m.deliveryKey!, { contentType: mime, inline: true, expiresInSeconds: 3600 });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (signed) {
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.redirect(302, signed.url);
      return;
    }
    const bytes = await this.storage.readBuffer(m.deliveryKey!);
    if (!bytes) {
      res.status(404).json({ data: null, error: { code: 'MEDIA_NOT_FOUND', message: 'Not found.' } });
      return;
    }
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const r = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (r && (r[1] || r[2])) {
      const size = bytes.length;
      let start = r[1] ? Number(r[1]) : size - Number(r[2]);
      let end = r[1] && r[2] ? Number(r[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end || start >= size) {
        res.setHeader('Content-Range', `bytes */${size}`);
        res.status(416).end();
        return;
      }
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.status(206).send(bytes.subarray(start, end + 1));
      return;
    }
    res.status(200).send(bytes);
  }
}
