import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { SecretBox } from '../common/utils/secret-box';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

export const GOOGLE_PROVIDERS = ['google_search_console', 'google_analytics'] as const;
export type GoogleProvider = (typeof GOOGLE_PROVIDERS)[number];

/** Read-only scopes only (Google manual §2). */
export const GOOGLE_SCOPES: Record<GoogleProvider, string> = {
  google_search_console: 'https://www.googleapis.com/auth/webmasters.readonly',
  google_analytics: 'https://www.googleapis.com/auth/analytics.readonly',
};

export const SOURCE_LABEL: Record<string, string> = { GOOGLE_SEARCH_CONSOLE: 'Google Search Console', GOOGLE_ANALYTICS: 'Google Analytics 4' };

type GoogleSecret = { refreshToken: string; accessToken?: string; expiresAt?: number };
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string; error?: string; error_description?: string };

const SYNC_QUEUE = 'google.sync';
const TXN_TTL_MS = 10 * 60_000;
const PROPERTY_CACHE_MS = 60 * 60_000;
/** Initial refresh cadence (Google manual §7): GSC daily, GA4 every 6 hours. */
const SYNC_EVERY_MS: Record<string, number> = { GOOGLE_SEARCH_CONSOLE: 24 * 3600_000, GOOGLE_ANALYTICS: 6 * 3600_000 };

const day = (d: Date) => d.toISOString().slice(0, 10);
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

/** Revoked or invalid authorization: retrying will not help, the user must reconnect. */
export class GoogleReauthRequired extends HttpException {
  constructor() {
    super({ code: 'GOOGLE_REAUTH_REQUIRED', message: 'Reconnect Google to continue syncing.' }, HttpStatus.CONFLICT);
  }
}

/**
 * Google integration module (Google API Integration Manual V1.1): OAuth 2.0
 * with PKCE and single-use, short-lived, user/workspace-bound transactions;
 * encrypted tokens that never reach the browser; token refresh under a lock
 * with REAUTH_REQUIRED on revocation; revoke on disconnect; authorized
 * property listing (cached); and idempotent scheduled syncs that upsert
 * normalized Search Console / GA4 metrics with source attribution.
 */
@Injectable()
export class GoogleService implements OnModuleInit {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.jobs.register(SYNC_QUEUE, async (p) => {
      await this.syncDataSource(String(p.dataSourceId), String(p.syncKey));
    });
    this.jobs.registerPeriodic('google.sync.schedule', 15 * 60_000, async () => {
      await this.scheduleDueSyncs();
    });
  }

  // ── Configuration ────────────────────────────────────────────────────────

  private get clientId() {
    return this.config.get<string>('GOOGLE_CLIENT_ID') || this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID') || '';
  }

  private get clientSecret() {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET') || this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') || '';
  }

  private get webUrl() {
    return (this.config.get<string>('WEB_URL') ?? (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
  }

  /** Must match the redirect URI registered on the OAuth client exactly. */
  get redirectUri() {
    return this.config.get<string>('GOOGLE_REDIRECT_URI') || `${this.webUrl}/app/integrations/google/callback`;
  }

  get configured() {
    return !!this.clientId && !!this.clientSecret && !!this.encryptionKeys()[0];
  }

  private encryptionKeys() {
    return [this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY'), this.config.get<string>('INTEGRATION_ENCRYPTION_KEY')].filter((k): k is string => !!k && k.length >= 32);
  }

  /** Seals with the Google token key; opens with it or the general integration key (key rotation). */
  private seal(plain: string) {
    const key = this.encryptionKeys()[0];
    if (!key) throw new ServiceUnavailableException({ code: 'GOOGLE_NOT_CONFIGURED', message: 'Google integrations are not available yet.' });
    return new SecretBox(key).seal(plain);
  }

  private open(sealed: string) {
    for (const key of this.encryptionKeys()) {
      try {
        return new SecretBox(key).open(sealed);
      } catch {
        // try the next key
      }
    }
    throw new ServiceUnavailableException({ code: 'GOOGLE_TOKEN_UNREADABLE', message: 'Stored Google credentials could not be read. Reconnect Google.' });
  }

  // ── OAuth lifecycle ──────────────────────────────────────────────────────

  async start(userId: string, workspaceId: string, provider: GoogleProvider, returnTo?: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, 'integration.manage');
    if (!GOOGLE_PROVIDERS.includes(provider)) throw new BadRequestException({ code: 'UNKNOWN_PROVIDER', message: 'Unknown Google integration.' });
    if (!this.configured) throw new ServiceUnavailableException({ code: 'GOOGLE_NOT_CONFIGURED', message: 'Google integrations are not available yet.' });
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    await this.prisma.oAuthTransaction.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
    await this.prisma.oAuthTransaction.create({
      data: {
        stateHash: sha(state),
        provider,
        userId,
        workspaceId,
        codeVerifierSealed: this.seal(verifier),
        // Same-site path only; the web app redirects there after the callback.
        returnTo: returnTo && /^\/(?![/\\])/.test(returnTo) ? returnTo.slice(0, 300) : null,
        expiresAt: new Date(Date.now() + TXN_TTL_MS),
      },
    });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      // Incremental, read-only consent for the selected product only.
      scope: ['openid', 'email', GOOGLE_SCOPES[provider]].join(' '),
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  /**
   * Completes the OAuth transaction: exact state match, unexpired, single use,
   * same signed-in user; `access_denied` is handled explicitly.
   */
  async callback(userId: string, input: { code?: string; state: string; error?: string }, meta?: RequestMeta) {
    const txn = await this.prisma.oAuthTransaction.findUnique({ where: { stateHash: sha(input.state) } });
    if (!txn) throw new BadRequestException({ code: 'INVALID_STATE', message: 'The connection request is not valid. Please try again.' });
    const claimed = await this.prisma.oAuthTransaction.updateMany({ where: { id: txn.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new BadRequestException({ code: 'INVALID_STATE', message: 'The connection request expired or was already used. Please try again.' });
    if (txn.userId !== userId) throw new BadRequestException({ code: 'INVALID_STATE', message: 'Please finish connecting with the same account that started it.' });
    if (input.error) {
      throw new BadRequestException({ code: input.error === 'access_denied' ? 'GOOGLE_CONSENT_DENIED' : 'GOOGLE_AUTH_FAILED', message: input.error === 'access_denied' ? 'Google connection cancelled.' : 'Google did not complete the connection.' });
    }
    if (!input.code) throw new BadRequestException({ code: 'GOOGLE_AUTH_FAILED', message: 'Google did not return an authorization code.' });
    const ws = await this.rbac.requireWorkspace(userId, txn.workspaceId, 'integration.manage');
    const provider = txn.provider as GoogleProvider;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: input.code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: this.redirectUri, grant_type: 'authorization_code', code_verifier: this.open(txn.codeVerifierSealed) }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    const token = ((await res?.json().catch(() => ({}))) ?? {}) as TokenResponse;
    if (!res?.ok || !token.access_token) throw new BadRequestException({ code: 'GOOGLE_AUTH_FAILED', message: 'Google did not complete the connection. Please try again.' });
    const scopes = (token.scope ?? '').split(/\s+/).filter(Boolean);
    if (!scopes.includes(GOOGLE_SCOPES[provider])) {
      throw new BadRequestException({ code: 'GOOGLE_SCOPE_MISSING', message: 'Read-only access was not granted. Connect again and allow access.' });
    }
    const claims = token.id_token ? (JSON.parse(Buffer.from(token.id_token.split('.')[1] ?? '', 'base64url').toString('utf8') || '{}') as { sub?: string; email?: string }) : {};
    const account = claims.email ?? 'Google account';

    const providerRow = await this.prisma.integrationProvider.findUniqueOrThrow({ where: { key: provider } });
    const existing = await this.prisma.workspaceIntegration.findFirst({
      where: { workspaceId: txn.workspaceId, providerId: providerRow.id, OR: [...(claims.sub ? [{ externalSubjectId: claims.sub }] : []), { externalAccountRef: account }] },
      include: { tokens: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    // Google does not return a refresh token on every authorization: keep the one we have.
    let refreshToken = token.refresh_token;
    if (!refreshToken && existing?.tokens[0]) {
      try {
        refreshToken = (JSON.parse(this.open(existing.tokens[0].accessSecretRef)) as GoogleSecret).refreshToken;
      } catch {
        refreshToken = undefined;
      }
    }
    if (!refreshToken) {
      throw new BadRequestException({ code: 'GOOGLE_NO_REFRESH_TOKEN', message: 'Google did not grant offline access. Remove AmpliVerify under your Google account’s third-party access, then connect again.' });
    }
    const secret: GoogleSecret = { refreshToken, accessToken: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
    const sealed = this.seal(JSON.stringify(secret));
    const saved = await this.prisma.$transaction(async (tx) => {
      const data = { status: 'CONNECTED' as const, connectedBy: userId, externalAccountRef: account, externalSubjectId: claims.sub ?? existing?.externalSubjectId ?? null, scopes, lastErrorCode: null };
      const integ = existing ? await tx.workspaceIntegration.update({ where: { id: existing.id }, data }) : await tx.workspaceIntegration.create({ data: { ...data, workspaceId: txn.workspaceId, providerId: providerRow.id } });
      await tx.integrationToken.deleteMany({ where: { workspaceIntegrationId: integ.id } });
      await tx.integrationToken.create({ data: { workspaceIntegrationId: integ.id, accessSecretRef: sealed, expiresAt: new Date(secret.expiresAt!) } });
      await tx.projectDataSource.updateMany({ where: { workspaceIntegrationId: integ.id, status: { in: ['ERROR', 'REAUTH_REQUIRED'] } }, data: { status: 'CONNECTED' } });
      await this.auditLog.record({ actorUserId: userId, organizationId: ws.organizationId, workspaceId: ws.id, action: 'workspace.integration.connect', targetType: 'workspace_integration', targetId: integ.id, afterState: { provider, account, scopes }, requestMeta: meta }, tx);
      return integ;
    });
    await this.prisma.providerCache.deleteMany({ where: { key: `google:properties:${saved.id}` } });
    return { id: saved.id, provider, account, status: saved.status, returnTo: txn.returnTo };
  }

  /** Revokes the grant at Google (best effort) — called on disconnect. */
  async revoke(integrationId: string) {
    const integ = await this.prisma.workspaceIntegration.findUnique({ where: { id: integrationId }, include: { tokens: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    const sealed = integ?.tokens[0]?.accessSecretRef;
    if (!sealed) return false;
    try {
      const secret = JSON.parse(this.open(sealed)) as GoogleSecret;
      const res = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: secret.refreshToken }), signal: AbortSignal.timeout(10_000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Stops scheduled work for a connection being removed. */
  async stopSyncs(integrationId: string) {
    const sources = await this.prisma.projectDataSource.findMany({ where: { workspaceIntegrationId: integrationId }, select: { id: true } });
    for (const s of sources) {
      await this.prisma.backgroundJob.updateMany({ where: { queue: SYNC_QUEUE, status: 'QUEUED', jobKey: { startsWith: `gsync:${s.id}:` } }, data: { status: 'CANCELED' } });
    }
    await this.prisma.providerCache.deleteMany({ where: { key: `google:properties:${integrationId}` } });
  }

  // ── Tokens and requests ──────────────────────────────────────────────────

  /** A valid access token; refreshes under a per-connection lock so concurrent callers cannot race. */
  async accessToken(integrationId: string, force = false): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`google-token:${integrationId}`}))`;
        const integ = await tx.workspaceIntegration.findUnique({ where: { id: integrationId }, include: { tokens: { orderBy: { createdAt: 'desc' }, take: 1 } } });
        if (!integ || integ.status === 'DISCONNECTED' || !integ.tokens[0]) throw new NotFoundException({ code: 'INTEGRATION_NOT_FOUND', message: 'Google connection not found.' });
        if (integ.status === 'REAUTH_REQUIRED') throw new GoogleReauthRequired();
        const secret = JSON.parse(this.open(integ.tokens[0].accessSecretRef)) as GoogleSecret;
        if (!force && secret.accessToken && secret.expiresAt && secret.expiresAt > Date.now() + 60_000) return secret.accessToken;
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, refresh_token: secret.refreshToken, grant_type: 'refresh_token' }),
          signal: AbortSignal.timeout(20_000),
        }).catch(() => null);
        const token = ((await res?.json().catch(() => ({}))) ?? {}) as TokenResponse;
        if (!res || res.status >= 500) throw new ServiceUnavailableException({ code: 'GOOGLE_UNAVAILABLE', message: 'Google data temporarily unavailable.' });
        if (!res.ok || !token.access_token) {
          // invalid_grant: revoked, expired or password changed — stop syncing until reconnect.
          await tx.workspaceIntegration.update({ where: { id: integrationId }, data: { status: 'REAUTH_REQUIRED', lastErrorCode: token.error ?? `http_${res.status}` } });
          await tx.projectDataSource.updateMany({ where: { workspaceIntegrationId: integrationId, status: 'CONNECTED' }, data: { status: 'REAUTH_REQUIRED' } });
          return null;
        }
        const next: GoogleSecret = { refreshToken: token.refresh_token ?? secret.refreshToken, accessToken: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
        await tx.integrationToken.update({ where: { id: integ.tokens[0].id }, data: { accessSecretRef: this.seal(JSON.stringify(next)), expiresAt: new Date(next.expiresAt!) } });
        return token.access_token;
      },
      { timeout: 30_000, maxWait: 30_000 },
    ).then((t) => {
      if (t === null) throw new GoogleReauthRequired();
      return t;
    });
  }

  /** Calls a Google API with the connection's token; refreshes and retries once on 401; maps errors to safe messages. */
  async request<T>(integrationId: string, url: string, init: { method?: string; body?: unknown; operation: string; product?: 'gsc' | 'ga4' }): Promise<T> {
    const started = Date.now();
    let status = 'ok';
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const access = await this.accessToken(integrationId, attempt > 0);
        const res = await fetch(url, {
          method: init.method ?? 'GET',
          headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.timeout(60_000),
        }).catch((err: Error) => {
          status = err.name === 'TimeoutError' ? 'timeout' : 'network_error';
          throw new ServiceUnavailableException({ code: 'GOOGLE_TIMEOUT', message: 'Analysis taking longer than expected. Please try again shortly.' });
        });
        if (res.status === 401 && attempt === 0) continue;
        const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
        if (res.ok) return json;
        status = `http_${res.status}`;
        if (res.status === 429) throw new ServiceUnavailableException({ code: 'GOOGLE_QUOTA', message: 'Google data temporarily unavailable.' });
        if (res.status === 403 || res.status === 404) {
          throw new HttpException(
            init.product === 'ga4' ? { code: 'GA4_ACCESS_DENIED', message: 'You do not have access to this Analytics property.' } : { code: 'GOOGLE_PROPERTY_ACCESS', message: 'Access to this property is unavailable.' },
            HttpStatus.FORBIDDEN,
          );
        }
        if (res.status >= 500) throw new ServiceUnavailableException({ code: 'GOOGLE_UNAVAILABLE', message: 'Google data temporarily unavailable.' });
        throw new BadRequestException({ code: 'GOOGLE_API_ERROR', message: json.error?.message ?? `Google API error ${res.status}.` });
      }
      throw new GoogleReauthRequired();
    } catch (err) {
      if (status === 'ok') status = err instanceof GoogleReauthRequired ? 'reauth_required' : 'error';
      throw err;
    } finally {
      await this.prisma.providerEvent.create({ data: { provider: 'google', operation: init.operation, status, latencyMs: Date.now() - started } }).catch(() => undefined);
    }
  }

  /** Authorized GSC sites or GA4 properties (cached for an hour; `refresh` re-checks access). */
  async properties(integrationId: string, refresh = false): Promise<{ id: string; name: string; permission?: string }[]> {
    const integ = await this.prisma.workspaceIntegration.findUnique({ where: { id: integrationId }, include: { provider: true } });
    if (!integ || integ.status === 'DISCONNECTED') throw new NotFoundException({ code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found.' });
    const key = `google:properties:${integrationId}`;
    if (!refresh) {
      const hit = await this.prisma.providerCache.findUnique({ where: { key } });
      if (hit && hit.expiresAt > new Date()) return hit.valueJson as { id: string; name: string }[];
    }
    let list: { id: string; name: string; permission?: string }[];
    if (integ.provider.key === 'google_search_console') {
      const r = await this.request<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(integrationId, 'https://www.googleapis.com/webmasters/v3/sites', { operation: 'gsc.sites', product: 'gsc' });
      // The exact property identifier is preserved (URL-prefix or sc-domain:).
      list = (r.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => ({ id: s.siteUrl, name: s.siteUrl, permission: s.permissionLevel }));
    } else {
      const r = await this.request<{ accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[] }>(integrationId, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', { operation: 'ga4.properties', product: 'ga4' });
      list = (r.accountSummaries ?? []).flatMap((a) => (a.propertySummaries ?? []).map((p) => ({ id: p.property, name: `${a.displayName} › ${p.displayName}` })));
    }
    const expiresAt = new Date(Date.now() + PROPERTY_CACHE_MS);
    await this.prisma.providerCache.upsert({ where: { key }, create: { key, provider: 'google', valueJson: list as Prisma.InputJsonArray, expiresAt }, update: { valueJson: list as Prisma.InputJsonArray, fetchedAt: new Date(), expiresAt } });
    return list;
  }

  // ── Scheduled sync ───────────────────────────────────────────────────────

  /** Enqueues due syncs; the job key makes duplicate scheduling within one window a no-op. */
  async scheduleDueSyncs(now = new Date()) {
    const sources = await this.prisma.projectDataSource.findMany({
      where: { sourceType: { in: Object.keys(SYNC_EVERY_MS) }, status: 'CONNECTED', workspaceIntegration: { status: 'CONNECTED' }, project: { status: 'ACTIVE', deletedAt: null } },
      select: { id: true, sourceType: true, lastSyncAt: true, configJson: true },
    });
    let queued = 0;
    for (const s of sources) {
      if (!(s.configJson as { propertyId?: string } | null)?.propertyId) continue;
      const every = SYNC_EVERY_MS[s.sourceType];
      if (s.lastSyncAt && now.getTime() - s.lastSyncAt.getTime() < every) continue;
      const syncKey = `gsync:${s.id}:${Math.floor(now.getTime() / every)}`;
      await this.jobs.enqueue(SYNC_QUEUE, { dataSourceId: s.id, syncKey }, { jobKey: syncKey });
      queued++;
    }
    return queued;
  }

  /** Manual "Sync now" for a project's Google sources. */
  async requestSync(dataSourceId: string) {
    const syncKey = `gsync:${dataSourceId}:manual:${Math.floor(Date.now() / 600_000)}`;
    await this.jobs.enqueue(SYNC_QUEUE, { dataSourceId, syncKey }, { jobKey: syncKey });
    return { queued: true };
  }

  /** One idempotent sync run: fetch, normalize and upsert; stops on revoked authorization. */
  async syncDataSource(dataSourceId: string, syncKey: string) {
    const ds = await this.prisma.projectDataSource.findUnique({ where: { id: dataSourceId }, include: { workspaceIntegration: true } });
    if (!ds || ds.status !== 'CONNECTED' || ds.workspaceIntegration.status !== 'CONNECTED') return;
    const propertyId = (ds.configJson as { propertyId?: string } | null)?.propertyId;
    if (!propertyId) return;
    const existing = await this.prisma.syncRun.findUnique({ where: { syncKey } });
    if (existing?.status === 'SUCCEEDED') return;
    const run = existing
      ? await this.prisma.syncRun.update({ where: { id: existing.id }, data: { status: 'RUNNING', attempts: { increment: 1 }, errorCode: null } })
      : await this.prisma.syncRun.create({ data: { workspaceIntegrationId: ds.workspaceIntegrationId, dataSourceId: ds.id, syncType: ds.sourceType, syncKey, status: 'RUNNING', attempts: 1 } });
    try {
      const { rows, dataThrough } = ds.sourceType === 'GOOGLE_SEARCH_CONSOLE' ? await this.syncSearchConsole(ds.id, ds.projectId, ds.workspaceIntegrationId, propertyId) : await this.syncAnalytics(ds.id, ds.projectId, ds.workspaceIntegrationId, propertyId);
      await this.prisma.$transaction([
        this.prisma.syncRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', completedAt: new Date(), rowsUpserted: rows, dataThrough: dataThrough ? new Date(`${dataThrough}T00:00:00Z`) : null } }),
        this.prisma.projectDataSource.update({ where: { id: ds.id }, data: { lastSyncAt: new Date() } }),
      ]);
    } catch (err) {
      const code = ((err as HttpException).getResponse?.() as { code?: string } | undefined)?.code ?? 'SYNC_FAILED';
      await this.prisma.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorCode: code } });
      if (err instanceof GoogleReauthRequired || code === 'GOOGLE_PROPERTY_ACCESS' || code === 'GA4_ACCESS_DENIED') {
        if (code !== 'GOOGLE_REAUTH_REQUIRED') await this.prisma.projectDataSource.update({ where: { id: ds.id }, data: { status: 'ERROR' } });
        this.logger.warn(`Google sync ${syncKey} stopped: ${code}`);
        return; // permanent: no retry
      }
      throw err; // transient: the job queue retries with backoff
    }
  }

  private async upsertMetric(row: Prisma.GoogleMetricUncheckedCreateInput) {
    const where = { dataSourceId_source_date_dimension_dimensionValue: { dataSourceId: row.dataSourceId, source: row.source, date: row.date, dimension: row.dimension, dimensionValue: row.dimensionValue ?? '' } };
    await this.prisma.googleMetric.upsert({ where, create: row, update: { ...row, fetchedAt: new Date() } });
  }

  private async syncSearchConsole(dataSourceId: string, projectId: string, integrationId: string, siteUrl: string) {
    type Rows = { rows?: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const end = new Date(Date.now() - 86_400_000);
    const start = new Date(end.getTime() - 32 * 86_400_000);
    const daily = await this.request<Rows>(integrationId, url, { method: 'POST', body: { startDate: day(start), endDate: day(end), dimensions: ['date'], dataState: 'final' }, operation: 'gsc.sync', product: 'gsc' });
    let rows = 0;
    const dates = (daily.rows ?? []).map((r) => r.keys?.[0]).filter((d): d is string => !!d).sort();
    for (const r of daily.rows ?? []) {
      await this.upsertMetric({ dataSourceId, projectId, source: 'GSC', propertyId: siteUrl, date: new Date(`${r.keys![0]}T00:00:00Z`), dimension: 'date', dimensionValue: '', clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), ctr: r.ctr, position: r.position });
      rows++;
    }
    // Search Console reports with a lag: the last date with data is the period end.
    const dataThrough = dates.at(-1) ?? null;
    if (dataThrough) {
      const periodStart = day(new Date(new Date(`${dataThrough}T00:00:00Z`).getTime() - 27 * 86_400_000));
      for (const dimension of ['query', 'page'] as const) {
        const r = await this.request<Rows>(integrationId, url, { method: 'POST', body: { startDate: periodStart, endDate: dataThrough, dimensions: [dimension], rowLimit: 250 }, operation: 'gsc.sync', product: 'gsc' });
        for (const x of r.rows ?? []) {
          await this.upsertMetric({ dataSourceId, projectId, source: 'GSC', propertyId: siteUrl, date: new Date(`${dataThrough}T00:00:00Z`), dimension, dimensionValue: (x.keys?.[0] ?? '').slice(0, 2000), clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), ctr: x.ctr, position: x.position });
          rows++;
        }
      }
      await this.prisma.googleMetric.deleteMany({ where: { dataSourceId, source: 'GSC', dimension: { in: ['query', 'page'] }, date: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
    }
    return { rows, dataThrough };
  }

  private async syncAnalytics(dataSourceId: string, projectId: string, integrationId: string, propertyId: string) {
    if (!/^properties\/\d+$/.test(propertyId)) throw new BadRequestException({ code: 'GA4_PROPERTY_INVALID', message: 'GA4 property IDs must be numeric (properties/123).' });
    type Rows = { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] };
    const url = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`;
    const daily = await this.request<Rows>(integrationId, url, {
      method: 'POST',
      body: { dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'engagedSessions' }, { name: 'keyEvents' }], limit: 100 },
      operation: 'ga4.sync',
      product: 'ga4',
    });
    let rows = 0;
    let dataThrough: string | null = null;
    for (const r of daily.rows ?? []) {
      const v = r.dimensionValues[0].value; // YYYYMMDD
      const d = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      if (!dataThrough || d > dataThrough) dataThrough = d;
      await this.upsertMetric({ dataSourceId, projectId, source: 'GA4', propertyId, date: new Date(`${d}T00:00:00Z`), dimension: 'date', dimensionValue: '', activeUsers: Number(r.metricValues[0].value), sessions: Number(r.metricValues[1].value), engagedSessions: Number(r.metricValues[2].value), conversions: Number(r.metricValues[3].value) });
      rows++;
    }
    if (dataThrough) {
      const pages = await this.request<Rows>(integrationId, url, {
        method: 'POST',
        body: {
          dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
          dimensions: [{ name: 'landingPagePlusQueryString' }],
          metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'keyEvents' }],
          dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } },
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 100,
        },
        operation: 'ga4.sync',
        product: 'ga4',
      });
      for (const r of pages.rows ?? []) {
        await this.upsertMetric({ dataSourceId, projectId, source: 'GA4', propertyId, date: new Date(`${dataThrough}T00:00:00Z`), dimension: 'landing_page', dimensionValue: r.dimensionValues[0].value.slice(0, 2000), sessions: Number(r.metricValues[0].value), engagedSessions: Number(r.metricValues[1].value), conversions: Number(r.metricValues[2].value) });
        rows++;
      }
    }
    return { rows, dataThrough };
  }

  // ── Reads with attribution ───────────────────────────────────────────────

  /** Project Google overview: stored daily metrics, freshness and connection state per source. */
  async overview(projectId: string, days = 28) {
    const sources = await this.prisma.projectDataSource.findMany({ where: { projectId, sourceType: { in: Object.keys(SYNC_EVERY_MS) } }, include: { workspaceIntegration: { select: { status: true, externalAccountRef: true } } } });
    const since = new Date(Date.now() - Math.min(Math.max(days, 7), 90) * 86_400_000);
    return Promise.all(
      sources.map(async (s) => {
        const [metrics, lastRun] = await Promise.all([
          this.prisma.googleMetric.findMany({ where: { dataSourceId: s.id, dimension: 'date', date: { gte: since } }, orderBy: { date: 'asc' } }),
          this.prisma.syncRun.findFirst({ where: { dataSourceId: s.id }, orderBy: { startedAt: 'desc' } }),
        ]);
        const isGsc = s.sourceType === 'GOOGLE_SEARCH_CONSOLE';
        const sum = (k: 'clicks' | 'impressions' | 'sessions' | 'activeUsers') => (metrics.length ? metrics.reduce((t, m) => t + (m[k] ?? 0), 0) : null);
        return {
          dataSourceId: s.id,
          source: s.sourceType,
          sourceLabel: SOURCE_LABEL[s.sourceType] ?? s.sourceType,
          propertyId: (s.configJson as { propertyId?: string } | null)?.propertyId ?? null,
          account: s.workspaceIntegration.externalAccountRef,
          status: s.workspaceIntegration.status === 'REAUTH_REQUIRED' ? 'REAUTH_REQUIRED' : s.status,
          lastSyncAt: s.lastSyncAt,
          lastRun: lastRun ? { status: lastRun.status, at: lastRun.completedAt ?? lastRun.startedAt, errorCode: lastRun.errorCode, dataThrough: lastRun.dataThrough } : null,
          // null = no data stored yet (not a measured zero).
          totals: isGsc ? { clicks: sum('clicks'), impressions: sum('impressions') } : { sessions: sum('sessions'), activeUsers: sum('activeUsers') },
          daily: metrics.map((m) => ({ date: day(m.date), ...(isGsc ? { clicks: m.clicks, impressions: m.impressions, ctr: m.ctr, position: m.position } : { sessions: m.sessions, activeUsers: m.activeUsers, engagedSessions: m.engagedSessions, conversions: m.conversions }) })),
          note: isGsc ? 'Search Console rows are subject to Google data availability and privacy filtering; long-tail queries may be omitted.' : 'GA4 data depends on the authorized property and may update for recent days.',
        };
      }),
    );
  }

  /** Latest stored Search Console breakdown (28-day period), or null when not synced yet. */
  async storedBreakdown(dataSourceId: string, dimension: 'query' | 'page') {
    const latest = await this.prisma.googleMetric.findFirst({ where: { dataSourceId, source: 'GSC', dimension }, orderBy: { date: 'desc' }, select: { date: true, fetchedAt: true } });
    if (!latest || Date.now() - latest.fetchedAt.getTime() > 36 * 3600_000) return null;
    const rows = await this.prisma.googleMetric.findMany({ where: { dataSourceId, source: 'GSC', dimension, date: latest.date }, orderBy: { clicks: 'desc' }, take: 250 });
    return { dataThrough: day(latest.date), fetchedAt: latest.fetchedAt, rows };
  }
}
