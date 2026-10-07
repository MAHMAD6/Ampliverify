import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { GeoPromptStatus, Prisma, TaskStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { CreditsService } from '../commerce/credits.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { WorkspaceSettings } from '../workspaces/workspaces.service';
import { analyzeAnswer, GeoProviders } from './geo-providers';

export type Cadence = 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
const USAGE_FEATURE = 'geo.check';
const QUEUE = 'geo.run';

type StoredResult = {
  text: string;
  citations: { url: string; title: string | null }[];
  model: string;
  analysis: ReturnType<typeof analyzeAnswer>;
  error?: string;
};

export function nextRunAt(cadence: Cadence, from = new Date()) {
  const d = new Date(from);
  if (cadence === 'DAILY') d.setUTCDate(d.getUTCDate() + 1);
  else if (cadence === 'WEEKLY') d.setUTCDate(d.getUTCDate() + 7);
  else if (cadence === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

/**
 * AI Search (GEO): tracked prompts are asked on each AI platform, answers are
 * analyzed for brand mentions, ranking, competitor mentions and citations,
 * then rolled up into visibility metrics, trends and actionable opportunities.
 * Trends are only reported once there are at least two checks.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly jobs: JobsService,
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly storage: ContentStorageService,
    private readonly providers: GeoProviders,
  ) {}

  onModuleInit() {
    this.jobs.register(QUEUE, async (p) => this.process(String(p.runId)));
    this.jobs.registerPeriodic('geo.schedules', 60_000, () => this.runDueSchedules());
  }

  // ── Platforms ──────────────────────────────────────────────────────────

  async platforms() {
    const rows = await this.prisma.geoPlatform.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return rows.map((p) => {
      const provider = (p.capabilities as { provider?: string } | null)?.provider ?? '';
      return { id: p.id, key: p.key, name: p.name, provider, configured: this.providers.isConfigured(provider) };
    });
  }

  private async resolvePlatforms(keys: string[] | null | undefined, workspaceDefaults: string[] | undefined) {
    const all = await this.platforms();
    const wanted = keys?.length ? keys : workspaceDefaults?.length ? workspaceDefaults : all.map((p) => p.key);
    return all.filter((p) => wanted.includes(p.key));
  }

  // ── Prompts ────────────────────────────────────────────────────────────

  async listPrompts(actorId: string, projectId: string, filters: { status?: string; platform?: string; q?: string; tag?: string } = {}) {
    await this.projects.requireProject(actorId, projectId, 'geo.read');
    const prompts = await this.prisma.geoPrompt.findMany({
      where: {
        projectId,
        status: filters.status && filters.status in GeoPromptStatus ? (filters.status as GeoPromptStatus) : { not: 'ARCHIVED' },
        ...(filters.q ? { prompt: { contains: filters.q, mode: 'insensitive' as const } } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        schedules: true,
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { platformResults: { include: { platform: true, mentions: true, competitorMentions: true } } },
        },
      },
    });
    return prompts
      .map((p) => {
        const last = p.runs[0];
        const results = (last?.platformResults ?? []).filter((r) => !filters.platform || r.platform.key === filters.platform);
        const ok = results.filter((r) => r.status === 'SUCCEEDED');
        const brand = ok.filter((r) => r.mentions.some((m) => m.mentionType === 'BRAND'));
        const positions = brand.map((r) => r.mentions.find((m) => m.mentionType === 'BRAND')?.positionHint).filter((x): x is number => typeof x === 'number');
        return {
          id: p.id,
          prompt: p.prompt,
          status: p.status,
          tags: p.tags,
          country: p.country,
          platformKeys: p.platformKeys,
          cadence: (p.schedules.find((s) => s.enabled)?.cadence ?? 'MANUAL') as Cadence,
          nextRunAt: p.schedules.find((s) => s.enabled)?.nextRunAt ?? null,
          createdAt: p.createdAt,
          lastRun: last ? { id: last.id, status: last.status, startedAt: last.startedAt, completedAt: last.completedAt } : null,
          platforms: results.map((r) => ({
            key: r.platform.key,
            name: r.platform.name,
            status: r.status,
            mentioned: r.mentions.some((m) => m.mentionType === 'BRAND'),
            cited: r.mentions.some((m) => m.mentionType === 'BRAND_CITATION'),
            position: r.mentions.find((m) => m.mentionType === 'BRAND')?.positionHint ?? null,
          })),
          visibility: ok.length ? Math.round((brand.length / ok.length) * 100) : null,
          avgPosition: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null,
        };
      })
      .filter((p) => !filters.platform || p.platforms.length > 0 || !p.lastRun);
  }

  async createPrompt(
    actorId: string,
    projectId: string,
    input: { prompt: string; platformKeys?: string[]; country?: string | null; tags?: string[]; cadence?: Cadence; runNow?: boolean },
    meta?: RequestMeta,
  ) {
    const project = await this.projects.requireProject(actorId, projectId, 'geo.write');
    await this.entitlements.assertModuleEnabled('geo');
    await this.entitlements.assertFeature(project.workspaceId, 'geo.audit');
    const text = input.prompt.trim();
    if (text.length < 3) throw new BadRequestException({ code: 'PROMPT_REQUIRED', message: 'Enter the question people ask AI assistants.' });
    if (input.platformKeys?.length) {
      const known = new Set((await this.platforms()).map((p) => p.key));
      const unknown = input.platformKeys.filter((k) => !known.has(k));
      if (unknown.length) throw new BadRequestException({ code: 'UNKNOWN_PLATFORM', message: `Unknown platforms: ${unknown.join(', ')}` });
    }
    const duplicate = await this.prisma.geoPrompt.findFirst({ where: { projectId, prompt: { equals: text, mode: 'insensitive' }, status: { not: 'ARCHIVED' } } });
    if (duplicate) throw new ConflictException({ code: 'PROMPT_EXISTS', message: 'This prompt is already tracked.' });

    const prompt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.geoPrompt.create({
        data: { projectId, prompt: text, createdBy: actorId, platformKeys: input.platformKeys ?? [], country: input.country ?? null, tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10) },
      });
      if (input.cadence && input.cadence !== 'MANUAL') {
        await tx.geoPromptSchedule.create({ data: { promptId: created.id, cadence: input.cadence, nextRunAt: nextRunAt(input.cadence) } });
      }
      await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.geo.prompt.create', targetType: 'geo_prompt', targetId: created.id, afterState: { prompt: text, cadence: input.cadence ?? 'MANUAL' }, requestMeta: meta }, tx);
      return created;
    });
    const run = input.runNow ? await this.runCheck(actorId, prompt.id, {}, meta) : null;
    return { ...prompt, run };
  }

  async updatePrompt(
    actorId: string,
    promptId: string,
    input: { prompt?: string; status?: GeoPromptStatus; platformKeys?: string[]; country?: string | null; tags?: string[]; cadence?: Cadence },
    meta?: RequestMeta,
  ) {
    const prompt = await this.findPrompt(promptId);
    const project = await this.projects.requireProject(actorId, prompt.projectId, 'geo.write');
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.geoPrompt.update({
        where: { id: promptId },
        data: {
          ...(input.prompt !== undefined && { prompt: input.prompt.trim() }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.platformKeys !== undefined && { platformKeys: input.platformKeys }),
          ...(input.country !== undefined && { country: input.country }),
          ...(input.tags !== undefined && { tags: input.tags }),
        },
      });
      if (input.cadence !== undefined) {
        await tx.geoPromptSchedule.deleteMany({ where: { promptId } });
        if (input.cadence !== 'MANUAL') await tx.geoPromptSchedule.create({ data: { promptId, cadence: input.cadence, nextRunAt: nextRunAt(input.cadence) } });
      }
      if (input.status && input.status !== 'ACTIVE') await tx.geoPromptSchedule.updateMany({ where: { promptId }, data: { enabled: false } });
      if (input.status === 'ACTIVE') await tx.geoPromptSchedule.updateMany({ where: { promptId }, data: { enabled: true } });
      await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.geo.prompt.update', targetType: 'geo_prompt', targetId: promptId, beforeState: { prompt: prompt.prompt, status: prompt.status }, afterState: { prompt: saved.prompt, status: saved.status, cadence: input.cadence ?? null }, requestMeta: meta }, tx);
      return saved;
    });
  }

  async duplicatePrompt(actorId: string, promptId: string, meta?: RequestMeta) {
    const prompt = await this.findPrompt(promptId);
    const schedule = prompt.schedules.find((s) => s.enabled);
    return this.createPrompt(actorId, prompt.projectId, { prompt: `${prompt.prompt} (copy)`, platformKeys: prompt.platformKeys, country: prompt.country, tags: prompt.tags, cadence: (schedule?.cadence as Cadence) ?? 'MANUAL' }, meta);
  }

  async getPrompt(actorId: string, promptId: string) {
    const prompt = await this.findPrompt(promptId);
    await this.projects.requireProject(actorId, prompt.projectId, 'geo.read');
    const runs = await this.prisma.geoRun.findMany({
      where: { promptId },
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: {
        platformResults: {
          include: { platform: true, mentions: true, citations: { include: { source: true }, orderBy: { rank: 'asc' } }, competitorMentions: { include: { competitor: true } } },
        },
        opportunities: true,
      },
    });
    const latest = runs.find((r) => r.status === 'SUCCEEDED' || r.status === 'FAILED') ?? runs[0];
    const results = latest
      ? await Promise.all(
          latest.platformResults.map(async (r) => {
            const stored = r.responseRef ? await this.readStored(r.responseRef) : null;
            return {
              id: r.id,
              platform: { key: r.platform.key, name: r.platform.name },
              status: r.status,
              answer: stored?.text ?? null,
              model: stored?.model ?? null,
              error: stored?.error ?? null,
              mentioned: r.mentions.some((m) => m.mentionType === 'BRAND'),
              position: r.mentions.find((m) => m.mentionType === 'BRAND')?.positionHint ?? null,
              cited: r.mentions.some((m) => m.mentionType === 'BRAND_CITATION'),
              excerpt: stored?.analysis?.excerpt ?? null,
              citations: r.citations.map((c) => ({ rank: c.rank, url: c.source.canonicalUrl, domain: c.source.domain, title: c.source.title })),
              competitors: r.competitorMentions.map((c) => ({ id: c.competitor.id, name: c.competitor.name, position: c.positionHint })),
            };
          }),
        )
      : [];
    const history = runs
      .filter((r) => r.status === 'SUCCEEDED')
      .map((r) => {
        const ok = r.platformResults.filter((x) => x.status === 'SUCCEEDED');
        const mentioned = ok.filter((x) => x.mentions.some((m) => m.mentionType === 'BRAND')).length;
        return { runId: r.id, at: r.completedAt ?? r.startedAt, visibility: ok.length ? Math.round((mentioned / ok.length) * 100) : null, platforms: ok.length };
      })
      .reverse();
    return {
      id: prompt.id,
      projectId: prompt.projectId,
      prompt: prompt.prompt,
      status: prompt.status,
      tags: prompt.tags,
      country: prompt.country,
      platformKeys: prompt.platformKeys,
      cadence: (prompt.schedules.find((s) => s.enabled)?.cadence ?? 'MANUAL') as Cadence,
      nextRunAt: prompt.schedules.find((s) => s.enabled)?.nextRunAt ?? null,
      createdAt: prompt.createdAt,
      latestRun: latest ? { id: latest.id, status: latest.status, startedAt: latest.startedAt, completedAt: latest.completedAt, creditCost: latest.creditCost } : null,
      results,
      history: history.length >= 2 ? history : [],
      checks: history.length,
      opportunities: (latest?.opportunities ?? []).map((o) => this.opportunityView(o)),
      runs: runs.map((r) => ({ id: r.id, status: r.status, trigger: r.trigger, startedAt: r.startedAt, completedAt: r.completedAt })),
    };
  }

  // ── Checks ─────────────────────────────────────────────────────────────

  async runCheck(actorId: string, promptId: string, input: { platformKeys?: string[] }, meta?: RequestMeta, trigger: 'MANUAL' | 'SCHEDULED' = 'MANUAL') {
    const prompt = await this.findPrompt(promptId);
    const project = await this.projects.requireProject(actorId, prompt.projectId, 'geo.write');
    if (prompt.status !== 'ACTIVE') throw new ConflictException({ code: 'PROMPT_NOT_ACTIVE', message: 'Resume this prompt before running a check.' });
    if (project.status !== 'ACTIVE') throw new ConflictException({ code: 'PROJECT_NOT_ACTIVE', message: 'Resume the project before running a check.' });
    await this.entitlements.assertModuleEnabled('geo');
    await this.entitlements.assertFeature(project.workspaceId, 'geo.audit');
    const running = await this.prisma.geoRun.count({ where: { promptId, status: { in: ['QUEUED', 'RUNNING'] } } });
    if (running) throw new ConflictException({ code: 'CHECK_IN_PROGRESS', message: 'A check is already running for this prompt.' });

    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: project.workspaceId } });
    const settings = (ws.settingsJson ?? {}) as WorkspaceSettings;
    const platforms = (await this.resolvePlatforms(input.platformKeys?.length ? input.platformKeys : prompt.platformKeys, settings.aiGeo?.defaultPlatforms)).filter((p) => p.configured);
    if (!platforms.length) {
      throw new ServiceUnavailableException({ code: 'GEO_PROVIDERS_NOT_CONFIGURED', message: 'None of the selected AI platforms is connected yet.' });
    }
    await this.entitlements.assertWithinLimit(project.workspaceId, 'limit.geo_queries', USAGE_FEATURE, platforms.length);

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.geoRun.create({ data: { promptId, trigger, status: 'QUEUED' } });
      const { cost } = await this.credits.charge(
        { workspaceId: project.workspaceId, projectId: project.id, featureKey: USAGE_FEATURE, units: platforms.length, referenceType: 'geo_run', referenceId: created.id, idempotencyKey: `geo:${created.id}`, actorId },
        tx,
      );
      await tx.geoRun.update({ where: { id: created.id }, data: { creditCost: cost } });
      await tx.geoPlatformResult.createMany({ data: platforms.map((p) => ({ runId: created.id, platformId: p.id })) });
      await this.jobs.enqueue(QUEUE, { runId: created.id, requestedBy: actorId }, { jobKey: `geo:${created.id}` }, tx);
      await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.geo.check', targetType: 'geo_run', targetId: created.id, afterState: { platforms: platforms.map((p) => p.key), trigger }, requestMeta: meta }, tx);
      return created;
    });
    return { id: run.id, status: run.status, platforms: platforms.map((p) => p.key) };
  }

  async process(runId: string) {
    const run = await this.prisma.geoRun.findUnique({
      where: { id: runId },
      include: { prompt: { include: { project: { include: { domains: true, workspace: true } } } }, platformResults: { include: { platform: true } } },
    });
    if (!run || run.status === 'SUCCEEDED' || run.status === 'CANCELED') return;
    await this.prisma.geoRun.update({ where: { id: runId }, data: { status: 'RUNNING' } });

    const project = run.prompt.project;
    const settings = (project.workspace.settingsJson ?? {}) as WorkspaceSettings;
    const brandNames = [settings.aiGeo?.brandName, ...(settings.aiGeo?.brandAliases ?? []), project.name].filter((n): n is string => !!n && n.trim().length >= 2);
    const brand = { names: [...new Set(brandNames)], domains: project.domains.map((d) => d.host) };
    const competitors = await this.prisma.geoCompetitor.findMany({ where: { projectId: project.id, status: 'ACTIVE' } });
    const usage = await this.prisma.usageEvent.findUnique({ where: { idempotencyKey: `usage:geo:${runId}` } });
    const perUnit = await this.credits.costOf(USAGE_FEATURE, 1);

    let succeeded = 0;
    for (const result of run.platformResults.filter((r) => r.status === 'PENDING')) {
      const provider = (result.platform.capabilities as { provider?: string } | null)?.provider ?? '';
      const key = `geo/${project.id}/${runId}/${result.platform.key}.json`;
      try {
        const answer = await this.providers.ask(provider, run.prompt.prompt, { country: run.prompt.country, usageEventId: usage?.id });
        const analysis = analyzeAnswer(answer, brand, competitors);
        const stored: StoredResult = { text: answer.text, citations: answer.citations, model: answer.model, analysis };
        const body = JSON.stringify(stored);
        await this.storage.writeBuffer(key, Buffer.from(body, 'utf8'), 'application/json');

        await this.prisma.$transaction(async (tx) => {
          await tx.geoPlatformResult.update({ where: { id: result.id }, data: { status: 'SUCCEEDED', responseRef: key, responseHash: createHash('sha256').update(answer.text).digest('hex') } });
          if (analysis.mentioned) {
            await tx.geoMention.create({ data: { resultId: result.id, entity: brand.names[0] ?? brand.domains[0] ?? project.name, mentionType: 'BRAND', positionHint: analysis.position } });
          }
          if (analysis.cited) {
            await tx.geoMention.create({ data: { resultId: result.id, entity: brand.domains[0] ?? project.name, mentionType: 'BRAND_CITATION', positionHint: analysis.citationRank } });
          }
          for (const c of analysis.competitors) {
            await tx.geoCompetitorMention.create({ data: { resultId: result.id, competitorId: c.id, positionHint: c.position } });
          }
          let rank = 0;
          for (const citation of answer.citations.slice(0, 50)) {
            const domain = hostOf(citation.url);
            if (!domain) continue;
            rank++;
            const source = await tx.geoSource.upsert({
              where: { canonicalUrl: citation.url.slice(0, 2000) },
              create: { canonicalUrl: citation.url.slice(0, 2000), domain, title: citation.title?.slice(0, 500) ?? null },
              update: citation.title ? { title: citation.title.slice(0, 500) } : {},
            });
            await tx.geoCitation.create({ data: { resultId: result.id, sourceId: source.id, rank } });
          }
          await tx.geoVisibilitySnapshot.createMany({
            data: [
              { projectId: project.id, platformId: result.platformId, metricKey: 'mentioned', metricValue: analysis.mentioned ? 1 : 0 },
              { projectId: project.id, platformId: result.platformId, metricKey: 'cited', metricValue: analysis.cited ? 1 : 0 },
              ...(analysis.position ? [{ projectId: project.id, platformId: result.platformId, metricKey: 'position', metricValue: analysis.position }] : []),
            ],
          });
        });
        succeeded++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`GEO check ${runId}/${result.platform.key} failed: ${message}`);
        await this.storage.writeBuffer(key, Buffer.from(JSON.stringify({ error: message.slice(0, 500) }), 'utf8'), 'application/json').catch(() => undefined);
        await this.prisma.geoPlatformResult.update({ where: { id: result.id }, data: { status: 'FAILED', responseRef: key } });
        // Refund this platform's share of the charge.
        if (perUnit.greaterThan(0)) {
          await this.prisma.$transaction((tx) =>
            this.credits.applyEntry(tx, {
              workspaceId: project.workspaceId,
              delta: perUnit,
              reason: 'REVERSAL',
              referenceType: 'geo_platform_result',
              referenceId: result.id,
              idempotencyKey: `geo-refund:${result.id}`,
            }),
          );
        }
      }
    }

    await this.prisma.geoRun.update({ where: { id: runId }, data: { status: succeeded ? 'SUCCEEDED' : 'FAILED', completedAt: new Date() } });
    if (succeeded) await this.generateOpportunities(runId);
    await this.notifications.notify({
      workspaceId: project.workspaceId,
      userId: run.prompt.createdBy,
      eventKey: 'geo.check_completed',
      title: succeeded ? 'AI search check completed' : 'AI search check failed',
      body: `"${run.prompt.prompt.slice(0, 120)}" — ${succeeded}/${run.platformResults.length} platform${run.platformResults.length === 1 ? '' : 's'} checked.`,
    });
  }

  /** Concrete next actions derived from the latest results (never generic advice). */
  private async generateOpportunities(runId: string) {
    const run = await this.prisma.geoRun.findUniqueOrThrow({
      where: { id: runId },
      include: {
        prompt: { include: { project: { include: { domains: true } } } },
        platformResults: { where: { status: 'SUCCEEDED' }, include: { platform: true, mentions: true, citations: { include: { source: true } }, competitorMentions: { include: { competitor: true } } } },
      },
    });
    const projectId = run.prompt.projectId;
    const ownDomains = run.prompt.project.domains.map((d) => d.host);
    const isOwn = (domain: string) => ownDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
    const items: { type: string; priority: number; details: Prisma.InputJsonObject }[] = [];

    for (const r of run.platformResults) {
      const mentioned = r.mentions.some((m) => m.mentionType === 'BRAND');
      const cited = r.mentions.some((m) => m.mentionType === 'BRAND_CITATION');
      const thirdParty = [...new Set(r.citations.map((c) => c.source.domain).filter((d) => !isOwn(d)))].slice(0, 5);
      const rivals = r.competitorMentions.map((c) => c.competitor.name);
      if (!mentioned && rivals.length) {
        items.push({
          type: 'COMPETITOR_GAP',
          priority: 1,
          details: { platform: r.platform.name, prompt: run.prompt.prompt, competitors: rivals, sources: thirdParty, action: `${rivals.join(', ')} appear in ${r.platform.name}'s answer and you do not. Get covered on the sources it cites${thirdParty.length ? ` (${thirdParty.join(', ')})` : ''} and publish a page that directly answers this question.` },
        });
      } else if (!mentioned) {
        items.push({
          type: 'MISSING_MENTION',
          priority: 2,
          details: { platform: r.platform.name, prompt: run.prompt.prompt, sources: thirdParty, action: `${r.platform.name} does not mention you for this question. Publish a page that answers it directly with clear, citable facts${thirdParty.length ? `, and pursue mentions on ${thirdParty.join(', ')}` : ''}.` },
        });
      } else if (!cited) {
        items.push({
          type: 'NOT_CITED',
          priority: 2,
          details: { platform: r.platform.name, prompt: run.prompt.prompt, sources: thirdParty, action: `${r.platform.name} mentions you but cites other sites. Add a concise answer, FAQ schema and supporting data on your own page so it can be cited.` },
        });
      }
      for (const domain of thirdParty.slice(0, 2)) {
        items.push({ type: 'SOURCE_OUTREACH', priority: 3, details: { platform: r.platform.name, prompt: run.prompt.prompt, domain, action: `${domain} is cited by ${r.platform.name} for this question. Pitch content, reviews or listings there.` } });
      }
    }
    if (!items.length) return;
    // Replace open opportunities from earlier runs of this prompt.
    await this.prisma.$transaction([
      this.prisma.geoOpportunity.updateMany({ where: { projectId, status: 'OPEN', run: { promptId: run.promptId }, runId: { not: runId } }, data: { status: 'DISMISSED' } }),
      this.prisma.geoOpportunity.createMany({ data: items.map((i) => ({ projectId, runId, type: i.type, priority: i.priority, detailsJson: i.details })) }),
    ]);
  }

  private async runDueSchedules() {
    const due = await this.prisma.geoPromptSchedule.findMany({
      where: { enabled: true, nextRunAt: { lte: new Date() }, prompt: { status: 'ACTIVE', project: { status: 'ACTIVE', deletedAt: null } } },
      include: { prompt: true },
      take: 50,
    });
    for (const s of due) {
      await this.prisma.geoPromptSchedule.update({ where: { id: s.id }, data: { nextRunAt: nextRunAt(s.cadence as Cadence) } });
      try {
        await this.runCheck(s.prompt.createdBy, s.promptId, {}, undefined, 'SCHEDULED');
      } catch (err) {
        this.logger.warn(`Scheduled GEO check for ${s.promptId} skipped: ${(err as { message?: string }).message}`);
      }
    }
  }

  // ── Project-level views ────────────────────────────────────────────────

  private async latestResults(projectId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const runs = await this.prisma.geoRun.findMany({
      where: { prompt: { projectId, status: { not: 'ARCHIVED' } }, status: 'SUCCEEDED', startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      include: { platformResults: { where: { status: 'SUCCEEDED' }, include: { platform: true, mentions: true, citations: { include: { source: true } }, competitorMentions: { include: { competitor: true } } } } },
    });
    // Latest result per (prompt, platform).
    const latest = new Map<string, (typeof runs)[number]['platformResults'][number] & { promptId: string; at: Date }>();
    for (const run of runs) {
      for (const r of run.platformResults) {
        const k = `${run.promptId}:${r.platformId}`;
        if (!latest.has(k)) latest.set(k, { ...r, promptId: run.promptId, at: run.completedAt ?? run.startedAt });
      }
    }
    return { runs, results: [...latest.values()] };
  }

  async overview(actorId: string, projectId: string, days = 30) {
    await this.projects.requireProject(actorId, projectId, 'geo.read');
    const { runs, results } = await this.latestResults(projectId, days);
    const platforms = await this.platforms();
    const metrics = (rs: typeof results) => {
      const mentioned = rs.filter((r) => r.mentions.some((m) => m.mentionType === 'BRAND'));
      const cited = rs.filter((r) => r.mentions.some((m) => m.mentionType === 'BRAND_CITATION'));
      const positions = mentioned.map((r) => r.mentions.find((m) => m.mentionType === 'BRAND')!.positionHint).filter((p): p is number => typeof p === 'number');
      const competitorMentions = rs.reduce((n, r) => n + r.competitorMentions.length, 0);
      return {
        answers: rs.length,
        visibility: rs.length ? Math.round((mentioned.length / rs.length) * 100) : null,
        citationRate: rs.length ? Math.round((cited.length / rs.length) * 100) : null,
        avgPosition: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null,
        shareOfVoice: mentioned.length + competitorMentions ? Math.round((mentioned.length / (mentioned.length + competitorMentions)) * 100) : null,
      };
    };
    const [promptCount, lastRun, snapshots, openOpps] = await Promise.all([
      this.prisma.geoPrompt.count({ where: { projectId, status: 'ACTIVE' } }),
      this.prisma.geoRun.findFirst({ where: { prompt: { projectId }, status: 'SUCCEEDED' }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
      this.prisma.$queryRaw<{ day: Date; platform_id: string; value: Prisma.Decimal; n: bigint }[]>`
        SELECT date_trunc('day', "captured_at") AS day, "platform_id", AVG("metric_value") AS value, COUNT(*) AS n
          FROM "geo_visibility_snapshots"
         WHERE "project_id" = ${projectId}::uuid AND "metric_key" = 'mentioned' AND "captured_at" >= ${new Date(Date.now() - days * 86_400_000)}
         GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.geoOpportunity.count({ where: { projectId, status: 'OPEN' } }),
    ]);
    const checkDays = new Set(snapshots.map((s) => s.day.toISOString()));
    return {
      periodDays: days,
      lastCheckedAt: lastRun?.completedAt ?? null,
      prompts: promptCount,
      checks: runs.length,
      openOpportunities: openOpps,
      ...metrics(results),
      platforms: platforms.map((p) => ({ ...p, ...metrics(results.filter((r) => r.platform.key === p.key)) })),
      // No trend before two check days (planning rule).
      trend:
        checkDays.size >= 2
          ? snapshots.map((s) => ({ day: s.day, platformKey: platforms.find((p) => p.id === s.platform_id)?.key ?? null, visibility: Math.round(Number(s.value) * 100) }))
          : [],
    };
  }

  async citations(actorId: string, projectId: string, days = 30) {
    const project = await this.projects.requireProject(actorId, projectId, 'geo.read');
    const { results } = await this.latestResults(projectId, days);
    const own = (await this.prisma.domain.findMany({ where: { projectId: project.id } })).map((d) => d.host);
    const byDomain = new Map<string, { domain: string; citations: number; platforms: Set<string>; prompts: Set<string>; urls: Map<string, string | null>; own: boolean }>();
    for (const r of results) {
      for (const c of r.citations) {
        const d = c.source.domain;
        const row = byDomain.get(d) ?? { domain: d, citations: 0, platforms: new Set(), prompts: new Set(), urls: new Map(), own: own.some((o) => d === o || d.endsWith(`.${o}`)) };
        row.citations++;
        row.platforms.add(r.platform.name);
        row.prompts.add(r.promptId);
        row.urls.set(c.source.canonicalUrl, c.source.title);
        byDomain.set(d, row);
      }
    }
    return [...byDomain.values()]
      .sort((a, b) => b.citations - a.citations)
      .map((r) => ({ domain: r.domain, own: r.own, citations: r.citations, platforms: [...r.platforms], prompts: r.prompts.size, urls: [...r.urls.entries()].slice(0, 10).map(([url, title]) => ({ url, title })) }));
  }

  async competitors(actorId: string, projectId: string, days = 30) {
    await this.projects.requireProject(actorId, projectId, 'geo.read');
    const { results } = await this.latestResults(projectId, days);
    const list = await this.prisma.geoCompetitor.findMany({ where: { projectId, status: 'ACTIVE' }, orderBy: { name: 'asc' } });
    const total = results.length;
    const brandMentions = results.filter((r) => r.mentions.some((m) => m.mentionType === 'BRAND')).length;
    return {
      answers: total,
      brand: { mentions: brandMentions, visibility: total ? Math.round((brandMentions / total) * 100) : null },
      competitors: list.map((c) => {
        const hits = results.filter((r) => r.competitorMentions.some((m) => m.competitorId === c.id));
        const positions = hits.map((r) => r.competitorMentions.find((m) => m.competitorId === c.id)!.positionHint).filter((p): p is number => typeof p === 'number');
        return {
          id: c.id,
          name: c.name,
          domain: c.domain,
          mentions: hits.length,
          visibility: total ? Math.round((hits.length / total) * 100) : null,
          avgPosition: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null,
        };
      }),
    };
  }

  async addCompetitor(actorId: string, projectId: string, input: { name: string; domain?: string | null }, meta?: RequestMeta) {
    const project = await this.projects.requireProject(actorId, projectId, 'geo.write');
    const name = input.name.trim();
    const domain = input.domain ? hostOf(input.domain.includes('://') ? input.domain : `https://${input.domain}`) : null;
    try {
      const c = await this.prisma.geoCompetitor.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name, domain },
        update: { domain, status: 'ACTIVE' },
      });
      await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.geo.competitor.add', targetType: 'geo_competitor', targetId: c.id, afterState: { name, domain }, requestMeta: meta });
      return c;
    } catch {
      throw new ConflictException({ code: 'COMPETITOR_EXISTS', message: 'This competitor is already tracked.' });
    }
  }

  async removeCompetitor(actorId: string, competitorId: string, meta?: RequestMeta) {
    const c = await this.prisma.geoCompetitor.findUnique({ where: { id: competitorId } });
    if (!c) throw new NotFoundException({ code: 'COMPETITOR_NOT_FOUND', message: 'Competitor not found.' });
    const project = await this.projects.requireProject(actorId, c.projectId, 'geo.write');
    await this.prisma.geoCompetitor.update({ where: { id: competitorId }, data: { status: 'ARCHIVED' } });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.geo.competitor.remove', targetType: 'geo_competitor', targetId: competitorId, requestMeta: meta });
    return { id: competitorId, removed: true };
  }

  async history(actorId: string, projectId: string, limit = 100) {
    await this.projects.requireProject(actorId, projectId, 'geo.read');
    const runs = await this.prisma.geoRun.findMany({
      where: { prompt: { projectId } },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: { prompt: { select: { id: true, prompt: true } }, platformResults: { include: { platform: true, mentions: true } } },
    });
    return runs.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      status: r.status,
      trigger: r.trigger,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      creditCost: r.creditCost,
      platforms: r.platformResults.map((x) => ({ key: x.platform.key, name: x.platform.name, status: x.status, mentioned: x.mentions.some((m) => m.mentionType === 'BRAND') })),
    }));
  }

  async opportunities(actorId: string, projectId: string, status?: TaskStatus) {
    await this.projects.requireProject(actorId, projectId, 'geo.read');
    const rows = await this.prisma.geoOpportunity.findMany({
      where: { projectId, status: status ?? 'OPEN' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return rows.map((o) => this.opportunityView(o));
  }

  async setOpportunityStatus(actorId: string, id: string, status: TaskStatus) {
    const o = await this.prisma.geoOpportunity.findUnique({ where: { id } });
    if (!o) throw new NotFoundException({ code: 'OPPORTUNITY_NOT_FOUND', message: 'Opportunity not found.' });
    await this.projects.requireProject(actorId, o.projectId, 'geo.write');
    return this.opportunityView(await this.prisma.geoOpportunity.update({ where: { id }, data: { status } }));
  }

  private opportunityView(o: { id: string; type: string; priority: number; status: string; detailsJson: Prisma.JsonValue; createdAt: Date; runId: string | null }) {
    return { id: o.id, type: o.type, priority: o.priority, status: o.status, runId: o.runId, createdAt: o.createdAt, ...((o.detailsJson ?? {}) as object) };
  }

  private async findPrompt(id: string) {
    const prompt = await this.prisma.geoPrompt.findUnique({ where: { id }, include: { schedules: true } });
    if (!prompt) throw new NotFoundException({ code: 'PROMPT_NOT_FOUND', message: 'Prompt not found.' });
    return prompt;
  }

  private async readStored(key: string): Promise<StoredResult | null> {
    const text = await this.storage.readText(key);
    if (!text) return null;
    try {
      return JSON.parse(text) as StoredResult;
    } catch {
      return null;
    }
  }
}
