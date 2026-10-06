import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, JWK, SignJWT } from 'jose';
import request from 'supertest';
import { configureApp } from '../../src/configure-app';
import { createPrisma, grantGlobal, testDatabaseUrl, uniq } from './helpers';

const ISSUER = 'http://auth.test';
const AUDIENCE = 'ampliverify-api';
const SYNC_SECRET = 's'.repeat(40);

/** End-to-end through the HTTP stack with real JWKS-verified bearer tokens. */
describe('HTTP API', () => {
  let app: INestApplication;
  let jwksServer: Server;
  let prisma: PrismaClient;
  let privateKey: CryptoKey;
  let foreignKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey;
    foreignKey = (await generateKeyPair('RS256')).privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256', use: 'sig' };

    jwksServer = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
    const { port } = jwksServer.address() as AddressInfo;

    Object.assign(process.env, {
      DATABASE_URL: testDatabaseUrl(),
      BETTER_AUTH_JWKS_URL: `http://127.0.0.1:${port}/jwks`,
      BETTER_AUTH_ISSUER: ISSUER,
      BETTER_AUTH_AUDIENCE: AUDIENCE,
      AUTH_SYNC_SECRET: SYNC_SECRET,
    });

    // Import after env is set: ConfigModule validates at module construction.
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
    prisma = createPrisma();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await new Promise((resolve) => jwksServer.close(resolve));
  });

  const api = () => request(app.getHttpServer());

  function token(sub: string, key: CryptoKey = privateKey, overrides: { aud?: string } = {}) {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(overrides.aud ?? AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  }

  async function provision(label: string) {
    const authSubject = `auth|${uniq(label)}`;
    const res = await api()
      .post('/api/v1/internal/auth/users/sync')
      .set('x-auth-sync-secret', SYNC_SECRET)
      .send({ authSubject, email: `${uniq(label)}@example.test`, displayName: label })
      .expect(200);
    return { authSubject, id: res.body.data.id as string, bearer: `Bearer ${await token(authSubject)}` };
  }

  it('health is public', async () => {
    const res = await api().get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok', service: 'ampliverify-api' }, meta: {}, error: null });
  });

  it('auth sync requires the shared secret', async () => {
    const res = await api()
      .post('/api/v1/internal/auth/users/sync')
      .set('x-auth-sync-secret', 'wrong')
      .send({ authSubject: 'x', email: 'x@example.test' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_AUTH_SYNC_SECRET');
  });

  it('rejects missing, forged, wrong-audience and unprovisioned tokens', async () => {
    const user = await provision('authn');
    expect((await api().get('/api/v1/user/me').expect(401)).body.error.code).toBe('MISSING_BEARER_TOKEN');
    const forged = await token(user.authSubject, foreignKey);
    expect((await api().get('/api/v1/user/me').set('authorization', `Bearer ${forged}`).expect(401)).body.error.code).toBe('INVALID_BEARER_TOKEN');
    const wrongAud = await token(user.authSubject, privateKey, { aud: 'other' });
    expect((await api().get('/api/v1/user/me').set('authorization', `Bearer ${wrongAud}`).expect(401)).body.error.code).toBe('INVALID_BEARER_TOKEN');
    const ghost = await token('auth|ghost');
    expect((await api().get('/api/v1/user/me').set('authorization', `Bearer ${ghost}`).expect(401)).body.error.code).toBe('USER_NOT_PROVISIONED');
  });

  it('suspended users are rejected', async () => {
    const user = await provision('suspended');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const res = await api().get('/api/v1/user/me').set('authorization', user.bearer).expect(401);
    expect(res.body.error.code).toBe('USER_NOT_ACTIVE');
  });

  it('onboarding -> project CRUD, with cross-tenant denial over HTTP', async () => {
    const alice = await provision('alice');
    const bob = await provision('bob');

    const me = await api().get('/api/v1/user/me').set('authorization', alice.bearer).expect(200);
    expect(me.body.data).toMatchObject({ id: alice.id, status: 'ACTIVE' });
    expect(me.body.data).not.toHaveProperty('authSubject');

    const onboard = await api()
      .post('/api/v1/user/organizations')
      .set('authorization', alice.bearer)
      .send({ name: 'Alice Co' })
      .expect(201);
    const workspaceId = onboard.body.data.workspace.id;

    const created = await api()
      .post('/api/v1/user/projects')
      .set('authorization', alice.bearer)
      .send({ workspaceId, name: 'Main Site' })
      .expect(201);
    const projectId = created.body.data.id;

    await api().get(`/api/v1/user/projects/${projectId}`).set('authorization', alice.bearer).expect(200);
    const denied = await api().get(`/api/v1/user/projects/${projectId}`).set('authorization', bob.bearer).expect(403);
    expect(denied.body).toEqual({ data: null, meta: {}, error: { code: 'PERMISSION_DENIED', message: expect.any(String) } });

    const bobList = await api().get('/api/v1/user/projects').set('authorization', bob.bearer).expect(200);
    expect(bobList.body.data).toEqual([]);

    await api().get('/api/v1/user/projects/not-a-uuid').set('authorization', alice.bearer).expect(400);
    const extra = await api()
      .post('/api/v1/user/projects')
      .set('authorization', alice.bearer)
      .send({ workspaceId, name: 'x', organizationId: workspaceId })
      .expect(400);
    expect(extra.body.error.code).toBe('VALIDATION_FAILED');

    const withDomain = await api()
      .post('/api/v1/user/projects')
      .set('authorization', alice.bearer)
      .send({ workspaceId, name: 'Shop', domain: 'https://www.Shop.Example.com/home', primaryGoal: 'GEO' })
      .expect(201);
    expect(withDomain.body.data).toMatchObject({ name: 'Shop', primaryGoal: 'GEO', primaryDomain: 'shop.example.com' });
    const listed = await api().get('/api/v1/user/projects').set('authorization', alice.bearer).expect(200);
    expect(listed.body.data.find((p: { id: string }) => p.id === withDomain.body.data.id).primaryDomain).toBe('shop.example.com');

    const badDomain = await api()
      .post('/api/v1/user/projects')
      .set('authorization', alice.bearer)
      .send({ workspaceId, name: 'Bad', domain: 'not a domain' })
      .expect(400);
    expect(badDomain.body.error.code).toBe('INVALID_DOMAIN');
    await api()
      .post('/api/v1/user/projects')
      .set('authorization', alice.bearer)
      .send({ workspaceId, name: 'Bad goal', primaryGoal: 'EVERYTHING' })
      .expect(400);
  });

  it('admin routes require global permissions', async () => {
    const regular = await provision('regular');
    await api().get('/api/v1/admin/users').set('authorization', regular.bearer).expect(403);

    const admin = await provision('admin');
    await grantGlobal(prisma, admin.id, 'SUPER_ADMIN');
    const users = await api().get('/api/v1/admin/users?limit=5').set('authorization', admin.bearer).expect(200);
    expect(users.body.data.length).toBeLessThanOrEqual(5);
    const logs = await api().get('/api/v1/admin/audit-logs').set('authorization', admin.bearer).expect(200);
    expect(Array.isArray(logs.body.data)).toBe(true);
  });
});
