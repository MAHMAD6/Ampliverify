import { BadRequestException, Injectable } from '@nestjs/common';
import { AiGateService } from '../ai/ai-gate.service';
import { OpenAiService } from '../ai/openai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { OptimizationService } from './optimization.service';

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'steps'],
  properties: {
    summary: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'impact', 'effort', 'timeframe', 'evidenceIds'],
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          impact: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          effort: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          timeframe: { type: 'string', enum: ['this week', 'this month', 'this quarter'] },
          evidenceIds: { type: 'array', items: { type: 'string' }, description: 'IDs of the findings or GEO opportunities this step addresses.' },
        },
      },
    },
  },
};

type Plan = { summary: string; steps: { title: string; why: string; impact: string; effort: string; timeframe: string; evidenceIds: string[] }[] };

/**
 * AI-generated action plan (Hybrid pricing guide §3, `ai.action_plan`): an
 * ordered plan built only from the project's verified audit findings and
 * observed GEO opportunities. Steps are recommendations and cite the evidence
 * they address; unknown evidence IDs are dropped.
 */
@Injectable()
export class ActionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly optimization: OptimizationService,
    private readonly ai: AiGateService,
    private readonly openai: OpenAiService,
    private readonly storage: ContentStorageService,
  ) {}

  private key(projectId: string) {
    return `action-plans/${projectId}/latest.json`;
  }

  async latest(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'seo.audit.read');
    const raw = await this.storage.readText(this.key(projectId));
    return raw ? (JSON.parse(raw) as unknown) : null;
  }

  async generate(actorId: string, projectId: string) {
    const project = await this.projects.requireProject(actorId, projectId, 'seo.audit.run');
    const { items } = await this.optimization.recommendations(actorId, projectId, {});
    const open = items.filter((i) => i.status !== 'RESOLVED' && i.status !== 'IGNORED').slice(0, 40);
    const geo = await this.prisma.geoOpportunity.findMany({ where: { projectId, status: 'OPEN' }, orderBy: { priority: 'asc' }, take: 20 });
    if (!open.length && !geo.length) throw new BadRequestException({ code: 'NO_EVIDENCE', message: 'Run an audit or an AI search check first; the plan is built only from your project’s findings.' });
    const evidence = [
      ...open.map((i) => ({ id: i.id, kind: 'finding', title: i.title, category: i.categoryLabel, priority: i.priority, page: i.pageUrl })),
      ...geo.map((g) => ({ id: g.id, kind: 'geo_opportunity', type: g.type, priority: g.priority, details: g.detailsJson })),
    ];
    const known = new Set(evidence.map((e) => e.id));
    const out = await this.ai.run({ workspaceId: project.workspaceId, projectId, actorId, referenceType: 'action_plan', operation: 'ai.action_plan' }, (usage) =>
      this.openai.generateJson<Plan>(
        {
          system: 'You are a senior SEO and GEO strategist. Turn the verified findings into an ordered, practical action plan. Use only the evidence provided; never invent metrics, rankings or results. Each step cites the evidence IDs it addresses.',
          prompt: `Website: ${project.name}\nEvidence (JSON):\n${JSON.stringify(evidence).slice(0, 60_000)}\n\nReturn 5–10 steps, highest impact for the least effort first.`,
          schema: PLAN_SCHEMA,
          name: 'action_plan',
          effort: 'medium',
        },
        { operation: 'ai.action_plan', ...usage },
      ),
    );
    const plan = {
      generatedAt: new Date().toISOString(),
      model: this.openai.model,
      label: 'recommendation',
      summary: out.summary,
      steps: out.steps.slice(0, 12).map((s) => ({ ...s, evidenceIds: s.evidenceIds.filter((id) => known.has(id)) })),
    };
    await this.storage.writeBuffer(this.key(projectId), Buffer.from(JSON.stringify(plan), 'utf8'), 'application/json');
    return plan;
  }
}
