import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { EditorService } from '../editor/editor.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { parsePublicUrl, safeFetch } from '../common/utils/safe-fetch';
import { SecretBox } from '../common/utils/secret-box';

const GOOGLE_PROVIDERS = ['google_search_console', 'google_analytics'] as const;
type GoogleProvider = (typeof GOOGLE_PROVIDERS)[number];

type WordPressSecret = { siteUrl: string; username: string; password: string };
type GoogleSecret = { refreshToken: string; accessToken?: string; expiresAt?: number };

/**
 * Workspace integrations: WordPress publishing (application passwords) and
 * Google Search Console / Analytics 4 (OAuth, read-only). Credentials are
 * sealed with AES-256-GCM and never returned to clients.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly editor: EditorService,
    private readonly config: ConfigService,
  ) {}

  private box() {
    const key = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY');
    if (!key) throw new ServiceUnavailableException({ code: 'INTEGRATIONS_NOT_CONFIGURED', message: 'Integrations are not available yet.' });
    return new SecretBox(key);
  }

  private get allowPrivate() {
    return this.config.get('AUDIT_ALLOW_PRIVATE_HOSTS') === 'true';
  }

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  get googleConfigured() {
    return !!this.config.get('GOOGLE_OAUTH_CLIENT_ID') && !!this.config.get('GOOGLE_OAUTH_CLIENT_SECRET');
  }

  async list(userId: string, workspaceId: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'workspace.read');
    const [providers, connections] = await Promise.all([
      this.prisma.integrationProvider.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.workspaceIntegration.findMany({
        where: { workspaceId, status: { not: 'DISCONNECTED' } },
        include: { provider: true, connector: { select: { displayName: true, email: true } }, dataSources: { include: { project: { select: { id: true, name: true } } } }, syncRuns: { orderBy: { startedAt: 'desc' }, take: 1 } },
      }),
    ]);
    return providers.map((p) => {
      const conns = connections.filter((c) => c.providerId === p.id);
      return {
        key: p.key,
        name: p.name,
        authType: p.authType,
        available: p.authType === 'OAUTH2' ? this.googleConfigured && !!this.config.get('INTEGRATION_ENCRYPTION_KEY') : !!this.config.get('INTEGRATION_ENCRYPTION_KEY'),
        connections: conns.map((c) => ({
          id: c.id,
          status: c.status,
          account: c.externalAccountRef,
          connectedBy: c.connector.displayName ?? c.connector.email,
          createdAt: c.createdAt,
          lastSync: c.syncRuns[0] ? { status: c.syncRuns[0].status, at: c.syncRuns[0].startedAt, error: c.syncRuns[0].errorCode } : null,
          projects: c.dataSources.map((d) => ({ id: d.project.id, name: d.project.name, sourceType: d.sourceType, config: d.configJson, lastSyncAt: d.lastSyncAt })),
        })),
      };
    });
  }

  private async storeConnection(userId: string, workspaceId: string, providerKey: string, account: string, secret: object, meta?: RequestMeta) {
    const ws = await this.rbac.requireWorkspace(userId, workspaceId, 'integration.manage');
    const provider = await this.prisma.integrationProvider.findUnique({ where: { key: providerKey } });
    if (!provider?.active) throw new NotFoundException({ code: 'PROVIDER_NOT_FOUND', message: 'Unknown integration.' });
    const sealed = this.box().seal(JSON.stringify(secret));
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceIntegration.findFirst({ where: { workspaceId, providerId: provider.id, externalAccountRef: account } });
      const integ = existing
        ? await tx.workspaceIntegration.update({ where: { id: existing.id }, data: { status: 'CONNECTED', connectedBy: userId } })
        : await tx.workspaceIntegration.create({ data: { workspaceId, providerId: provider.id, status: 'CONNECTED', externalAccountRef: account, connectedBy: userId } });
      await tx.integrationToken.deleteMany({ where: { workspaceIntegrationId: integ.id } });
      await tx.integrationToken.create({ data: { workspaceIntegrationId: integ.id, accessSecretRef: sealed } });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId, action: 'workspace.integration.connect', targetType: 'workspace_integration', targetId: integ.id, afterState: { provider: providerKey, account }, requestMeta: meta }, tx);
      return { id: integ.id, provider: providerKey, account, status: integ.status };
    });
  }

  private async secretOf<T>(integrationId: string): Promise<{ integ: Prisma.WorkspaceIntegrationGetPayload<{ include: { provider: true } }>; secret: T }> {
    const integ = await this.prisma.workspaceIntegration.findUnique({ where: { id: integrationId }, include: { provider: true, tokens: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!integ || integ.status === 'DISCONNECTED' || !integ.tokens[0]) throw new NotFoundException({ code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found.' });
    return { integ, secret: JSON.parse(this.box().open(integ.tokens[0].accessSecretRef)) as T };
  }

  async disconnect(userId: string, integrationId: string, meta?: RequestMeta) {
    const integ = await this.prisma.workspaceIntegration.findUnique({ where: { id: integrationId } });
    if (!integ) throw new NotFoundException({ code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found.' });
    const ws = await this.rbac.requireWorkspace(userId, integ.workspaceId, 'integration.manage');
    await this.prisma.$transaction(async (tx) => {
      await tx.integrationToken.deleteMany({ where: { workspaceIntegrationId: integrationId } });
      await tx.projectDataSource.updateMany({ where: { workspaceIntegrationId: integrationId }, data: { status: 'DISCONNECTED' } });
      await tx.workspaceIntegration.update({ where: { id: integrationId }, data: { status: 'DISCONNECTED' } });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId: ws.id, action: 'workspace.integration.disconnect', targetType: 'workspace_integration', targetId: integrationId, requestMeta: meta }, tx);
    });
    return { id: integrationId, status: 'DISCONNECTED' };
  }

  // ── WordPress ──────────────────────────────────────────────────────────

  private wpHeaders(s: WordPressSecret) {
    return { authorization: `Basic ${Buffer.from(`${s.username}:${s.password.replace(/\s+/g, '')}`).toString('base64')}`, accept: 'application/json' };
  }

  async connectWordPress(userId: string, workspaceId: string, input: { siteUrl: string; username: string; applicationPassword: string }, meta?: RequestMeta) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'integration.manage');
    await this.entitlements.assertFeature(workspaceId, 'integrations.cms');
    const site = parsePublicUrl(input.siteUrl.trim(), this.allowPrivate);
    const siteUrl = `${site.origin}${site.pathname.replace(/\/+$/, '')}`;
    const secret: WordPressSecret = { siteUrl, username: input.username.trim(), password: input.applicationPassword };
    const res = await safeFetch(`${siteUrl}/wp-json/wp/v2/users/me?context=edit`, { headers: this.wpHeaders(secret), allowPrivate: this.allowPrivate, maxBytes: 512 * 1024 }).catch(() => null);
    if (!res) throw new BadRequestException({ code: 'WORDPRESS_UNREACHABLE', message: 'We could not reach this WordPress site.' });
    if (res.status === 401 || res.status === 403) throw new BadRequestException({ code: 'WORDPRESS_AUTH_FAILED', message: 'WordPress rejected the username or application password.' });
    if (res.status !== 200) throw new BadRequestException({ code: 'WORDPRESS_API_UNAVAILABLE', message: `The WordPress REST API returned HTTP ${res.status}.` });
    const me = JSON.parse(res.body) as { capabilities?: Record<string, boolean> };
    if (me.capabilities && !me.capabilities.edit_posts) throw new BadRequestException({ code: 'WORDPRESS_PERMISSION', message: 'This WordPress user cannot create posts.' });
    return this.storeConnection(userId, workspaceId, 'wordpress', new URL(siteUrl).host, secret, meta);
  }

  async testConnection(userId: string, integrationId: string) {
    const { integ, secret } = await this.secretOf<WordPressSecret & GoogleSecret>(integrationId);
    await this.rbac.requireWorkspace(userId, integ.workspaceId, 'integration.manage');
    let ok = false;
    if (integ.provider.key === 'wordpress') {
      const res = await safeFetch(`${secret.siteUrl}/wp-json/wp/v2/users/me`, { headers: this.wpHeaders(secret), allowPrivate: this.allowPrivate, maxBytes: 256 * 1024 }).catch(() => null);
      ok = res?.status === 200;
    } else {
      ok = !!(await this.googleAccessToken(integrationId).catch(() => null));
    }
    await this.prisma.workspaceIntegration.update({ where: { id: integrationId }, data: { status: ok ? 'CONNECTED' : 'ERROR' } });
    return { ok };
  }

  /** Publishes (or updates) an editor document as a WordPress post or page. */
  async publishToWordPress(userId: string, documentId: string, input: { integrationId: string; status: 'draft' | 'publish'; type: 'posts' | 'pages' }, meta?: RequestMeta) {
    const doc = await this.prisma.editorDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' });
    const project = await this.projects.requireProject(userId, doc.projectId, 'editor.write');
    await this.entitlements.assertFeature(project.workspaceId, 'integrations.cms');
    const { integ, secret } = await this.secretOf<WordPressSecret>(input.integrationId);
    if (integ.workspaceId !== project.workspaceId || integ.provider.key !== 'wordpress') throw new BadRequestException({ code: 'INTEGRATION_MISMATCH', message: 'Choose a WordPress site connected to this workspace.' });
    const content = await this.editor.content(documentId);
    if (!content) throw new BadRequestException({ code: 'EMPTY_DOCUMENT', message: 'Save the document before publishing.' });

    const previous = await this.prisma.editorChangeEvent.findFirst({ where: { documentId, action: 'cms.publish', metadata: { path: ['integrationId'], equals: integ.id } }, orderBy: { createdAt: 'desc' } });
    const remoteId = (previous?.metadata as { remoteId?: number } | null)?.remoteId;
    const sync = await this.prisma.syncRun.create({ data: { workspaceIntegrationId: integ.id, syncType: 'PUBLISH', status: 'RUNNING' } });
    const body = JSON.stringify({ title: content.title || doc.title, content: content.html, excerpt: content.metaDescription, status: input.status, ...(content.slug ? { slug: content.slug } : {}) });
    const res = await safeFetch(`${secret.siteUrl}/wp-json/wp/v2/${input.type}${remoteId ? `/${remoteId}` : ''}`, {
      method: 'POST',
      headers: { ...this.wpHeaders(secret), 'content-type': 'application/json' },
      body,
      allowPrivate: this.allowPrivate,
      maxBytes: 2 * 1024 * 1024,
    }).catch((e) => ({ status: 0, body: String(e) }));
    if (res.status !== 200 && res.status !== 201) {
      await this.prisma.syncRun.update({ where: { id: sync.id }, data: { status: 'FAILED', completedAt: new Date(), errorCode: `HTTP_${res.status}` } });
      throw new BadRequestException({ code: 'PUBLISH_FAILED', message: res.status === 401 || res.status === 403 ? 'WordPress rejected the credentials. Reconnect the site.' : 'WordPress could not save the post.' });
    }
    const post = JSON.parse(res.body) as { id: number; link?: string; status?: string };
    await this.prisma.$transaction([
      this.prisma.syncRun.update({ where: { id: sync.id }, data: { status: 'SUCCEEDED', completedAt: new Date() } }),
      this.prisma.editorChangeEvent.create({ data: { documentId, actorUserId: userId, action: 'cms.publish', metadata: { integrationId: integ.id, remoteId: post.id, link: post.link ?? null, status: post.status ?? input.status, type: input.type } } }),
      this.prisma.editorDocument.update({ where: { id: documentId }, data: { status: input.status === 'publish' ? 'PUBLISHED' : doc.status } }),
    ]);
    await this.auditLog.record({ actorUserId: userId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.editor.publish', targetType: 'editor_document', targetId: documentId, afterState: { remoteId: post.id, status: input.status }, requestMeta: meta });
    return { remoteId: post.id, link: post.link ?? null, status: post.status ?? input.status };
  }

  // ── Google (Search Console, Analytics 4) ───────────────────────────────

  private stateSecret() {
    return this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') ?? '';
  }

  private signState(payload: object) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${createHmac('sha256', this.stateSecret()).update(body).digest('base64url')}`;
  }

  private readState(state: string) {
    const [body, sig] = state.split('.');
    const expected = createHmac('sha256', this.stateSecret()).update(body ?? '').digest('base64url');
    if (!body || !sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'The connection request expired. Please try again.' });
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { workspaceId: string; userId: string; provider: GoogleProvider; exp: number };
    if (payload.exp < Date.now()) throw new BadRequestException({ code: 'INVALID_STATE', message: 'The connection request expired. Please try again.' });
    return payload;
  }

  async googleStart(userId: string, workspaceId: string, provider: GoogleProvider) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'integration.manage');
    if (!GOOGLE_PROVIDERS.includes(provider)) throw new BadRequestException({ code: 'UNKNOWN_PROVIDER', message: 'Unknown Google integration.' });
    if (!this.googleConfigured) throw new ServiceUnavailableException({ code: 'GOOGLE_NOT_CONFIGURED', message: 'Google integrations are not available yet.' });
    this.box();
    const p = await this.prisma.integrationProvider.findUniqueOrThrow({ where: { key: provider } });
    const scopes = [...((p.scopesJson as string[]) ?? []), 'openid', 'email'];
    const params = new URLSearchParams({
      client_id: String(this.config.get('GOOGLE_OAUTH_CLIENT_ID')),
      redirect_uri: `${this.webUrl}/app/integrations/google/callback`,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: this.signState({ workspaceId, userId, provider, exp: Date.now() + 10 * 60_000 }),
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  async googleCallback(userId: string, code: string, state: string, meta?: RequestMeta) {
    const s = this.readState(state);
    if (s.userId !== userId) throw new BadRequestException({ code: 'INVALID_STATE', message: 'Please finish connecting with the same account.' });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: String(this.config.get('GOOGLE_OAUTH_CLIENT_ID')),
        client_secret: String(this.config.get('GOOGLE_OAUTH_CLIENT_SECRET')),
        redirect_uri: `${this.webUrl}/app/integrations/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const token = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error_description?: string };
    if (!res.ok || !token.refresh_token) throw new BadRequestException({ code: 'GOOGLE_AUTH_FAILED', message: token.error_description ?? 'Google did not grant offline access. Try again.' });
    const email = token.id_token ? (JSON.parse(Buffer.from(token.id_token.split('.')[1], 'base64url').toString('utf8')) as { email?: string }).email : undefined;
    const secret: GoogleSecret = { refreshToken: token.refresh_token, accessToken: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
    return this.storeConnection(userId, s.workspaceId, s.provider, email ?? 'Google account', secret, meta);
  }

  private async googleAccessToken(integrationId: string) {
    const { secret } = await this.secretOf<GoogleSecret>(integrationId);
    if (secret.accessToken && secret.expiresAt && secret.expiresAt > Date.now() + 60_000) return secret.accessToken;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: String(this.config.get('GOOGLE_OAUTH_CLIENT_ID')), client_secret: String(this.config.get('GOOGLE_OAUTH_CLIENT_SECRET')), refresh_token: secret.refreshToken, grant_type: 'refresh_token' }),
    });
    const token = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!res.ok || !token.access_token) {
      await this.prisma.workspaceIntegration.update({ where: { id: integrationId }, data: { status: 'ERROR' } });
      throw new BadRequestException({ code: 'GOOGLE_TOKEN_EXPIRED', message: 'Google access expired. Reconnect the account.' });
    }
    const sealed = this.box().seal(JSON.stringify({ ...secret, accessToken: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 }));
    await this.prisma.integrationToken.updateMany({ where: { workspaceIntegrationId: integrationId }, data: { accessSecretRef: sealed } });
    return token.access_token;
  }

  private async googleGet<T>(integrationId: string, url: string, init?: { method?: string; body?: unknown }) {
    const access = await this.googleAccessToken(integrationId);
    const res = await fetch(url, { method: init?.method ?? 'GET', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: init?.body ? JSON.stringify(init.body) : undefined });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new BadRequestException({ code: 'GOOGLE_API_ERROR', message: json.error?.message ?? `Google API error ${res.status}.` });
    return json;
  }

  /** Properties available on a connected Google account (GSC sites or GA4 properties). */
  async googleProperties(userId: string, integrationId: string) {
    const { integ } = await this.secretOf<GoogleSecret>(integrationId);
    await this.rbac.requireWorkspace(userId, integ.workspaceId, 'workspace.read');
    if (integ.provider.key === 'google_search_console') {
      const r = await this.googleGet<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(integrationId, 'https://www.googleapis.com/webmasters/v3/sites');
      return (r.siteEntry ?? []).map((s) => ({ id: s.siteUrl, name: s.siteUrl, permission: s.permissionLevel }));
    }
    const r = await this.googleGet<{ accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[] }>(integrationId, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
    return (r.accountSummaries ?? []).flatMap((a) => (a.propertySummaries ?? []).map((p) => ({ id: p.property, name: `${a.displayName} › ${p.displayName}` })));
  }

  async linkProject(userId: string, projectId: string, input: { integrationId: string; propertyId?: string }, meta?: RequestMeta) {
    const project = await this.projects.requireProject(userId, projectId, 'project.update');
    const integ = await this.prisma.workspaceIntegration.findUnique({ where: { id: input.integrationId }, include: { provider: true } });
    if (!integ || integ.workspaceId !== project.workspaceId) throw new NotFoundException({ code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found in this workspace.' });
    const sourceType = integ.provider.key.toUpperCase();
    const ds = await this.prisma.projectDataSource.upsert({
      where: { projectId_workspaceIntegrationId_sourceType: { projectId, workspaceIntegrationId: integ.id, sourceType } },
      create: { projectId, workspaceIntegrationId: integ.id, sourceType, status: 'CONNECTED', configJson: input.propertyId ? { propertyId: input.propertyId } : Prisma.DbNull },
      update: { status: 'CONNECTED', configJson: input.propertyId ? { propertyId: input.propertyId } : Prisma.DbNull },
    });
    await this.auditLog.record({ actorUserId: userId, organizationId: project.organizationId, workspaceId: project.workspaceId, action: 'project.datasource.link', targetType: 'project_data_source', targetId: ds.id, afterState: { sourceType, propertyId: input.propertyId ?? null }, requestMeta: meta });
    return ds;
  }

  async unlinkProject(userId: string, dataSourceId: string) {
    const ds = await this.prisma.projectDataSource.findUnique({ where: { id: dataSourceId } });
    if (!ds) throw new NotFoundException({ code: 'DATASOURCE_NOT_FOUND', message: 'Data source not found.' });
    await this.projects.requireProject(userId, ds.projectId, 'project.update');
    await this.prisma.projectDataSource.delete({ where: { id: dataSourceId } });
    return { id: dataSourceId, deleted: true };
  }

  async projectSources(userId: string, projectId: string) {
    await this.projects.requireProject(userId, projectId, 'project.read');
    return this.prisma.projectDataSource.findMany({ where: { projectId }, include: { workspaceIntegration: { include: { provider: true } } } });
  }

  /** Search Console performance (clicks, impressions, CTR, position) by query or page. */
  async searchPerformance(userId: string, projectId: string, input: { dimension: 'query' | 'page'; days: number }) {
    const ds = await this.prisma.projectDataSource.findFirst({ where: { projectId, sourceType: 'GOOGLE_SEARCH_CONSOLE', status: 'CONNECTED' } });
    await this.projects.requireProject(userId, projectId, 'keyword.read');
    if (!ds) return { connected: false, rows: [] };
    const siteUrl = (ds.configJson as { propertyId?: string } | null)?.propertyId;
    if (!siteUrl) return { connected: true, configured: false, rows: [] };
    const end = new Date(Date.now() - 2 * 86_400_000);
    const start = new Date(end.getTime() - Math.min(Math.max(input.days, 7), 480) * 86_400_000);
    const r = await this.googleGet<{ rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }>(
      ds.workspaceIntegrationId,
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      { method: 'POST', body: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: [input.dimension], rowLimit: 250 } },
    );
    await this.prisma.projectDataSource.update({ where: { id: ds.id }, data: { lastSyncAt: new Date() } });
    return {
      connected: true,
      configured: true,
      siteUrl,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      rows: (r.rows ?? []).map((x) => ({ key: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: Math.round(x.ctr * 10000) / 100, position: Math.round(x.position * 10) / 10 })),
    };
  }

  /** GA4 organic landing-page sessions. */
  async analytics(userId: string, projectId: string, days: number) {
    await this.projects.requireProject(userId, projectId, 'project.read');
    const ds = await this.prisma.projectDataSource.findFirst({ where: { projectId, sourceType: 'GOOGLE_ANALYTICS', status: 'CONNECTED' } });
    if (!ds) return { connected: false, rows: [] };
    const property = (ds.configJson as { propertyId?: string } | null)?.propertyId;
    if (!property) return { connected: true, configured: false, rows: [] };
    const r = await this.googleGet<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>(ds.workspaceIntegrationId, `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
      method: 'POST',
      body: {
        dateRanges: [{ startDate: `${Math.min(Math.max(days, 7), 365)}daysAgo`, endDate: 'yesterday' }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'conversions' }],
        dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } },
        limit: 100,
      },
    });
    await this.prisma.projectDataSource.update({ where: { id: ds.id }, data: { lastSyncAt: new Date() } });
    return { connected: true, configured: true, rows: (r.rows ?? []).map((x) => ({ page: x.dimensionValues[0].value, sessions: Number(x.metricValues[0].value), engaged: Number(x.metricValues[1].value), conversions: Number(x.metricValues[2].value) })) };
  }
}

