import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from '../commerce/credits.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { normalizeHost } from '../common/utils/domain';
import { DataForSeoClient, KeywordRow, SerpRow } from './dataforseo.client';

export type KeywordTool = 'EXPLORER' | 'RELATED' | 'QUESTIONS' | 'COMPETITOR' | 'SERP';
export type ResearchInput = { tool: KeywordTool; query: string; country?: string; language?: string };

const USAGE_FEATURE = 'keywords.lookup';
const QUESTION_RE = /^(how|what|why|when|where|who|which|can|does|do|is|are|should|will|would|could)\b/i;
const SAVED_LIST = 'Saved keywords';

const normalizeTerm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Keyword Research: Explorer, Related, Questions, Competitor keywords and SERP
 * analysis (provider data, stored per query), plus keyword lists, saved
 * keywords and clusters.
 */
@Injectable()
export class KeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
    private readonly storage: ContentStorageService,
    private readonly provider: DataForSeoClient,
  ) {}

  get configured() {
    return this.provider.configured;
  }

  async research(actorId: string, projectId: string, input: ResearchInput) {
    const project = await this.projects.requireProject(actorId, projectId, 'keyword.write');
    await this.entitlements.assertModuleEnabled('keywords');
    await this.entitlements.assertFeature(project.workspaceId, 'keywords.research');
    await this.entitlements.assertWithinLimit(project.workspaceId, 'limit.keyword_lookups', USAGE_FEATURE);
    const country = (input.country ?? 'US').toUpperCase();
    const language = (input.language ?? 'en').toLowerCase();
    if (!/^[A-Z]{2}$/.test(country) || !/^[a-z]{2}$/.test(language)) throw new BadRequestException({ code: 'INVALID_LOCALE', message: 'Use a 2-letter country and language code.' });

    let query = input.query.trim();
    if (input.tool === 'COMPETITOR') {
      const host = normalizeHost(query);
      if (!host) throw new BadRequestException({ code: 'INVALID_DOMAIN', message: 'Enter a competitor domain, for example example.com.' });
      query = host;
    } else if (query.length < 2) {
      throw new BadRequestException({ code: 'QUERY_REQUIRED', message: 'Enter a keyword.' });
    }

    // Charge first so a failed provider call can be refunded with the same key.
    const record = await this.prisma.$transaction(async (tx) => {
      const q = await tx.keywordQuery.create({ data: { projectId, query, locale: language, countryCode: country, tool: input.tool, createdBy: actorId } });
      await this.credits.charge({ workspaceId: project.workspaceId, projectId, featureKey: USAGE_FEATURE, referenceType: 'keyword_query', referenceId: q.id, idempotencyKey: `kw:${q.id}`, actorId }, tx);
      return q;
    });

    let payload: { keywords?: KeywordRow[]; seed?: KeywordRow | null; serp?: SerpRow[] };
    try {
      switch (input.tool) {
        case 'EXPLORER': {
          const [seed, ideas] = await Promise.all([this.provider.overview(query, country, language), this.provider.ideas(query, country, language)]);
          payload = { seed, keywords: ideas };
          break;
        }
        case 'RELATED':
          payload = { keywords: await this.provider.related(query, country, language) };
          break;
        case 'QUESTIONS':
          payload = { keywords: (await this.provider.suggestions(query, country, language)).filter((k) => QUESTION_RE.test(k.keyword) || k.keyword.endsWith('?')) };
          break;
        case 'COMPETITOR':
          payload = { keywords: await this.provider.domainKeywords(query, country, language) };
          break;
        case 'SERP': {
          const [serp, seed] = await Promise.all([this.provider.serp(query, country, language), this.provider.overview(query, country, language)]);
          payload = { serp, seed };
          break;
        }
      }
    } catch (err) {
      await this.credits.refund(project.workspaceId, `kw:${record.id}`);
      // A failed lookup does not count toward the plan limit.
      await this.prisma.usageEvent.deleteMany({ where: { idempotencyKey: `usage:kw:${record.id}` } });
      await this.prisma.keywordQuery.delete({ where: { id: record.id } });
      throw err;
    }

    const key = `keywords/${projectId}/${record.id}.json`;
    await this.storage.writeBuffer(key, Buffer.from(JSON.stringify(payload), 'utf8'), 'application/json');
    const rows = [...(payload.seed ? [payload.seed] : []), ...(payload.keywords ?? [])];
    await this.persistMetrics(rows, country, language);
    if (input.tool === 'SERP' && payload.serp) await this.persistSerp(query, country, language, payload.serp);
    await this.prisma.keywordQuery.update({ where: { id: record.id }, data: { resultRef: key, resultCount: payload.keywords?.length ?? payload.serp?.length ?? 0 } });
    return this.view(record.id, payload, { ...record, resultRef: key });
  }

  private async persistMetrics(rows: KeywordRow[], country: string, language: string) {
    for (const row of rows.slice(0, 300)) {
      const kw = await this.upsertKeyword(row.keyword, country, language);
      await this.prisma.keywordMetricSnapshot.create({
        data: { keywordId: kw.id, provider: 'dataforseo', searchVolume: row.searchVolume, difficulty: row.difficulty, cpc: row.cpc },
      });
    }
  }

  private async persistSerp(term: string, country: string, language: string, serp: SerpRow[]) {
    const kw = await this.upsertKeyword(term, country, language);
    const seen = new Set<string>();
    await this.prisma.serpSnapshot.create({
      data: {
        keywordId: kw.id,
        provider: 'dataforseo',
        locale: `${language}-${country}`,
        results: {
          create: serp
            .filter((r) => {
              const k = `${r.position}|${r.type}|${r.url}`;
              return seen.has(k) ? false : (seen.add(k), true);
            })
            .map((r) => ({ position: r.position, url: r.url.slice(0, 2000), domain: r.domain, title: r.title, resultType: r.type })),
        },
      },
    });
  }

  private upsertKeyword(term: string, countryCode: string, locale: string) {
    const normalizedTerm = normalizeTerm(term).slice(0, 300);
    return this.prisma.keyword.upsert({
      where: { normalizedTerm_locale_countryCode: { normalizedTerm, locale, countryCode } },
      create: { normalizedTerm, locale, countryCode },
      update: {},
    });
  }

  private view(id: string, payload: object, q: { query: string; tool: string; countryCode: string; locale: string; createdAt: Date; resultRef: string | null }) {
    return { id, query: q.query, tool: q.tool, country: q.countryCode, language: q.locale, createdAt: q.createdAt, ...payload };
  }

  async recent(actorId: string, projectId: string, tool?: string) {
    await this.projects.requireProject(actorId, projectId, 'keyword.read');
    return this.prisma.keywordQuery.findMany({
      where: { projectId, ...(tool ? { tool } : {}), resultRef: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, query: true, tool: true, countryCode: true, locale: true, resultCount: true, createdAt: true },
    });
  }

  async getQuery(actorId: string, queryId: string) {
    const q = await this.prisma.keywordQuery.findUnique({ where: { id: queryId } });
    if (!q || !q.resultRef) throw new NotFoundException({ code: 'QUERY_NOT_FOUND', message: 'Research not found.' });
    await this.projects.requireProject(actorId, q.projectId, 'keyword.read');
    const raw = await this.storage.readText(q.resultRef);
    return this.view(q.id, raw ? JSON.parse(raw) : {}, q);
  }

  /** Latest metrics for terms (used by lists and clusters). */
  private async metricsFor(keywordIds: string[]) {
    if (!keywordIds.length) return new Map<string, { searchVolume: number | null; difficulty: number | null; cpc: number | null }>();
    const rows = await this.prisma.$queryRaw<{ keyword_id: string; search_volume: number | null; difficulty: Prisma.Decimal | null; cpc: Prisma.Decimal | null }[]>`
      SELECT DISTINCT ON ("keyword_id") "keyword_id", "search_volume", "difficulty", "cpc"
        FROM "keyword_metric_snapshots" WHERE "keyword_id" IN (${Prisma.join(keywordIds.map((id) => Prisma.sql`${id}::uuid`))})
       ORDER BY "keyword_id", "captured_at" DESC`;
    return new Map(rows.map((r) => [r.keyword_id, { searchVolume: r.search_volume, difficulty: r.difficulty ? Number(r.difficulty) : null, cpc: r.cpc ? Number(r.cpc) : null }]));
  }

  // ── Lists ──────────────────────────────────────────────────────────────

  async lists(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'keyword.read');
    const lists = await this.prisma.keywordList.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { items: true } }, creator: { select: { displayName: true, email: true } } } });
    return lists.map((l) => ({ id: l.id, name: l.name, saved: l.name === SAVED_LIST, count: l._count.items, createdAt: l.createdAt, createdBy: l.creator.displayName ?? l.creator.email }));
  }

  async getList(actorId: string, listId: string) {
    const list = await this.prisma.keywordList.findUnique({ where: { id: listId }, include: { items: { include: { keyword: true }, orderBy: { addedAt: 'desc' } } } });
    if (!list) throw new NotFoundException({ code: 'LIST_NOT_FOUND', message: 'List not found.' });
    await this.projects.requireProject(actorId, list.projectId, 'keyword.read');
    const metrics = await this.metricsFor(list.items.map((i) => i.keywordId));
    return {
      id: list.id,
      name: list.name,
      projectId: list.projectId,
      saved: list.name === SAVED_LIST,
      keywords: list.items.map((i) => ({ id: i.keywordId, keyword: i.keyword.normalizedTerm, country: i.keyword.countryCode, language: i.keyword.locale, addedAt: i.addedAt, ...(metrics.get(i.keywordId) ?? { searchVolume: null, difficulty: null, cpc: null }) })),
    };
  }

  async createList(actorId: string, projectId: string, name: string) {
    const project = await this.projects.requireProject(actorId, projectId, 'keyword.write');
    try {
      const list = await this.prisma.keywordList.create({ data: { projectId, name: name.trim(), createdBy: actorId } });
      await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.keyword_list.create', targetType: 'keyword_list', targetId: list.id, afterState: { name: list.name } });
      return list;
    } catch {
      throw new ConflictException({ code: 'LIST_EXISTS', message: 'A list with this name already exists.' });
    }
  }

  async renameList(actorId: string, listId: string, name: string) {
    const list = await this.findList(listId);
    await this.projects.requireProject(actorId, list.projectId, 'keyword.write');
    return this.prisma.keywordList.update({ where: { id: listId }, data: { name: name.trim() } });
  }

  async deleteList(actorId: string, listId: string) {
    const list = await this.findList(listId);
    const project = await this.projects.requireProject(actorId, list.projectId, 'keyword.write');
    await this.prisma.keywordList.delete({ where: { id: listId } });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.keyword_list.delete', targetType: 'keyword_list', targetId: listId, beforeState: { name: list.name } });
    return { id: listId, deleted: true };
  }

  async addToList(actorId: string, listId: string, keywords: string[], country = 'US', language = 'en') {
    const list = await this.findList(listId);
    await this.projects.requireProject(actorId, list.projectId, 'keyword.write');
    for (const term of keywords.map(normalizeTerm).filter(Boolean).slice(0, 500)) {
      const kw = await this.upsertKeyword(term, country.toUpperCase(), language.toLowerCase());
      await this.prisma.keywordListItem.upsert({ where: { listId_keywordId: { listId, keywordId: kw.id } }, create: { listId, keywordId: kw.id }, update: {} });
    }
    return this.getList(actorId, listId);
  }

  async removeFromList(actorId: string, listId: string, keywordIds: string[]) {
    const list = await this.findList(listId);
    await this.projects.requireProject(actorId, list.projectId, 'keyword.write');
    await this.prisma.keywordListItem.deleteMany({ where: { listId, keywordId: { in: keywordIds } } });
    return this.getList(actorId, listId);
  }

  async save(actorId: string, projectId: string, keywords: string[], country?: string, language?: string) {
    await this.projects.requireProject(actorId, projectId, 'keyword.write');
    const list =
      (await this.prisma.keywordList.findUnique({ where: { projectId_name: { projectId, name: SAVED_LIST } } })) ??
      (await this.prisma.keywordList.create({ data: { projectId, name: SAVED_LIST, createdBy: actorId } }));
    return this.addToList(actorId, list.id, keywords, country, language);
  }

  private async findList(id: string) {
    const list = await this.prisma.keywordList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException({ code: 'LIST_NOT_FOUND', message: 'List not found.' });
    return list;
  }

  // ── Clusters ───────────────────────────────────────────────────────────

  async clusters(actorId: string, projectId: string) {
    await this.projects.requireProject(actorId, projectId, 'keyword.read');
    const clusters = await this.prisma.keywordCluster.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, include: { items: { include: { keyword: true } } } });
    const metrics = await this.metricsFor([...new Set(clusters.flatMap((c) => c.items.map((i) => i.keywordId)))]);
    return clusters
      .sort((a, b) => b.items.length - a.items.length || b.createdAt.getTime() - a.createdAt.getTime())
      .map((c) => {
      const kws = c.items.map((i) => ({ id: i.keywordId, keyword: i.keyword.normalizedTerm, score: i.score ? Number(i.score) : null, ...(metrics.get(i.keywordId) ?? { searchVolume: null, difficulty: null, cpc: null }) }));
      const diffs = kws.map((k) => k.difficulty).filter((d): d is number => d !== null);
      return {
        id: c.id,
        label: c.label,
        method: c.method,
        createdAt: c.createdAt,
        keywords: kws,
        totalVolume: kws.reduce((n, k) => n + (k.searchVolume ?? 0), 0),
        avgDifficulty: diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null,
      };
    });
  }

  /**
   * Groups keywords by shared significant terms (lexical clustering): each
   * keyword joins the cluster whose head term it shares most, else starts one.
   */
  async autoCluster(actorId: string, projectId: string, input: { listId?: string; keywords?: string[]; country?: string; language?: string }) {
    const project = await this.projects.requireProject(actorId, projectId, 'keyword.write');
    let terms: { id: string; term: string }[] = [];
    if (input.listId) {
      const list = await this.getList(actorId, input.listId);
      if (list.projectId !== projectId) throw new BadRequestException({ code: 'LIST_NOT_IN_PROJECT', message: 'This list belongs to another project.' });
      terms = list.keywords.map((k) => ({ id: k.id, term: k.keyword }));
    } else {
      for (const t of (input.keywords ?? []).map(normalizeTerm).filter(Boolean).slice(0, 500)) {
        const kw = await this.upsertKeyword(t, (input.country ?? 'US').toUpperCase(), (input.language ?? 'en').toLowerCase());
        terms.push({ id: kw.id, term: kw.normalizedTerm });
      }
    }
    if (terms.length < 2) throw new BadRequestException({ code: 'NOT_ENOUGH_KEYWORDS', message: 'Add at least two keywords to cluster.' });

    const groups = lexicalClusters(terms);
    const created = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (const g of groups) {
        out.push(
          await tx.keywordCluster.create({
            data: { projectId, label: g.label, method: 'LEXICAL', items: { create: g.items.map((i) => ({ keywordId: i.id, score: i.score })) } },
          }),
        );
      }
      return out;
    });
    await this.auditLog.record({ actorUserId: actorId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.keyword_cluster.create', targetType: 'keyword_cluster', targetId: null, afterState: { clusters: created.length, keywords: terms.length } });
    return this.clusters(actorId, projectId);
  }

  async deleteCluster(actorId: string, clusterId: string) {
    const c = await this.prisma.keywordCluster.findUnique({ where: { id: clusterId } });
    if (!c) throw new NotFoundException({ code: 'CLUSTER_NOT_FOUND', message: 'Cluster not found.' });
    await this.projects.requireProject(actorId, c.projectId, 'keyword.write');
    await this.prisma.keywordCluster.delete({ where: { id: clusterId } });
    return { id: clusterId, deleted: true };
  }
}

const STOP = new Set(['the', 'a', 'an', 'for', 'to', 'of', 'in', 'on', 'and', 'or', 'with', 'how', 'what', 'why', 'is', 'are', 'best', 'vs', 'my', 'your', 'do', 'does', 'can', 'i']);

export function lexicalClusters(terms: { id: string; term: string }[]) {
  const tokens = (t: string) => t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));
  const freq = new Map<string, number>();
  for (const t of terms) for (const w of new Set(tokens(t.term))) freq.set(w, (freq.get(w) ?? 0) + 1);
  const clusters = new Map<string, { label: string; items: { id: string; score: number }[] }>();
  for (const t of terms) {
    const ws = tokens(t.term);
    // Head = the term's most frequent shared token (ties: longer token).
    const head = ws.filter((w) => (freq.get(w) ?? 0) > 1).sort((a, b) => (freq.get(b)! - freq.get(a)!) || b.length - a.length)[0] ?? ws[0] ?? t.term;
    const c = clusters.get(head) ?? { label: head, items: [] };
    c.items.push({ id: t.id, score: ws.length ? Math.round((ws.filter((w) => w === head).length / ws.length) * 10000) / 10000 : 0 });
    clusters.set(head, c);
  }
  return [...clusters.values()].sort((a, b) => b.items.length - a.items.length);
}
