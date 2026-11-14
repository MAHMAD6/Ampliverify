import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { SettingsService } from '../commerce/settings.service';
import { RbacService } from '../rbac/rbac.service';

/** Simple CMS pages (V2 guide §1: CRUD /admin/public-pages with publish statuses and preview before live). */
const SETTING = 'cms.public_pages';
const MAX_PAGES = 200;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Content = { title: string; description: string | null; body: string };
type PageRow = {
  slug: string;
  draft: (Content & { updatedAt: string; updatedBy: string }) | null;
  published: (Content & { publishedAt: string; publishedBy: string }) | null;
  createdAt: string;
};

class PageDto {
  @IsString() @MinLength(3) @MaxLength(80) @Matches(SLUG, { message: 'Use lowercase letters, numbers and hyphens.' }) slug: string;
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsString() @MaxLength(100_000) body: string;
}

class PageUpdateDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsString() @MaxLength(100_000) body: string;
}

@Injectable()
export class PublicPagesService {
  constructor(
    private readonly settings: SettingsService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  private load() {
    return this.settings.get<PageRow[]>(SETTING, []);
  }

  private async save(rows: PageRow[], userId: string) {
    await this.settings.set(SETTING, rows as never, userId);
  }

  private content(input: { title: string; description?: string; body: string }): Content {
    const body = input.body.replace(/\r\n/g, '\n').trim();
    if (body.length < 20) throw new BadRequestException({ code: 'BODY_TOO_SHORT', message: 'Write the page content (at least 20 characters).' });
    return { title: input.title.trim(), description: input.description?.trim() || null, body };
  }

  private view(p: PageRow) {
    return { ...p, status: p.published ? (p.draft ? 'PUBLISHED_WITH_CHANGES' : 'PUBLISHED') : 'DRAFT' };
  }

  async published(slug: string) {
    const p = (await this.load()).find((r) => r.slug === slug);
    if (!p?.published) throw new NotFoundException({ code: 'PAGE_NOT_FOUND', message: 'Page not found.' });
    const { title, description, body, publishedAt } = p.published;
    return { slug, title, description, body, publishedAt };
  }

  /** Slugs and dates of published pages, for the sitemap. */
  async publishedList() {
    return (await this.load()).filter((r) => r.published).map((r) => ({ slug: r.slug, title: r.published!.title, publishedAt: r.published!.publishedAt }));
  }

  async list(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    return (await this.load()).map((p) => this.view(p));
  }

  async create(userId: string, dto: PageDto) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const rows = await this.load();
    if (rows.some((r) => r.slug === dto.slug)) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'A page with this address already exists.' });
    if (rows.length >= MAX_PAGES) throw new BadRequestException({ code: 'TOO_MANY_PAGES', message: `Up to ${MAX_PAGES} pages.` });
    const now = new Date().toISOString();
    const row: PageRow = { slug: dto.slug, draft: { ...this.content(dto), updatedAt: now, updatedBy: userId }, published: null, createdAt: now };
    await this.save([...rows, row], userId);
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: 'public_page.create', targetType: 'public_page', targetId: null, afterState: { slug: dto.slug } });
    return this.view(row);
  }

  private async mutate(userId: string, slug: string, fn: (p: PageRow) => PageRow | null, action: string) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const rows = await this.load();
    const i = rows.findIndex((r) => r.slug === slug);
    if (i < 0) throw new NotFoundException({ code: 'PAGE_NOT_FOUND', message: 'Page not found.' });
    const next = fn(rows[i]);
    const out = next ? rows.map((r, j) => (j === i ? next : r)) : rows.filter((_, j) => j !== i);
    await this.save(out, userId);
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: `public_page.${action}`, targetType: 'public_page', targetId: null, afterState: { slug } });
    return next ? this.view(next) : { slug, deleted: true };
  }

  /** Saves a draft; the live page changes only when the draft is published. */
  update(userId: string, slug: string, dto: PageUpdateDto) {
    return this.mutate(userId, slug, (p) => ({ ...p, draft: { ...this.content(dto), updatedAt: new Date().toISOString(), updatedBy: userId } }), 'draft');
  }

  publish(userId: string, slug: string) {
    return this.mutate(
      userId,
      slug,
      (p) => {
        if (!p.draft) throw new BadRequestException({ code: 'NOTHING_TO_PUBLISH', message: 'There are no unpublished changes.' });
        const { title, description, body } = p.draft;
        return { ...p, draft: null, published: { title, description, body, publishedAt: new Date().toISOString(), publishedBy: userId } };
      },
      'publish',
    );
  }

  /** Takes the page offline and keeps its text as a draft. */
  unpublish(userId: string, slug: string) {
    return this.mutate(
      userId,
      slug,
      (p) => {
        if (!p.published) throw new BadRequestException({ code: 'NOT_PUBLISHED', message: 'This page is not published.' });
        const { title, description, body } = p.draft ?? p.published;
        return { ...p, published: null, draft: { title, description, body, updatedAt: new Date().toISOString(), updatedBy: userId } };
      },
      'unpublish',
    );
  }

  remove(userId: string, slug: string) {
    return this.mutate(
      userId,
      slug,
      (p) => {
        if (p.published) throw new BadRequestException({ code: 'UNPUBLISH_FIRST', message: 'Unpublish the page before deleting it.' });
        return null;
      },
      'delete',
    );
  }
}

@Public()
@Controller('public/pages')
export class PublicPagesController {
  constructor(private readonly pages: PublicPagesService) {}

  @Get()
  list() {
    return this.pages.publishedList();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.pages.published(slug);
  }
}

@Controller('admin/public-pages')
export class AdminPublicPagesController {
  constructor(private readonly pages: PublicPagesService) {}

  @Get()
  list(@CurrentActor() a: AuthenticatedActor) {
    return this.pages.list(a.userId);
  }

  @Post()
  create(@CurrentActor() a: AuthenticatedActor, @Body() dto: PageDto) {
    return this.pages.create(a.userId, dto);
  }

  @Put(':slug')
  update(@CurrentActor() a: AuthenticatedActor, @Param('slug') slug: string, @Body() dto: PageUpdateDto) {
    return this.pages.update(a.userId, slug, dto);
  }

  @Post(':slug/publish')
  publish(@CurrentActor() a: AuthenticatedActor, @Param('slug') slug: string) {
    return this.pages.publish(a.userId, slug);
  }

  @Post(':slug/unpublish')
  unpublish(@CurrentActor() a: AuthenticatedActor, @Param('slug') slug: string) {
    return this.pages.unpublish(a.userId, slug);
  }

  @Delete(':slug')
  remove(@CurrentActor() a: AuthenticatedActor, @Param('slug') slug: string) {
    return this.pages.remove(a.userId, slug);
  }
}
