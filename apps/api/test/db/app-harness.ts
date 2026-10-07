import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { exportJWK, generateKeyPair, JWK, SignJWT } from 'jose';
import request from 'supertest';
import { configureApp } from '../../src/configure-app';
import { JobsService } from '../../src/jobs/jobs.service';
import { createPrisma, testDatabaseUrl, uniq } from './helpers';

const ISSUER = 'http://auth.test';
const AUDIENCE = 'ampliverify-api';
export const SYNC_SECRET = 's'.repeat(40);

export type TestUser = { id: string; authSubject: string; bearer: string };

/**
 * Boots the full Nest app against the test database with a local JWKS
 * server, the in-process job worker disabled (tests drain queues) and
 * private hosts allowed so audits can crawl a local fixture site.
 */
export async function startApp(env: Record<string, string> = {}) {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256', use: 'sig' };
  const jwksServer = createServer((_req, res) => {
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
    JOBS_WORKER: 'off',
    AUDIT_ALLOW_PRIVATE_HOSTS: 'true',
    EMAIL_LOG_ONLY: 'true',
    ...env,
  });

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app, app.get(ConfigService));
  await app.init();
  const prisma: PrismaClient = createPrisma();
  const jobs = app.get(JobsService);

  const api = () => request(app.getHttpServer());

  const token = (sub: string) =>
    new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject(sub).setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().setExpirationTime('10m').sign(pair.privateKey);

  async function provision(label: string): Promise<TestUser> {
    const authSubject = `auth|${uniq(label)}`;
    const res = await api()
      .post('/api/v1/internal/auth/users/sync')
      .set('x-auth-sync-secret', SYNC_SECRET)
      .send({ authSubject, email: `${uniq(label)}@example.test`, displayName: label })
      .expect(200);
    return { authSubject, id: res.body.data.id, bearer: `Bearer ${await token(authSubject)}` };
  }

  /** User + organization + workspace (+ optional project). */
  async function onboard(label: string, project?: { name?: string; domain?: string }) {
    const user = await provision(label);
    const org = await api().post('/api/v1/user/organizations').set('authorization', user.bearer).send({ name: `${label} Co` }).expect(201);
    const workspaceId: string = org.body.data.workspace.id;
    const organizationId: string = org.body.data.organization.id;
    let projectId: string | null = null;
    if (project) {
      const p = await api()
        .post('/api/v1/user/projects')
        .set('authorization', user.bearer)
        .send({ workspaceId, name: project.name ?? `${label} site`, domain: project.domain })
        .expect(201);
      projectId = p.body.data.id;
    }
    return { user, workspaceId, organizationId, projectId: projectId as string };
  }

  async function close() {
    await app.close();
    await prisma.$disconnect();
    await new Promise((resolve) => jwksServer.close(resolve));
  }

  return { app, api, prisma, jobs, provision, onboard, token, close };
}

/** Small HTTP server whose routes can be swapped during a test. */
export async function startSite(routes: Record<string, { status?: number; body: string; type?: string; headers?: Record<string, string> }>) {
  const server: Server = createServer((req, res) => {
    const route = routes[req.url ?? '/'];
    if (!route) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.statusCode = route.status ?? 200;
    res.setHeader('content-type', route.type ?? 'text/html; charset=utf-8');
    for (const [k, v] of Object.entries(route.headers ?? {})) res.setHeader(k, v);
    res.end(req.method === 'HEAD' ? undefined : route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    routes,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
