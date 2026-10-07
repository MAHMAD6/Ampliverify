import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EditorStatus, Prisma, SuggestionStatus, SuggestionType } from '@prisma/client';
import { load } from 'cheerio';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { AiGateService } from '../ai/ai-gate.service';
import { ClaudeService } from '../ai/claude.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { analyzePage, scoreFindings } from '../audits/analyzer';
import { RULES_BY_KEY } from '../audits/rules';
import { parsePublicUrl, safeFetch } from '../common/utils/safe-fetch';

export type DocumentContent = {
  html: string;
  title: string;
  metaDescription: string;
  slug?: string;
  focusKeyword?: string;
};

const SUGGESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'explanation', 'original', 'replacement'],
        properties: {
          type: { type: 'string', enum: ['CONTENT', 'STRUCTURE', 'KEYWORD', 'METADATA', 'LINK', 'READABILITY'] },
          title: { type: 'string' },
          explanation: { type: 'string' },
          original: { type: 'string', description: 'Exact text from the draft to replace, or empty when adding new text.' },
          replacement: { type: 'string', description: 'Proposed text (HTML allowed for content blocks).' },
        },
      },
    },
  },
};

const sanitizeHtml = (html: string) => {
  // Strip active content; the editor stores semantic HTML only.
  const $ = load(html, null, false);
  $('script,style,iframe,object,embed,form,link,meta').remove();
  $('*').each((_, el) => {
    for (const attr of Object.keys((el as { attribs?: Record<string, string> }).attribs ?? {})) {
      const value = $(el).attr(attr) ?? '';
      if (/^on/i.test(attr) || (/^(href|src)$/i.test(attr) && /^\s*(javascript|data|vbscript):/i.test(value))) $(el).removeAttr(attr);
    }
  });
  return $.html();
};

/**
 * On-Page SEO Editor: versioned documents (content in storage), live SEO/GEO
 * scoring with the audit rule engine, Claude suggestions that the user
 * accepts or rejects, and import of an existing page.
 */
@Injectable()
export class EditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly ai: AiGateService,
    private readonly claude: ClaudeService,
    private readonly storage: ContentStorageService,
    private readonly config: ConfigService,
  ) {}

  async list(actorId: string, projectId: string, status?: EditorStatus) {
    await this.projects.requireProject(actorId, projectId, 'editor.read');
    const docs = await this.prisma.editorDocument.findMany({
      where: { projectId, ...(status ? { status } : { status: { not: 'ARCHIVED' } }) },
      orderBy: { updatedAt: 'desc' },
      include: { page: { select: { url: true } }, creator: { select: { displayName: true, email: true } }, versions: { orderBy: { versionNo: 'desc' }, take: 1, select: { versionNo: true, createdAt: true } } },
      take: 300,
    });
    return docs.map((d) => ({ id: d.id, title: d.title, status: d.status, pageUrl: d.page?.url ?? null, updatedAt: d.updatedAt, createdBy: d.creator.displayName ?? d.creator.email, version: d.versions[0]?.versionNo ?? 0 }));
  }

  async create(actorId: string, projectId: string, input: { title: string; content?: Partial<DocumentContent>; pageUrl?: string }) {
    const project = await this.projects.requireProject(actorId, projectId, 'editor.write');
    let pageId: string | null = null;
    if (input.pageUrl) pageId = (await this.pageFor(projectId, input.pageUrl)).id;
    const doc = await this.prisma.editorDocument.create({ data: { projectId, title: input.title.trim(), createdBy: actorId, pageId } });
    await this.saveVersion(actorId, doc.id, { html: input.content?.html ?? '', title: input.content?.title ?? input.title, metaDescription: input.content?.metaDescription ?? '', slug: input.content?.slug, focusKeyword: input.content?.focusKeyword });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.editor.create', targetType: 'editor_document', targetId: doc.id });
    return this.get(actorId, doc.id);
  }

  /** Imports title, description and main content of an existing page into a new document. */
  async importPage(actorId: string, projectId: string, url: string) {
    await this.projects.requireProject(actorId, projectId, 'editor.write');
    const allowPrivate = this.config.get('AUDIT_ALLOW_PRIVATE_HOSTS') === 'true';
    parsePublicUrl(url, allowPrivate);
    const res = await safeFetch(url, { allowPrivate });
    if (res.status >= 400) throw new BadRequestException({ code: 'PAGE_UNAVAILABLE', message: `The page returned HTTP ${res.status}.` });
    const $ = load(res.body);
    const title = $('title').first().text().trim();
    const metaDescription = $('meta[name="description" i]').attr('content')?.trim() ?? '';
    const main = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
    main.find('script,style,noscript,nav,header,footer,aside,form,iframe,svg').remove();
    return this.create(actorId, projectId, { title: title || url, pageUrl: res.finalUrl, content: { html: sanitizeHtml(main.html() ?? ''), title, metaDescription } });
  }

  async get(actorId: string, id: string, versionNo?: number) {
    const doc = await this.findDoc(id);
    await this.projects.requireProject(actorId, doc.projectId, 'editor.read');
    const version = await this.prisma.editorVersion.findFirst({
      where: { documentId: id, ...(versionNo ? { versionNo } : {}) },
      orderBy: { versionNo: 'desc' },
      include: { suggestions: { orderBy: { createdAt: 'desc' } } },
    });
    const content = version ? await this.readContent(version.contentRef) : null;
    const versions = await this.prisma.editorVersion.findMany({ where: { documentId: id }, orderBy: { versionNo: 'desc' }, take: 50, select: { id: true, versionNo: true, createdAt: true, creator: { select: { displayName: true, email: true } } } });
    return {
      id: doc.id,
      projectId: doc.projectId,
      title: doc.title,
      status: doc.status,
      pageUrl: doc.page?.url ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: version ? { id: version.id, versionNo: version.versionNo, createdAt: version.createdAt } : null,
      content,
      analysis: content ? this.analyze(content, doc.page?.url) : null,
      suggestions: (version?.suggestions ?? []).map((s) => ({ id: s.id, type: s.type, status: s.status, createdAt: s.createdAt, ...(s.suggestionJson as object) })),
      versions: versions.map((v) => ({ id: v.id, versionNo: v.versionNo, createdAt: v.createdAt, author: v.creator.displayName ?? v.creator.email })),
      aiAvailable: this.ai.configured,
    };
  }

  /** Saves a new version (no-op when the content hash is unchanged). */
  async saveVersion(actorId: string, id: string, content: DocumentContent) {
    const doc = await this.findDoc(id);
    await this.projects.requireProject(actorId, doc.projectId, 'editor.write');
    const clean: DocumentContent = {
      html: sanitizeHtml(content.html ?? ''),
      title: (content.title ?? '').slice(0, 300),
      metaDescription: (content.metaDescription ?? '').slice(0, 500),
      slug: content.slug?.slice(0, 200),
      focusKeyword: content.focusKeyword?.slice(0, 200),
    };
    if (Buffer.byteLength(clean.html) > 2_000_000) throw new BadRequestException({ code: 'DOCUMENT_TOO_LARGE', message: 'This document is too large.' });
    const body = JSON.stringify(clean);
    const hash = createHash('sha256').update(body).digest('hex');
    const latest = await this.prisma.editorVersion.findFirst({ where: { documentId: id }, orderBy: { versionNo: 'desc' } });
    if (latest?.contentHash === hash) return { versionNo: latest.versionNo, unchanged: true };
    const versionNo = (latest?.versionNo ?? 0) + 1;
    const key = `editor/${doc.projectId}/${id}/v${versionNo}.json`;
    await this.storage.writeBuffer(key, Buffer.from(body, 'utf8'), 'application/json');
    await this.prisma.$transaction([
      this.prisma.editorVersion.create({ data: { documentId: id, versionNo, contentRef: key, contentHash: hash, createdBy: actorId } }),
      this.prisma.editorDocument.update({ where: { id }, data: { title: clean.title || doc.title, updatedAt: new Date() } }),
      this.prisma.editorChangeEvent.create({ data: { documentId: id, actorUserId: actorId, action: 'version.save', metadata: { versionNo } } }),
    ]);
    return { versionNo, unchanged: false, analysis: this.analyze(clean, doc.page?.url) };
  }

  async update(actorId: string, id: string, input: { title?: string; status?: EditorStatus }) {
    const doc = await this.findDoc(id);
    await this.projects.requireProject(actorId, doc.projectId, 'editor.write');
    const saved = await this.prisma.editorDocument.update({ where: { id }, data: { ...(input.title !== undefined && { title: input.title.trim() }), ...(input.status !== undefined && { status: input.status }) } });
    if (input.status) await this.prisma.editorChangeEvent.create({ data: { documentId: id, actorUserId: actorId, action: 'status.change', metadata: { from: doc.status, to: input.status } } });
    return saved;
  }

  /** Scores unsaved editor content (live feedback while typing). */
  async analyzeDraft(actorId: string, id: string, content: DocumentContent) {
    const doc = await this.findDoc(id);
    await this.projects.requireProject(actorId, doc.projectId, 'editor.read');
    return this.analyze({ ...content, html: sanitizeHtml(content.html) }, doc.page?.url);
  }

  /** Runs the audit rule engine on the draft (no network): scores + issues. */
  analyze(content: DocumentContent, url?: string | null) {
    const html = `<!doctype html><html lang="en"><head><title>${escapeHtml(content.title)}</title><meta name="description" content="${escapeHtml(content.metaDescription)}"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="${escapeHtml(url ?? 'https://draft.local/')}"></head><body>${content.html}</body></html>`;
    const result = analyzePage({ requestedUrl: url ?? 'https://draft.local/', finalUrl: url ?? 'https://draft.local/', status: 200, headers: { 'content-type': 'text/html' }, html, redirects: [], elapsedMs: 0, robotsAllowed: true });
    // Rules that depend on the live site, not the draft, are left to audits.
    const skip = new Set(['crawl.canonical_missing', 'crawl.canonical_other', 'tech.viewport_missing', 'tech.lang_missing', 'tech.not_https', 'seo.og_missing', 'schema.missing', 'geo.no_entity_schema']);
    const findings = result.findings.filter((f) => !skip.has(f.ruleKey));
    const focus = content.focusKeyword?.trim().toLowerCase();
    const text = load(content.html).text().toLowerCase();
    const keyword = focus
      ? {
          keyword: focus,
          inTitle: content.title.toLowerCase().includes(focus),
          inMeta: content.metaDescription.toLowerCase().includes(focus),
          inH1: result.metrics.h1.some((h) => h.toLowerCase().includes(focus)),
          occurrences: text.split(focus).length - 1,
          density: result.metrics.wordCount ? Math.round(((text.split(focus).length - 1) * focus.split(' ').length * 10000) / result.metrics.wordCount) / 100 : 0,
        }
      : null;
    return {
      scores: scoreFindings(findings),
      wordCount: result.metrics.wordCount,
      headings: result.metrics.headings,
      readingMinutes: Math.max(1, Math.round(result.metrics.wordCount / 230)),
      keyword,
      issues: findings.map((f) => {
        const rule = RULES_BY_KEY.get(f.ruleKey)!;
        return { ruleKey: f.ruleKey, title: rule.title, category: rule.category, severity: rule.severity, guidance: rule.guidance, details: f.details ?? null };
      }),
    };
  }

  async suggest(actorId: string, id: string, input: { focus?: SuggestionType; instruction?: string }) {
    const doc = await this.findDoc(id);
    const project = await this.projects.requireProject(actorId, doc.projectId, 'editor.write');
    const version = await this.prisma.editorVersion.findFirst({ where: { documentId: id }, orderBy: { versionNo: 'desc' } });
    if (!version) throw new BadRequestException({ code: 'EMPTY_DOCUMENT', message: 'Save the document before asking for suggestions.' });
    const content = (await this.readContent(version.contentRef))!;
    if (load(content.html).text().trim().length < 50) throw new BadRequestException({ code: 'DOCUMENT_TOO_SHORT', message: 'Write a little more before asking for suggestions.' });
    const analysis = this.analyze(content, doc.page?.url);
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: project.workspaceId } });
    const tone = (ws.settingsJson as { aiGeo?: { aiTone?: string } } | null)?.aiGeo?.aiTone;

    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId: project.id, actorId, referenceType: 'editor_document', referenceId: id }, (usageEventId) =>
      this.claude.generateJson<{ suggestions: { type: SuggestionType; title: string; explanation: string; original: string; replacement: string }[] }>(
        {
          system: `You are an on-page SEO and GEO editor. Suggest specific, minimal edits that improve how this page ranks in search and how likely AI assistants are to quote it: direct answers, clear headings, the focus keyword used naturally, accurate metadata, scannable structure. Quote "original" exactly from the draft so the edit can be applied. Never invent facts, numbers, quotes or sources.${tone ? ` Match this tone: ${tone}.` : ''} Write in ${ws.language}.`,
          prompt: `Focus keyword: ${content.focusKeyword || 'not set'}\nTitle tag: ${content.title}\nMeta description: ${content.metaDescription}\nDetected issues: ${analysis.issues.map((i) => i.title).join('; ') || 'none'}\n${input.focus ? `Concentrate on: ${input.focus}\n` : ''}${input.instruction ? `Writer's request: ${input.instruction}\n` : ''}\nDraft HTML:\n${content.html.slice(0, 60_000)}\n\nReturn up to 8 suggestions, most impactful first.`,
          schema: SUGGESTION_SCHEMA,
          effort: 'medium',
        },
        { operation: 'editor.suggest', usageEventId },
      ),
    );
    await this.prisma.$transaction(
      out.suggestions.slice(0, 8).map((s) =>
        this.prisma.editorSuggestion.create({
          data: { versionId: version.id, type: s.type, suggestionJson: { title: s.title, explanation: s.explanation, original: s.original, replacement: sanitizeHtml(s.replacement) }, modelRef: this.claude.model },
        }),
      ),
    );
    await this.prisma.editorChangeEvent.create({ data: { documentId: id, actorUserId: actorId, action: 'ai.suggest', metadata: { count: out.suggestions.length } } });
    return this.get(actorId, id);
  }

  async decideSuggestion(actorId: string, suggestionId: string, status: SuggestionStatus) {
    if (!['ACCEPTED', 'REJECTED', 'DISMISSED'].includes(status)) throw new BadRequestException({ code: 'INVALID_STATUS', message: 'Accept, reject or dismiss.' });
    const s = await this.prisma.editorSuggestion.findUnique({ where: { id: suggestionId }, include: { version: true } });
    if (!s) throw new NotFoundException({ code: 'SUGGESTION_NOT_FOUND', message: 'Suggestion not found.' });
    const doc = await this.findDoc(s.version.documentId);
    await this.projects.requireProject(actorId, doc.projectId, 'editor.write');
    if (s.status !== 'PENDING') throw new ConflictException({ code: 'SUGGESTION_DECIDED', message: 'This suggestion was already handled.' });
    await this.prisma.editorChangeEvent.create({ data: { documentId: doc.id, actorUserId: actorId, action: `suggestion.${status.toLowerCase()}`, metadata: { suggestionId } } });
    return this.prisma.editorSuggestion.update({ where: { id: suggestionId }, data: { status, decidedAt: new Date() } });
  }

  async history(actorId: string, id: string) {
    const doc = await this.findDoc(id);
    await this.projects.requireProject(actorId, doc.projectId, 'editor.read');
    return this.prisma.editorChangeEvent.findMany({ where: { documentId: id }, orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { displayName: true, email: true } } } });
  }

  async content(id: string) {
    const version = await this.prisma.editorVersion.findFirst({ where: { documentId: id }, orderBy: { versionNo: 'desc' } });
    return version ? this.readContent(version.contentRef) : null;
  }

  private async pageFor(projectId: string, url: string) {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const domain =
      (await this.prisma.domain.findFirst({ where: { projectId, host } })) ??
      (await this.prisma.domain.findFirst({ where: { projectId } }));
    if (!domain) throw new BadRequestException({ code: 'NO_PROJECT_DOMAIN', message: 'Add a website to this project first.' });
    return this.prisma.page.upsert({ where: { domainId_url: { domainId: domain.id, url } }, create: { domainId: domain.id, url }, update: {} });
  }

  private async findDoc(id: string) {
    const doc = await this.prisma.editorDocument.findUnique({ where: { id }, include: { page: { select: { url: true } } } });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' });
    return doc;
  }

  private async readContent(key: string): Promise<DocumentContent | null> {
    const text = await this.storage.readText(key);
    return text ? (JSON.parse(text) as DocumentContent) : null;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export type { Prisma };
