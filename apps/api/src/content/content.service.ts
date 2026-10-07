import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { AiGateService } from '../ai/ai-gate.service';
import { ClaudeService } from '../ai/claude.service';

const IDEA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'targetKeyword', 'intent', 'format', 'rationale', 'priority'],
        properties: {
          title: { type: 'string' },
          targetKeyword: { type: 'string' },
          intent: { type: 'string', enum: ['informational', 'commercial', 'transactional', 'navigational'] },
          format: { type: 'string', enum: ['guide', 'how-to', 'listicle', 'comparison', 'landing page', 'faq', 'case study', 'glossary'] },
          rationale: { type: 'string' },
          priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
      },
    },
  },
};

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'metaDescription', 'audience', 'searchIntent', 'wordCountTarget', 'outline', 'questions', 'secondaryKeywords', 'internalLinkIdeas', 'geoNotes'],
  properties: {
    title: { type: 'string' },
    metaDescription: { type: 'string' },
    audience: { type: 'string' },
    searchIntent: { type: 'string' },
    wordCountTarget: { type: 'integer' },
    outline: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['heading', 'level', 'points'], properties: { heading: { type: 'string' }, level: { type: 'integer' }, points: { type: 'array', items: { type: 'string' } } } },
    },
    questions: { type: 'array', items: { type: 'string' } },
    secondaryKeywords: { type: 'array', items: { type: 'string' } },
    internalLinkIdeas: { type: 'array', items: { type: 'string' } },
    geoNotes: { type: 'array', items: { type: 'string' } },
  },
};

type IdeaOut = { ideas: { title: string; targetKeyword: string; intent: string; format: string; rationale: string; priority: string }[] };

/**
 * Content Strategy: topic ideas, clusters (from keyword research), content
 * briefs, content plans and optimized content. Ideas and briefs can be
 * drafted by Claude from the project's own data (domain, keywords, GEO gaps).
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly ai: AiGateService,
    private readonly claude: ClaudeService,
  ) {}

  // ── Context the AI works from (never invented data) ───────────────────

  private async projectContext(projectId: string) {
    const [project, domains, lists, opportunities, findings] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { workspace: true } }),
      this.prisma.domain.findMany({ where: { projectId }, select: { host: true } }),
      this.prisma.keywordList.findMany({ where: { projectId }, include: { items: { include: { keyword: true }, take: 40 } }, take: 5 }),
      this.prisma.geoOpportunity.findMany({ where: { projectId, status: 'OPEN' }, take: 10, orderBy: { priority: 'asc' } }),
      this.prisma.auditFinding.findMany({ where: { auditPage: { auditRun: { projectId } }, ruleKey: { in: ['content.thin', 'geo.no_faq', 'geo.no_question_headings'] }, status: 'OPEN' }, take: 10, include: { auditPage: { include: { page: true } } } }),
    ]);
    const ideas = await this.prisma.contentIdea.findMany({ where: { projectId }, select: { title: true }, take: 100 });
    return [
      `Project: ${project.name}`,
      `Website: ${domains.map((d) => d.host).join(', ') || 'not set'}`,
      `Primary goal: ${project.primaryGoal ?? 'not set'}`,
      `Language: ${project.workspace.language}`,
      lists.length ? `Tracked keywords: ${lists.flatMap((l) => l.items.map((i) => i.keyword.normalizedTerm)).slice(0, 80).join('; ')}` : 'Tracked keywords: none yet',
      opportunities.length ? `AI search gaps: ${opportunities.map((o) => String((o.detailsJson as { prompt?: string })?.prompt ?? '')).filter(Boolean).join('; ')}` : '',
      findings.length ? `Pages flagged as thin or lacking Q&A: ${[...new Set(findings.map((f) => f.auditPage.page.url))].join(', ')}` : '',
      ideas.length ? `Existing ideas (do not repeat): ${ideas.map((i) => i.title).join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ── Ideas ──────────────────────────────────────────────────────────────

  async ideas(actorId: string, projectId: string, status?: ContentStatus) {
    await this.projects.requireProject(actorId, projectId, 'content.read');
    return this.prisma.contentIdea.findMany({ where: { projectId, ...(status ? { status } : { status: { not: 'ARCHIVED' } }) }, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async createIdea(actorId: string, projectId: string, input: { title: string; metadata?: Record<string, unknown> }) {
    await this.projects.requireProject(actorId, projectId, 'content.write');
    return this.prisma.contentIdea.create({ data: { projectId, title: input.title.trim(), source: 'MANUAL', metadata: (input.metadata ?? {}) as Prisma.InputJsonObject } });
  }

  async updateIdea(actorId: string, id: string, input: { title?: string; status?: ContentStatus; metadata?: Record<string, unknown> }) {
    const idea = await this.prisma.contentIdea.findUnique({ where: { id } });
    if (!idea) throw new NotFoundException({ code: 'IDEA_NOT_FOUND', message: 'Idea not found.' });
    await this.projects.requireProject(actorId, idea.projectId, 'content.write');
    return this.prisma.contentIdea.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.metadata !== undefined && { metadata: { ...((idea.metadata as object) ?? {}), ...input.metadata } as Prisma.InputJsonObject }),
      },
    });
  }

  async generateIdeas(actorId: string, projectId: string, input: { topic?: string; count?: number }) {
    const project = await this.projects.requireProject(actorId, projectId, 'content.write');
    const count = Math.min(Math.max(input.count ?? 8, 3), 20);
    const context = await this.projectContext(projectId);
    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId, actorId, referenceType: 'content_ideas' }, (usageEventId) =>
      this.claude.generateJson<IdeaOut>(
        {
          system:
            'You are a senior SEO and content strategist. Propose content that a real audience searches for and that AI assistants would cite. Ground every idea in the project context provided; do not invent statistics, rankings or search volumes. Write in the project language.',
          prompt: `${context}\n\n${input.topic ? `Focus topic: ${input.topic}\n` : ''}Propose ${count} distinct content ideas for this website. For each, give the working title, the primary keyword to target, search intent, format, a one-sentence rationale tied to the context above, and a priority.`,
          schema: IDEA_SCHEMA,
          effort: 'medium',
        },
        { operation: 'content.ideas', usageEventId },
      ),
    );
    const created = await this.prisma.$transaction(
      out.ideas.slice(0, count).map((i) =>
        this.prisma.contentIdea.create({
          data: { projectId, title: i.title.slice(0, 300), source: 'AI', metadata: { targetKeyword: i.targetKeyword, intent: i.intent, format: i.format, rationale: i.rationale, priority: i.priority, model: this.claude.model } },
        }),
      ),
    );
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.content.ideas.generate', targetType: 'project', targetId: projectId, afterState: { count: created.length } });
    return created;
  }

  // ── Briefs ─────────────────────────────────────────────────────────────

  async briefs(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'content.read');
    return this.prisma.contentBrief.findMany({ where: { projectId, status: { not: 'ARCHIVED' } }, orderBy: { updatedAt: 'desc' }, include: { primaryKeyword: true }, take: 300 });
  }

  async getBrief(actorId: string, id: string) {
    const brief = await this.prisma.contentBrief.findUnique({ where: { id }, include: { primaryKeyword: true, planItems: true } });
    if (!brief) throw new NotFoundException({ code: 'BRIEF_NOT_FOUND', message: 'Brief not found.' });
    await this.projects.requireProject(actorId, brief.projectId, 'content.read');
    return brief;
  }

  async createBrief(actorId: string, projectId: string, input: { title: string; keyword?: string; ideaId?: string; generate?: boolean; country?: string; language?: string }) {
    const project = await this.projects.requireProject(actorId, projectId, 'content.write');
    let keywordId: string | null = null;
    const keyword = input.keyword?.trim().toLowerCase();
    if (keyword) {
      const kw = await this.prisma.keyword.upsert({
        where: { normalizedTerm_locale_countryCode: { normalizedTerm: keyword, locale: input.language ?? 'en', countryCode: (input.country ?? 'US').toUpperCase() } },
        create: { normalizedTerm: keyword, locale: input.language ?? 'en', countryCode: (input.country ?? 'US').toUpperCase() },
        update: {},
      });
      keywordId = kw.id;
    }
    const brief = await this.prisma.contentBrief.create({ data: { projectId, title: input.title.trim(), primaryKeywordId: keywordId, briefJson: { ideaId: input.ideaId ?? null } } });
    if (input.ideaId) await this.prisma.contentIdea.updateMany({ where: { id: input.ideaId, projectId }, data: { status: 'IN_PROGRESS' } });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.content.brief.create', targetType: 'content_brief', targetId: brief.id });
    return input.generate ? this.generateBrief(actorId, brief.id) : brief;
  }

  async updateBrief(actorId: string, id: string, input: { title?: string; status?: ContentStatus; brief?: Record<string, unknown> }) {
    const brief = await this.getBrief(actorId, id);
    await this.projects.requireProject(actorId, brief.projectId, 'content.write');
    return this.prisma.contentBrief.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.brief !== undefined && { briefJson: { ...((brief.briefJson as object) ?? {}), ...input.brief } as Prisma.InputJsonObject }),
      },
    });
  }

  async generateBrief(actorId: string, id: string) {
    const brief = await this.getBrief(actorId, id);
    const project = await this.projects.requireProject(actorId, brief.projectId, 'content.write');
    const context = await this.projectContext(brief.projectId);
    const serp = brief.primaryKeywordId
      ? await this.prisma.serpSnapshot.findFirst({ where: { keywordId: brief.primaryKeywordId }, orderBy: { capturedAt: 'desc' }, include: { results: { orderBy: { position: 'asc' }, take: 10 } } })
      : null;
    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId: brief.projectId, actorId, referenceType: 'content_brief', referenceId: id }, (usageEventId) =>
      this.claude.generateJson<Record<string, unknown>>(
        {
          system:
            'You are a senior SEO content strategist writing a brief for a writer. The brief must help the page rank in search and be cited by AI assistants: direct answers, clear structure, verifiable facts, and questions real people ask. Do not invent statistics or sources.',
          prompt: `${context}\n\nTitle: ${brief.title}\nPrimary keyword: ${brief.primaryKeyword?.normalizedTerm ?? 'derive from the title'}\n${
            serp ? `Current top results: ${serp.results.map((r) => `${r.position}. ${r.title ?? ''} (${r.domain})`).join('; ')}\n` : ''
          }Write the content brief.`,
          schema: BRIEF_SCHEMA,
          effort: 'medium',
        },
        { operation: 'content.brief', usageEventId },
      ),
    );
    return this.prisma.contentBrief.update({
      where: { id },
      data: { briefJson: { ...((brief.briefJson as object) ?? {}), ...out, generatedBy: this.claude.model, generatedAt: new Date().toISOString() } as Prisma.InputJsonObject, status: brief.status === 'DRAFT' ? 'IN_PROGRESS' : brief.status },
    });
  }

  // ── Plans ──────────────────────────────────────────────────────────────

  async plans(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'content.read');
    return this.prisma.contentPlan.findMany({ where: { projectId, status: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'desc' }, include: { items: { orderBy: [{ targetDate: 'asc' }], include: { brief: { select: { id: true, title: true } } } } } });
  }

  async createPlan(actorId: string, projectId: string, name: string) {
    await this.projects.requireProject(actorId, projectId, 'content.write');
    return this.prisma.contentPlan.create({ data: { projectId, name: name.trim() } });
  }

  async updatePlan(actorId: string, id: string, input: { name?: string; status?: ContentStatus }) {
    const plan = await this.findPlan(id);
    await this.projects.requireProject(actorId, plan.projectId, 'content.write');
    return this.prisma.contentPlan.update({ where: { id }, data: { ...(input.name !== undefined && { name: input.name.trim() }), ...(input.status !== undefined && { status: input.status }) } });
  }

  async addPlanItem(actorId: string, planId: string, input: { title: string; targetDate?: string | null; briefId?: string | null; status?: ContentStatus }) {
    const plan = await this.findPlan(planId);
    await this.projects.requireProject(actorId, plan.projectId, 'content.write');
    if (input.briefId) {
      const brief = await this.prisma.contentBrief.findUnique({ where: { id: input.briefId } });
      if (!brief || brief.projectId !== plan.projectId) throw new BadRequestException({ code: 'BRIEF_NOT_IN_PROJECT', message: 'Brief not found in this project.' });
    }
    return this.prisma.contentPlanItem.create({ data: { planId, title: input.title.trim(), targetDate: input.targetDate ? new Date(input.targetDate) : null, briefId: input.briefId ?? null, status: input.status ?? 'PLANNED' } });
  }

  async updatePlanItem(actorId: string, itemId: string, input: { title?: string; targetDate?: string | null; status?: ContentStatus; briefId?: string | null }) {
    const item = await this.prisma.contentPlanItem.findUnique({ where: { id: itemId }, include: { plan: true } });
    if (!item) throw new NotFoundException({ code: 'PLAN_ITEM_NOT_FOUND', message: 'Plan item not found.' });
    await this.projects.requireProject(actorId, item.plan.projectId, 'content.write');
    return this.prisma.contentPlanItem.update({
      where: { id: itemId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.targetDate !== undefined && { targetDate: input.targetDate ? new Date(input.targetDate) : null }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.briefId !== undefined && { briefId: input.briefId }),
      },
    });
  }

  async deletePlanItem(actorId: string, itemId: string) {
    const item = await this.prisma.contentPlanItem.findUnique({ where: { id: itemId }, include: { plan: true } });
    if (!item) throw new NotFoundException({ code: 'PLAN_ITEM_NOT_FOUND', message: 'Plan item not found.' });
    await this.projects.requireProject(actorId, item.plan.projectId, 'content.write');
    await this.prisma.contentPlanItem.delete({ where: { id: itemId } });
    return { id: itemId, deleted: true };
  }

  /** Optimized content: editor documents that reached review or publication. */
  async optimized(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'content.read');
    return this.prisma.editorDocument.findMany({
      where: { projectId, status: { in: ['IN_REVIEW', 'PUBLISHED'] } },
      orderBy: { updatedAt: 'desc' },
      include: { page: { select: { url: true } }, versions: { orderBy: { versionNo: 'desc' }, take: 1, select: { versionNo: true, createdAt: true } } },
    });
  }

  async summary(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'content.read');
    const [ideas, briefs, planItems, optimized, clusters] = await Promise.all([
      this.prisma.contentIdea.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.contentBrief.count({ where: { projectId, status: { not: 'ARCHIVED' } } }),
      this.prisma.contentPlanItem.groupBy({ by: ['status'], where: { plan: { projectId } }, _count: true }),
      this.prisma.editorDocument.count({ where: { projectId, status: { in: ['IN_REVIEW', 'PUBLISHED'] } } }),
      this.prisma.keywordCluster.count({ where: { projectId } }),
    ]);
    return {
      ideas: ideas.reduce((n, r) => n + (r.status === 'ARCHIVED' ? 0 : r._count), 0),
      briefs,
      planned: planItems.reduce((n, r) => n + (['PLANNED', 'IN_PROGRESS', 'IN_REVIEW'].includes(r.status) ? r._count : 0), 0),
      published: planItems.reduce((n, r) => n + (r.status === 'COMPLETED' ? r._count : 0), 0),
      optimized,
      clusters,
      aiAvailable: this.ai.configured,
    };
  }

  private async findPlan(id: string) {
    const plan = await this.prisma.contentPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    return plan;
  }
}
