import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { ApplicationStatus, CmsContentType, JobStatus, PublishStatus, WorkArrangement } from '@prisma/client';
import { Request, Response } from 'express';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { ArticleKind, CmsService } from './cms.service';
import { CareersService } from './careers.service';

const KINDS: Record<string, ArticleKind> = { blog: 'BLOG', guides: 'GUIDE', help: 'HELP', 'case-studies': 'CASE_STUDY' };
const kindOf = (k: string) => {
  const kind = KINDS[k];
  if (!kind) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Unknown content type.' });
  return kind;
};

class ResultDto {
  @IsString() @MaxLength(80) label: string;
  @IsString() @MaxLength(80) value: string;
}
class ArticleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) excerpt?: string | null;
  @IsOptional() @IsString() @MaxLength(500_000) body?: string;
  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() categoryId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() authorId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() featuredMediaId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() publishedAt?: string | null;
  @IsOptional() @IsString() @MaxLength(160) customerName?: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ResultDto) results?: ResultDto[];
}
class CategoryDto {
  @IsEnum(CmsContentType) contentType: CmsContentType;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
}
class CategoryUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
}
class AuthorDto {
  @IsString() @MinLength(1) @MaxLength(120) displayName: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() userId?: string | null;
}
class MediaDto {
  @IsOptional() @IsString() @MaxLength(300) altText?: string | null;
}
class VideoDto {
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsUrl({ require_protocol: true }) videoUrl: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() thumbnailId?: string | null;
  @IsOptional() @IsInt() @Min(0) durationSec?: number | null;
  @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
}
class EventDto {
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string | null;
  @IsOptional() @IsString() @MaxLength(40) eventType?: string;
  @IsDateString() startsAt: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() endsAt?: string | null;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsString() @MaxLength(300) locationText?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUrl({ require_protocol: true }) registrationUrl?: string | null;
  @IsOptional() @IsEnum(PublishStatus) status?: PublishStatus;
}
class JobDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) slug?: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string | null;
  @IsOptional() @IsString() @MaxLength(200) locationText?: string | null;
  @IsOptional() @IsString() @MaxLength(60) employmentType?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsEnum(WorkArrangement) workArrangement?: WorkArrangement | null;
  @IsOptional() @IsString() @MaxLength(200) compensationText?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) summary?: string | null;
  @IsOptional() @IsString() @MaxLength(200_000) description?: string;
  @IsOptional() @IsBoolean() showOnCareersPage?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() applicationDeadline?: string | null;
  @IsOptional() @IsBoolean() requireResume?: boolean;
  @IsOptional() @IsBoolean() requireCoverLetter?: boolean;
  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string | null;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
}
class AppStatusDto {
  @IsEnum(ApplicationStatus) status: ApplicationStatus;
}
class NoteDto {
  @IsString() @MinLength(1) @MaxLength(5000) note: string;
}
class ApplyDto {
  @IsString() @MinLength(1) @MaxLength(100) firstName: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) linkedinUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) portfolioUrl?: string;
  @IsOptional() @IsString() @MaxLength(5000) message?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

type MulterFile = { buffer: Buffer; size: number; originalname: string };
const uploadLimits = { limits: { fileSize: 10 * 1024 * 1024, files: 2 } };

@Controller()
export class CmsController {
  constructor(
    private readonly cms: CmsService,
    private readonly careers: CareersService,
  ) {}

  @Get('admin/content/overview')
  overview(@CurrentActor() a: AuthenticatedActor) {
    return this.cms.overview(a.userId);
  }

  // Articles: /admin/content/{blog|guides|help|case-studies}
  @Get('admin/content/:kind')
  list(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string, @Query() q: Record<string, string>) {
    return this.cms.listArticles(a.userId, kindOf(kind), q);
  }
  @Post('admin/content/:kind')
  create(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string, @Body() dto: ArticleDto, @Req() req: Request) {
    return this.cms.createArticle(a.userId, kindOf(kind), dto, requestMeta(req));
  }
  @Get('admin/content/:kind/:id')
  get(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.cms.getArticle(a.userId, kindOf(kind), id);
  }
  @Patch('admin/content/:kind/:id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArticleDto, @Req() req: Request) {
    return this.cms.updateArticle(a.userId, kindOf(kind), id, dto, requestMeta(req));
  }
  @Delete('admin/content/:kind/:id')
  remove(@CurrentActor() a: AuthenticatedActor, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.cms.deleteArticle(a.userId, kindOf(kind), id, requestMeta(req));
  }

  @Get('admin/categories')
  categories(@CurrentActor() a: AuthenticatedActor, @Query('type') type?: CmsContentType) {
    return this.cms.categories(a.userId, type && type in CmsContentType ? type : undefined);
  }
  @Post('admin/categories')
  createCategory(@CurrentActor() a: AuthenticatedActor, @Body() dto: CategoryDto, @Req() req: Request) {
    return this.cms.createCategory(a.userId, dto, requestMeta(req));
  }
  @Patch('admin/categories/:id')
  updateCategory(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryUpdateDto) {
    return this.cms.updateCategory(a.userId, id, dto);
  }
  @Delete('admin/categories/:id')
  deleteCategory(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.cms.deleteCategory(a.userId, id, requestMeta(req));
  }
  @Get('admin/tags')
  tags(@CurrentActor() a: AuthenticatedActor) {
    return this.cms.tags(a.userId);
  }
  @Get('admin/authors')
  authors(@CurrentActor() a: AuthenticatedActor) {
    return this.cms.authors(a.userId);
  }
  @Post('admin/authors')
  createAuthor(@CurrentActor() a: AuthenticatedActor, @Body() dto: AuthorDto, @Req() req: Request) {
    return this.cms.upsertAuthor(a.userId, null, dto, requestMeta(req));
  }
  @Patch('admin/authors/:id')
  updateAuthor(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AuthorDto, @Req() req: Request) {
    return this.cms.upsertAuthor(a.userId, id, dto, requestMeta(req));
  }
  @Delete('admin/authors/:id')
  deleteAuthor(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.cms.deleteAuthor(a.userId, id);
  }

  @Get('admin/media')
  media(@CurrentActor() a: AuthenticatedActor, @Query('q') q?: string) {
    return this.cms.media(a.userId, q);
  }
  @Post('admin/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@CurrentActor() a: AuthenticatedActor, @UploadedFile() file: MulterFile | undefined, @Body() dto: MediaDto, @Req() req: Request) {
    return this.cms.upload(a.userId, file, dto.altText ?? undefined, requestMeta(req));
  }
  @Patch('admin/media/:id')
  updateMedia(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MediaDto) {
    return this.cms.updateMedia(a.userId, id, dto.altText ?? null);
  }
  @Delete('admin/media/:id')
  deleteMedia(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.cms.deleteMedia(a.userId, id, requestMeta(req));
  }
  @Public()
  @Get('public/media/:id')
  async mediaFile(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const f = await this.cms.mediaFile(id);
    res.setHeader('content-type', f.mimeType);
    res.setHeader('cache-control', 'public, max-age=86400');
    res.setHeader('x-content-type-options', 'nosniff');
    res.send(f.body);
  }

  @Get('admin/videos')
  videos(@CurrentActor() a: AuthenticatedActor) {
    return this.cms.videos(a.userId);
  }
  @Post('admin/videos')
  createVideo(@CurrentActor() a: AuthenticatedActor, @Body() dto: VideoDto, @Req() req: Request) {
    return this.cms.saveVideo(a.userId, null, dto, requestMeta(req));
  }
  @Patch('admin/videos/:id')
  updateVideo(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VideoDto, @Req() req: Request) {
    return this.cms.saveVideo(a.userId, id, dto, requestMeta(req));
  }
  @Delete('admin/videos/:id')
  deleteVideo(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.cms.deleteVideo(a.userId, id);
  }
  @Get('admin/events')
  events(@CurrentActor() a: AuthenticatedActor) {
    return this.cms.events(a.userId);
  }
  @Post('admin/events')
  createEvent(@CurrentActor() a: AuthenticatedActor, @Body() dto: EventDto, @Req() req: Request) {
    return this.cms.saveEvent(a.userId, null, dto, requestMeta(req));
  }
  @Patch('admin/events/:id')
  updateEvent(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EventDto, @Req() req: Request) {
    return this.cms.saveEvent(a.userId, id, dto, requestMeta(req));
  }
  @Delete('admin/events/:id')
  deleteEvent(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.cms.deleteEvent(a.userId, id);
  }

  // ── Careers ────────────────────────────────────────────────────────────

  @Get('admin/jobs')
  jobs(@CurrentActor() a: AuthenticatedActor, @Query('status') status?: JobStatus) {
    return this.careers.list(a.userId, status && status in JobStatus ? status : undefined);
  }
  @Post('admin/jobs')
  createJob(@CurrentActor() a: AuthenticatedActor, @Body() dto: JobDto, @Req() req: Request) {
    return this.careers.create(a.userId, dto, requestMeta(req));
  }
  @Get('admin/jobs/:id')
  job(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.careers.get(a.userId, id);
  }
  @Patch('admin/jobs/:id')
  updateJob(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: JobDto, @Req() req: Request) {
    return this.careers.update(a.userId, id, dto, requestMeta(req));
  }
  @Delete('admin/jobs/:id')
  deleteJob(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.careers.remove(a.userId, id, requestMeta(req));
  }
  @Get('admin/applications')
  applications(@CurrentActor() a: AuthenticatedActor, @Query('jobId') jobId?: string, @Query('status') status?: ApplicationStatus, @Query('q') q?: string) {
    return this.careers.applications(a.userId, { jobId, status: status && status in ApplicationStatus ? status : undefined, q });
  }
  @Get('admin/applications/:id')
  application(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.careers.application(a.userId, id);
  }
  @Patch('admin/applications/:id')
  applicationStatus(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AppStatusDto, @Req() req: Request) {
    return this.careers.setApplicationStatus(a.userId, id, dto.status, requestMeta(req));
  }
  @Post('admin/applications/:id/notes')
  note(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.careers.addNote(a.userId, id, dto.note);
  }
  @Get('admin/applicant-files/:id')
  async file(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
    const f = await this.careers.downloadFile(a.userId, id, requestMeta(req));
    res.setHeader('content-type', f.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${f.filename}"`);
    res.setHeader('x-content-type-options', 'nosniff');
    res.send(f.body);
  }
  @Post('admin/applicant-files/:id/rescan')
  rescan(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.careers.rescan(a.userId, id);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('public/careers/:slug/apply')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'resume', maxCount: 1 }, { name: 'coverLetter', maxCount: 1 }], uploadLimits))
  apply(@Param('slug') slug: string, @Body() dto: ApplyDto, @UploadedFiles() files: { resume?: MulterFile[]; coverLetter?: MulterFile[] }, @Req() req: Request) {
    return this.careers.apply(slug, dto, { resume: files?.resume?.[0], coverLetter: files?.coverLetter?.[0] }, req.ip);
  }

  @Public()
  @Get('public/careers/:slug/applications/:receipt')
  receipt(@Param('slug') slug: string, @Param('receipt', ParseUUIDPipe) receipt: string) {
    return this.careers.receipt(slug, receipt);
  }
}

