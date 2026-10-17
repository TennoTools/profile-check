import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { type BuildAppOptions, buildApp } from '../src/app';

const ACCOUNT_ID = '505875fb1a4d80894a000000';

let apps: FastifyInstance[] = [];

const makeApp = (options: Partial<BuildAppOptions> = {}): FastifyInstance => {
  const app = buildApp({ dbPath: ':memory:', serveWeb: false, logger: false, dotEnv: {}, ...options });
  apps.push(app);
  return app;
};

const waitForRun = async (app: FastifyInstance, id: string) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await app.inject({ method: 'GET', url: `/api/runs/${id}` });
    const run = response.json();
    if (run.state === 'done' || run.state === 'failed') return run;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('run did not finish in time');
};

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

describe('settings API', () => {
  it('returns defaults on a fresh DB', async () => {
    const app = makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      defaultPlatform: 'pc',
      defaultAccountId: null,
      defaultUseProxy: false,
      timeoutMs: 30_000,
      hasScraperApiKey: false,
      scraperApiKeyMask: null,
    });
  });

  it('stores the key masked and never echoes it', async () => {
    const app = makeApp();
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { scraperApiKey: 'abcd1234secret', defaultPlatform: 'ps4', defaultUseProxy: true },
    });
    expect(put.statusCode).toBe(200);
    const view = put.json();
    expect(view.hasScraperApiKey).toBe(true);
    expect(view.scraperApiKeyMask).toBe('••••cret');
    expect(JSON.stringify(view)).not.toContain('abcd1234secret');
    expect(view.defaultPlatform).toBe('ps4');
    expect(view.defaultUseProxy).toBe(true);

    const cleared = await app.inject({ method: 'PUT', url: '/api/settings', payload: { scraperApiKey: null } });
    expect(cleared.json().hasScraperApiKey).toBe(false);
  });

  it('turns on "use ScraperAPI by default" with the first key, off again when cleared', async () => {
    const app = makeApp();
    const put = await app.inject({ method: 'PUT', url: '/api/settings', payload: { scraperApiKey: 'first-key' } });
    expect(put.json().defaultUseProxy).toBe(true);

    const cleared = await app.inject({ method: 'PUT', url: '/api/settings', payload: { scraperApiKey: null } });
    expect(cleared.json().defaultUseProxy).toBe(false);
  });

  it('respects an explicit defaultUseProxy when saving the key', async () => {
    const app = makeApp();
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { scraperApiKey: 'first-key', defaultUseProxy: false },
    });
    expect(put.json().defaultUseProxy).toBe(false);
  });

  it('rejects unknown fields and out-of-range values', async () => {
    const app = makeApp();
    expect((await app.inject({ method: 'PUT', url: '/api/settings', payload: { nope: 1 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/api/settings', payload: { timeoutMs: 10 } })).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject({ method: 'PUT', url: '/api/settings', payload: { defaultAccountId: 'nope' } })).statusCode,
    ).toBe(400);
  });

  it('seeds missing keys from the .env bootstrap without overwriting', async () => {
    const app = makeApp({ dotEnv: { SCRAPERAPI_KEY: 'from-env', WARFRAME_ACCOUNT_ID: ACCOUNT_ID } });
    const view = (await app.inject({ method: 'GET', url: '/api/settings' })).json();
    expect(view.hasScraperApiKey).toBe(true);
    expect(view.defaultAccountId).toBe(ACCOUNT_ID);

    await app.inject({ method: 'PUT', url: '/api/settings', payload: { scraperApiKey: 'new-key' } });
    const view2 = (await app.inject({ method: 'GET', url: '/api/settings' })).json();
    expect(view2.scraperApiKeyMask).toBe('••••-key');
  });
});

describe('runs API', () => {
  it('rejects invalid run requests', async () => {
    const app = makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { platform: 'switch', accountId: 'nope' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().details.length).toBeGreaterThan(0);
  });

  it('persists a failing fetch run and lists it', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: 'nope' }), { status: 404 })) as typeof fetch;
    const app = makeApp({ fetchImpl });

    const post = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { platform: 'pc', accountId: ACCOUNT_ID },
    });
    expect(post.statusCode).toBe(202);
    const { id } = post.json();

    const run = await waitForRun(app, id);
    expect(run.state).toBe('failed');
    expect(run.error.type).toBe('fetch');
    expect(run.error.message).toContain('No profile found');

    const list = (await app.inject({ method: 'GET', url: '/api/runs' })).json();
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ id, state: 'failed', accountId: ACCOUNT_ID, platform: 'pc' });
  });

  it('returns 404 for unknown runs', async () => {
    const app = makeApp();
    expect((await app.inject({ method: 'GET', url: '/api/runs/does-not-exist' })).statusCode).toBe(404);
  });

  it('replays terminal events over SSE for a finished run', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: 'nope' }), { status: 500 })) as typeof fetch;
    const app = makeApp({ fetchImpl });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    const base = `http://127.0.0.1:${address.port}`;

    const post = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { platform: 'pc', accountId: ACCOUNT_ID },
    });
    const { id } = post.json();
    await waitForRun(app, id);

    const controller = new AbortController();
    const response = await fetch(`${base}/api/runs/${id}/events`, { signal: controller.signal });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('no body');
    const decoder = new TextDecoder();
    let text = '';
    while (!text.includes('event: error')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    controller.abort();
    expect(text).toContain('event: error');
    expect(text).toContain('profile viewing is disabled');
  });
});
