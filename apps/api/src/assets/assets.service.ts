import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetOwnershipStatus, AssetRelationship, MarketplaceAssetType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import { AuditService } from '../audit/audit.service';
import { normalizeHost } from '../common/utils/domain';
import { safeFetch } from '../common/utils/safe-fetch';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { detectFileType, IMAGE_TYPES } from '../storage/file-safety';
import { ValuationService } from '../valuation/valuation.service';

export const ANALYSIS_CHECKS = ['seo', 'traffic', 'technical', 'content', 'domain', 'valuation'] as const;
export type AssetInput = {
  workspaceId: string;
  name: string;
  url?: string | null;
  assetType: MarketplaceAssetType;
  relationship: AssetRelationship;
  description?: string | null;
  category?: string | null;
  acquiredAt?: string | null;
  purchasePriceMinor?: number | null;
  currency?: string;
  projectId?: string | null;
};

const num = (v: bigint | null | undefined) => (v === null || v === undefined ? null : Number(v));
const TXT_PREFIX = 'ampliverify-verification=';

/**
 * Digital Assets (V2 guide §2.1–§2.6). An asset's relationship (owned,
 * managed, authorized, prospective) is what the user claims; its ownership
 * status is what we could verify (DNS TXT, meta tag, HTML file) or what staff
 * accepted from documents. Analysing a site never adds it as owned.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly storage: ContentStorageService,
    private readonly valuation: ValuationService,
  ) {}

  private async asset(userId: string, id: string, permission = 'project.read') {
    const a = await this.prisma.digitalAsset.findUnique({ where: { id } });
    if (!a) throw new NotFoundException({ code: 'ASSET_NOT_FOUND', message: 'Asset not found.' });
    await this.rbac.requireWorkspace(userId, a.workspaceId, permission);
    return a;
  }

  private view(a: Prisma.DigitalAssetGetPayload<object> & { project?: { id: string; name: string } | null }) {
    return {
      id: a.id,
      name: a.name,
      url: a.url,
      domain: a.domain,
      assetType: a.assetType,
      relationship: a.relationship,
      ownershipStatus: a.ownershipStatus,
      verifiedMethod: a.verifiedMethod,
      verifiedAt: a.verifiedAt,
      description: a.description,
      category: a.category,
      acquiredAt: a.acquiredAt,
      purchasePriceMinor: num(a.purchasePriceMinor),
      currency: a.currency,
      project: a.project ?? null,
      archivedAt: a.archivedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async summary(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'project.read');
    const where = { workspaceId, archivedAt: null };
    const [byRel, byStatus, projects, analyses, latestValues] = await Promise.all([
      this.prisma.digitalAsset.groupBy({ by: ['relationship'], where, _count: true }),
      this.prisma.digitalAsset.groupBy({ by: ['ownershipStatus'], where, _count: true }),
      this.prisma.digitalAsset.findMany({ where: { ...where, projectId: { not: null } }, select: { project: { select: { status: true } } } }),
      this.prisma.acquisitionAnalysis.count({ where: { workspaceId } }),
      this.portfolioValue(workspaceId),
    ]);
    const rel = Object.fromEntries(byRel.map((r) => [r.relationship, r._count])) as Partial<Record<AssetRelationship, number>>;
    return {
      totalAssets: byRel.filter((r) => r.relationship !== 'PROSPECTIVE').reduce((t, r) => t + r._count, 0),
      owned: rel.OWNED ?? 0,
      managed: rel.MANAGED ?? 0,
      authorized: rel.AUTHORIZED ?? 0,
      prospective: rel.PROSPECTIVE ?? 0,
      verification: Object.fromEntries(byStatus.map((s) => [s.ownershipStatus, s._count])),
      activeProjects: projects.filter((p) => p.project?.status === 'ACTIVE').length,
      linkedProjects: projects.length,
      analyses,
      // Sum of the latest completed valuation range per verified, non-prospective asset; null when none exists.
      estimatedValue: latestValues,
    };
  }

  private async portfolioValue(workspaceId: string) {
    const assets = await this.prisma.digitalAsset.findMany({ where: { workspaceId, archivedAt: null, relationship: { not: 'PROSPECTIVE' }, domain: { not: null } }, select: { domain: true } });
    if (!assets.length) return null;
    const rows = await this.prisma.websiteValuation.findMany({ where: { workspaceId, status: 'COMPLETED', domain: { in: assets.map((a) => a.domain!) }, valueLow: { not: null } }, orderBy: { completedAt: 'desc' }, select: { domain: true, valueLow: true, valueHigh: true, currency: true } });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!latest.has(r.domain)) latest.set(r.domain, r);
    if (!latest.size) return null;
    const vals = [...latest.values()];
    return { low: vals.reduce((t, v) => t + (v.valueLow ?? 0), 0), high: vals.reduce((t, v) => t + (v.valueHigh ?? 0), 0), currency: vals[0].currency, assetsValued: vals.length };
  }

  async list(userId: string, workspaceId: string, filters: { relationship?: AssetRelationship; q?: string; archived?: boolean } = {}) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'project.read');
    const rows = await this.prisma.digitalAsset.findMany({
      where: {
        workspaceId,
        archivedAt: filters.archived ? { not: null } : null,
        ...(filters.relationship ? { relationship: filters.relationship } : { relationship: { not: 'PROSPECTIVE' } }),
        ...(filters.q?.trim() ? { OR: [{ name: { contains: filters.q.trim(), mode: 'insensitive' } }, { domain: { contains: filters.q.trim(), mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { project: { select: { id: true, name: true } } },
    });
    return rows.map((a) => this.view(a));
  }

  async detail(userId: string, id: string) {
    const a = await this.asset(userId, id);
    const [project, evidence, financials, valuations, analyses] = await Promise.all([
      a.projectId ? this.prisma.project.findUnique({ where: { id: a.projectId }, select: { id: true, name: true, status: true } }) : null,
      this.prisma.assetOwnershipEvidence.findMany({ where: { assetId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.assetFinancialEntry.findMany({ where: { assetId: id }, orderBy: { month: 'desc' }, take: 36 }),
      a.domain ? this.prisma.websiteValuation.findMany({ where: { workspaceId: a.workspaceId, domain: a.domain }, orderBy: { createdAt: 'desc' }, take: 24, select: { id: true, kind: true, status: true, qualityScore: true, confidenceGrade: true, valueLow: true, valueHigh: true, currency: true, createdAt: true, completedAt: true } }) : [],
      this.prisma.acquisitionAnalysis.findMany({ where: { assetId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, createdAt: true, valuationId: true } }),
    ]);
    const tasks = project ? await this.prisma.optimizationTask.groupBy({ by: ['status'], where: { projectId: project.id }, _count: true }) : [];
    return {
      ...this.view({ ...a, project }),
      verificationToken: a.verificationToken,
      verification: a.domain
        ? {
            dnsRecord: { type: 'TXT', host: a.domain, value: `${TXT_PREFIX}${a.verificationToken}` },
            metaTag: `<meta name="ampliverify-verification" content="${a.verificationToken}">`,
            file: { path: `/.well-known/ampliverify-${a.verificationToken.slice(0, 12)}.txt`, content: a.verificationToken },
          }
        : null,
      evidence: evidence.map((e) => ({ id: e.id, method: e.method, status: e.status, detail: e.detail, filename: e.filename, createdAt: e.createdAt })),
      financials: financials.map((f) => ({ id: f.id, month: f.month, revenueMinor: Number(f.revenueMinor), costMinor: Number(f.costMinor), source: f.source, note: f.note })),
      valuations,
      analyses,
      tasks: Object.fromEntries(tasks.map((t) => [t.status, t._count])),
    };
  }

  async create(userId: string, input: AssetInput) {
    await this.rbac.requireWorkspace(userId, input.workspaceId, 'project.create');
    const data = await this.validate(input);
    const a = await this.prisma.digitalAsset.create({ data: { ...data, workspaceId: input.workspaceId, createdBy: userId, verificationToken: randomBytes(16).toString('hex') } });
    await this.audit.record({ actorUserId: userId, workspaceId: input.workspaceId, action: 'asset.create', targetType: 'digital_asset', targetId: a.id, afterState: { name: a.name, relationship: a.relationship } });
    return this.view(a);
  }

  async update(userId: string, id: string, input: Partial<AssetInput> & { archived?: boolean }) {
    const a = await this.asset(userId, id, 'project.create');
    if (input.archived !== undefined) {
      const row = await this.prisma.digitalAsset.update({ where: { id }, data: { archivedAt: input.archived ? new Date() : null } });
      return this.view(row);
    }
    const merged: AssetInput = {
      workspaceId: a.workspaceId,
      name: input.name ?? a.name,
      url: input.url !== undefined ? input.url : a.url,
      assetType: input.assetType ?? a.assetType,
      relationship: input.relationship ?? a.relationship,
      description: input.description !== undefined ? input.description : a.description,
      category: input.category !== undefined ? input.category : a.category,
      acquiredAt: input.acquiredAt !== undefined ? input.acquiredAt : a.acquiredAt?.toISOString().slice(0, 10),
      purchasePriceMinor: input.purchasePriceMinor !== undefined ? input.purchasePriceMinor : num(a.purchasePriceMinor),
      currency: input.currency ?? a.currency,
      projectId: input.projectId !== undefined ? input.projectId : a.projectId,
    };
    const data = await this.validate(merged);
    // Changing the address invalidates earlier verification.
    const reset = data.domain !== a.domain ? { ownershipStatus: 'UNVERIFIED' as AssetOwnershipStatus, verifiedAt: null, verifiedMethod: null } : {};
    const row = await this.prisma.digitalAsset.update({ where: { id }, data: { ...data, ...reset } });
    await this.audit.record({ actorUserId: userId, workspaceId: a.workspaceId, action: 'asset.update', targetType: 'digital_asset', targetId: id });
    return this.view(row);
  }

  async remove(userId: string, id: string) {
    const a = await this.asset(userId, id, 'project.create');
    const files = await this.prisma.assetOwnershipEvidence.findMany({ where: { assetId: id, storageKey: { not: null } } });
    await this.prisma.digitalAsset.delete({ where: { id } });
    await Promise.all(files.map((f) => this.storage.delete(f.storageKey!).catch(() => undefined)));
    await this.audit.record({ actorUserId: userId, workspaceId: a.workspaceId, action: 'asset.delete', targetType: 'digital_asset', targetId: id });
    return { deleted: true };
  }

  /** Automated proof of control: DNS TXT record, homepage meta tag or a well-known file. */
  async verify(userId: string, id: string, method: 'DNS_TXT' | 'META_TAG' | 'HTML_FILE') {
    const a = await this.asset(userId, id, 'project.create');
    if (!a.domain) throw new BadRequestException({ code: 'NO_DOMAIN', message: 'Add the website address first.' });
    if (a.relationship === 'PROSPECTIVE') throw new BadRequestException({ code: 'PROSPECTIVE', message: 'Prospective assets are not verified. Change the relationship once you own or manage it.' });
    let ok = false;
    let detail = '';
    try {
      if (method === 'DNS_TXT') {
        const records = (await dns.resolveTxt(a.domain)).map((r) => r.join(''));
        ok = records.includes(`${TXT_PREFIX}${a.verificationToken}`);
        detail = ok ? 'TXT record found.' : `TXT record not found (${records.length} TXT record(s) checked).`;
      } else if (method === 'META_TAG') {
        const res = await safeFetch(`https://${a.domain}/`, { timeoutMs: 10_000, maxBytes: 1_000_000, maxRedirects: 3 });
        const tag = /<meta\s+[^>]*name=["']ampliverify-verification["'][^>]*>/i.exec(res.body)?.[0] ?? '';
        ok = tag.includes(a.verificationToken);
        detail = ok ? 'Meta tag found on the home page.' : tag ? 'Meta tag found but the token does not match.' : 'Meta tag not found on the home page.';
      } else {
        const res = await safeFetch(`https://${a.domain}/.well-known/ampliverify-${a.verificationToken.slice(0, 12)}.txt`, { timeoutMs: 10_000, maxBytes: 10_000, maxRedirects: 2 });
        ok = res.status === 200 && res.body.trim() === a.verificationToken;
        detail = ok ? 'Verification file found.' : `Verification file not found (HTTP ${res.status}).`;
      }
    } catch (err) {
      detail = `Check failed: ${(err as Error).message}`.slice(0, 300);
    }
    await this.prisma.assetOwnershipEvidence.create({ data: { assetId: id, method, status: ok ? 'VERIFIED' : 'REJECTED', detail, createdBy: userId } });
    if (ok) await this.prisma.digitalAsset.update({ where: { id }, data: { ownershipStatus: 'VERIFIED', verifiedAt: new Date(), verifiedMethod: method } });
    await this.audit.record({ actorUserId: userId, workspaceId: a.workspaceId, action: ok ? 'asset.verify.success' : 'asset.verify.failed', targetType: 'digital_asset', targetId: id, afterState: { method, detail } });
    return { verified: ok, detail };
  }

  /** Documents (purchase agreement, registrar record) for staff review; the asset stays PENDING until reviewed. */
  async uploadEvidence(userId: string, id: string, note: string | undefined, file: { buffer: Buffer; originalname: string; size: number } | undefined) {
    const a = await this.asset(userId, id, 'project.create');
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Choose a file.' });
    if (file.size > 15 * 1024 * 1024) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Files can be up to 15 MB.' });
    const type = detectFileType(file.buffer, ['application/pdf', ...IMAGE_TYPES]);
    if (!type) throw new BadRequestException({ code: 'FILE_TYPE', message: 'Use a PDF or image file.' });
    const key = `assets/evidence/${id}/${randomBytes(12).toString('hex')}.${type.ext}`;
    await this.storage.writeBuffer(key, file.buffer, type.mime);
    await this.prisma.assetOwnershipEvidence.create({ data: { assetId: id, method: 'DOCUMENT', status: 'PENDING', detail: note?.trim().slice(0, 500) || null, storageKey: key, filename: file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 120), createdBy: userId } });
    if (a.ownershipStatus !== 'VERIFIED') await this.prisma.digitalAsset.update({ where: { id }, data: { ownershipStatus: 'PENDING' } });
    return { uploaded: true };
  }

  async addFinancial(userId: string, id: string, input: { month: string; revenueMinor: number; costMinor: number; note?: string }) {
    const a = await this.asset(userId, id, 'project.create');
    if (!/^\d{4}-\d{2}$/.test(input.month)) throw new BadRequestException({ code: 'MONTH_INVALID', message: 'Use the YYYY-MM format.' });
    const month = new Date(`${input.month}-01T00:00:00Z`);
    if (month > new Date()) throw new BadRequestException({ code: 'MONTH_FUTURE', message: 'Only past or current months can be recorded.' });
    const row = await this.prisma.assetFinancialEntry.upsert({
      where: { assetId_month_source: { assetId: id, month, source: 'SELF_REPORTED' } },
      create: { assetId: id, month, revenueMinor: BigInt(input.revenueMinor), costMinor: BigInt(input.costMinor), note: input.note?.trim().slice(0, 300) || null, createdBy: userId },
      update: { revenueMinor: BigInt(input.revenueMinor), costMinor: BigInt(input.costMinor), note: input.note?.trim().slice(0, 300) || null },
    });
    await this.audit.record({ actorUserId: userId, workspaceId: a.workspaceId, action: 'asset.financials.record', targetType: 'digital_asset', targetId: id, afterState: { month: input.month } });
    return { id: row.id };
  }

  async deleteFinancial(userId: string, id: string, entryId: string) {
    await this.asset(userId, id, 'project.create');
    await this.prisma.assetFinancialEntry.deleteMany({ where: { id: entryId, assetId: id } });
    return { deleted: true };
  }

  /** Performance & Reports: per-asset value, financials and linked project activity from recorded data only. */
  async performance(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'project.read');
    const assets = await this.prisma.digitalAsset.findMany({ where: { workspaceId, archivedAt: null, relationship: { not: 'PROSPECTIVE' } }, include: { project: { select: { id: true, name: true } }, financials: { orderBy: { month: 'desc' }, take: 12 } }, orderBy: { name: 'asc' } });
    const domains = assets.map((a) => a.domain).filter((d): d is string => !!d);
    const vals = domains.length ? await this.prisma.websiteValuation.findMany({ where: { workspaceId, status: 'COMPLETED', domain: { in: domains } }, orderBy: { completedAt: 'desc' }, select: { domain: true, qualityScore: true, valueLow: true, valueHigh: true, currency: true, completedAt: true } }) : [];
    const projectIds = assets.map((a) => a.projectId).filter((p): p is string => !!p);
    const tasks = projectIds.length ? await this.prisma.optimizationTask.groupBy({ by: ['projectId', 'status'], where: { projectId: { in: projectIds } }, _count: true }) : [];
    return assets.map((a) => {
      const history = vals.filter((v) => v.domain === a.domain);
      const revenue = a.financials.reduce((t, f) => t + Number(f.revenueMinor), 0);
      const cost = a.financials.reduce((t, f) => t + Number(f.costMinor), 0);
      return {
        ...this.view(a),
        latestValuation: history[0] ?? null,
        previousValuation: history[1] ?? null,
        valuationCount: history.length,
        last12Months: a.financials.length ? { months: a.financials.length, revenueMinor: revenue, costMinor: cost, profitMinor: revenue - cost, source: 'SELF_REPORTED' } : null,
        tasks: Object.fromEntries(tasks.filter((t) => t.projectId === a.projectId).map((t) => [t.status, t._count])),
      };
    });
  }

  // ── Acquisition Analyzer ────────────────────────────────────────────────

  async analyses(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'project.read');
    const rows = await this.prisma.acquisitionAnalysis.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const vals = await this.prisma.websiteValuation.findMany({ where: { id: { in: rows.map((r) => r.valuationId).filter((v): v is string => !!v) } }, select: { id: true, status: true, qualityScore: true, confidenceGrade: true, valueLow: true, valueHigh: true, currency: true } });
    const map = new Map(vals.map((v) => [v.id, v]));
    return rows.map((r) => ({ id: r.id, url: r.url, domain: r.domain, assetType: r.assetType, askingPriceMinor: num(r.askingPriceMinor), currency: r.currency, checks: r.checks, assetId: r.assetId, valuation: r.valuationId ? (map.get(r.valuationId) ?? null) : null, createdAt: r.createdAt }));
  }

  async analyze(userId: string, input: { workspaceId: string; url: string; assetType: MarketplaceAssetType; checks: string[]; askingPriceMinor?: number | null; currency?: string; notes?: string }) {
    await this.rbac.requireWorkspace(userId, input.workspaceId, 'project.read');
    const domain = normalizeHost(input.url);
    if (!domain) throw new BadRequestException({ code: 'URL_INVALID', message: 'Enter a valid public website address.' });
    const checks = input.checks.filter((c) => (ANALYSIS_CHECKS as readonly string[]).includes(c));
    if (!checks.length) throw new BadRequestException({ code: 'CHECKS_REQUIRED', message: 'Select at least one check.' });
    // The analysis uses the Website Value Calculator pipeline (real crawl and provider evidence).
    const config = await this.valuation.publicConfig();
    const est = (await this.valuation.createEstimate({ domain, consentVersion: config.consentVersion, userId, idempotencyKey: `acq-${randomBytes(8).toString('hex')}` })) as { id: string };
    const row = await this.prisma.acquisitionAnalysis.create({
      data: { workspaceId: input.workspaceId, createdBy: userId, url: `https://${domain}`, domain, assetType: input.assetType, checks, askingPriceMinor: input.askingPriceMinor ? BigInt(input.askingPriceMinor) : null, currency: (input.currency ?? 'USD').toUpperCase(), notes: input.notes?.trim().slice(0, 2000) || null, valuationId: est.id },
    });
    await this.audit.record({ actorUserId: userId, workspaceId: input.workspaceId, action: 'asset.acquisition.analyze', targetType: 'acquisition_analysis', targetId: row.id, afterState: { domain, checks } });
    return { id: row.id, valuationId: est.id };
  }

  async analysis(userId: string, id: string) {
    const r = await this.prisma.acquisitionAnalysis.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: 'ANALYSIS_NOT_FOUND', message: 'Analysis not found.' });
    await this.rbac.requireWorkspace(userId, r.workspaceId, 'project.read');
    const valuation = r.valuationId ? await this.valuation.get(r.valuationId, { userId }).catch(() => null) : null;
    const evidence = r.valuationId ? await this.valuation.evidence(r.valuationId, { userId }).catch(() => []) : [];
    return { id: r.id, url: r.url, domain: r.domain, assetType: r.assetType, checks: r.checks, askingPriceMinor: num(r.askingPriceMinor), currency: r.currency, notes: r.notes, assetId: r.assetId, createdAt: r.createdAt, valuation, evidence };
  }

  /** Save as a prospective acquisition. It is never marked owned from analysis alone. */
  async saveProspect(userId: string, id: string) {
    const r = await this.prisma.acquisitionAnalysis.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: 'ANALYSIS_NOT_FOUND', message: 'Analysis not found.' });
    await this.rbac.requireWorkspace(userId, r.workspaceId, 'project.create');
    if (r.assetId) return { assetId: r.assetId };
    const a = await this.prisma.digitalAsset.create({ data: { workspaceId: r.workspaceId, createdBy: userId, name: r.domain, url: r.url, domain: r.domain, assetType: r.assetType, relationship: 'PROSPECTIVE', verificationToken: randomBytes(16).toString('hex'), purchasePriceMinor: r.askingPriceMinor, currency: r.currency } });
    await this.prisma.acquisitionAnalysis.update({ where: { id }, data: { assetId: a.id } });
    return { assetId: a.id };
  }

  private async validate(input: AssetInput) {
    const name = input.name?.trim();
    if (!name || name.length < 2) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Name the asset.' });
    let url: string | null = null;
    let domain: string | null = null;
    if (input.url?.trim()) {
      domain = normalizeHost(input.url);
      if (!domain) throw new BadRequestException({ code: 'URL_INVALID', message: 'Enter a valid public website address.' });
      url = `https://${domain}`;
    }
    if (input.projectId) {
      const p = await this.prisma.project.findUnique({ where: { id: input.projectId }, select: { workspaceId: true } });
      if (!p || p.workspaceId !== input.workspaceId) throw new BadRequestException({ code: 'PROJECT_INVALID', message: 'Choose a project from this workspace.' });
    }
    if (input.purchasePriceMinor !== null && input.purchasePriceMinor !== undefined && (!Number.isInteger(input.purchasePriceMinor) || input.purchasePriceMinor < 0)) throw new BadRequestException({ code: 'PRICE_INVALID', message: 'Enter a valid price.' });
    const acquiredAt = input.acquiredAt ? new Date(`${input.acquiredAt.slice(0, 10)}T00:00:00Z`) : null;
    if (acquiredAt && (Number.isNaN(acquiredAt.getTime()) || acquiredAt > new Date())) throw new BadRequestException({ code: 'DATE_INVALID', message: 'Enter a valid past date.' });
    return {
      name: name.slice(0, 120),
      url,
      domain,
      assetType: input.assetType,
      relationship: input.relationship,
      description: input.description?.trim().slice(0, 4000) || null,
      category: input.category?.trim().slice(0, 60) || null,
      acquiredAt,
      purchasePriceMinor: input.purchasePriceMinor === null || input.purchasePriceMinor === undefined ? null : BigInt(input.purchasePriceMinor),
      currency: (input.currency ?? 'USD').toUpperCase().slice(0, 3),
      projectId: input.projectId ?? null,
    };
  }
}
