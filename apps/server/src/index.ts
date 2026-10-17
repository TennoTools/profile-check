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

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
