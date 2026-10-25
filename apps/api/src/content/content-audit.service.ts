import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiGateService } from '../ai/ai-gate.service';
import { OpenAiService } from '../ai/openai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';

type Metrics = { url?: string; finalUrl?: string; title?: string | null; metaDescription?: string | null; h1?: string[]; headings?: { level: number; text: string }[]; wordCount?: number; imageCount?: number; imagesMissingAlt?: number; internalLinks?: string[]; schemaTypes?: string[]; indexable?: boolean };

export type ContentPage = {
  url: string;
  title: string | null;
  words: number;
  h1: number;
  headings: number;
  questionHeadings: number;
  internalLinks: number;
  schema: string[];
  issues: string[];
};

const QUESTION_RE = /^(how|what|why|when|where|who|which|can|does|do|is|are|should|will)\b|\?$/i;
const THIN_WORDS = 300;

const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'quality', 'summary', 'recommendations'],
        properties: {
          url: { type: 'string' },
          quality: { type: 'string', enum: ['STRONG', 'ADEQUATE', 'WEAK'] },
          summary: { type: 'string' },
          recommendations: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

/**
 * Content Audit (V1 manual §2, OpenAI guide §4): a content inventory with
 * deterministic heading/text checks from the latest site audit; an optional
 * AI assessment of structure and quality is stored separately and labelled
 * as recommendations, never as measured data.
 */
@Injectable()
export class ContentAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly ai: AiGateService,
    private readonly openai: OpenAiService,
  ) {}

  /** Pure analysis of audited pages (exported for tests). */
  static analyze(pages: Metrics[]) {
    const byTitle = new Map<string, number>();
    const byDescription = new Map<string, number>();
    for (const m of pages) {
      if (m.title) byTitle.set(m.title.trim().toLowerCase(), (byTitle.get(m.title.trim().toLowerCase()) ?? 0) + 1);
      if (m.metaDescription) byDescription.set(m.metaDescription.trim().toLowerCase(), (byDescription.get(m.metaDescription.trim().toLowerCase()) ?? 0) + 1);
    }
    const rows: ContentPage[] = pages.map((m) => {
      const headings = m.headings ?? [];
      const issues: string[] = [];
      const words = m.wordCount ?? 0;
      if (words < THIN_WORDS) issues.push(`Thin content (${words} words)`);
      if (!m.title) issues.push('Missing title');
      else if ((byTitle.get(m.title.trim().toLowerCase()) ?? 0) > 1) issues.push('Duplicate title');
      if (!m.metaDescription) issues.push('Missing meta description');
      else if ((byDescription.get(m.metaDescription.trim().toLowerCase()) ?? 0) > 1) issues.push('Duplicate meta description');
      const h1 = (m.h1 ?? []).length;
      if (h1 === 0) issues.push('No H1');
      if (h1 > 1) issues.push('Multiple H1');
      for (let i = 1; i < headings.length; i++) {
        if (headings[i].level > headings[i - 1].level + 1) {
          issues.push(`Heading level skipped (H${headings[i - 1].level} → H${headings[i].level})`);
          break;
        }
      }
      if (words >= THIN_WORDS && headings.filter((x) => x.level === 2).length === 0) issues.push('Long text without H2 sections');
      if ((m.imageCount ?? 0) > 0 && (m.imagesMissingAlt ?? 0) > 0) issues.push(`${m.imagesMissingAlt} image(s) without alt text`);
      return {
        url: m.finalUrl || m.url || '',
        title: m.title ?? null,
        words,
        h1,
        headings: headings.length,
        questionHeadings: headings.filter((x) => QUESTION_RE.test(x.text.trim())).length,
        internalLinks: (m.internalLinks ?? []).length,
        schema: m.schemaTypes ?? [],
        issues,
      };
    });
    const total = rows.length;
    const summary = {
      pages: total,
      totalWords: rows.reduce((t, r) => t + r.words, 0),
      avgWords: total ? Math.round(rows.reduce((t, r) => t + r.words, 0) / total) : 0,
      thin: rows.filter((r) => r.words < THIN_WORDS).length,
      duplicateTitles: rows.filter((r) => r.issues.includes('Duplicate title')).length,
      missingDescriptions: rows.filter((r) => r.issues.includes('Missing meta description')).length,
      headingIssues: rows.filter((r) => r.issues.some((i) => i.startsWith('Heading level') || i.includes('H1'))).length,
      withQuestions: rows.filter((r) => r.questionHeadings > 0).length,
      withSchema: rows.filter((r) => r.schema.length > 0).length,
    };
    return { summary, pages: rows.sort((a, b) => b.issues.length - a.issues.length || a.words - b.words) };
  }

  async run(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'content.write');
    const run = await this.prisma.auditRun.findFirst({ where: { projectId, status: { in: ['SUCCEEDED', 'PARTIAL'] } }, orderBy: { completedAt: 'desc' }, include: { pages: { select: { metricsJson: true } } } });
    if (!run || !run.pages.length) throw new BadRequestException({ code: 'NO_AUDIT', message: 'Run a site audit first; the content audit analyzes the pages it crawled.' });
    const { summary, pages } = ContentAuditService.analyze(run.pages.map((p) => (p.metricsJson ?? {}) as Metrics));
    const row = await this.prisma.contentAudit.create({
      data: { projectId, sourceRunId: run.id, createdBy: actorId, summaryJson: { ...summary, auditedAt: run.completedAt?.toISOString() ?? null } as Prisma.InputJsonObject, pagesJson: pages as unknown as Prisma.InputJsonArray },
    });
    return this.view(row);
  }

  async list(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'content.read');
    const rows = await this.prisma.contentAudit.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, summaryJson: true, aiAt: true } });
    return rows;
  }

  async get(actorId: string, id: string) {
    const row = await this.prisma.contentAudit.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'CONTENT_AUDIT_NOT_FOUND', message: 'Content audit not found.' });
    await this.projects.requireProject(actorId, row.projectId, 'content.read');
    return this.view(row);
  }

  /** AI quality assessment for the pages with the most issues (max 10), stored with the audit. */
  async assess(actorId: string, id: string) {
    const row = await this.prisma.contentAudit.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'CONTENT_AUDIT_NOT_FOUND', message: 'Content audit not found.' });
    const project = await this.projects.requireProject(actorId, row.projectId, 'content.write');
    const pages = (row.pagesJson as unknown as ContentPage[]).slice(0, 10);
    const audit = await this.prisma.auditRun.findUnique({ where: { id: row.sourceRunId ?? '' }, include: { pages: { select: { metricsJson: true } } } });
    const headingsOf = new Map((audit?.pages ?? []).map((p) => { const m = (p.metricsJson ?? {}) as Metrics; return [m.finalUrl || m.url || '', (m.headings ?? []).slice(0, 40)]; }));
    const input = pages.map((p) => ({ url: p.url, title: p.title, words: p.words, issues: p.issues, headings: headingsOf.get(p.url) ?? [] }));
    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId: row.projectId, actorId, referenceType: 'content_audit', referenceId: id, operation: 'ai.content_audit' }, (usage) =>
      this.openai.generateJson<{ pages: { url: string; quality: string; summary: string; recommendations: string[] }[] }>(
        {
          system: 'You are a senior content strategist. Assess each page’s content structure and quality for search and AI answers using only the metrics and headings provided. Do not invent traffic, rankings or facts. Give specific, actionable recommendations.',
          prompt: `Pages (JSON):\n${JSON.stringify(input).slice(0, 60_000)}\n\nAssess every page.`,
          schema: AI_SCHEMA,
          name: 'content_audit',
          effort: 'medium',
        },
        { operation: 'ai.content_audit', ...usage },
      ),
    );
    const known = new Set(pages.map((p) => p.url));
    const ai = { generatedAt: new Date().toISOString(), model: this.openai.model, label: 'recommendation', pages: out.pages.filter((p) => known.has(p.url)) };
    const saved = await this.prisma.contentAudit.update({ where: { id }, data: { aiJson: ai as unknown as Prisma.InputJsonObject, aiAt: new Date() } });
    return this.view(saved);
  }

  private view(row: { id: string; projectId: string; createdAt: Date; summaryJson: Prisma.JsonValue; pagesJson: Prisma.JsonValue; aiJson: Prisma.JsonValue | null; aiAt: Date | null }) {
    return { id: row.id, projectId: row.projectId, createdAt: row.createdAt, summary: row.summaryJson, pages: row.pagesJson, ai: row.aiJson, aiAt: row.aiAt };
  }
}
