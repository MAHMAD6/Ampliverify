import { startApp } from './app-harness';

describe('Rate limiting', () => {
  let h: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    h = await startApp({ RATE_LIMIT_PER_MINUTE: '5' });
  });

  afterAll(async () => {
    await h?.close();
  });

  it('limits each user separately and leaves anonymous public reads alone', async () => {
    const a = await h.provision('rl-a');
    const b = await h.provision('rl-b');
    for (let i = 0; i < 5; i++) await h.api().get('/api/v1/user/me').set('authorization', a.bearer).expect(200);
    const limited = await h.api().get('/api/v1/user/me').set('authorization', a.bearer).expect(429);
    expect(limited.body.error).toBeTruthy();
    // Another user has their own budget.
    await h.api().get('/api/v1/user/me').set('authorization', b.bearer).expect(200);
    // Public content reads are not limited.
    for (let i = 0; i < 8; i++) await h.api().get('/api/v1/public/plans').expect(200);
  });
});
