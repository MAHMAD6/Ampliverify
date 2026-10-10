import { createHmac } from 'crypto';
import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { startApp } from './app-harness';

type Received = { headers: IncomingMessage['headers']; body: string };

describe('CMS connectors', () => {
  let h: Awaited<ReturnType<typeof startApp>>;
  let server: Server;
  let endpoint: string;
  const received: Received[] = [];

  beforeAll(async () => {
    h = await startApp({ INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(40) });
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ id: 'remote-42', url: 'https://cms.example.test/posts/guide' }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hooks/ampliverify`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await h?.close();
  });

  it('connects a signed webhook endpoint and publishes editor documents to it, updating on republish', async () => {
    const { user, workspaceId, projectId } = await h.onboard('cms-hook', { domain: 'example.test' });
    const auth = { authorization: user.bearer };
    const conn = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/webhook`).set(auth).send({ url: endpoint }).expect(201);
    const { id: integrationId, signingSecret } = conn.body.data;
    expect(signingSecret).toMatch(/^whsec_/);
    expect(JSON.parse(received[0].body).event).toBe('ping');

    // The secret is never listed again.
    const list = await h.api().get(`/api/v1/user/workspaces/${workspaceId}/integrations`).set(auth).expect(200);
    expect(JSON.stringify(list.body.data)).not.toContain(signingSecret);

    const doc = await h.api().post(`/api/v1/user/projects/${projectId}/editor/documents`).set(auth).send({ title: 'Guide', content: { html: '<h1>Guide</h1><p>Hello</p>', title: 'Guide', metaDescription: 'A guide', slug: 'guide' } }).expect(201);
    const pub = await h.api().post(`/api/v1/user/editor/documents/${doc.body.data.id}/publish`).set(auth).send({ integrationId, status: 'publish', type: 'posts' }).expect(201);
    expect(pub.body.data).toMatchObject({ remoteId: 'remote-42', link: 'https://cms.example.test/posts/guide', status: 'published' });

    const hook = received[received.length - 1];
    const payload = JSON.parse(hook.body);
    expect(payload.event).toBe('document.publish');
    expect(payload.data.document).toMatchObject({ id: doc.body.data.id, title: 'Guide', slug: 'guide' });
    expect(payload.data.remoteId).toBeNull();
    // Signature verifies with the secret given at connection time.
    const [t, v1] = String(hook.headers['x-ampliverify-signature']).split(',').map((p) => p.split('=')[1]);
    expect(v1).toBe(createHmac('sha256', signingSecret).update(`${t}.${hook.body}`).digest('hex'));

    await h.api().post(`/api/v1/user/editor/documents/${doc.body.data.id}/publish`).set(auth).send({ integrationId, status: 'publish', type: 'posts' }).expect(201);
    expect(JSON.parse(received[received.length - 1].body).data.remoteId).toBe('remote-42');

    const editorDoc = await h.prisma.editorDocument.findUniqueOrThrow({ where: { id: doc.body.data.id } });
    expect(editorDoc.status).toBe('PUBLISHED');
  });

  it('only sends Shopify tokens to myshopify.com hosts', async () => {
    const { user, workspaceId } = await h.onboard('cms-shop');
    const res = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/shopify`).set({ authorization: user.bearer }).send({ shopDomain: 'evil.example.com', accessToken: 'shpat_0123456789' }).expect(400);
    expect(res.body.error.code).toBe('SHOPIFY_DOMAIN_INVALID');
  });

  it('rejects malformed Webflow collection ids before calling Webflow', async () => {
    const { user, workspaceId } = await h.onboard('cms-wf');
    const res = await h.api().post(`/api/v1/user/workspaces/${workspaceId}/integrations/webflow`).set({ authorization: user.bearer }).send({ apiToken: 'token-0123456789', collectionId: 'not-a-collection' }).expect(400);
    expect(res.body.error.code).toBe('WEBFLOW_COLLECTION_INVALID');
  });
});
