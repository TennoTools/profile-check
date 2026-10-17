/** Entry point: local-only API server. */

import process from 'node:process';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = buildApp();

try {
  await app.listen({ host: config.host, port: config.port });
  console.log(`TennoTools API ready on http://${config.host}:${config.port} (local only)`);
  console.log(
    `  Dev GUI: vite on http://localhost:5173 · Prod GUI: http://${config.host}:${config.port} (after npm run build)`,
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const SHUTDOWN_TIMEOUT_MS = 5_000;

let closing = false;
const shutdown = async (): Promise<void> => {
  if (closing) return;
  closing = true;
  // Never hang forever (a browser can hold an SSE stream open): cap the close.
  // The WAL checkpoint runs in the onClose hook whenever it wins the race.
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((done) => setTimeout(done, SHUTDOWN_TIMEOUT_MS)),
  ]);
  process.exit(0);
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown();
  });
}
