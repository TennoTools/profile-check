import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const tempDirs: string[] = [];

const makeTempDbPath = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'profile-check-db-'));
  tempDirs.push(dir);
  return join(dir, 'app.sqlite');
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('database shutdown', () => {
  it('checkpoints the WAL on close so the file is left self-contained', async () => {
    const dbPath = makeTempDbPath();
    const app = buildApp({ dbPath, serveWeb: false, logger: false, dotEnv: {} });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { timeoutMs: 12_345 },
    });
    expect(response.statusCode).toBe(200);
    expect(existsSync(`${dbPath}-wal`)).toBe(true);

    await app.close();

    expect(existsSync(`${dbPath}-wal`)).toBe(false);
    expect(existsSync(`${dbPath}-shm`)).toBe(false);
  });
});
