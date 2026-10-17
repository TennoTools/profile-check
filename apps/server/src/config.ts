/** Startup configuration: local-only server, SQLite path, .env bootstrap values. */

import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readDotEnv } from './dotenv';

/** Repo root: this file lives in apps/server/src (or dist) → up 3 levels. */
export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

export interface ServerConfig {
  host: string;
  port: number;
  dbPath: string;
  webDistPath: string;
  extensionPath: string;
  /** Values read once from the repo-root .env (bootstrap only — settings DB wins afterwards). */
  dotEnv: Record<string, string>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const dotEnv = readDotEnv(join(REPO_ROOT, '.env'));
  return {
    host: env.TENNOTOOLS_HOST ?? '127.0.0.1',
    port: Number(env.TENNOTOOLS_PORT ?? env.PORT ?? '') || 8787,
    dbPath: env.TENNOTOOLS_DB_PATH ?? join(REPO_ROOT, 'data', 'app.sqlite'),
    webDistPath: join(REPO_ROOT, 'apps', 'web', 'dist'),
    extensionPath: join(REPO_ROOT, 'apps', 'server', 'assets', 'extension'),
    dotEnv,
  };
}
