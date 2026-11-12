import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Put } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { SettingsService } from '../commerce/settings.service';
import { RbacService } from '../rbac/rbac.service';

/** Legal documents editable in Super Admin (V2 guide §1: CMS "legal revisions" and publication controls). */
export const LEGAL_KEYS = ['privacy', 'terms', 'cookies', 'dpa', 'refund', 'seller', 'regional'] as const;
export type LegalKey = (typeof LEGAL_KEYS)[number];

type Revision = { version: number; body: string; summary: string | null; publishedAt: string; publishedBy: string };
type LegalDoc = { draft: { body: string; updatedAt: string; updatedBy: string } | null; published: Revision | null; history: Omit<Revision, 'body'>[] };

const EMPTY: LegalDoc = { draft: null, published: null, history: [] };
const settingKey = (k: LegalKey) => `legal.page.${k}`;

class LegalDto {
  @IsString() @MaxLength(100_000) body: string;
  @IsOptional() @IsString() @MaxLength(300) summary?: string;
  @IsOptional() @IsBoolean() publish?: boolean;
}

@Injectable()
export class LegalService {
  constructor(
    private readonly settings: SettingsService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  private key(k: string): LegalKey {
    if (!(LEGAL_KEYS as readonly string[]).includes(k)) throw new NotFoundException({ code: 'LEGAL_NOT_FOUND', message: 'Unknown legal document.' });
    return k as LegalKey;
  }

  private load(k: LegalKey) {
    return this.settings.get<LegalDoc>(settingKey(k), EMPTY);
  }

  /** Published text only; null means the site shows its built-in text. */
  async published(k: string) {
    const doc = await this.load(this.key(k));
    return doc.published ? { body: doc.published.body, version: doc.published.version, publishedAt: doc.published.publishedAt } : null;
  }

  async list(userId: string) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    return Promise.all(LEGAL_KEYS.map(async (k) => ({ key: k, ...(await this.load(k)) })));
  }

  /** Save a draft, or publish a new numbered revision. Every change is audited; history is append-only. */
  async save(userId: string, k: string, input: LegalDto) {
    await this.rbac.assertGlobalPermission(userId, 'cms.manage');
    const key = this.key(k);
    const body = input.body.replace(/\r\n/g, '\n').trim();
    if (body.length < 50) throw new BadRequestException({ code: 'BODY_TOO_SHORT', message: 'Write the full document (at least 50 characters).' });
    const doc = await this.load(key);
    const now = new Date().toISOString();
    let next: LegalDoc;
    if (input.publish) {
      const version = (doc.published?.version ?? 0) + 1;
      const rev: Revision = { version, body, summary: input.summary?.trim() || null, publishedAt: now, publishedBy: userId };
      next = { draft: null, published: rev, history: [{ version, summary: rev.summary, publishedAt: now, publishedBy: userId }, ...doc.history].slice(0, 100) };
    } else {
      next = { ...doc, draft: { body, updatedAt: now, updatedBy: userId } };
    }
    await this.settings.set(settingKey(key), next as never, userId);
    await this.audit.record({ actorUserId: userId, actorRole: 'admin', action: input.publish ? 'legal.publish' : 'legal.draft', targetType: 'legal_page', targetId: null, afterState: { key, version: next.published?.version ?? null, summary: input.summary ?? null } });
    return { key, ...next };
  }
}

@Public()
@Controller('public/legal')
export class LegalPublicController {
  constructor(private readonly legal: LegalService) {}

  @Get(':key')
  get(@Param('key') key: string) {
    return this.legal.published(key);
  }
}

@Controller('admin/legal')
export class LegalAdminController {
  constructor(private readonly legal: LegalService) {}

  @Get()
  list(@CurrentActor() a: AuthenticatedActor) {
    return this.legal.list(a.userId);
  }

  @Put(':key')
  save(@CurrentActor() a: AuthenticatedActor, @Param('key') key: string, @Body() dto: LegalDto) {
    return this.legal.save(a.userId, key, dto);
  }
}

@Module({
  controllers: [LegalPublicController, LegalAdminController],
  providers: [LegalService],
})
export class LegalModule {}
