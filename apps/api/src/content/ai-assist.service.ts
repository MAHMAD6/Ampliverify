import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiGateService } from '../ai/ai-gate.service';
import { OpenAiService } from '../ai/openai.service';
import { EditorService } from '../editor/editor.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ContentStorageService } from '../storage/content-storage.service';

const EXPLAIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation', 'impact', 'steps', 'example'],
  properties: {
    explanation: { type: 'string' },
    impact: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    example: { type: 'string', description: 'A corrected example (e.g. a rewritten title) or empty when not applicable.' },
  },
};

const SECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['html'],
  properties: { html: { type: 'string', description: 'The section body as semantic HTML (p, ul, ol, li, h3, strong, em, a). No h1/h2.' } },
};

const GEO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'recommendations'],
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'action', 'evidence'],
        properties: { title: { type: 'string' }, why: { type: 'string' }, action: { type: 'string' }, evidence: { type: 'string', description: 'Which observed fact this is based on.' } },
      },
    },
  },
};

type Outline = { heading: string; level?: number; points?: string[] }[];

/**
 * OpenAI-assisted features from the OpenAI integration guide §4: explaining
 * audit findings, drafting articles section by section into an editor draft,
 * and GEO recommendations grounded in saved AI Mode / AI Overview evidence.
 * Output is always a suggestion: nothing is published and no metric is invented.
 */
@Injectable()
export class AiAssistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly ai: AiGateService,
    private readonly openai: OpenAiService,
    private readonly editor: EditorService,
    private readonly storage: ContentStorageService,
  ) {}

  // ── On-Page SEO Audit: explain a finding and recommend the correction ──

  async explainFinding(actorId: string, findingId: string, refresh = false) {
    const f = await this.prisma.auditFinding.findUnique({ where: { id: findingId }, include: { auditPage: { include: { page: true, auditRun: true } } } });
    if (!f) throw new NotFoundException({ code: 'FINDING_NOT_FOUND', message: 'Finding not found.' });
    const project = await this.projects.requireProject(actorId, f.auditPage.auditRun.projectId, 'seo.audit.run');
    const key = `ai-explanations/${project.id}/${findingId}.json`;
    if (!refresh) {
      const cached = await this.storage.readText(key);
      if (cached) return JSON.parse(cached) as unknown;
    }
    const m = (f.auditPage.metricsJson ?? {}) as { title?: string | null; metaDescription?: string | null; h1?: string[]; wordCount?: number };
    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId: project.id, actorId, referenceType: 'audit_finding', referenceId: findingId, operation: 'ai.finding_explanation' }, (usage) =>
      this.openai.generateJson<{ explanation: string; impact: string; steps: string[]; example: string }>(
        {
          system: 'You are a senior technical SEO. Explain the audit finding in plain language for a site owner and give exact correction steps. Use only the page facts provided; do not invent ranking data or traffic.',
          prompt: `Finding: ${f.ruleKey} (${f.severity})\nDetails: ${JSON.stringify(f.detailsJson ?? {}).slice(0, 4000)}\nPage: ${f.auditPage.page.url}\nTitle: ${m.title ?? '—'}\nMeta description: ${m.metaDescription ?? '—'}\nH1: ${(m.h1 ?? []).join(' | ') || '—'}\nWords: ${m.wordCount ?? '—'}`,
          schema: EXPLAIN_SCHEMA,
          name: 'finding_explanation',
          effort: 'low',
          maxTokens: 2000,
        },
        { operation: 'ai.finding_explanation', ...usage },
      ),
    );
    const result = { ...out, findingId, generatedAt: new Date().toISOString(), model: this.openai.model, label: 'recommendation' };
    await this.storage.writeBuffer(key, Buffer.from(JSON.stringify(result), 'utf8'), 'application/json');
    return result;
  }

  // ── Article writing: outline → sections → editor draft ────────────────

  /** Drafts the article for a brief one section at a time and saves it as a new editor draft (never published). */
  async draftArticle(actorId: string, briefId: string) {
    const brief = await this.prisma.contentBrief.findUnique({ where: { id: briefId }, include: { primaryKeyword: true } });
    if (!brief) throw new NotFoundException({ code: 'BRIEF_NOT_FOUND', message: 'Brief not found.' });
    const project = await this.projects.requireProject(actorId, brief.projectId, 'content.write');
    const b = (brief.briefJson ?? {}) as { outline?: Outline; questions?: string[]; secondaryKeywords?: string[]; audience?: string; searchIntent?: string; metaDescription?: string; title?: string };
    const outline = (b.outline ?? []).filter((o) => o.heading?.trim()).slice(0, 10);
    if (outline.length === 0) throw new BadRequestException({ code: 'BRIEF_HAS_NO_OUTLINE', message: 'Generate or write the brief outline first; the draft follows it section by section.' });
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: project.workspaceId } });
    const keyword = brief.primaryKeyword?.normalizedTerm ?? '';
    const sections = await this.ai.run({ workspaceId: project.workspaceId, projectId: project.id, actorId, referenceType: 'content_brief', referenceId: briefId, operation: 'ai.article_draft' }, async (usage) => {
      const parts: { heading: string; html: string }[] = [];
      // Manageable sections: one bounded request per outline heading.
      for (const o of outline) {
        const out = await this.openai.generateJson<{ html: string }>(
          {
            system: `You are an expert SEO writer. Write one section of an article in ${ws.language}. Be accurate and specific; do not invent statistics, quotes, sources or rankings. Answer the reader's question directly in the first sentence.`,
            prompt: `Article: ${brief.title}\nFocus keyword: ${keyword || 'none'}\nAudience: ${b.audience ?? '—'}\nIntent: ${b.searchIntent ?? '—'}\nSection heading: ${o.heading}\nPoints to cover: ${(o.points ?? []).join('; ') || '—'}\nRelated questions: ${(b.questions ?? []).slice(0, 8).join('; ')}\nAlready written sections: ${parts.map((p) => p.heading).join('; ') || 'none'}\n\nWrite this section only (150–350 words).`,
            schema: SECTION_SCHEMA,
            name: 'article_section',
            effort: 'low',
            maxTokens: 3000,
          },
          { operation: 'ai.article_draft', ...usage },
        );
        parts.push({ heading: o.heading, html: out.html });
      }
      return parts;
    });
    const escape = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const html = sections.map((s) => `<h2>${escape(s.heading)}</h2>\n${s.html}`).join('\n');
    const doc = await this.editor.create(actorId, brief.projectId, { title: b.title || brief.title, content: { html, title: b.title || brief.title, metaDescription: b.metaDescription ?? '', focusKeyword: keyword } });
    return { documentId: (doc as { id: string }).id, sections: sections.length, label: 'AI draft — review before publishing' };
  }

  // ── GEO: recommendations grounded in observed evidence ────────────────

  async geoRecommendations(actorId: string, promptId: string) {
    const prompt = await this.prisma.geoPrompt.findUnique({ where: { id: promptId }, include: { project: { include: { domains: true } } } });
    if (!prompt) throw new NotFoundException({ code: 'PROMPT_NOT_FOUND', message: 'Prompt not found.' });
    const project = await this.projects.requireProject(actorId, prompt.projectId, 'geo.write');
    const run = await this.prisma.geoRun.findFirst({
      where: { promptId, status: { in: ['SUCCEEDED', 'PARTIAL'] } },
      orderBy: { startedAt: 'desc' },
      include: { platformResults: { where: { status: 'SUCCEEDED' }, include: { platform: true, mentions: true, citations: { include: { source: true }, orderBy: { rank: 'asc' }, take: 15 }, competitorMentions: { include: { competitor: true } } } } },
    });
    if (!run?.platformResults.length) throw new BadRequestException({ code: 'NO_OBSERVATIONS', message: 'Run an AI search check first; recommendations are based on what was observed.' });
    const ownDomains = prompt.project.domains.map((d) => d.host);
    const evidence = run.platformResults.map((r) => ({
      surface: r.platform.name,
      observedAt: run.completedAt ?? run.startedAt,
      brandMentioned: r.mentions.some((m) => m.mentionType === 'BRAND'),
      brandCited: r.mentions.some((m) => m.mentionType === 'BRAND_CITATION'),
      citedDomains: r.citations.map((c) => c.source.domain),
      competitorsMentioned: r.competitorMentions.map((c) => c.competitor.name),
    }));
    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId: project.id, actorId, referenceType: 'geo_prompt', referenceId: promptId, operation: 'ai.geo_recommendations' }, (usage) =>
      this.openai.generateJson<{ summary: string; recommendations: { title: string; why: string; action: string; evidence: string }[] }>(
        {
          system: 'You are a GEO (generative engine optimization) strategist. Recommend content and citation improvements so the brand is more likely to be cited in Google AI Mode and AI Overviews. Base every recommendation on the observed evidence provided; these are recommendations (inferred), not observations. Never claim visibility in ChatGPT or other assistants.',
          prompt: `Query: "${prompt.prompt}"\nBrand domains: ${ownDomains.join(', ') || '—'}\nObserved evidence (JSON):\n${JSON.stringify(evidence).slice(0, 20_000)}\n\nGive 3–6 recommendations.`,
          schema: GEO_SCHEMA,
          name: 'geo_recommendations',
          effort: 'medium',
        },
        { operation: 'ai.geo_recommendations', ...usage },
      ),
    );
    const result = { ...out, promptId, runId: run.id, generatedAt: new Date().toISOString(), model: this.openai.model, inferenceLabel: 'inferred' };
    await this.storage.writeBuffer(`geo-recommendations/${project.id}/${promptId}.json`, Buffer.from(JSON.stringify(result), 'utf8'), 'application/json');
    return result;
  }

  async latestGeoRecommendations(actorId: string, promptId: string) {
    const prompt = await this.prisma.geoPrompt.findUnique({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException({ code: 'PROMPT_NOT_FOUND', message: 'Prompt not found.' });
    await this.projects.requireProject(actorId, prompt.projectId, 'geo.read');
    const raw = await this.storage.readText(`geo-recommendations/${prompt.projectId}/${promptId}.json`);
    return raw ? (JSON.parse(raw) as unknown) : null;
  }
}
