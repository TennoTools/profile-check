/** Fastify app: runs API + SSE, settings, Get-ID jobs, optional static web build. */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import fastifyStatic from '@fastify/static';
import {
  type CheckEvent,
  DEFAULT_PLATFORM,
  type GetIdEvent,
  isPlatform,
  runRequestSchema,
  type SettingsView,
  settingsUpdateSchema,
} from '@tennotools/profile-check-core';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig } from './config';
import { openDb, RunsStore, SettingsStore } from './db';
import { startCheck } from './jobs/check';
import { type DiscoverJobHandle, GetIdJob } from './jobs/get-id';
import { EventBus } from './run-bus';

export interface BuildAppOptions {
  dbPath?: string;
  serveWeb?: boolean;
  logger?: boolean;
  fetchImpl?: typeof fetch;
  /** Override the .env bootstrap values (tests use `{}`). */
  dotEnv?: Record<string, string>;
}

const TERMINAL_GET_ID_STATES: ReadonlySet<GetIdEvent['state']> = new Set(['found', 'closed', 'cancelled', 'error']);

const writeSseHead = (raw: ServerResponse): void => {
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
};

const writeSseEvent = (raw: ServerResponse, event: string, data: unknown): void => {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = loadConfig();
  const db = openDb(options.dbPath ?? config.dbPath);
  const settings = new SettingsStore(db);
  settings.seedFromEnv(options.dotEnv ?? config.dotEnv);
  const runs = new RunsStore(db);
  const runBus = new EventBus<CheckEvent>();
  const getIdBus = new EventBus<GetIdEvent>();

  const app = Fastify({ logger: options.logger ?? true });

  let activeGetIdJob: DiscoverJobHandle | undefined;

  const settingsView = (): SettingsView => {
    const platform = settings.get('default_platform');
    const key = settings.get('scraperapi_key');
    return {
      defaultPlatform: platform && isPlatform(platform) ? platform : DEFAULT_PLATFORM,
      defaultAccountId: settings.get('default_account_id') ?? null,
      defaultUseProxy: settings.getBool('default_use_proxy', false),
      timeoutMs: settings.getNumber('timeout_ms', 30_000),
      hasScraperApiKey: Boolean(key),
      scraperApiKeyMask: key ? `••••${key.slice(-4)}` : null,
    };
  };

  app.get('/api/health', () => ({ ok: true, version: '2.0.0' }));

  // --- Runs ---

  app.post('/api/runs', (request, reply) => {
    const parsed = runRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid run request', details: parsed.error.issues });
    }
    const id = randomUUID();
    runs.create(id, parsed.data);
    void startCheck(id, parsed.data, { runs, settings, bus: runBus, fetchImpl: options.fetchImpl });
    return reply.code(202).send({ id });
  });

  app.get('/api/runs', (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return runs.list(limit, offset);
  });

  app.get('/api/runs/:id', (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  app.get('/api/runs/:id/events', (request, reply) => {
    const { id } = request.params as { id: string };
    if (!runs.get(id)) return reply.code(404).send({ error: 'Run not found' });
    reply.hijack();
    writeSseHead(reply.raw);
    let unsubscribe: () => void = () => {};
    unsubscribe = runBus.subscribe(id, (event) => {
      writeSseEvent(reply.raw, event.event, event.data);
      if (event.event !== 'progress') {
        unsubscribe();
        setTimeout(() => reply.raw.end(), 10);
      }
    });
    request.raw.on('close', unsubscribe);
  });

  // --- Settings ---

  app.get('/api/settings', () => settingsView());

  app.put('/api/settings', (request, reply) => {
    const parsed = settingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid settings update', details: parsed.error.issues });
    }
    const update = parsed.data;
    if (update.defaultPlatform !== undefined) settings.set('default_platform', update.defaultPlatform);
    if (update.defaultAccountId !== undefined) {
      if (update.defaultAccountId === null) settings.delete('default_account_id');
      else settings.set('default_account_id', update.defaultAccountId.toLowerCase());
    }
    if (update.defaultUseProxy !== undefined) settings.set('default_use_proxy', update.defaultUseProxy ? '1' : '0');
    if (update.timeoutMs !== undefined) settings.set('timeout_ms', String(update.timeoutMs));
    if (update.scraperApiKey !== undefined) {
      const hadKey = Boolean(settings.get('scraperapi_key'));
      if (update.scraperApiKey === null) {
        settings.delete('scraperapi_key');
        // Clearing the key also turns off the proxy default (unless explicitly overridden).
        if (update.defaultUseProxy === undefined) settings.set('default_use_proxy', '0');
      } else {
        settings.set('scraperapi_key', update.scraperApiKey.trim());
        // First key saved: route through ScraperAPI by default (unless explicitly overridden).
        if (!hadKey && update.defaultUseProxy === undefined) settings.set('default_use_proxy', '1');
      }
    }
    return settingsView();
  });

  // --- Get-ID (Playwright, local browser on the user's desktop) ---

  app.post('/api/account-id/discover', (_request, reply) => {
    if (activeGetIdJob) return reply.code(409).send({ error: 'A discover job is already running' });
    const job = new GetIdJob({
      bus: getIdBus,
      jobId: randomUUID(),
      extensionPath: config.extensionPath,
    });
    activeGetIdJob = job;
    void job.run().finally(() => {
      if (activeGetIdJob === job) activeGetIdJob = undefined;
    });
    return reply.code(202).send({ jobId: job.jobId });
  });

  app.get('/api/account-id/discover/events', (request, reply) => {
    const { jobId } = request.query as { jobId?: string };
    if (!jobId) return reply.code(400).send({ error: 'jobId query param required' });
    reply.hijack();
    writeSseHead(reply.raw);
    let unsubscribe: () => void = () => {};
    unsubscribe = getIdBus.subscribe(jobId, (event) => {
      writeSseEvent(reply.raw, 'status', event);
      if (TERMINAL_GET_ID_STATES.has(event.state)) {
        unsubscribe();
        setTimeout(() => reply.raw.end(), 10);
      }
    });
    request.raw.on('close', unsubscribe);
  });

  app.post('/api/account-id/discover/cancel', (_request, reply) => {
    if (!activeGetIdJob) return reply.code(404).send({ error: 'No discover job running' });
    activeGetIdJob.cancel();
    return reply.code(204).send();
  });

  // --- Static web build (production mode) ---

  if ((options.serveWeb ?? true) && existsSync(config.webDistPath)) {
    app.register(fastifyStatic, { root: config.webDistPath });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api')) return reply.code(404).send({ error: 'Not found' });
      return reply.sendFile('index.html');
    });
  }

  app.addHook('onClose', async () => {
    activeGetIdJob?.cancel();
    db.close();
  });

  return app;
}
